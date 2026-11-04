/**
 * Layer 5: Sync Layer (Deferred Synchronization Outbox Queue + NetInfo Listener — RF-07).
 *
 * Monitors network connectivity (`@react-native-community/netinfo`) and automatically flushes
 * eligible Outbox items in FIFO order when connectivity is restored, applying exponential backoff
 * on transient failures and conflict resolution on 409 responses.
 */

import {
  getDispatchableOutboxItems,
  markOutboxAttemptFailure,
  markOutboxSynced,
  resolveOutboxConflict,
  type OutboxQueueItem,
} from '@network-suite/contracts';
import { localStore } from '../store/localStore';

const DEFAULT_BACKEND_URL = 'http://localhost:3000';

export interface SyncStatusState {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncAttemptAt?: number;
  lastSyncSuccessAt?: number;
  lastSyncMessage: string;
  backendSyncedReportsCount: number;
  backendSyncedDiagnosticsCount: number;
}

type SyncStateListener = (state: SyncStatusState) => void;

class OutboxSyncManager {
  private state: SyncStatusState = {
    isOnline: true,
    isSyncing: false,
    lastSyncMessage: 'Monitor NetInfo activo — esperando eventos de cola Outbox.',
    backendSyncedReportsCount: 0,
    backendSyncedDiagnosticsCount: 0,
  };
  private listeners = new Set<SyncStateListener>();
  private backendBaseUrl = DEFAULT_BACKEND_URL;

  public setBackendBaseUrl(url: string): void {
    this.backendBaseUrl = url;
  }

  public getState(): SyncStatusState {
    return { ...this.state };
  }

  public subscribe(listener: SyncStateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private updateState(patch: Partial<SyncStatusState>): void {
    this.state = { ...this.state, ...patch };
    const snap = this.getState();
    for (const l of this.listeners) {
      l(snap);
    }
  }

  /**
   * Simulates or applies a `@react-native-community/netinfo` connectivity change event.
   * When transitioning from OFFLINE -> ONLINE, automatically triggers `flushOutboxQueue()`.
   */
  public async setConnectivityState(isOnline: boolean): Promise<void> {
    const wasOffline = !this.state.isOnline;
    this.updateState({
      isOnline,
      lastSyncMessage: isOnline
        ? 'NetInfo: Conectividad recuperada (ONLINE). Disparando sincronización automática de cola Outbox...'
        : 'NetInfo: Sin conexión a internet (MODO CAMPO OFFLINE). Todas las acciones se encolan localmente en Outbox.',
    });

    if (isOnline && wasOffline) {
      await this.flushOutboxQueue();
    }
  }

  /**
   * Dispatches all eligible Outbox items (`PENDING`, `RETRY_SCHEDULED`, `CONFLICT_RESOLVED`)
   * to the synchronization backend (`POST /api/sync/outbox`).
   */
  public async flushOutboxQueue(): Promise<{
    processed: number;
    synced: number;
    failed: number;
  }> {
    if (!this.state.isOnline) {
      const pendingCount = localStore
        .getSnapshot()
        .outbox.filter((i) => i.status !== 'SYNCED').length;
      this.updateState({
        lastSyncAttemptAt: Date.now(),
        lastSyncMessage: `Modo Offline activo: ${pendingCount} acción(es) permanecen encoladas en WatermelonDB Outbox.`,
      });
      return { processed: 0, synced: 0, failed: 0 };
    }

    const allOutbox = localStore.getSnapshot().outbox;
    const dispatchable = getDispatchableOutboxItems(allOutbox, Date.now());

    if (dispatchable.length === 0) {
      await this.refreshBackendStateSummary();
      this.updateState({
        lastSyncAttemptAt: Date.now(),
        lastSyncMessage: 'Cola Outbox al día (0 pendientes de envío).',
      });
      return { processed: 0, synced: 0, failed: 0 };
    }

    this.updateState({
      isSyncing: true,
      lastSyncAttemptAt: Date.now(),
      lastSyncMessage: `Sincronizando ${dispatchable.length} ítem(s) de la cola Outbox con el backend...`,
    });

    let synced = 0;
    let failed = 0;

    for (const item of dispatchable) {
      const res = await this.dispatchSingleItem(item);
      if (res === 'SYNCED') {
        synced += 1;
      } else {
        failed += 1;
      }
    }

    await this.refreshBackendStateSummary();

    this.updateState({
      isSyncing: false,
      lastSyncSuccessAt: synced > 0 ? Date.now() : this.state.lastSyncSuccessAt,
      lastSyncMessage:
        failed === 0
          ? `Sincronización Outbox exitosa: ${synced} ítem(s) confirmados por el backend con Idempotency-Key.`
          : `Sincronización parcial: ${synced} sincronizados, ${failed} reprogramados con backoff exponencial.`,
    });

    return {
      processed: dispatchable.length,
      synced,
      failed,
    };
  }

  private async dispatchSingleItem(item: OutboxQueueItem): Promise<'SYNCED' | 'FAILED'> {
    try {
      const response = await fetch(`${this.backendBaseUrl}/api/sync/outbox`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': item.idempotencyKey,
        },
        body: JSON.stringify({ item }),
      });

      if (response.status === 409) {
        const conflictData = (await response.json()) as {
          serverRecord?: Record<string, unknown>;
        };
        const resolved = resolveOutboxConflict(item, conflictData.serverRecord ?? {});
        localStore.upsertOutboxItem(resolved);
        return this.dispatchSingleItem(resolved);
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} al sincronizar ${item.id}`);
      }

      const syncedItem = markOutboxSynced(item);
      localStore.upsertOutboxItem(syncedItem);
      localStore.markEntitySynced(item.entityType, item.entityId);
      return 'SYNCED';
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error de red al conectar con backend';
      const failedItem = markOutboxAttemptFailure(item, message);
      localStore.upsertOutboxItem(failedItem);
      return 'FAILED';
    }
  }

  public async refreshBackendStateSummary(): Promise<void> {
    try {
      const res = await fetch(`${this.backendBaseUrl}/api/sync/state`);
      if (res.ok) {
        const data = (await res.json()) as {
          totalSyncedReports: number;
          totalSyncedDiagnostics: number;
        };
        this.updateState({
          backendSyncedReportsCount: data.totalSyncedReports,
          backendSyncedDiagnosticsCount: data.totalSyncedDiagnostics,
        });
      }
    } catch {
      // Ignore if backend is offline
    }
  }
}

export const outboxSyncManager = new OutboxSyncManager();

