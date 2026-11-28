import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  DoorOpen,
  Lock,
  ShieldAlert,
  Siren,
  Unlock,
  X,
} from 'lucide-react';
import { useCBT } from '../context/CBTContext';
import type {
  ExamAttempt,
  Role,
  ToiletPermissionRequest,
  ViolationLog,
} from '../types/cbt';
import { filterActiveToiletRequests } from '../utils/cbtLogic';
import {
  filterScopedLockedAttempts,
  filterScopedViolations,
} from '../utils/realtimeSync';
import {
  classifyViolation,
  evaluateIncomingCriticalAlerts,
  formatViolationClock,
  type CriticalViolationAlert,
} from '../utils/violationAnalytics';

function playStaffChime(kind: 'violation' | 'toilet' | 'critical') {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    if (kind === 'critical') {
      [0, 0.18, 0.36].forEach((offset) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1046, ctx.currentTime + offset);
        osc.frequency.setValueAtTime(784, ctx.currentTime + offset + 0.08);
        gain.gain.setValueAtTime(0.11, ctx.currentTime + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + offset);
        osc.stop(ctx.currentTime + offset + 0.16);
      });
      window.setTimeout(() => {
        ctx.close().catch(() => {});
      }, 650);
      return;
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    if (kind === 'toilet') {
      osc.frequency.setValueAtTime(660, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
    } else {
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.16);
    }
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.24);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.26);
    window.setTimeout(() => {
      ctx.close().catch(() => {});
    }, 340);
  } catch {
    // Ignore autoplay or Web Audio restrictions
  }
}

function dispatchBrowserNotification(
  title: string,
  body: string,
  tag: string,
  onClickFocus?: () => void
) {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return;
  }
  if (Notification.permission !== 'granted') return;
  try {
    const notification = new Notification(title, {
      body,
      tag,
      requireInteraction: true,
    });
    notification.onclick = () => {
      try {
        window.focus();
      } catch {
        // Ignore window focus errors
      }
      onClickFocus?.();
      notification.close();
    };
  } catch {
    // Ignore browser notification errors
  }
}

export interface LiveProctorToastHubProps {
  role: Extract<Role, 'admin' | 'teacher' | 'proctor'>;
  allowedPackageIds?: string[];
  allowedClasses?: string[];
  soundEnabled?: boolean;
  desktopPushEnabled?: boolean;
  onOpenViolations?: () => void;
  onOpenMonitoring?: (packageId?: string) => void;
}

/**
 * Shared real-time floating notification hub mounted in Super Admin, Teacher, and Proctor portals.
 * Automatically surfaces newly arriving:
 * 1. Locked student exams due to violations (with inline "Buka Kunci" button)
 * 2. Student toilet leave requests (with inline "Konfirmasi Izin" button)
 * 3. Critical violation bursts (>=2 high-severity flags in 30s) & individual violations
 * without requiring any page refresh.
 */
export function LiveProctorToastHub({
  role,
  allowedPackageIds,
  allowedClasses,
  soundEnabled = true,
  desktopPushEnabled = true,
  onOpenViolations,
  onOpenMonitoring,
}: LiveProctorToastHubProps) {
  const { db, confirmToiletLeave, unlockOrResetAttempt } = useCBT();

  const scopedViolations = useMemo(
    () =>
      filterScopedViolations({
        violations: db.violations || [],
        role,
        allowedPackageIds,
        allowedClasses,
      }),
    [db.violations, role, allowedPackageIds, allowedClasses]
  );

  const scopedLockedAttempts = useMemo(
    () =>
      filterScopedLockedAttempts({
        attempts: db.attempts || [],
        maxViolationTolerance: db.security.maxViolationTolerance,
        role,
        allowedPackageIds,
        allowedClasses,
      }),
    [
      db.attempts,
      db.security.maxViolationTolerance,
      role,
      allowedPackageIds,
      allowedClasses,
    ]
  );

  const activeToiletRequests = useMemo(
    () =>
      filterActiveToiletRequests({
        requests: db.toiletRequests || [],
        role,
        allowedPackageIds,
        allowedClasses,
      }),
    [db.toiletRequests, role, allowedPackageIds, allowedClasses]
  );

  const [liveViolationToast, setLiveViolationToast] =
    useState<ViolationLog | null>(null);
  const [liveCriticalAlert, setLiveCriticalAlert] =
    useState<CriticalViolationAlert | null>(null);
  const [liveLockedToast, setLiveLockedToast] = useState<ExamAttempt | null>(null);
  const [liveToiletToast, setLiveToiletToast] =
    useState<ToiletPermissionRequest | null>(null);
  const [unlockingId, setUnlockingId] = useState<string | null>(null);

  // Track IDs known at initial mount so only newly arriving live events pop toasts
  const knownViolationIdsRef = useRef<Set<string> | null>(null);
  const knownLockedKeysRef = useRef<Set<string> | null>(null);
  const knownToiletIdsRef = useRef<Set<string> | null>(null);

  const violationTimerRef = useRef<number | null>(null);
  const criticalTimerRef = useRef<number | null>(null);
  const lockedTimerRef = useRef<number | null>(null);
  const toiletTimerRef = useRef<number | null>(null);

  // 1. Detect newly arriving violations & critical 30s bursts
  useEffect(() => {
    if (knownViolationIdsRef.current === null) {
      knownViolationIdsRef.current = new Set(scopedViolations.map((v) => v.id));
      return;
    }

    const newlyArrived = scopedViolations.filter(
      (v) => !knownViolationIdsRef.current!.has(v.id)
    );
    if (newlyArrived.length === 0) return;

    for (const v of newlyArrived) {
      knownViolationIdsRef.current.add(v.id);
    }

    const criticalAlerts = evaluateIncomingCriticalAlerts({
      allTeacherViolations: scopedViolations,
      newlyArrivedViolations: newlyArrived,
    });

    if (criticalAlerts.length > 0) {
      const topCritical = criticalAlerts[0];
      setLiveCriticalAlert(topCritical);
      setLiveViolationToast(null);

      if (desktopPushEnabled) {
        const tags = topCritical.categories.map((c) => c.englishTag).join(', ');
        dispatchBrowserNotification(
          `CRITICAL VIOLATION — ${topCritical.studentName} (${topCritical.className})`,
          `${topCritical.countInWindow}x pelanggaran berat dalam ${topCritical.windowSeconds} detik (${tags}) pada ${topCritical.packageTitle} pukul ${topCritical.clockTime}.`,
          `${role}-critical-${topCritical.studentNisn}-${topCritical.packageId}`,
          onOpenViolations
        );
      }

      if (soundEnabled) {
        playStaffChime('critical');
      }

      if (criticalTimerRef.current) window.clearTimeout(criticalTimerRef.current);
      criticalTimerRef.current = window.setTimeout(() => {
        setLiveCriticalAlert(null);
      }, 15_000);
      return;
    }

    const newest = newlyArrived[0];
    setLiveViolationToast(newest);

    if (soundEnabled) {
      playStaffChime('violation');
    }

    if (violationTimerRef.current) window.clearTimeout(violationTimerRef.current);
    violationTimerRef.current = window.setTimeout(() => {
      setLiveViolationToast(null);
    }, 10_000);
  }, [scopedViolations, soundEnabled, desktopPushEnabled, role, onOpenViolations]);

  // 2. Detect newly locked student attempts (transitioned to locked due to violations)
  useEffect(() => {
    // Key includes updatedAt/submittedAt so if a student is unlocked and later locked again, it alerts again
    const makeLockKey = (a: ExamAttempt) =>
      `${a.id}:${a.submittedAt || a.updatedAt || a.violationCount}`;

    if (knownLockedKeysRef.current === null) {
      knownLockedKeysRef.current = new Set(scopedLockedAttempts.map(makeLockKey));
      return;
    }

    const newlyLocked = scopedLockedAttempts.filter(
      (a) => !knownLockedKeysRef.current!.has(makeLockKey(a))
    );
    if (newlyLocked.length === 0) {
      // Auto-dismiss toast if that attempt was unlocked elsewhere
      if (
        liveLockedToast &&
        !scopedLockedAttempts.some((a) => a.id === liveLockedToast.id)
      ) {
        setLiveLockedToast(null);
      }
      return;
    }

    for (const a of newlyLocked) {
      knownLockedKeysRef.current.add(makeLockKey(a));
    }

    const newestLocked = newlyLocked[0];
    setLiveLockedToast(newestLocked);

    if (soundEnabled) {
      playStaffChime('critical');
    }

    if (desktopPushEnabled) {
      const pkg = db.packages.find((p) => p.id === newestLocked.packageId);
      dispatchBrowserNotification(
        `UJIAN TERKUNCI — ${newestLocked.studentName} (${newestLocked.className})`,
        `Ujian "${pkg?.title || 'CBT'}" terkunci otomatis akibat ${newestLocked.violationCount}x pelanggaran. Klik untuk membuka kunci.`,
        `${role}-locked-${newestLocked.id}`,
        () => onOpenMonitoring?.(newestLocked.packageId)
      );
    }

    if (lockedTimerRef.current) window.clearTimeout(lockedTimerRef.current);
    lockedTimerRef.current = window.setTimeout(() => {
      setLiveLockedToast(null);
    }, 30_000);
  }, [
    scopedLockedAttempts,
    liveLockedToast,
    soundEnabled,
    desktopPushEnabled,
    db.packages,
    role,
    onOpenMonitoring,
  ]);

  // 3. Detect newly arriving pending toilet permission requests
  useEffect(() => {
    const pendingReqs = activeToiletRequests.filter((r) => r.status === 'pending');

    if (knownToiletIdsRef.current === null) {
      knownToiletIdsRef.current = new Set(pendingReqs.map((r) => r.id));
      return;
    }

    const newlyArrived = pendingReqs.filter(
      (r) => !knownToiletIdsRef.current!.has(r.id)
    );
    if (newlyArrived.length === 0) {
      if (
        liveToiletToast &&
        !pendingReqs.some((r) => r.id === liveToiletToast.id)
      ) {
        setLiveToiletToast(null);
      }
      return;
    }

    for (const r of newlyArrived) {
      knownToiletIdsRef.current.add(r.id);
    }

    const newestReq = newlyArrived[0];
    setLiveToiletToast(newestReq);

    if (soundEnabled) {
      playStaffChime('toilet');
    }

    if (desktopPushEnabled) {
      dispatchBrowserNotification(
        `IZIN SISWA — ${newestReq.studentName} (${newestReq.className})`,
        `${newestReq.reason} pada ${newestReq.packageTitle}. Segera konfirmasi izin pada portal.`,
        `${role}-toilet-${newestReq.id}`
      );
    }

    if (toiletTimerRef.current) window.clearTimeout(toiletTimerRef.current);
    toiletTimerRef.current = window.setTimeout(() => {
      setLiveToiletToast(null);
    }, 30_000);
  }, [activeToiletRequests, liveToiletToast, soundEnabled, desktopPushEnabled, role]);

  useEffect(() => {
    return () => {
      if (violationTimerRef.current) window.clearTimeout(violationTimerRef.current);
      if (criticalTimerRef.current) window.clearTimeout(criticalTimerRef.current);
      if (lockedTimerRef.current) window.clearTimeout(lockedTimerRef.current);
      if (toiletTimerRef.current) window.clearTimeout(toiletTimerRef.current);
    };
  }, []);

  const hasAnyToast = Boolean(
    liveLockedToast || liveToiletToast || liveCriticalAlert || liveViolationToast
  );
  if (!hasAnyToast) return null;

  const toastCategory = liveViolationToast
    ? classifyViolation(liveViolationToast.type, liveViolationToast.detail)
    : null;
  const toastClock = liveViolationToast
    ? formatViolationClock(liveViolationToast.timestamp)
    : null;

  const lockedPkgTitle = liveLockedToast
    ? db.packages.find((p) => p.id === liveLockedToast.packageId)?.title ||
      'Paket Ujian'
    : '';

  const criticalTestId =
    role === 'proctor'
      ? 'proctor-critical-violation-banner'
      : 'critical-violation-alert-banner';
  const violationTestId =
    role === 'proctor'
      ? 'proctor-realtime-violation-toast'
      : 'realtime-violation-toast';

  return (
    <div
      data-testid="live-proctor-toast-stack"
      className="fixed bottom-24 right-3 sm:right-4 lg:bottom-6 lg:right-6 z-50 flex flex-col gap-2 w-[calc(100vw-1.5rem)] sm:w-[calc(100vw-2rem)] max-w-sm max-h-[72vh] overflow-y-auto pointer-events-none"
    >
      {/* 1. Locked Student Exam Alert (Highest Action Priority) */}
      {liveLockedToast && (
        <div
          role="alert"
          aria-live="assertive"
          data-testid="locked-exam-alert-toast"
          className="pointer-events-auto rounded-xl border-2 border-rose-600 bg-rose-700 text-white shadow-2xl p-3 sm:p-3.5"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15">
              <Lock className="h-5 w-5 text-white animate-pulse" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-rose-100">
                  UJIAN TERKUNCI PELANGGARAN
                </span>
                <button
                  type="button"
                  aria-label="Tutup notifikasi ujian terkunci"
                  onClick={() => setLiveLockedToast(null)}
                  className="rounded p-0.5 text-rose-100 hover:bg-white/15 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-1 text-sm font-bold leading-snug">
                {liveLockedToast.studentName} ({liveLockedToast.className})
              </div>
              <div className="mt-0.5 text-xs text-rose-50">
                {lockedPkgTitle} · Terkunci otomatis ({liveLockedToast.violationCount}x pelanggaran).
              </div>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  data-testid="toast-unlock-attempt-btn"
                  disabled={unlockingId === liveLockedToast.id}
                  onClick={async () => {
                    const id = liveLockedToast.id;
                    setUnlockingId(id);
                    try {
                      await unlockOrResetAttempt(id, 'unlock');
                      setLiveLockedToast(null);
                    } finally {
                      setUnlockingId(null);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 rounded-md bg-white px-2.5 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                >
                  <Unlock className="h-3.5 w-3.5" />
                  <span>
                    {unlockingId === liveLockedToast.id ? 'Membuka...' : 'Buka Kunci'}
                  </span>
                </button>
                {onOpenMonitoring && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenMonitoring(liveLockedToast.packageId);
                      setLiveLockedToast(null);
                    }}
                    className="rounded-md border border-white/40 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-white/20"
                  >
                    Lihat Monitoring
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Incoming Student Toilet Leave Request Alert */}
      {liveToiletToast && (
        <div
          role="alert"
          aria-live="assertive"
          data-testid="toilet-request-alert-toast"
          className="pointer-events-auto rounded-xl border-2 border-amber-400 dark:border-amber-600 bg-white dark:bg-slate-900 shadow-2xl ring-1 ring-amber-500/20 p-3 sm:p-3.5"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
              <DoorOpen className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                  Permintaan Izin Siswa Baru
                </span>
                <button
                  type="button"
                  aria-label="Tutup notifikasi izin siswa"
                  onClick={() => setLiveToiletToast(null)}
                  className="rounded p-0.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-1 text-xs font-bold text-slate-900 dark:text-slate-100">
                {liveToiletToast.studentName} ({liveToiletToast.className})
              </div>
              <div className="mt-0.5 text-xs text-slate-600 dark:text-slate-300 truncate">
                {liveToiletToast.reason} · {liveToiletToast.packageTitle}
              </div>
              <div className="mt-2.5 flex items-center gap-2">
                <button
                  type="button"
                  data-testid="toast-confirm-toilet-btn"
                  onClick={() => {
                    confirmToiletLeave(liveToiletToast.id);
                    setLiveToiletToast(null);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Konfirmasi Izin</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Escalated CRITICAL VIOLATION Banner (>=2 high-severity flags in 30s) */}
      {liveCriticalAlert && (
        <div
          role="alert"
          aria-live="assertive"
          data-testid={criticalTestId}
          className="pointer-events-auto rounded-xl border-2 border-red-600 bg-red-600 text-white shadow-2xl p-3 sm:p-3.5"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15">
              <Siren className="h-5 w-5 text-white animate-pulse" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-red-100">
                  CRITICAL VIOLATION · {liveCriticalAlert.clockTime}
                </span>
                <button
                  type="button"
                  aria-label="Tutup peringatan kritis"
                  onClick={() => setLiveCriticalAlert(null)}
                  className="rounded p-0.5 text-red-100 hover:bg-white/15 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-1 text-sm font-bold leading-snug">
                {liveCriticalAlert.studentName} ({liveCriticalAlert.className})
              </div>
              <div className="mt-0.5 text-xs text-red-50">
                {liveCriticalAlert.countInWindow}x pelanggaran berat dalam{' '}
                {liveCriticalAlert.windowSeconds} detik:{' '}
                <span className="font-semibold">
                  {liveCriticalAlert.categories
                    .map((c) => c.englishTag)
                    .join(', ')}
                </span>
              </div>
              {onOpenViolations && (
                <div className="mt-2.5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onOpenViolations();
                      setLiveCriticalAlert(null);
                    }}
                    className="rounded-md bg-white px-2.5 py-1 text-[11px] font-bold text-red-700 hover:bg-red-50"
                  >
                    Tindak Lanjuti Sekarang
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. Standard Real-Time Single Violation Toast */}
      {!liveCriticalAlert && liveViolationToast && toastCategory && toastClock && (
        <div
          role="alert"
          aria-live="assertive"
          data-testid={violationTestId}
          className="pointer-events-auto rounded-xl border border-rose-300 dark:border-rose-800 bg-white dark:bg-slate-900 shadow-xl ring-1 ring-rose-500/20 p-3 sm:p-3.5"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wide text-rose-600 dark:text-rose-400">
                  Pelanggaran Baru · {toastClock.time}
                </span>
                <button
                  type="button"
                  aria-label="Tutup notifikasi pelanggaran"
                  onClick={() => setLiveViolationToast(null)}
                  className="rounded p-0.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-1 text-xs font-bold text-slate-900 dark:text-slate-100">
                {toastCategory.label} ({toastCategory.englishTag})
              </div>
              <div className="mt-0.5 text-xs text-slate-600 dark:text-slate-300 truncate">
                {liveViolationToast.studentName} · {liveViolationToast.className}
              </div>
              {onOpenViolations && (
                <div className="mt-2.5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onOpenViolations();
                      setLiveViolationToast(null);
                    }}
                    className="rounded-md bg-rose-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-rose-700"
                  >
                    Lihat Log
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Compact inline alert banner shown automatically at the top of Admin, Teacher, and Proctor portals
 * whenever one or more student exams are currently locked due to violations.
 */
export function LockedExamNotifications({
  role,
  allowedPackageIds,
  allowedClasses,
  onOpenMonitoring,
}: {
  role: Extract<Role, 'admin' | 'teacher' | 'proctor'>;
  allowedPackageIds?: string[];
  allowedClasses?: string[];
  onOpenMonitoring?: (packageId?: string) => void;
}) {
  const { db, unlockOrResetAttempt } = useCBT();
  const [unlockingId, setUnlockingId] = useState<string | null>(null);

  const lockedAttempts = useMemo(
    () =>
      filterScopedLockedAttempts({
        attempts: db.attempts || [],
        maxViolationTolerance: db.security.maxViolationTolerance,
        role,
        allowedPackageIds,
        allowedClasses,
      }),
    [
      db.attempts,
      db.security.maxViolationTolerance,
      role,
      allowedPackageIds,
      allowedClasses,
    ]
  );

  if (lockedAttempts.length === 0) return null;

  return (
    <section
      aria-label="Notifikasi Ujian Siswa Terkunci"
      data-testid="locked-exam-notifications"
      className="mb-4 rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50/90 dark:bg-rose-950/35 p-3 sm:p-4 space-y-2.5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300">
            <Lock className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-xs font-bold text-rose-950 dark:text-rose-100">
              Ujian Siswa Terkunci Pelanggaran ({lockedAttempts.length})
            </h2>
            <p className="text-[11px] text-rose-800 dark:text-rose-300">
              Peserta berikut otomatis terkunci karena melewati batas pelanggaran. Klik Buka Kunci agar siswa dapat melanjutkan.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {lockedAttempts.slice(0, 6).map((att) => {
          const pkgTitle =
            db.packages.find((p) => p.id === att.packageId)?.title || 'Paket Ujian';
          return (
            <div
              key={att.id}
              data-testid={`locked-attempt-card-${att.id}`}
              className="flex items-center justify-between gap-2.5 rounded-lg border border-rose-200 dark:border-rose-800/80 bg-white dark:bg-slate-900 px-3 py-2.5 text-xs"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold text-slate-900 dark:text-slate-100 truncate">
                    {att.studentName}
                  </span>
                  <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                    ({att.className})
                  </span>
                </div>
                <div className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-400 truncate">
                  {pkgTitle} ·{' '}
                  <span className="font-mono font-semibold text-rose-600 dark:text-rose-400">
                    {att.violationCount}x pelanggaran
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  data-testid="banner-unlock-attempt-btn"
                  disabled={unlockingId === att.id}
                  onClick={async () => {
                    setUnlockingId(att.id);
                    try {
                      await unlockOrResetAttempt(att.id, 'unlock');
                    } finally {
                      setUnlockingId(null);
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60 whitespace-nowrap"
                >
                  <Unlock className="h-3.5 w-3.5" />
                  <span>{unlockingId === att.id ? 'Membuka...' : 'Buka Kunci'}</span>
                </button>
                {onOpenMonitoring && (
                  <button
                    type="button"
                    onClick={() => onOpenMonitoring(att.packageId)}
                    className="hidden sm:inline-flex items-center rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 whitespace-nowrap"
                  >
                    Detail
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
