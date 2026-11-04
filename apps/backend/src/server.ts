/**
 * HTTP Synchronization & Real UDP SNMP Bridge Server for TP6: Network Diagnostics Suite.
 * Exposes:
 *  - GET  /api/health
 *  - GET  /api/lan/discover        (RF-01 + «include» RF-02 initial SNMP probe over real UDP)
 *  - POST /api/snmp/query          (RF-02 real binary ASN.1 BER GetRequest/GetResponse over UDP)
 *  - POST /api/ssh/exec            (RF-03 embedded SSH diagnostic command execution)
 *  - GET  /api/datasheets          (RF-04 catalog of equipment technical datasheets)
 *  - GET  /api/datasheets/:code    (RF-04 lookup by QR / barcode / serial)
 *  - POST /api/sync/outbox         (RF-07 deferred synchronization Outbox ingestion)
 *  - GET  /api/sync/state          (RF-07 / Deliverable 07 verification of synced backend state)
 */

import http from 'node:http';
import {
  buildRealisticSshOutput,
  SSH_VENDOR_PRESETS,
  type NetworkDevice,
  type OutboxQueueItem,
  type SshExecutionResult,
} from '@network-suite/contracts';
import {
  findDatasheetByQrCode,
  findSimulatedDeviceByIp,
  TELECOM_LAN_TOPOLOGY,
} from './datasheetsStore.js';
import {
  executeRealUdpSnmpQuery,
  startSnmpUdpAgent,
  type RunningSnmpUdpAgent,
} from './snmpAgentUdp.js';
import { SyncBackendStore } from './syncController.js';

export interface RunningBackendServer {
  httpServer: http.Server;
  httpPort: number;
  snmpAgent: RunningSnmpUdpAgent;
  syncStore: SyncBackendStore;
  close: () => Promise<void>;
}

export async function createAndStartBackend(options?: {
  httpPort?: number;
  snmpUdpPort?: number;
}): Promise<RunningBackendServer> {
  const snmpAgent = await startSnmpUdpAgent(options?.snmpUdpPort ?? 1610);
  const syncStore = new SyncBackendStore();

  const httpServer = http.createServer(async (req, res) => {
    // Enable CORS for mobile/web emulator clients
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Idempotency-Key, X-Client-Platform'
    );

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

    try {
      // 1. Health Check
      if (req.method === 'GET' && url.pathname === '/api/health') {
        sendJson(res, 200, {
          status: 'ok',
          service: 'TP6 Network Diagnostics Suite — Sync Backend & Real UDP SNMP Agent',
          snmpUdpPort: snmpAgent.port,
          timestamp: Date.now(),
        });
        return;
      }

      // 2. RF-01 + «include» RF-02: LAN Discovery with automatic initial SNMP UDP binary probe
      if (req.method === 'GET' && url.pathname === '/api/lan/discover') {
        const subnet = url.searchParams.get('subnet') ?? '192.168.1.0/24';
        const discoveredDevices: NetworkDevice[] = [];

        for (const item of TELECOM_LAN_TOPOLOGY) {
          const telemetry = await executeRealUdpSnmpQuery({
            agentPort: snmpAgent.port,
            targetDeviceIp: item.device.ipAddress,
            community: 'public',
          });

          discoveredDevices.push({
            ...item.device,
            macAddress:
              telemetry.interfaces[0]?.ifPhysAddressMac || item.device.macAddress,
            sysName: telemetry.sysName,
            sysDescr: telemetry.sysDescr,
            sysUpTimeTicks: telemetry.sysUpTimeTicks,
            sysUpTimeFormatted: telemetry.sysUpTimeFormatted,
            ifInOctets: telemetry.interfaces[0]?.ifInOctets ?? 0,
            ifOutOctets: telemetry.interfaces[0]?.ifOutOctets ?? 0,
            lastSeenAt: Date.now(),
          });
        }

        sendJson(res, 200, {
          subnet,
          discoveredCount: discoveredDevices.length,
          snmpProbeIncluded: true,
          devices: discoveredDevices,
        });
        return;
      }

      // 3. RF-02: Real Binary SNMP v1/v2c Query over UDP
      if (req.method === 'POST' && url.pathname === '/api/snmp/query') {
        const body = await readJsonBody<{
          targetIp?: string;
          community?: string;
          oids?: string[];
        }>(req);

        const targetIp = body.targetIp ?? '192.168.1.1';
        const community = body.community ?? 'public';

        const snapshot = await executeRealUdpSnmpQuery({
          agentPort: snmpAgent.port,
          targetDeviceIp: targetIp,
          community,
          oids: body.oids,
        });

        sendJson(res, 200, { snapshot });
        return;
      }

      // 4. RF-03: Embedded SSH Predefined Command Execution
      if (req.method === 'POST' && url.pathname === '/api/ssh/exec') {
        const body = await readJsonBody<{
          deviceId?: string;
          targetIp?: string;
          port?: number;
          username?: string;
          credentialKeychainRef?: string;
          presetId?: string;
        }>(req);

        const targetIp = body.targetIp ?? '192.168.1.1';
        const sim = findSimulatedDeviceByIp(targetIp);
        const preset =
          SSH_VENDOR_PRESETS.find((p) => p.id === body.presetId) ??
          SSH_VENDOR_PRESETS[0];

        const stdout = buildRealisticSshOutput({
          presetId: preset.id,
          targetIp,
          hostname: sim.device.hostname,
          vendor: sim.device.vendor,
        });

        const result: SshExecutionResult = {
          id: `ssh-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          deviceId: body.deviceId ?? sim.device.id,
          targetIp,
          port: body.port ?? 22,
          username: body.username ?? 'admin-telecom',
          credentialKeychainRef:
            body.credentialKeychainRef ?? `keychain://telecom.ssh.${sim.device.id}`,
          presetId: preset.id,
          command: preset.command,
          stdout,
          stderr: '',
          exitCode: 0,
          durationMs: 38,
          executedAt: Date.now(),
        };

        sendJson(res, 200, { result });
        return;
      }

      // 5. RF-04: Technical Datasheet Lookup by QR/Barcode
      if (req.method === 'GET' && url.pathname.startsWith('/api/datasheets/')) {
        const code = decodeURIComponent(url.pathname.replace('/api/datasheets/', ''));
        const datasheet = findDatasheetByQrCode(code);
        if (!datasheet) {
          sendJson(res, 404, { error: `Ficha técnica no encontrada para el código: ${code}` });
          return;
        }
        sendJson(res, 200, { datasheet });
        return;
      }

      // 6. RF-07: Outbox Synchronization Endpoint (Single or Batch)
      if (req.method === 'POST' && url.pathname === '/api/sync/outbox') {
        const body = await readJsonBody<{
          item?: OutboxQueueItem;
          items?: OutboxQueueItem[];
        }>(req);

        const queueItems = body.items ?? (body.item ? [body.item] : []);
        if (queueItems.length === 0) {
          sendJson(res, 400, { error: 'No OutboxQueueItem provided in payload' });
          return;
        }

        const results = queueItems.map((item) => syncStore.ingestOutboxItem(item));
        sendJson(res, results[0].httpStatus, {
          syncedCount: results.length,
          receipts: results.map((r) => r.receipt),
          serverSummary: syncStore.getStateSummary(),
        });
        return;
      }

      // 7. Backend Sync State Inspection
      if (req.method === 'GET' && url.pathname === '/api/sync/state') {
        sendJson(res, 200, syncStore.getStateSummary());
        return;
      }

      sendJson(res, 404, { error: `Route not found: ${req.method} ${url.pathname}` });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal server error';
      sendJson(res, 500, { error: message });
    }
  });

  const requestedHttpPort = options?.httpPort ?? Number(process.env.PORT ?? 3000);
  await new Promise<void>((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(requestedHttpPort, '0.0.0.0', () => {
      httpServer.removeListener('error', reject);
      resolve();
    });
  });

  const addr = httpServer.address();
  const boundHttpPort = typeof addr === 'object' && addr ? addr.port : requestedHttpPort;

  return {
    httpServer,
    httpPort: boundHttpPort,
    snmpAgent,
    syncStore,
    close: async () => {
      await snmpAgent.close();
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    },
  };
}

function sendJson(res: http.ServerResponse, statusCode: number, data: unknown): void {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

async function readJsonBody<T>(req: http.IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString('utf-8');
  return raw ? (JSON.parse(raw) as T) : ({} as T);
}

// Direct CLI execution entrypoint
if (process.argv[1]?.replace(/\\/g, '/').endsWith('src/server.ts')) {
  createAndStartBackend({ httpPort: 3000, snmpUdpPort: 1610 }).then((srv) => {
    console.log(
      `[TP6 Backend] HTTP Sync Server listening on http://localhost:${srv.httpPort} | Real UDP SNMPv2c Agent listening on udp://127.0.0.1:${srv.snmpAgent.port}`
    );
  });
}

