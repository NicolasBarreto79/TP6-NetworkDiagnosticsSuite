import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createOutboxQueueItem } from '@network-suite/contracts';
import { createAndStartBackend, type RunningBackendServer } from '../src/server.js';
import { executeRealUdpSnmpQuery } from '../src/snmpAgentUdp.js';

describe('Backend Sync API & Real UDP SNMPv2c Agent Integration (RF-01, RF-02, RF-03, RF-04, RF-07)', () => {
  let server: RunningBackendServer;
  let baseUrl: string;

  before(async () => {
    server = await createAndStartBackend({ httpPort: 0, snmpUdpPort: 0 });
    baseUrl = `http://127.0.0.1:${server.httpPort}`;
  });

  after(async () => {
    await server.close();
  });

  it('exchanges genuine binary ASN.1 BER SNMPv2c packets over a real UDP socket', async () => {
    const telemetryMk = await executeRealUdpSnmpQuery({
      agentPort: server.snmpAgent.port,
      targetDeviceIp: '192.168.1.1',
      community: 'public',
    });

    assert.equal(telemetryMk.sysName, 'MK-CCR2004-NODO-CENTRO');
    assert.equal(telemetryMk.interfaces[0].ifPhysAddressMac, 'DC:2C:6E:4A:11:01');
    assert.ok(telemetryMk.sysUpTimeTicks > 0);
    assert.ok(telemetryMk.rawResponseHex.startsWith('30 '));

    const telemetryHw = await executeRealUdpSnmpQuery({
      agentPort: server.snmpAgent.port,
      targetDeviceIp: '192.168.1.20',
      community: 'public',
    });

    assert.equal(telemetryHw.sysName, 'HW-ONT-HG8245Q2-ABONADO402');
    assert.equal(telemetryHw.interfaces[0].ifPhysAddressMac, '48:FD:8E:91:C2:14');
  });

  it('discovers LAN devices and automatically includes SNMP probe enrichment (RF-01 «include» RF-02)', async () => {
    const res = await fetch(`${baseUrl}/api/lan/discover?subnet=192.168.1.0/24`);
    assert.equal(res.status, 200);
    const data = (await res.json()) as {
      discoveredCount: number;
      snmpProbeIncluded: boolean;
      devices: Array<{ ipAddress: string; sysName: string; macAddress: string }>;
    };

    assert.equal(data.snmpProbeIncluded, true);
    assert.equal(data.discoveredCount, 4);
    assert.equal(data.devices[0].ipAddress, '192.168.1.1');
    assert.equal(data.devices[0].sysName, 'MK-CCR2004-NODO-CENTRO');
  });

  it('resolves QR/Barcode technical datasheets (RF-04) and executes SSH diagnostics (RF-03)', async () => {
    const qrRes = await fetch(`${baseUrl}/api/datasheets/QR-HW-HG8245Q2-SN485754`);
    assert.equal(qrRes.status, 200);
    const qrData = (await qrRes.json()) as {
      datasheet: { vendor: string; model: string; serialNumber: string };
    };
    assert.equal(qrData.datasheet.vendor, 'Huawei');
    assert.equal(qrData.datasheet.serialNumber, '4857544391C214AB');

    const sshRes = await fetch(`${baseUrl}/api/ssh/exec`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetIp: '192.168.1.20',
        presetId: 'huawei-gpon-optical',
      }),
    });
    assert.equal(sshRes.status, 200);
    const sshData = (await sshRes.json()) as { result: { stdout: string; exitCode: number } };
    assert.equal(sshData.result.exitCode, 0);
    assert.ok(sshData.result.stdout.includes('Rx optical power(dBm)'));
  });

  it('ingests Outbox queue items idempotently and updates backend state (RF-07)', async () => {
    const outboxItem = createOutboxQueueItem({
      entityType: 'INSTALLATION_REPORT',
      entityId: 'REP-TEST-001',
      operation: 'CREATE',
      payload: {
        id: 'REP-TEST-001',
        deviceId: 'dev-mk-ccr2004',
        deviceIp: '192.168.1.1',
        deviceMac: 'DC:2C:6E:4A:11:01',
        deviceHostname: 'MK-CCR2004-NODO-CENTRO',
        vendor: 'MikroTik',
        model: 'CCR2004-16G-2S+',
        qrBarcode: 'QR-MK-CCR2004-SN884120',
        siteName: 'Nodo Centro CDU',
        technicianName: 'Nicolás Barreto',
        technicianNotes: 'Instalación validada end-to-end.',
        coordinates: {
          latitude: -32.4845,
          longitude: -58.2321,
          accuracyMeters: 4,
          capturedAt: Date.now(),
        },
        photos: [],
        pdfLocalUri: 'file:///Documents/REP-TEST-001.pdf',
        pdfFileName: 'REP-TEST-001.pdf',
        pdfSizeBytes: 24500,
        createdAt: Date.now(),
        syncStatus: 'PENDING_SYNC',
      },
    });

    // First send -> 201 ACCEPTED
    const sync1 = await fetch(`${baseUrl}/api/sync/outbox`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item: outboxItem }),
    });
    assert.equal(sync1.status, 201);
    const sync1Json = (await sync1.json()) as {
      receipts: Array<{ status: string }>;
      serverSummary: { totalSyncedReports: number };
    };
    assert.equal(sync1Json.receipts[0].status, 'ACCEPTED');
    assert.equal(sync1Json.serverSummary.totalSyncedReports, 1);

    // Retry with same Idempotency-Key -> 200 DUPLICATE_IDEMPOTENT without duplicating report
    const sync2 = await fetch(`${baseUrl}/api/sync/outbox`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item: outboxItem }),
    });
    assert.equal(sync2.status, 200);
    const sync2Json = (await sync2.json()) as {
      receipts: Array<{ status: string }>;
      serverSummary: { totalSyncedReports: number };
    };
    assert.equal(sync2Json.receipts[0].status, 'DUPLICATE_IDEMPOTENT');
    assert.equal(sync2Json.serverSummary.totalSyncedReports, 1);
  });
});

