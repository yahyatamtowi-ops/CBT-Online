import type {
  ExamAttempt,
  Role,
  ToiletPermissionRequest,
  ViolationLog,
} from '../types/cbt';
import { isAttemptViolationLocked, mergeExamAttempts } from './cbtLogic';

export type LiveExamEventKind =
  | 'violation_recorded'
  | 'toilet_request'
  | 'toilet_updated'
  | 'attempt_updated'
  | 'attempt_reset';

export interface LiveExamEvent {
  eventId: string;
  senderId: string;
  sentAt: string;
  kind: LiveExamEventKind;
  violation?: ViolationLog;
  toiletRequest?: ToiletPermissionRequest;
  attempt?: ExamAttempt;
  deletedAttemptId?: string;
}

export interface LiveSnapshotPayload {
  violations: ViolationLog[];
  toiletRequests: ToiletPermissionRequest[];
  attempts: ExamAttempt[];
  deletedAttemptIds: string[];
}

const LIVE_CHANNEL_NAME = 'cerdasexam_live_events_v1';

const CLIENT_SENDER_ID =
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `cli-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function getLiveClientSenderId(): string {
  return CLIENT_SENDER_ID;
}

/**
 * Pure merge helper: prepends/deduplicates live ViolationLog entries sorted newest-first.
 */
export function mergeLiveViolations(
  local: ViolationLog[],
  incoming: ViolationLog[],
  maxItems = 300
): ViolationLog[] {
  if (incoming.length === 0) return local;
  const byId = new Map<string, ViolationLog>();
  for (const v of local) {
    byId.set(v.id, v);
  }
  let changed = false;
  for (const v of incoming) {
    if (!v || !v.id) continue;
    if (!byId.has(v.id)) {
      byId.set(v.id, v);
      changed = true;
    }
  }
  if (!changed) return local;
  return Array.from(byId.values())
    .sort((a, b) => (Date.parse(b.timestamp) || 0) - (Date.parse(a.timestamp) || 0))
    .slice(0, maxItems);
}

const TOILET_STATUS_RANK: Record<ToiletPermissionRequest['status'], number> = {
  pending: 1,
  confirmed: 2,
  returned: 3,
};

/**
 * Pure merge helper: merges live ToiletPermissionRequest updates by preserving the most advanced lifecycle state
 * (pending -> confirmed -> returned) and newest timestamps.
 */
export function mergeLiveToiletRequests(
  local: ToiletPermissionRequest[],
  incoming: ToiletPermissionRequest[],
  maxItems = 150
): ToiletPermissionRequest[] {
  if (incoming.length === 0) return local;
  const byId = new Map<string, ToiletPermissionRequest>();
  for (const r of local) {
    byId.set(r.id, r);
  }
  let changed = false;
  for (const inc of incoming) {
    if (!inc || !inc.id) continue;
    const prev = byId.get(inc.id);
    if (!prev) {
      byId.set(inc.id, inc);
      changed = true;
      continue;
    }
    const prevRank = TOILET_STATUS_RANK[prev.status] ?? 0;
    const incRank = TOILET_STATUS_RANK[inc.status] ?? 0;
    if (
      incRank > prevRank ||
      (incRank === prevRank &&
        (inc.confirmedAt !== prev.confirmedAt || inc.returnedAt !== prev.returnedAt))
    ) {
      byId.set(inc.id, { ...prev, ...inc });
      changed = true;
    }
  }
  if (!changed) return local;
  return Array.from(byId.values())
    .sort(
      (a, b) =>
        (Date.parse(b.requestedAt) || 0) - (Date.parse(a.requestedAt) || 0)
    )
    .slice(0, maxItems);
}

/**
 * Pure merge helper: merges incoming live ExamAttempt deltas into local attempts,
 * respecting unlocks, violation locks, and optional resets.
 */
export function mergeLiveAttempts(
  local: ExamAttempt[],
  incoming: ExamAttempt[],
  maxViolationTolerance: number,
  deletedAttemptIds: string[] = []
): ExamAttempt[] {
  let next = local;
  if (deletedAttemptIds.length > 0) {
    const delSet = new Set(deletedAttemptIds);
    const filtered = next.filter((a) => !delSet.has(a.id));
    if (filtered.length !== next.length) {
      next = filtered;
    }
  }
  if (incoming.length === 0) return next;
  return mergeExamAttempts(next, incoming, maxViolationTolerance);
}

/**
 * Applies a single LiveExamEvent or snapshot delta cleanly to the core live slices.
 */
export function applyLiveEventToSlices(
  current: {
    violations: ViolationLog[];
    toiletRequests: ToiletPermissionRequest[];
    attempts: ExamAttempt[];
  },
  event: LiveExamEvent,
  maxViolationTolerance: number
): {
  changed: boolean;
  violations: ViolationLog[];
  toiletRequests: ToiletPermissionRequest[];
  attempts: ExamAttempt[];
} {
  const nextViolations = event.violation
    ? mergeLiveViolations(current.violations, [event.violation])
    : current.violations;
  const nextToilets = event.toiletRequest
    ? mergeLiveToiletRequests(current.toiletRequests, [event.toiletRequest])
    : current.toiletRequests;
  const nextAttempts = mergeLiveAttempts(
    current.attempts,
    event.attempt ? [event.attempt] : [],
    maxViolationTolerance,
    event.deletedAttemptId ? [event.deletedAttemptId] : []
  );

  const changed =
    nextViolations !== current.violations ||
    nextToilets !== current.toiletRequests ||
    nextAttempts !== current.attempts;

  return {
    changed,
    violations: nextViolations,
    toiletRequests: nextToilets,
    attempts: nextAttempts,
  };
}

/**
 * Pure scope filter returning currently violation-locked attempts visible to a given staff role.
 */
export function filterScopedLockedAttempts(params: {
  attempts: ExamAttempt[];
  maxViolationTolerance: number;
  role: Role;
  allowedPackageIds?: string[];
  allowedClasses?: string[];
}): ExamAttempt[] {
  const pkgSet =
    params.allowedPackageIds && params.allowedPackageIds.length > 0
      ? new Set(params.allowedPackageIds)
      : params.role === 'admin'
      ? null
      : new Set<string>();
  const classSet =
    params.allowedClasses && params.allowedClasses.length > 0
      ? new Set(params.allowedClasses)
      : null;

  return params.attempts
    .filter((a) => {
      if (!isAttemptViolationLocked(a, params.maxViolationTolerance)) return false;
      if (params.role === 'admin') return true;
      if (pkgSet && !pkgSet.has(a.packageId)) return false;
      if (classSet && !classSet.has(a.className)) return false;
      return true;
    })
    .sort((a, b) => {
      const ta = Date.parse(a.updatedAt || a.submittedAt || a.startedAt) || 0;
      const tb = Date.parse(b.updatedAt || b.submittedAt || b.startedAt) || 0;
      return tb - ta;
    });
}

/**
 * Pure scope filter returning violations visible to a given staff role (admin, teacher, proctor).
 */
export function filterScopedViolations(params: {
  violations: ViolationLog[];
  role: Role;
  allowedPackageIds?: string[];
  allowedClasses?: string[];
}): ViolationLog[] {
  const pkgSet =
    params.allowedPackageIds && params.allowedPackageIds.length > 0
      ? new Set(params.allowedPackageIds)
      : params.role === 'admin'
      ? null
      : new Set<string>();
  const classSet =
    params.allowedClasses && params.allowedClasses.length > 0
      ? new Set(params.allowedClasses)
      : null;

  return params.violations
    .filter((v) => {
      if (params.role === 'admin') return true;
      if (pkgSet && !pkgSet.has(v.packageId)) return false;
      if (classSet && !classSet.has(v.className)) return false;
      return true;
    })
    .sort(
      (a, b) =>
        (Date.parse(b.timestamp) || 0) - (Date.parse(a.timestamp) || 0)
    );
}

/**
 * Publishes a live exam event across:
 * 1. Same-browser BroadcastChannel (instant cross-tab delivery)
 * 2. Express Server-Sent Events hub POST /api/live-events (instant cross-browser / cross-device delivery)
 */
export function publishLiveExamEvent(
  payload: Omit<LiveExamEvent, 'eventId' | 'senderId' | 'sentAt'>
): LiveExamEvent {
  const event: LiveExamEvent = {
    eventId: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    senderId: CLIENT_SENDER_ID,
    sentAt: new Date().toISOString(),
    ...payload,
  };

  // 1. Same-browser BroadcastChannel (works completely offline & across tabs)
  if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
    try {
      const bc = new BroadcastChannel(LIVE_CHANNEL_NAME);
      bc.postMessage(event);
      bc.close();
    } catch {
      // Ignore unsupported BroadcastChannel contexts
    }
  }

  // 2. Server-side live SSE broadcast (non-blocking)
  if (typeof fetch === 'function') {
    void fetch('/api/live-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
      keepalive: true,
    }).catch(() => {
      // Graceful fallback when running on static hosting or offline
    });
  }

  return event;
}

/**
 * Subscribes to live exam events from both same-browser BroadcastChannel and server SSE (`/api/live-events`).
 * Automatically hydrates buffered recent events from `/api/live-events/snapshot` upon mount.
 */
export function subscribeToLiveExamEvents(handlers: {
  onEvent: (event: LiveExamEvent) => void;
  onSnapshot?: (snapshot: LiveSnapshotPayload) => void;
}): () => void {
  const seenEventIds = new Set<string>();
  const dispatch = (raw: unknown) => {
    if (!raw || typeof raw !== 'object') return;
    const evt = raw as Partial<LiveExamEvent>;
    if (!evt.eventId || !evt.kind) return;
    if (evt.senderId === CLIENT_SENDER_ID) return;
    if (seenEventIds.has(evt.eventId)) return;
    seenEventIds.add(evt.eventId);
    if (seenEventIds.size > 400) {
      const first = seenEventIds.values().next().value;
      if (first) seenEventIds.delete(first);
    }
    handlers.onEvent(evt as LiveExamEvent);
  };

  let bc: BroadcastChannel | null = null;
  if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
    try {
      bc = new BroadcastChannel(LIVE_CHANNEL_NAME);
      bc.onmessage = (msg) => {
        dispatch(msg.data);
      };
    } catch {
      bc = null;
    }
  }

  let es: EventSource | null = null;
  if (typeof window !== 'undefined' && typeof EventSource !== 'undefined') {
    try {
      es = new EventSource('/api/live-events');
      es.onmessage = (msg) => {
        try {
          const parsed = JSON.parse(msg.data);
          if (parsed && parsed.type === 'live_event' && parsed.event) {
            dispatch(parsed.event);
          }
        } catch {
          // Ignore keepalive or malformed frame
        }
      };
      es.onerror = () => {
        // EventSource automatically reconnects; stay silent on static hosting
      };
    } catch {
      es = null;
    }
  }

  // Hydrate buffered live events from server on initial connect
  let cancelled = false;
  if (handlers.onSnapshot && typeof fetch === 'function') {
    void fetch('/api/live-events/snapshot', {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })
      .then(async (resp) => {
        if (!resp.ok || cancelled) return;
        const ct = resp.headers.get('content-type') || '';
        if (!ct.includes('application/json')) return;
        const data = (await resp.json()) as {
          ok?: boolean;
          snapshot?: LiveSnapshotPayload;
        };
        if (data.ok && data.snapshot && !cancelled) {
          handlers.onSnapshot?.(data.snapshot);
        }
      })
      .catch(() => {
        // Silent on pure static hosting or offline
      });
  }

  return () => {
    cancelled = true;
    if (bc) {
      try {
        bc.close();
      } catch {
        // ignore
      }
    }
    if (es) {
      try {
        es.close();
      } catch {
        // ignore
      }
    }
  };
}
