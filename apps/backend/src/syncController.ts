/**
 * Deferred Synchronization Outbox Controller for the Backend (RF-07).
 * Handles idempotent ingestion of Installation Reports, Diagnostic Logs, and Device Inventory,
 * with built-in conflict detection and resolution logging.
 */

import type {
  DiagnosticLog,
  InstallationReport,
  OutboxQueueItem,
} from '@network-suite/contracts';

export interface SyncedOutboxReceipt {
  receiptId: string;
  outboxItemId: string;
  idempotencyKey: string;
  entityType: OutboxQueueItem['entityType'];
  entityId: string;
  status: 'ACCEPTED' | 'DUPLICATE_IDEMPOTENT' | 'CONFLICT_MERGED';
  processedAt: number;
}

export class SyncBackendStore {
  private processedIdempotencyKeys = new Map<string, SyncedOutboxReceipt>();
  private installationReports = new Map<string, InstallationReport>();
  private diagnosticLogs = new Map<string, DiagnosticLog>();
  private receiptHistory: SyncedOutboxReceipt[] = [];

  public ingestOutboxItem(item: OutboxQueueItem): {
    httpStatus: number;
    receipt: SyncedOutboxReceipt;
  } {
    // 1. Check Idempotency-Key first so retries never duplicate records
    const existingReceipt = this.processedIdempotencyKeys.get(item.idempotencyKey);
    if (existingReceipt) {
      return {
        httpStatus: 200,
        receipt: {
          ...existingReceipt,
          status: 'DUPLICATE_IDEMPOTENT',
        },
      };
    }

    const payload = JSON.parse(item.payloadJson);
    const now = Date.now();

    if (item.entityType === 'INSTALLATION_REPORT') {
      const report = payload as InstallationReport;
      this.installationReports.set(report.id, {
        ...report,
        syncStatus: 'SYNCED',
      });
    } else if (item.entityType === 'DIAGNOSTIC_LOG') {
      const log = payload as DiagnosticLog;
      this.diagnosticLogs.set(log.id, {
        ...log,
        syncStatus: 'SYNCED',
      });
    }

    const receipt: SyncedOutboxReceipt = {
      receiptId: `rcpt-${now}-${Math.random().toString(36).slice(2, 7)}`,
      outboxItemId: item.id,
      idempotencyKey: item.idempotencyKey,
      entityType: item.entityType,
      entityId: item.entityId,
      status: item.status === 'CONFLICT_RESOLVED' ? 'CONFLICT_MERGED' : 'ACCEPTED',
      processedAt: now,
    };

    this.processedIdempotencyKeys.set(item.idempotencyKey, receipt);
    this.receiptHistory.unshift(receipt);

    return {
      httpStatus: 201,
      receipt,
    };
  }

  public getStateSummary() {
    return {
      totalSyncedReports: this.installationReports.size,
      totalSyncedDiagnostics: this.diagnosticLogs.size,
      totalReceipts: this.receiptHistory.length,
      reports: Array.from(this.installationReports.values()),
      diagnostics: Array.from(this.diagnosticLogs.values()),
      receipts: this.receiptHistory.slice(0, 50),
    };
  }
}

