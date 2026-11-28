import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  BellRing,
  BookOpen,
  FileText,
  LogOut,
  Printer,
  ShieldAlert,
  Siren,
  X,
} from 'lucide-react';
import { useCBT } from '../../context/CBTContext';
import type { ViolationLog } from '../../types/cbt';
import {
  classifyViolation,
  evaluateIncomingCriticalAlerts,
  formatViolationClock,
  type CriticalViolationAlert,
} from '../../utils/violationAnalytics';
import { SchoolLogo } from '../LandingPortal';
import { ScrollToTopButton } from '../ScrollToTopButton';
import { FullscreenToggleButton } from '../FullscreenToggleButton';
import { DraggableFloatingMenu } from '../DraggableFloatingMenu';
import { ExamPackageManager } from './ExamPackageManager';
import { PrintResultsPanel } from './PrintResultsPanel';
import { ProctoringAnalytics } from './ProctoringAnalytics';
import { QuestionBankEditor } from './QuestionBankEditor';
import { ViolationNotificationDashboard } from './ViolationNotificationDashboard';

type TeacherTab =
  | 'packages'
  | 'questions'
  | 'proctoring'
  | 'alerts'
  | 'print_results';

export type DesktopPushPermission =
  | 'default'
  | 'granted'
  | 'denied'
  | 'unsupported';

function getBrowserNotificationPermission(): DesktopPushPermission {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return 'unsupported';
  }
  return Notification.permission;
}

function playViolationPingSound() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.16);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.24);
    window.setTimeout(() => {
      ctx.close().catch(() => {});
    }, 320);
  } catch {
    // Ignore autoplay or Web Audio restrictions
  }
}

function playCriticalAlertSound() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const pulses = [0, 0.18, 0.36];
    pulses.forEach((offset) => {
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
  } catch {
    // Ignore autoplay or Web Audio restrictions
  }
}

function dispatchCriticalDesktopPush(
  alert: CriticalViolationAlert,
  onClickFocus: () => void
): boolean {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return false;
  }
  if (Notification.permission !== 'granted') return false;
  try {
    const tags = alert.categories.map((c) => c.englishTag).join(', ');
    const notification = new Notification(
      `CRITICAL VIOLATION — ${alert.studentName} (${alert.className})`,
      {
        body: `${alert.countInWindow}x pelanggaran berat dalam ${alert.windowSeconds} detik (${tags}) pada ${alert.packageTitle} pukul ${alert.clockTime}.`,
        tag: `critical-${alert.studentNisn}-${alert.packageId}`,
        requireInteraction: true,
      }
    );
    notification.onclick = () => {
      try {
        window.focus();
      } catch {
        // Ignore window focus errors
      }
      onClickFocus();
      notification.close();
    };
    return true;
  } catch {
    return false;
  }
}

export function TeacherPortal() {
  const { db, session, logout } = useCBT();
  const teacher =
    db.teachers.find((t) => t.id === session?.userId) || db.teachers[0];

  const myPackages = useMemo(
    () => db.packages.filter((p) => p.teacherId === teacher?.id),
    [db.packages, teacher?.id]
  );
  const myPackageIds = useMemo(
    () => new Set(myPackages.map((p) => p.id)),
    [myPackages]
  );

  const [activeTab, setActiveTab] = useState<TeacherTab>('packages');
  const [selectedPackageId, setSelectedPackageId] = useState<string>(
    myPackages[0]?.id || ''
  );

  const readStorageKey = teacher
    ? `cerdasexam_teacher_read_violations_${teacher.id}`
    : '';

  const [readViolationIds, setReadViolationIds] = useState<Set<string>>(() => {
    if (!readStorageKey) return new Set();
    try {
      const raw = localStorage.getItem(readStorageKey);
      if (!raw) return new Set();
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? new Set<string>(parsed) : new Set();
    } catch {
      return new Set();
    }
  });

  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [desktopPushPermission, setDesktopPushPermission] =
    useState<DesktopPushPermission>(() => getBrowserNotificationPermission());
  const [desktopPushEnabled, setDesktopPushEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('cerdasexam_teacher_desktop_push');
      return saved !== '0';
    } catch {
      return true;
    }
  });
  const [liveToastViolation, setLiveToastViolation] =
    useState<ViolationLog | null>(null);
  const [liveCriticalAlert, setLiveCriticalAlert] =
    useState<CriticalViolationAlert | null>(null);

  const teacherViolations = useMemo(
    () =>
      db.violations
        .filter((v) => myPackageIds.has(v.packageId))
        .sort(
          (a, b) =>
            (Date.parse(b.timestamp) || 0) - (Date.parse(a.timestamp) || 0)
        ),
    [db.violations, myPackageIds]
  );

  const unreadViolationIds = useMemo(() => {
    const unread = new Set<string>();
    for (const v of teacherViolations) {
      if (!readViolationIds.has(v.id)) {
        unread.add(v.id);
      }
    }
    return unread;
  }, [teacherViolations, readViolationIds]);

  const unreadCount = unreadViolationIds.size;

  const handleToggleDesktopPush = async (): Promise<string> => {
    if (typeof Notification === 'undefined') {
      setDesktopPushPermission('unsupported');
      return 'Browser ini tidak mendukung Desktop Push Notification.';
    }

    if (Notification.permission === 'granted') {
      const next = !desktopPushEnabled;
      setDesktopPushEnabled(next);
      try {
        localStorage.setItem('cerdasexam_teacher_desktop_push', next ? '1' : '0');
      } catch {
        // Ignore storage error
      }
      return next
        ? 'Desktop Push Alert diaktifkan untuk pelanggaran kritis (30 detik).'
        : 'Desktop Push Alert dijeda sementara.';
    }

    if (Notification.permission === 'denied') {
      setDesktopPushPermission('denied');
      return 'Izin notifikasi diblokir browser. Aktifkan izin notifikasi pada pengaturan situs browser Anda.';
    }

    try {
      const perm = await Notification.requestPermission();
      setDesktopPushPermission(perm);
      if (perm === 'granted') {
        setDesktopPushEnabled(true);
        try {
          localStorage.setItem('cerdasexam_teacher_desktop_push', '1');
        } catch {
          // Ignore storage error
        }
        return 'Desktop Push Alert berhasil diaktifkan. Anda akan menerima peringatan instan saat terjadi pelanggaran kritis.';
      }
      return 'Izin Desktop Push Notification tidak diberikan.';
    } catch {
      return 'Gagal meminta izin notifikasi desktop.';
    }
  };

  // Track IDs known at mount so only newly incoming violations trigger live toast / critical push
  const knownIdsRef = useRef<Set<string> | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const criticalTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (knownIdsRef.current === null) {
      knownIdsRef.current = new Set(teacherViolations.map((v) => v.id));
      return;
    }

    const newlyArrived = teacherViolations.filter(
      (v) => !knownIdsRef.current!.has(v.id)
    );
    if (newlyArrived.length === 0) return;

    for (const v of newlyArrived) {
      knownIdsRef.current.add(v.id);
    }

    // Evaluate automated 30-second Critical Violation burst rule
    const criticalAlerts = evaluateIncomingCriticalAlerts({
      allTeacherViolations: teacherViolations,
      newlyArrivedViolations: newlyArrived,
    });

    if (criticalAlerts.length > 0) {
      const topCritical = criticalAlerts[0];
      setLiveCriticalAlert(topCritical);
      setLiveToastViolation(null);

      if (desktopPushEnabled && getBrowserNotificationPermission() === 'granted') {
        dispatchCriticalDesktopPush(topCritical, () => {
          setActiveTab('alerts');
        });
      }

      if (soundEnabled) {
        playCriticalAlertSound();
      }

      if (criticalTimerRef.current) {
        window.clearTimeout(criticalTimerRef.current);
      }
      criticalTimerRef.current = window.setTimeout(() => {
        setLiveCriticalAlert(null);
      }, 14_000);
      return;
    }

    // Standard single violation toast
    const newest = newlyArrived[0];
    setLiveToastViolation(newest);

    if (soundEnabled) {
      playViolationPingSound();
    }

    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setLiveToastViolation(null);
    }, 9000);
  }, [teacherViolations, soundEnabled, desktopPushEnabled]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
      if (criticalTimerRef.current) {
        window.clearTimeout(criticalTimerRef.current);
      }
    };
  }, []);

  const handleMarkAllRead = () => {
    const next = new Set(readViolationIds);
    for (const v of teacherViolations) {
      next.add(v.id);
    }
    setReadViolationIds(next);
    if (readStorageKey) {
      try {
        localStorage.setItem(
          readStorageKey,
          JSON.stringify([...next].slice(-500))
        );
      } catch {
        // Ignore storage quota errors
      }
    }
  };

  if (!teacher) {
    return (
      <div className="min-h-screen bg-slate-50/90 dark:bg-slate-950/95 text-slate-900 dark:text-slate-100 p-8 text-center flex flex-col items-center justify-center batik-shell">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Akun guru tidak ditemukan.
        </p>
        <button
          type="button"
          onClick={logout}
          className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
        >
          Kembali ke Beranda
        </button>
      </div>
    );
  }

  const navItems: Array<{
    id: TeacherTab;
    label: string;
    shortLabel: string;
    icon: React.ComponentType<{ className?: string }>;
    badgeCount?: number;
  }> = [
    {
      id: 'packages',
      label: 'Paket Ujian Saya',
      shortLabel: 'Paket',
      icon: FileText,
    },
    {
      id: 'questions',
      label: 'Bank Soal & Editor',
      shortLabel: 'Soal',
      icon: BookOpen,
    },
    {
      id: 'proctoring',
      label: 'Live Monitoring & Nilai',
      shortLabel: 'Monitor',
      icon: Activity,
    },
    {
      id: 'alerts',
      label: 'Notifikasi Pelanggaran',
      shortLabel: 'Notifikasi',
      icon: BellRing,
      badgeCount: unreadCount,
    },
    {
      id: 'print_results',
      label: 'Cetak Hasil (PDF)',
      shortLabel: 'Cetak PDF',
      icon: Printer,
    },
  ];

  const activeNav = navItems.find((n) => n.id === activeTab);
  const activeLabel = activeNav?.label || '';
  const activeShortLabel = activeNav?.shortLabel || activeLabel;
  const toastCategory = liveToastViolation
    ? classifyViolation(liveToastViolation.type, liveToastViolation.detail)
    : null;
  const toastClock = liveToastViolation
    ? formatViolationClock(liveToastViolation.timestamp)
    : null;

  return (
    <div className="min-h-screen bg-slate-50/90 dark:bg-slate-950/95 text-slate-900 dark:text-slate-100 flex batik-shell">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto border-r border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-200 dark:border-slate-800">
          <SchoolLogo
            src={db.school.logoUrl}
            schoolName={db.school.schoolName}
            size="sm"
          />
          <div className="min-w-0">
            <div className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
              Portal Guru
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {db.school.schoolName}
            </div>
          </div>
        </div>

        <nav aria-label="Menu Guru" className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.badgeCount !== undefined && item.badgeCount > 0 && (
                  <span className="rounded-md bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold text-white font-mono tabular-nums shrink-0">
                    {item.badgeCount > 99 ? '99+' : item.badgeCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 dark:border-slate-800 p-4 space-y-3">
          <div className="text-xs">
            <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
              {teacher.name}
            </div>
            <div className="text-slate-500 dark:text-slate-400 font-mono truncate">
              NIP {teacher.nip}
            </div>
            <div className="text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              {teacher.subjects.join(' · ')}
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Keluar Portal</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col min-w-0">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-slate-200/90 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm px-3 py-2.5 sm:px-6 sm:py-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="lg:hidden shrink-0">
              <SchoolLogo
                src={db.school.logoUrl}
                schoolName={db.school.schoolName}
                size="sm"
              />
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
              <span className="hidden sm:inline">Portal Guru</span>
              <span className="hidden sm:inline mx-1.5">/</span>
              <span className="sm:hidden font-semibold text-slate-900 dark:text-slate-100">
                {activeShortLabel}
              </span>
              <span className="hidden sm:inline font-semibold text-slate-900 dark:text-slate-100">
                {activeLabel}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              data-testid="teacher-violation-bell-btn"
              onClick={() => setActiveTab('alerts')}
              aria-label={
                unreadCount > 0
                  ? `Buka Notifikasi Pelanggaran (${unreadCount} belum dibaca)`
                  : 'Buka Notifikasi Pelanggaran'
              }
              className={`relative inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border px-2 sm:px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                activeTab === 'alerts'
                  ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                  : unreadCount > 0
                    ? 'border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50'
                    : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              <BellRing
                className={`h-3.5 w-3.5 ${unreadCount > 0 ? 'text-rose-600 dark:text-rose-400' : ''}`}
              />
              <span className="hidden sm:inline">Notifikasi</span>
              {unreadCount > 0 && (
                <span className="rounded bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold text-white font-mono tabular-nums leading-none">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            <FullscreenToggleButton variant="header" />
            <button
              type="button"
              onClick={logout}
              className="lg:hidden inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Keluar</span>
            </button>
          </div>
        </header>

        {/* Escalated CRITICAL VIOLATION floating banner (>=2 high-severity flags in 30s) */}
        {liveCriticalAlert && (
          <div
            role="alert"
            aria-live="assertive"
            data-testid="critical-violation-alert-banner"
            className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-50 w-[calc(100vw-2rem)] max-w-md rounded-xl border-2 border-red-600 bg-red-600 text-white shadow-2xl p-4"
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
                <div className="mt-2.5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('alerts');
                      setLiveCriticalAlert(null);
                    }}
                    className="rounded-md bg-white px-2.5 py-1 text-[11px] font-bold text-red-700 hover:bg-red-50"
                  >
                    Tindak Lanjuti Sekarang
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Standard real-time floating toast when a single violation arrives */}
        {!liveCriticalAlert && liveToastViolation && toastCategory && toastClock && (
          <div
            role="alert"
            aria-live="assertive"
            data-testid="realtime-violation-toast"
            className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-50 w-[calc(100vw-2rem)] max-w-sm rounded-xl border border-rose-300 dark:border-rose-800 bg-white dark:bg-slate-900 shadow-xl ring-1 ring-rose-500/20 p-4"
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
                    onClick={() => setLiveToastViolation(null)}
                    className="rounded p-0.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="mt-1 text-xs font-bold text-slate-900 dark:text-slate-100">
                  {toastCategory.label} ({toastCategory.englishTag})
                </div>
                <div className="mt-0.5 text-xs text-slate-600 dark:text-slate-300 truncate">
                  {liveToastViolation.studentName} · {liveToastViolation.className}
                </div>
                <div className="mt-2.5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('alerts');
                      setLiveToastViolation(null);
                    }}
                    className="rounded-md bg-rose-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-rose-700"
                  >
                    Lihat Log
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <main className="flex-1 p-3 pb-16 sm:p-6 sm:pb-16 lg:p-8 lg:pb-10 max-w-7xl w-full mx-auto">
          {activeTab === 'packages' && (
            <ExamPackageManager
              teacher={teacher}
              selectedPackageId={selectedPackageId}
              onSelectPackage={setSelectedPackageId}
              onOpenQuestions={(pkgId) => {
                setSelectedPackageId(pkgId);
                setActiveTab('questions');
              }}
              onOpenProctoring={(pkgId) => {
                setSelectedPackageId(pkgId);
                setActiveTab('proctoring');
              }}
            />
          )}
          {activeTab === 'questions' && (
            <QuestionBankEditor
              teacher={teacher}
              selectedPackageId={selectedPackageId}
              onSelectPackage={setSelectedPackageId}
            />
          )}
          {activeTab === 'proctoring' && (
            <ProctoringAnalytics
              teacher={teacher}
              selectedPackageId={selectedPackageId}
              onSelectPackage={setSelectedPackageId}
            />
          )}
          {activeTab === 'alerts' && (
            <ViolationNotificationDashboard
              teacher={teacher}
              selectedPackageId={selectedPackageId}
              onSelectPackage={setSelectedPackageId}
              unreadViolationIds={unreadViolationIds}
              soundEnabled={soundEnabled}
              onToggleSound={() => setSoundEnabled((prev) => !prev)}
              desktopPushPermission={desktopPushPermission}
              desktopPushEnabled={desktopPushEnabled}
              onToggleDesktopPush={handleToggleDesktopPush}
              onMarkAllRead={handleMarkAllRead}
            />
          )}
          {activeTab === 'print_results' && (
            <PrintResultsPanel
              teacher={teacher}
              selectedPackageId={selectedPackageId}
              onSelectPackage={setSelectedPackageId}
            />
          )}
        </main>
      </div>

      {/* Draggable Floating Navigation Button for Mobile & Tablet (< lg) */}
      <DraggableFloatingMenu
        portalKey="teacher"
        portalTitle="Menu Portal Guru"
        ariaLabel="Menu Mengambang Guru"
        navItems={navItems}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
      />
      <ScrollToTopButton />
    </div>
  );
}
