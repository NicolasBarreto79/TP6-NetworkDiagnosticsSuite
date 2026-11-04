/**
 * Real UDP SNMP v1/v2c Agent & Client using `node:dgram` and `@network-suite/contracts`.
 * Exchanges genuine ASN.1 BER binary datagrams over UDP sockets to validate RF-01 and RF-02.
 */

import dgram from 'node:dgram';
import {
  BerTag,
  buildSnmpGetRequestPacket,
  buildSnmpGetResponsePacket,
  DEFAULT_DIAGNOSTIC_OIDS,
  macStringToBytes,
  mapSnmpResponseToTelemetry,
  MIB2_OIDS,
  parseSnmpPacket,
  type SnmpTelemetrySnapshot,
  type SnmpVarBind,
} from '@network-suite/contracts';
import { findSimulatedDeviceByIp } from './datasheetsStore.js';

export interface RunningSnmpUdpAgent {
  socket: dgram.Socket;
  port: number;
  close: () => Promise<void>;
}

const agentBootTimeMs = Date.now();

/**
 * Starts a real UDP SNMP v1/v2c Agent listening for binary ASN.1 BER GetRequest PDUs (0xA0).
 */
export async function startSnmpUdpAgent(port = 1610): Promise<RunningSnmpUdpAgent> {
  const socket = dgram.createSocket('udp4');

  socket.on('message', (msg, rinfo) => {
    try {
      const requestBytes = new Uint8Array(msg.buffer, msg.byteOffset, msg.byteLength);
      const parsed = parseSnmpPacket(requestBytes);

      if (parsed.pduType !== BerTag.GET_REQUEST_PDU) {
        return;
      }

      // Support optional community routing suffix "public@192.168.1.20" so a single local UDP socket
      // can emulate all 4 LAN telecom devices with real binary UDP traffic.
      const [cleanCommunity, routedIp] = parsed.community.split('@');
      const targetIp = routedIp || '192.168.1.1';
      const sim = findSimulatedDeviceByIp(targetIp);

      const elapsedSeconds = Math.max(1, Math.floor((Date.now() - agentBootTimeMs) / 1000));
      const dynamicUpTimeTicks = sim.baseUpTimeTicks + elapsedSeconds * 100;
      const dynamicInOctets = sim.baseInOctets + elapsedSeconds * 14520;
      const dynamicOutOctets = sim.baseOutOctets + elapsedSeconds * 8340;

      const responseVarBinds: SnmpVarBind[] = parsed.varBinds.map((reqVb) => {
        switch (reqVb.oid) {
          case MIB2_OIDS.sysName:
            return {
              oid: reqVb.oid,
              typeTag: BerTag.OCTET_STRING,
              value: sim.device.hostname,
            };
          case MIB2_OIDS.sysDescr:
            return {
              oid: reqVb.oid,
              typeTag: BerTag.OCTET_STRING,
              value: sim.sysDescr,
            };
          case MIB2_OIDS.sysUpTime:
            return {
              oid: reqVb.oid,
              typeTag: BerTag.TIMETICKS,
              value: dynamicUpTimeTicks,
            };
          case MIB2_OIDS.sysLocation:
            return {
              oid: reqVb.oid,
              typeTag: BerTag.OCTET_STRING,
              value: sim.sysLocation,
            };
          case MIB2_OIDS.ifDescr1:
            return {
              oid: reqVb.oid,
              typeTag: BerTag.OCTET_STRING,
              value: sim.ifDescr1,
            };
          case MIB2_OIDS.ifPhysAddress1:
            return {
              oid: reqVb.oid,
              typeTag: BerTag.OCTET_STRING,
              value: '',
              rawBytes: macStringToBytes(sim.device.macAddress),
            };
          case MIB2_OIDS.ifOperStatus1:
            return {
              oid: reqVb.oid,
              typeTag: BerTag.INTEGER,
              value: 1, // 1 = UP
            };
          case MIB2_OIDS.ifInOctets1:
            return {
              oid: reqVb.oid,
              typeTag: BerTag.COUNTER32,
              value: dynamicInOctets,
            };
          case MIB2_OIDS.ifOutOctets1:
            return {
              oid: reqVb.oid,
              typeTag: BerTag.COUNTER32,
              value: dynamicOutOctets,
            };
          default:
            return {
              oid: reqVb.oid,
              typeTag: BerTag.OCTET_STRING,
              value: `${sim.device.vendor} ${sim.device.model}`,
            };
        }
      });

      const responsePacket = buildSnmpGetResponsePacket({
        community: cleanCommunity || 'public',
        requestId: parsed.requestId,
        version: parsed.version,
        varBinds: responseVarBinds,
      });

      socket.send(responsePacket.buffer, rinfo.port, rinfo.address);
    } catch {
      // Ignore malformed UDP datagrams on the wire
    }
  });

  await new Promise<void>((resolve, reject) => {
    socket.once('error', reject);
    socket.bind(port, '127.0.0.1', () => {
      socket.removeListener('error', reject);
      resolve();
    });
  });

  const address = socket.address();
  const boundPort = typeof address === 'object' ? address.port : port;

  return {
    socket,
    port: boundPort,
    close: () =>
      new Promise<void>((resolve) => {
        socket.close(() => resolve());
      }),
  };
}

/**
 * Sends a real binary SNMP GetRequest over UDP to the SNMP Agent and parses the binary GetResponse.
 */
export async function executeRealUdpSnmpQuery(params: {
  agentPort: number;
  targetDeviceIp: string;
  community?: string;
  oids?: string[];
  timeoutMs?: number;
}): Promise<SnmpTelemetrySnapshot> {
  const community = params.community ?? 'public';
  const oids = params.oids && params.oids.length > 0 ? params.oids : DEFAULT_DIAGNOSTIC_OIDS;
  const timeoutMs = params.timeoutMs ?? 1500;

  const clientSocket = dgram.createSocket('udp4');
  const startTime = performance.now();

  const wireCommunity = `${community}@${params.targetDeviceIp}`;
  const reqPacket = buildSnmpGetRequestPacket({
    community: wireCommunity,
    oids,
    version: 'v2c',
  });

  // Also compute clean display request hex (without routing tag) for protocol inspector clarity
  const displayReqPacket = buildSnmpGetRequestPacket({
    community,
    oids,
    requestId: reqPacket.requestId,
    version: 'v2c',
  });

  try {
    const responseBuffer = await new Promise<Uint8Array>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`SNMP UDP timeout after ${timeoutMs}ms querying ${params.targetDeviceIp}`));
      }, timeoutMs);

      clientSocket.once('message', (msg) => {
        clearTimeout(timer);
        resolve(new Uint8Array(msg.buffer, msg.byteOffset, msg.byteLength));
      });

      clientSocket.once('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });

      clientSocket.send(reqPacket.buffer, params.agentPort, '127.0.0.1');
    });

    const roundTripMs = Math.max(1, Math.round(performance.now() - startTime));
    const parsedResponse = parseSnmpPacket(responseBuffer);

    return mapSnmpResponseToTelemetry({
      targetIp: params.targetDeviceIp,
      port: 161,
      roundTripMs,
      rawRequestHex: displayReqPacket.rawHex,
      parsedResponse,
    });
  } finally {
    clientSocket.close();
  }
}

