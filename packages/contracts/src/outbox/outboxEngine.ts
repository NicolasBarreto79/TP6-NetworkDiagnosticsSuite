/**
 * Outbox Pattern Deferred Synchronization Engine (RF-07, Martin Fowler Offline-First).
 * Governs state transitions, exponential backoff with deterministic bounds,
 * idempotency keys, and conflict resolution when reconnecting.
 */

import type {
  OutboxEntityType,
  OutboxOperationStatus,
  OutboxQueueItem,
} from '../models.js';

export const DEFAULT_MAX_OUTBOX_RETRIES = 5;
export const BASE_BACKOFF_MS = 2000;
export const MAX_BACKOFF_MS = 60000;

/**
 * Calculates exponential backoff in milliseconds: min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2^(retryCount - 1)).
 */
export function calculateExponentialBackoffMs(retryCount: number): number {
  if (retryCount <= 0) return 0;
  const delay = BASE_BACKOFF_MS * Math.pow(2, retryCount - 1);
  return Math.min(MAX_BACKOFF_MS, delay);
}

/**
 * Creates a new OutboxQueueItem ready to be persisted inside WatermelonDB.
 */
export function createOutboxQueueItem(params: {
  id?: string;
  entityType: OutboxEntityType;
  entityId: string;
  operation: 'CREATE' | 'UPDATE';
  payload: unknown;
  now?: number;
}): OutboxQueueItem {
  const now = params.now ?? Date.now();
  const id = params.id ?? `outbox-${now}-${Math.random().toString(36).slice(2, 8)}`;
  const idempotencyKey = `idem-${params.entityType.toLowerCase()}-${params.entityId}-${now}`;

  return {
    id,
    idempotencyKey,
    entityType: params.entityType,
    entityId: params.entityId,
    operation: params.operation,
    payloadJson: JSON.stringify(params.payload),
    status: 'PENDING',
    retryCount: 0,
    maxRetries: DEFAULT_MAX_OUTBOX_RETRIES,
    nextRetryAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Transitions an OutboxQueueItem when a sync attempt fails (network drop or 5xx).
 */
export function markOutboxAttemptFailure(
  item: OutboxQueueItem,
  errorMessage: string,
  now = Date.now()
): OutboxQueueItem {
  const nextRetryCount = item.retryCount + 1;
  const exhausted = nextRetryCount >= item.maxRetries;
  const backoffMs = calculateExponentialBackoffMs(nextRetryCount);

  return {
    ...item,
    retryCount: nextRetryCount,
    status: exhausted ? 'DEAD_LETTER' : 'RETRY_SCHEDULED',
    nextRetryAt: exhausted ? now : now + backoffMs,
    lastError: errorMessage,
    updatedAt: now,
  };
}

/**
 * Transitions an OutboxQueueItem when the server reports a 409 version conflict,
 * applying basic field-technician merge resolution (preserving field evidence + server metadata).
 */
export function resolveOutboxConflict(
  item: OutboxQueueItem,
  serverRecord: Record<string, unknown>,
  now = Date.now()
): OutboxQueueItem {
  const localPayload = JSON.parse(item.payloadJson) as Record<string, unknown>;
  const mergedPayload = {
    ...serverRecord,
    ...localPayload,
    conflictResolvedAt: now,
    resolutionStrategy: 'FIELD_EVIDENCE_PRIORITY_MERGE',
  };

  return {
    ...item,
    payloadJson: JSON.stringify(mergedPayload),
    status: 'CONFLICT_RESOLVED',
    conflictResolutionNote:
      'Conflicto de versión resuelto automáticamente priorizando evidencia de campo y fusionando metadatos remotos.',
    nextRetryAt: now,
    updatedAt: now,
  };
}

/**
 * Transitions an OutboxQueueItem to SYNCED upon receiving 200/201 from the synchronization backend.
 */
export function markOutboxSynced(item: OutboxQueueItem, now = Date.now()): OutboxQueueItem {
  return {
    ...item,
    status: 'SYNCED',
    lastError: undefined,
    updatedAt: now,
    syncedAt: now,
  };
}

/**
 * Filters and orders Outbox items that are eligible for immediate dispatch in FIFO order.
 */
export function getDispatchableOutboxItems(
  items: OutboxQueueItem[],
  now = Date.now()
): OutboxQueueItem[] {
  const eligibleStatuses: OutboxOperationStatus[] = [
    'PENDING',
    'RETRY_SCHEDULED',
    'CONFLICT_RESOLVED',
  ];

  return items
    .filter((item) => eligibleStatuses.includes(item.status) && item.nextRetryAt <= now)
    .sort((a, b) => a.createdAt - b.createdAt);
}

