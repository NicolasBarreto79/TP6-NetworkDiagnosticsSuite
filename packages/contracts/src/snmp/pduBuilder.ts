/**
 * SNMP v1/v2c PDU Builder and Parser (GetRequest 0xA0 & GetResponse 0xA2).
 * Implements RFC 1157 / RFC 1905 message structure:
 * Message ::= SEQUENCE {
 *   version INTEGER { version-1(0), version-2c(1) },
 *   community OCTET STRING,
 *   data ANY -- GetRequest-PDU (0xA0) or GetResponse-PDU (0xA2)
 * }
 * PDU ::= [0xA0|0xA2] IMPLICIT SEQUENCE {
 *   request-id INTEGER,
 *   error-status INTEGER,
 *   error-index INTEGER,
 *   variable-bindings SEQUENCE OF VarBind
 * }
 */

import {
  BerTag,
  bytesToHex,
  concatBytes,
  decodeBerIntegerValue,
  decodeBerOctetStringValue,
  decodeBerOidValue,
  decodeBerSequenceChildren,
  decodeBerTlv,
  encodeBerInteger,
  encodeBerNull,
  encodeBerOctetString,
  encodeBerOid,
  encodeBerRawOctetString,
  encodeBerTlv,
  encodeBerUnsigned32,
  formatMacBytes,
} from './berCodec.js';
import { formatSnmpTimeTicks, MIB2_OIDS } from './mib2Catalog.js';
import type { SnmpTelemetrySnapshot } from '../models.js';

export type SnmpVersionNumber = 0 | 1; // 0 = v1, 1 = v2c

export interface SnmpVarBind {
  oid: string;
  typeTag: number;
  value: string | number;
  rawBytes?: Uint8Array;
}

export interface SnmpParsedPacket {
  version: 'v1' | 'v2c';
  community: string;
  pduType: number;
  requestId: number;
  errorStatus: number;
  errorIndex: number;
  varBinds: SnmpVarBind[];
  rawHex: string;
}

/**
 * Builds a binary SNMP v1/v2c GetRequest packet (Uint8Array) ready to be sent over UDP/161.
 */
export function buildSnmpGetRequestPacket(params: {
  community: string;
  oids: string[];
  requestId?: number;
  version?: 'v1' | 'v2c';
}): { buffer: Uint8Array; requestId: number; rawHex: string } {
  const versionNum: SnmpVersionNumber = params.version === 'v1' ? 0 : 1;
  const requestId = params.requestId ?? Math.floor(100000 + Math.random() * 899999);

  // Encode Variable Bindings: each is SEQUENCE { OID, NULL }
  const varBindItems = params.oids.map((oid) => {
    const oidBytes = encodeBerOid(oid);
    const nullBytes = encodeBerNull();
    return encodeBerTlv(BerTag.SEQUENCE, concatBytes([oidBytes, nullBytes]));
  });

  const varBindListBytes = encodeBerTlv(BerTag.SEQUENCE, concatBytes(varBindItems));

  // Encode PDU header fields
  const reqIdBytes = encodeBerInteger(requestId);
  const errorStatusBytes = encodeBerInteger(0);
  const errorIndexBytes = encodeBerInteger(0);

  const pduBytes = encodeBerTlv(
    BerTag.GET_REQUEST_PDU,
    concatBytes([reqIdBytes, errorStatusBytes, errorIndexBytes, varBindListBytes])
  );

  const versionBytes = encodeBerInteger(versionNum);
  const communityBytes = encodeBerOctetString(params.community);

  const messageBytes = encodeBerTlv(
    BerTag.SEQUENCE,
    concatBytes([versionBytes, communityBytes, pduBytes])
  );

  return {
    buffer: messageBytes,
    requestId,
    rawHex: bytesToHex(messageBytes),
  };
}

/**
 * Builds a binary SNMP v1/v2c GetResponse packet (Uint8Array) used by the real UDP SNMP Agent.
 */
export function buildSnmpGetResponsePacket(params: {
  community: string;
  requestId: number;
  version?: 'v1' | 'v2c';
  errorStatus?: number;
  errorIndex?: number;
  varBinds: SnmpVarBind[];
}): { buffer: Uint8Array; rawHex: string } {
  const versionNum: SnmpVersionNumber = params.version === 'v1' ? 0 : 1;

  const encodedVarBinds = params.varBinds.map((vb) => {
    const oidBytes = encodeBerOid(vb.oid);
    let valBytes: Uint8Array;

    switch (vb.typeTag) {
      case BerTag.INTEGER:
        valBytes = encodeBerInteger(Number(vb.value), BerTag.INTEGER);
        break;
      case BerTag.COUNTER32:
      case BerTag.GAUGE32:
      case BerTag.TIMETICKS:
        valBytes = encodeBerUnsigned32(Number(vb.value), vb.typeTag);
        break;
      case BerTag.OBJECT_IDENTIFIER:
        valBytes = encodeBerOid(String(vb.value));
        break;
      case BerTag.OCTET_STRING:
        if (vb.rawBytes) {
          valBytes = encodeBerRawOctetString(vb.rawBytes);
        } else {
          valBytes = encodeBerOctetString(String(vb.value));
        }
        break;
      default:
        valBytes = encodeBerNull();
        break;
    }

    return encodeBerTlv(BerTag.SEQUENCE, concatBytes([oidBytes, valBytes]));
  });

  const varBindListBytes = encodeBerTlv(BerTag.SEQUENCE, concatBytes(encodedVarBinds));
  const reqIdBytes = encodeBerInteger(params.requestId);
  const errorStatusBytes = encodeBerInteger(params.errorStatus ?? 0);
  const errorIndexBytes = encodeBerInteger(params.errorIndex ?? 0);

  const pduBytes = encodeBerTlv(
    BerTag.GET_RESPONSE_PDU,
    concatBytes([reqIdBytes, errorStatusBytes, errorIndexBytes, varBindListBytes])
  );

  const versionBytes = encodeBerInteger(versionNum);
  const communityBytes = encodeBerOctetString(params.community);

  const buffer = encodeBerTlv(
    BerTag.SEQUENCE,
    concatBytes([versionBytes, communityBytes, pduBytes])
  );

  return {
    buffer,
    rawHex: bytesToHex(buffer),
  };
}

/**
 * Decodes a binary SNMP v1/v2c packet (GetRequest or GetResponse) from a raw UDP Uint8Array.
 */
export function parseSnmpPacket(buffer: Uint8Array): SnmpParsedPacket {
  const outer = decodeBerTlv(buffer, 0);
  if (outer.tag !== BerTag.SEQUENCE) {
    throw new Error(`Invalid SNMP packet outer tag: 0x${outer.tag.toString(16)}`);
  }

  const topNodes = decodeBerSequenceChildren(outer.valueBytes);
  if (topNodes.length < 3) {
    throw new Error('Malformed SNMP message: expected version, community, and PDU');
  }

  const versionInt = decodeBerIntegerValue(topNodes[0].valueBytes);
  const version: 'v1' | 'v2c' = versionInt === 0 ? 'v1' : 'v2c';
  const community = decodeBerOctetStringValue(topNodes[1].valueBytes);

  const pduNode = topNodes[2];
  const pduChildren = decodeBerSequenceChildren(pduNode.valueBytes);
  if (pduChildren.length < 4) {
    throw new Error('Malformed SNMP PDU: expected requestId, errorStatus, errorIndex, varBinds');
  }

  const requestId = decodeBerIntegerValue(pduChildren[0].valueBytes);
  const errorStatus = decodeBerIntegerValue(pduChildren[1].valueBytes);
  const errorIndex = decodeBerIntegerValue(pduChildren[2].valueBytes);

  const varBindListNodes = decodeBerSequenceChildren(pduChildren[3].valueBytes);
  const varBinds: SnmpVarBind[] = varBindListNodes.map((vbSeq) => {
    const pair = decodeBerSequenceChildren(vbSeq.valueBytes);
    if (pair.length < 2) {
      throw new Error('Malformed SNMP VarBind pair');
    }
    const oid = decodeBerOidValue(pair[0].valueBytes);
    const valNode = pair[1];

    let decodedValue: string | number = '';
    switch (valNode.tag) {
      case BerTag.INTEGER:
        decodedValue = decodeBerIntegerValue(valNode.valueBytes, false);
        break;
      case BerTag.COUNTER32:
      case BerTag.GAUGE32:
      case BerTag.TIMETICKS:
        decodedValue = decodeBerIntegerValue(valNode.valueBytes, true);
        break;
      case BerTag.OBJECT_IDENTIFIER:
        decodedValue = decodeBerOidValue(valNode.valueBytes);
        break;
      case BerTag.OCTET_STRING:
        if (oid === MIB2_OIDS.ifPhysAddress1 || valNode.valueBytes.length === 6) {
          decodedValue = formatMacBytes(valNode.valueBytes);
        } else {
          decodedValue = decodeBerOctetStringValue(valNode.valueBytes);
        }
        break;
      case BerTag.NULL:
        decodedValue = '';
        break;
      default:
        decodedValue = bytesToHex(valNode.valueBytes);
        break;
    }

    return {
      oid,
      typeTag: valNode.tag,
      value: decodedValue,
      rawBytes: valNode.valueBytes,
    };
  });

  return {
    version,
    community,
    pduType: pduNode.tag,
    requestId,
    errorStatus,
    errorIndex,
    varBinds,
    rawHex: bytesToHex(buffer),
  };
}

/**
 * Converts a parsed SNMP GetResponse packet into a strongly typed SnmpTelemetrySnapshot.
 */
export function mapSnmpResponseToTelemetry(params: {
  targetIp: string;
  port: number;
  roundTripMs: number;
  rawRequestHex: string;
  parsedResponse: SnmpParsedPacket;
}): SnmpTelemetrySnapshot {
  const { parsedResponse } = params;
  const byOid = new Map<string, string | number>();
  for (const vb of parsedResponse.varBinds) {
    byOid.set(vb.oid, vb.value);
  }

  const sysName = String(byOid.get(MIB2_OIDS.sysName) ?? 'unknown-device');
  const sysDescr = String(byOid.get(MIB2_OIDS.sysDescr) ?? 'SNMP Managed Device');
  const sysUpTimeTicks = Number(byOid.get(MIB2_OIDS.sysUpTime) ?? 0);
  const sysLocation = String(byOid.get(MIB2_OIDS.sysLocation) ?? 'Sitio Remoto');
  const ifDescr = String(byOid.get(MIB2_OIDS.ifDescr1) ?? 'eth0');
  const ifPhysAddressMac = String(byOid.get(MIB2_OIDS.ifPhysAddress1) ?? '00:00:00:00:00:00');
  const operNum = Number(byOid.get(MIB2_OIDS.ifOperStatus1) ?? 1);
  const ifInOctets = Number(byOid.get(MIB2_OIDS.ifInOctets1) ?? 0);
  const ifOutOctets = Number(byOid.get(MIB2_OIDS.ifOutOctets1) ?? 0);

  return {
    targetIp: params.targetIp,
    port: params.port,
    community: parsedResponse.community,
    version: parsedResponse.version,
    requestId: parsedResponse.requestId,
    roundTripMs: params.roundTripMs,
    rawRequestHex: params.rawRequestHex,
    rawResponseHex: parsedResponse.rawHex,
    sysName,
    sysDescr,
    sysUpTimeTicks,
    sysUpTimeFormatted: formatSnmpTimeTicks(sysUpTimeTicks),
    sysLocation,
    interfaces: [
      {
        ifIndex: 1,
        ifDescr,
        ifPhysAddressMac,
        ifOperStatus: operNum === 1 ? 'UP' : operNum === 2 ? 'DOWN' : 'TESTING',
        ifInOctets,
        ifOutOctets,
        ifSpeedBps: 1_000_000_000,
      },
    ],
    queriedAt: Date.now(),
  };
}

