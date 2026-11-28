import type { ExamAttempt, ExamPackage, Question, StudentRecord } from '../types/cbt';

export const EXAM_DATA_CACHE_NAME = 'cerdasexam-exam-data-v1';
export const EXAM_SNAPSHOT_CACHE_URL = '/__offline_exam_cache__/active-exam.json';
const OFFLINE_QUEUE_KEY = 'cerdasexam_offline_sync_queue_v1';

export interface OfflineExamSnapshot {
  student: StudentRecord;
  examPackage: ExamPackage;
  questions: Question[];
  attempt: ExamAttempt;
  savedAt: string;
}

export interface OfflineSyncQueueState {
  pendingSubmissions: string[]; // attemptIds submitted while offline
  pendingAnswerUpdates: number;
  lastOfflineSavedAt: string | null;
}

export async function registerExamServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });
    return registration;
  } catch {
    return null;
  }
}

export async function cacheStudentExamSnapshot(
  snapshot: OfflineExamSnapshot
): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  let wrote = false;

  // 1. Push via active Service Worker message channel when available
  try {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'CACHE_EXAM_DATA',
        payload: snapshot,
      });
      wrote = true;
    }
  } catch {
    // Fallback to direct Cache Storage below
  }

  // 2. Also write directly to Cache Storage API so data is guaranteed cached immediately
  try {
    if ('caches' in window) {
      const cache = await window.caches.open(EXAM_DATA_CACHE_NAME);
      const body = JSON.stringify({
        cachedAt: new Date().toISOString(),
        payload: snapshot,
      });
      await cache.put(
        new Request(EXAM_SNAPSHOT_CACHE_URL),
        new Response(body, {
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'X-CerdasExam-Offline-Cache': '1',
          },
        })
      );
      wrote = true;
    }
  } catch {
    // Ignore Cache Storage quota/restriction errors
  }

  return wrote;
}

export async function readCachedStudentExamSnapshot(): Promise<OfflineExamSnapshot | null> {
  if (typeof window === 'undefined' || !('caches' in window)) return null;
  try {
    const cache = await window.caches.open(EXAM_DATA_CACHE_NAME);
    const response = await cache.match(EXAM_SNAPSHOT_CACHE_URL);
    if (!response) return null;
    const parsed = (await response.json()) as { payload?: OfflineExamSnapshot | null };
    return parsed?.payload ?? null;
  } catch {
    return null;
  }
}

export function readOfflineSyncQueue(): OfflineSyncQueueState {
  if (typeof window === 'undefined') {
    return { pendingSubmissions: [], pendingAnswerUpdates: 0, lastOfflineSavedAt: null };
  }
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) {
      return { pendingSubmissions: [], pendingAnswerUpdates: 0, lastOfflineSavedAt: null };
    }
    const parsed = JSON.parse(raw) as Partial<OfflineSyncQueueState>;
    return {
      pendingSubmissions: Array.isArray(parsed.pendingSubmissions)
        ? parsed.pendingSubmissions
        : [],
      pendingAnswerUpdates: Number(parsed.pendingAnswerUpdates) || 0,
      lastOfflineSavedAt: parsed.lastOfflineSavedAt || null,
    };
  } catch {
    return { pendingSubmissions: [], pendingAnswerUpdates: 0, lastOfflineSavedAt: null };
  }
}

export function recordOfflineExamMutation(
  params: {
    submittedAttemptId?: string;
  } = {}
): OfflineSyncQueueState {
  const current = readOfflineSyncQueue();
  const nextSubmissions = params.submittedAttemptId
    ? [...new Set([...current.pendingSubmissions, params.submittedAttemptId])]
    : current.pendingSubmissions;
  const next: OfflineSyncQueueState = {
    pendingSubmissions: nextSubmissions,
    pendingAnswerUpdates: current.pendingAnswerUpdates + 1,
    lastOfflineSavedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota error
  }
  return next;
}

export function clearOfflineSyncQueue(): void {
  try {
    localStorage.removeItem(OFFLINE_QUEUE_KEY);
  } catch {
    // Ignore
  }
}
