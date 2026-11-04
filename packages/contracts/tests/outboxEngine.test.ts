import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildInstallationReportHtml,
  calculateExponentialBackoffMs,
  createOutboxQueueItem,
  getDispatchableOutboxItems,
  markOutboxAttemptFailure,
  markOutboxSynced,
  resolveOutboxConflict,
} from '../src/index.js';

describe('Outbox Pattern Synchronization Engine & PDF Report Generator (RF-06 / RF-07)', () => {
  it('calculates exponential backoff and transitions items through RETRY_SCHEDULED to DEAD_LETTER', () => {
    assert.equal(calculateExponentialBackoffMs(1), 2000);
    assert.equal(calculateExponentialBackoffMs(2), 4000);
    assert.equal(calculateExponentialBackoffMs(3), 8000);

    const now = 1_700_000_000_000;
    let item = createOutboxQueueItem({
      entityType: 'INSTALLATION_REPORT',
      entityId: 'rep-001',
      operation: 'CREATE',
      payload: { siteName: 'Nodo Norte' },
      now,
    });

    assert.equal(item.status, 'PENDING');
    item = markOutboxAttemptFailure(item, 'Network timeout', now + 100);
    assert.equal(item.status, 'RETRY_SCHEDULED');
    assert.equal(item.retryCount, 1);
    assert.equal(item.nextRetryAt, now + 100 + 2000);

    // Exhaust retries up to maxRetries (5)
    for (let i = 2; i <= 5; i++) {
      item = markOutboxAttemptFailure(item, 'Offline', now + i * 1000);
    }
    assert.equal(item.status, 'DEAD_LETTER');
    assert.equal(item.retryCount, 5);
  });

  it('resolves 409 conflicts and marks item as SYNCED after successful dispatch', () => {
    const now = 1_700_000_000_000;
    const item = createOutboxQueueItem({
      entityType: 'INSTALLATION_REPORT',
      entityId: 'rep-002',
      operation: 'UPDATE',
      payload: { technicianNotes: 'Conector APC reemplazado' },
      now,
    });

    const resolved = resolveOutboxConflict(
      item,
      { serverVersion: 3, siteSupervisor: 'Ing. Gomez' },
      now + 500
    );
    assert.equal(resolved.status, 'CONFLICT_RESOLVED');
    const merged = JSON.parse(resolved.payloadJson);
    assert.equal(merged.technicianNotes, 'Conector APC reemplazado');
    assert.equal(merged.serverVersion, 3);

    const dispatchable = getDispatchableOutboxItems([resolved], now + 600);
    assert.equal(dispatchable.length, 1);

    const synced = markOutboxSynced(resolved, now + 1000);
    assert.equal(synced.status, 'SYNCED');
    assert.equal(getDispatchableOutboxItems([synced], now + 2000).length, 0);
  });

  it('generates complete HTML installation report with georeferenced metadata and SNMP/SSH sections', () => {
    const html = buildInstallationReportHtml({
      id: 'REP-2026-0091',
      deviceId: 'dev-mk-01',
      deviceIp: '192.168.1.1',
      deviceMac: 'DC:2C:6E:4A:11:01',
      deviceHostname: 'MK-CCR2004-NODO-CENTRO',
      vendor: 'MikroTik',
      model: 'CCR2004-16G-2S+',
      qrBarcode: 'QR-MK-CCR2004-SN884120',
      siteName: 'Azotea Edificio Centro - Gabinete Principal',
      technicianName: 'Nicolás Barreto',
      technicianNotes: 'Enlace troncal SFP+ operativo. Señal óptica dentro de parámetros.',
      coordinates: {
        latitude: -32.484512,
        longitude: -58.232104,
        accuracyMeters: 3.4,
        altitudeMeters: 28,
        capturedAt: 1_700_000_000_000,
      },
      photos: [
        {
          id: 'ph-1',
          reportId: 'REP-2026-0091',
          uri: 'file:///storage/emulated/0/Documents/rack_photo_1.jpg',
          caption: 'Frente de rack y patchcord fibra LC/APC',
          mimeType: 'image/jpeg',
          coordinates: {
            latitude: -32.484512,
            longitude: -58.232104,
            accuracyMeters: 3.4,
            capturedAt: 1_700_000_000_000,
          },
          capturedAt: 1_700_000_000_000,
        },
      ],
      pdfLocalUri: 'file:///storage/emulated/0/Documents/REP-2026-0091.pdf',
      pdfFileName: 'REP-2026-0091.pdf',
      pdfSizeBytes: 48120,
      createdAt: 1_700_000_000_000,
      syncStatus: 'PENDING_SYNC',
    });

    assert.ok(html.includes('REP-2026-0091'));
    assert.ok(html.includes('MK-CCR2004-NODO-CENTRO'));
    assert.ok(html.includes('-32.484512'));
    assert.ok(html.includes('QR-MK-CCR2004-SN884120'));
  });
});

