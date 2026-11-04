import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createAndStartBackend, type RunningBackendServer } from '../../backend/src/server.js';
import { scanLocalNetworkLan } from '../src/layers/discovery/discoveryLayer.js';
import {
  executeDeviceSshCommand,
  keychainVault,
  queryDeviceSnmp,
} from '../src/layers/protocol/protocolLayer.js';
import {
  captureGeoreferencedPhoto,
  captureGpsLocation,
  scanEquipmentQrCode,
} from '../src/layers/evidence/evidenceLayer.js';
import { registerInstallationAndGeneratePdf } from '../src/layers/reporting/reportingLayer.js';
import { localStore } from '../src/layers/store/localStore.js';
import { outboxSyncManager } from '../src/layers/sync/syncLayer.js';

describe('Mobile 6-Layer Architecture End-to-End Verification (RF-01 to RF-08)', () => {
  let backend: RunningBackendServer;

  before(async () => {
    backend = await createAndStartBackend({ httpPort: 0, snmpUdpPort: 0 });
    outboxSyncManager.setBackendBaseUrl(`http://127.0.0.1:${backend.httpPort}`);
  });

  after(async () => {
    await backend.close();
  });

  it('RF-01 + «include» RF-02: Discovery Layer scans LAN and automatically enriches devices via SNMP', async () => {
    const scan = await scanLocalNetworkLan('192.168.1.0/24');
    assert.equal(scan.discoveredDevices.length, 4);
    assert.equal(scan.snmpProbesExecuted, 4);

    const mk = scan.discoveredDevices.find((d) => d.ipAddress === '192.168.1.1');
    assert.ok(mk);
    assert.equal(mk.macAddress, 'DC:2C:6E:4A:11:01');
    assert.equal(mk.sysName, 'MK-CCR2004-NODO-CENTRO');
  });

  it('RF-02 & RF-03: Protocol Layer runs SNMPv2c BER queries and SSH commands with Keychain credentials', async () => {
    const meta = await keychainVault.saveEquipmentCredential({
      deviceId: 'dev-mk-ccr2004',
      targetIp: '192.168.1.1',
      username: 'noc-engineer',
      passwordPlain: 'Sup3rS3cr3t_NeverPersistedInPlaintext!',
      snmpCommunity: 'public',
    });

    assert.ok(meta.serviceKey.startsWith('keychain://'));
    assert.equal(keychainVault.hasValidKeystoreSecret(meta.serviceKey), true);

    const snmpSnap = await queryDeviceSnmp({
      deviceId: 'dev-mk-ccr2004',
      targetIp: '192.168.1.1',
      hostname: 'MK-CCR2004-NODO-CENTRO',
      siteName: 'Nodo Centro CDU',
    });
    assert.ok(snmpSnap.sysUpTimeTicks > 0);
    assert.ok(snmpSnap.rawRequestHex.startsWith('30 '));

    const sshRes = await executeDeviceSshCommand({
      deviceId: 'dev-mk-ccr2004',
      targetIp: '192.168.1.1',
      hostname: 'MK-CCR2004-NODO-CENTRO',
      vendor: 'MikroTik',
      siteName: 'Nodo Centro CDU',
      presetId: 'mikrotik-interfaces',
    });
    assert.equal(sshRes.exitCode, 0);
    assert.equal(sshRes.credentialKeychainRef, meta.serviceKey);
  });

  it('RF-04, RF-05, RF-06, RF-07, RF-08: Offline QR scan, GPS/Photo evidence, PDF generation, Outbox queue, and auto-sync on reconnect', async () => {
    // 1. Switch mobile app to OFFLINE field mode
    await outboxSyncManager.setConnectivityState(false);
    assert.equal(outboxSyncManager.getState().isOnline, false);

    // 2. Scan QR code while offline (resolves from WatermelonDB local cache)
    const qrLookup = await scanEquipmentQrCode('QR-UBNT-PBE5AC-SN788A20');
    assert.equal(qrLookup.datasheet.vendor, 'Ubiquiti');

    // 3. Capture GPS and georeferenced photo evidence
    const gps = await captureGpsLocation(0);
    const device = localStore
      .getSnapshot()
      .devices.find((d) => d.ipAddress === '192.168.1.50')!;
    const photo = captureGeoreferencedPhoto({
      reportId: 'DRAFT',
      deviceHostname: device.hostname,
      deviceIp: device.ipAddress,
      caption: 'Antena PowerBeam 5AC alineada en mástil norte',
      coordinates: gps,
    });

    // 4. Register installation -> «include» Generate PDF -> «include» Enqueue in Outbox
    const bundle = registerInstallationAndGeneratePdf({
      device,
      qrBarcode: qrLookup.datasheet.qrCode,
      siteName: device.siteName,
      technicianName: 'Nicolás Barreto',
      technicianNotes: 'Enlace PtP 5.8GHz cerrado en -54 dBm con protector ETH-SP-G2.',
      coordinates: gps,
      photos: [photo],
    });

    assert.ok(bundle.report.pdfFileName.endsWith('.pdf'));
    assert.ok(bundle.htmlContent.includes('PowerBeam 5AC Gen2'));
    assert.equal(bundle.outboxItem.status, 'PENDING');

    // 5. Verify RF-08 Offline History query
    const history = localStore.queryOfflineHistory('UBNT-PBE5AC');
    assert.ok(history.reports.length >= 1);

    // 6. Restore connectivity (NetInfo ONLINE) -> triggers automatic Outbox synchronization
    await outboxSyncManager.setConnectivityState(true);

    const pendingAfterSync = localStore
      .getSnapshot()
      .outbox.filter((i) => i.status !== 'SYNCED');
    assert.equal(pendingAfterSync.length, 0);
    assert.ok(outboxSyncManager.getState().backendSyncedReportsCount >= 1);
  });
});

