import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  AppWindow,
  Bell,
  BellOff,
  CameraOff,
  CheckCheck,
  CheckCircle2,
  Clock,
  EyeOff,
  Filter,
  Lock,
  Mic,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Unlock,
  Users,
  UserX,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useCBT } from '../../context/CBTContext';
import type { TeacherAccount } from '../../types/cbt';
import { resolveEffectiveAttemptStatus } from '../../utils/cbtLogic';
import {
  computeViolationDashboardSummary,
  detectCriticalViolationBursts,
  type ViolationCategoryId,
} from '../../utils/violationAnalytics';
import type { DesktopPushPermission } from './TeacherPortal';

interface ViolationNotificationDashboardProps {
  teacher: TeacherAccount;
  selectedPackageId: string;
  onSelectPackage: (id: string) => void;
  unreadViolationIds: Set<string>;
  soundEnabled: boolean;
  onToggleSound: () => void;
  desktopPushPermission: DesktopPushPermission;
  desktopPushEnabled: boolean;
  onToggleDesktopPush: () => Promise<string>;
  onMarkAllRead: () => void;
}

const CORE_CATEGORIES: ViolationCategoryId[] = [
  'face_out_of_frame',
  'multiple_faces',
  'tab_switching',
];

const CATEGORY_VISUALS: Record<
  ViolationCategoryId,
  {
    icon: React.ComponentType<{ className?: string }>;
    barClass: string;
    iconBgClass: string;
    iconTextClass: string;
    borderAccentClass: string;
  }
> = {
  face_out_of_frame: {
    icon: UserX,
    barClass: 'bg-rose-500 dark:bg-rose-400',
    iconBgClass: 'bg-rose-50 dark:bg-rose-950/60',
    iconTextClass: 'text-rose-600 dark:text-rose-400',
    borderAccentClass: 'bg-rose-500',
  },
  multiple_faces: {
    icon: Users,
    barClass: 'bg-red-600 dark:bg-red-500',
    iconBgClass: 'bg-red-50 dark:bg-red-950/60',
    iconTextClass: 'text-red-600 dark:text-red-400',
    borderAccentClass: 'bg-red-600',
  },
  tab_switching: {
    icon: AppWindow,
    barClass: 'bg-amber-500 dark:bg-amber-400',
    iconBgClass: 'bg-amber-50 dark:bg-amber-950/60',
    iconTextClass: 'text-amber-700 dark:text-amber-400',
    borderAccentClass: 'bg-amber-500',
  },
  screenshot_print: {
    icon: CameraOff,
    barClass: 'bg-orange-500 dark:bg-orange-400',
    iconBgClass: 'bg-orange-50 dark:bg-orange-950/60',
    iconTextClass: 'text-orange-600 dark:text-orange-400',
    borderAccentClass: 'bg-orange-500',
  },
  head_gaze_away: {
    icon: EyeOff,
    barClass: 'bg-sky-500 dark:bg-sky-400',
    iconBgClass: 'bg-sky-50 dark:bg-sky-950/60',
    iconTextClass: 'text-sky-600 dark:text-sky-400',
    borderAccentClass: 'bg-sky-500',
  },
  notification_bar: {
    icon: BellOff,
    barClass: 'bg-violet-500 dark:bg-violet-400',
    iconBgClass: 'bg-violet-50 dark:bg-violet-950/60',
    iconTextClass: 'text-violet-600 dark:text-violet-400',
    borderAccentClass: 'bg-violet-500',
  },
  audio_talking: {
    icon: Mic,
    barClass: 'bg-teal-500 dark:bg-teal-400',
    iconBgClass: 'bg-teal-50 dark:bg-teal-950/60',
    iconTextClass: 'text-teal-600 dark:text-teal-400',
    borderAccentClass: 'bg-teal-500',
  },
  other: {
    icon: AlertOctagon,
    barClass: 'bg-slate-500 dark:bg-slate-400',
    iconBgClass: 'bg-slate-100 dark:bg-slate-800',
    iconTextClass: 'text-slate-600 dark:text-slate-300',
    borderAccentClass: 'bg-slate-400',
  },
};

export function ViolationNotificationDashboard({
  teacher,
  selectedPackageId,
  onSelectPackage,
  unreadViolationIds,
  soundEnabled,
  onToggleSound,
  desktopPushPermission,
  desktopPushEnabled,
  onToggleDesktopPush,
  onMarkAllRead,
}: ViolationNotificationDashboardProps) {
  const {
    db,
    unlockOrResetAttempt,
    pullDatabaseFromSpreadsheet,
    syncRuntime,
  } = useCBT();

  const myPackages = useMemo(
    () => db.packages.filter((p) => p.teacherId === teacher.id),
    [db.packages, teacher.id]
  );
  const myPackageIds = useMemo(
    () => myPackages.map((p) => p.id),
    [myPackages]
  );

  const [packageScope, setPackageScope] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<
    ViolationCategoryId | 'ALL'
  >('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [busyAttemptId, setBusyAttemptId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 15_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setNowMs(Date.now());
  }, [db.violations.length]);

  const effectivePackageScope =
    packageScope !== 'ALL' && myPackageIds.includes(packageScope)
      ? packageScope
      : 'ALL';

  const summary = useMemo(
    () =>
      computeViolationDashboardSummary({
        violations: db.violations,
        attempts: db.attempts,
        teacherPackageIds: myPackageIds,
        selectedPackageId: effectivePackageScope,
        categoryFilter,
        searchQuery,
        maxViolationTolerance: db.security.maxViolationTolerance,
        nowMs,
      }),
    [
      db.violations,
      db.attempts,
      myPackageIds,
      effectivePackageScope,
      categoryFilter,
      searchQuery,
      db.security.maxViolationTolerance,
      nowMs,
    ]
  );

  const criticalBursts = useMemo(
    () =>
      detectCriticalViolationBursts({
        violations: summary.allScoped.map((i) => i.log),
        nowMs,
      }),
    [summary.allScoped, nowMs]
  );

  const unreadScopedCount = useMemo(
    () =>
      summary.allScoped.filter((item) => unreadViolationIds.has(item.log.id))
        .length,
    [summary.allScoped, unreadViolationIds]
  );

  const visibleBreakdownRows = useMemo(() => {
    return summary.categoryBreakdown.filter(
      (row) => row.count > 0 || CORE_CATEGORIES.includes(row.category.id)
    );
  }, [summary.categoryBreakdown]);

  const maxCategoryCount = useMemo(() => {
    return Math.max(1, ...visibleBreakdownRows.map((row) => row.count));
  }, [visibleBreakdownRows]);

  const handleRefreshLive = async () => {
    setIsRefreshing(true);
    try {
      const res = await pullDatabaseFromSpreadsheet(undefined, { manual: true });
      setNowMs(Date.now());
      setNotice(
        res.ok ? 'Log pelanggaran berhasil disegarkan.' : res.message
      );
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleUnlockAttempt = async (
    attemptId: string,
    studentName: string
  ) => {
    setBusyAttemptId(attemptId);
    try {
      const res = await unlockOrResetAttempt(attemptId, 'unlock');
      setNotice(
        res.ok ? `Akses ujian ${studentName} berhasil dibuka.` : res.message
      );
    } finally {
      setBusyAttemptId(null);
    }
  };

  const handlePackageChange = (value: string) => {
    setPackageScope(value);
    if (value !== 'ALL' && value !== selectedPackageId) {
      onSelectPackage(value);
    }
  };

  const handlePushButtonClick = async () => {
    const msg = await onToggleDesktopPush();
    setNotice(msg);
  };

  const getAttemptForLog = (attemptId: string, packageId: string, nisn: string) => {
    return db.attempts.find(
      (a) =>
        a.id === attemptId ||
        (a.packageId === packageId && a.studentNisn.trim() === nisn.trim())
    );
  };

  const pushActive = desktopPushPermission === 'granted' && desktopPushEnabled;

  return (
    <div className="space-y-4" data-testid="violation-notification-dashboard">
      {/* Compact Header */}
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 truncate">
              Notifikasi Pelanggaran
            </h1>
            <span className="inline-flex items-center gap-1 rounded border border-emerald-200 dark:border-emerald-800/70 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300 shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live</span>
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Monitor anti-cheat real-time &amp; peringatan kritis otomatis (≥2 pelanggaran berat / 30 dtk).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <select
            value={effectivePackageScope}
            onChange={(e) => handlePackageChange(e.target.value)}
            aria-label="Filter paket ujian pada notifikasi pelanggaran"
            className="w-full sm:w-48 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100 truncate"
          >
            <option value="ALL">Semua Paket ({myPackages.length})</option>
            {myPackages.map((pkg) => (
              <option key={pkg.id} value={pkg.id}>
                {pkg.title} ({pkg.token})
              </option>
            ))}
          </select>

          <button
            type="button"
            data-testid="desktop-push-toggle-btn"
            onClick={handlePushButtonClick}
            aria-pressed={pushActive}
            aria-label={
              pushActive
                ? 'Nonaktifkan Desktop Push Alert'
                : 'Aktifkan Desktop Push Alert'
            }
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
              pushActive
                ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50'
                : desktopPushPermission === 'denied'
                  ? 'border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
                  : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            {pushActive ? (
              <Bell className="h-3.5 w-3.5" />
            ) : (
              <BellOff className="h-3.5 w-3.5" />
            )}
            <span>
              {pushActive
                ? 'Push Aktif'
                : desktopPushPermission === 'denied'
                  ? 'Push Diblokir'
                  : 'Push Desktop'}
            </span>
          </button>

          <button
            type="button"
            onClick={onToggleSound}
            aria-pressed={soundEnabled}
            aria-label={
              soundEnabled ? 'Matikan suara alert' : 'Aktifkan suara alert'
            }
            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
              soundEnabled
                ? 'border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100'
                : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            {soundEnabled ? (
              <Volume2 className="h-3.5 w-3.5" />
            ) : (
              <VolumeX className="h-3.5 w-3.5" />
            )}
            <span>{soundEnabled ? 'Suara' : 'Senyap'}</span>
          </button>

          {unreadScopedCount > 0 && (
            <button
              type="button"
              onClick={onMarkAllRead}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 whitespace-nowrap"
            >
              <CheckCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Dibaca ({unreadScopedCount})</span>
            </button>
          )}

          <button
            type="button"
            disabled={isRefreshing || syncRuntime.status === 'syncing'}
            onClick={handleRefreshLive}
            className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 whitespace-nowrap"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
            />
            <span>Segarkan</span>
          </button>
        </div>
      </div>

      {notice && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-lg border border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/90 dark:bg-indigo-950/50 px-3.5 py-2 text-xs font-medium text-indigo-800 dark:text-indigo-200"
        >
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Tutup pemberitahuan"
            className="rounded p-0.5 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Critical Violation Burst Panel (>=2 high-severity flags in 30s) */}
      {criticalBursts.length > 0 && (
        <section
          aria-labelledby="critical-alerts-heading"
          data-testid="critical-alerts-section"
          className="rounded-xl border border-red-300 dark:border-red-900 bg-red-50/80 dark:bg-red-950/35 p-3.5 space-y-2"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Siren className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
              <h2
                id="critical-alerts-heading"
                className="text-xs font-bold uppercase tracking-wide text-red-800 dark:text-red-300"
              >
                Peringatan Kritis Terdeteksi ({criticalBursts.length}) · ≥2 Flag Berat / 30 Detik
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {criticalBursts.slice(0, 4).map((burst) => {
              const attempt = getAttemptForLog(
                burst.attemptId,
                burst.packageId,
                burst.studentNisn
              );
              const isLocked =
                attempt &&
                resolveEffectiveAttemptStatus(
                  attempt,
                  db.security.maxViolationTolerance
                ) === 'locked';
              const isBusy = attempt && busyAttemptId === attempt.id;

              return (
                <div
                  key={burst.id}
                  data-testid="critical-burst-card"
                  className="flex items-center justify-between gap-2.5 rounded-lg border border-red-200 dark:border-red-800/80 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-900 dark:text-slate-100 truncate">
                        {burst.studentName}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
                        ({burst.className})
                      </span>
                      <span className="rounded bg-red-600 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white tabular-nums shrink-0">
                        {burst.countInWindow}x / {burst.windowSeconds}d
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-red-700 dark:text-red-300 truncate">
                      {burst.categories.map((c) => c.englishTag).join(' · ')} ·{' '}
                      <span className="font-mono text-slate-500 dark:text-slate-400">
                        {burst.clockTime}
                      </span>
                    </div>
                  </div>
                  {isLocked && attempt && (
                    <button
                      type="button"
                      disabled={Boolean(isBusy)}
                      onClick={() =>
                        handleUnlockAttempt(attempt.id, burst.studentName)
                      }
                      className="inline-flex items-center gap-1 rounded-md border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-1 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 shrink-0"
                    >
                      <Unlock className="h-3 w-3" />
                      <span>Buka</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Compact KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div
          data-testid="kpi-total-violations"
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2.5"
        >
          <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 dark:text-slate-400">
            <span>Total Pelanggaran</span>
            <ShieldAlert className="h-3.5 w-3.5 text-rose-500" />
          </div>
          <div className="mt-1 text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
            {summary.kpis.totalViolations}
          </div>
        </div>

        <div
          data-testid="kpi-recent-violations"
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2.5"
        >
          <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 dark:text-slate-400">
            <span>5 Menit Terakhir</span>
            <Clock
              className={`h-3.5 w-3.5 ${
                summary.kpis.last5MinCount > 0
                  ? 'text-rose-500'
                  : 'text-slate-400'
              }`}
            />
          </div>
          <div
            className={`mt-1 text-xl sm:text-2xl font-bold font-mono tabular-nums ${
              summary.kpis.last5MinCount > 0
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-slate-900 dark:text-slate-100'
            }`}
          >
            {summary.kpis.last5MinCount}
          </div>
        </div>

        <div
          data-testid="kpi-flagged-students"
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2.5"
        >
          <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 dark:text-slate-400">
            <span>Peserta Terindikasi</span>
            <Users className="h-3.5 w-3.5 text-amber-500" />
          </div>
          <div className="mt-1 text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
            {summary.kpis.uniqueStudentsCount}
          </div>
        </div>

        <div
          data-testid="kpi-high-severity"
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2.5"
        >
          <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 dark:text-slate-400">
            <span>Prioritas Tinggi</span>
            <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
          </div>
          <div className="mt-1 text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
            {summary.kpis.highSeverityCount}
          </div>
        </div>
      </div>

      {/* Visual Breakdown + Top Flagged Students */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <section
          aria-labelledby="violation-breakdown-heading"
          data-testid="violation-breakdown-chart"
          className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4"
        >
          <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
            <h2
              id="violation-breakdown-heading"
              className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200"
            >
              Jenis Pelanggaran (Klik untuk Filter)
            </h2>
            {categoryFilter !== 'ALL' && (
              <button
                type="button"
                onClick={() => setCategoryFilter('ALL')}
                className="inline-flex items-center gap-1 rounded border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300"
              >
                <X className="h-3 w-3" />
                <span>Reset</span>
              </button>
            )}
          </div>

          <div className="mt-2.5 space-y-1.5">
            {visibleBreakdownRows.map((row) => {
              const visual = CATEGORY_VISUALS[row.category.id];
              const Icon = visual.icon;
              const isSelected = categoryFilter === row.category.id;
              const widthPercent =
                row.count > 0
                  ? Math.max(8, Math.round((row.count / maxCategoryCount) * 100))
                  : 0;

              return (
                <button
                  key={row.category.id}
                  type="button"
                  aria-pressed={isSelected}
                  data-testid={`breakdown-row-${row.category.id}`}
                  onClick={() =>
                    setCategoryFilter((prev) =>
                      prev === row.category.id ? 'ALL' : row.category.id
                    )
                  }
                  className={`w-full text-left rounded-lg border px-2.5 py-2 transition-colors ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-50/70 dark:border-indigo-400 dark:bg-indigo-950/40'
                      : 'border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/70 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded ${visual.iconBgClass} ${visual.iconTextClass}`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0 flex items-baseline gap-1.5 truncate">
                        <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {row.category.shortLabel}
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          · {row.category.englishTag}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0 font-mono tabular-nums text-xs">
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {row.count}
                      </span>
                      <span className="ml-1 text-[11px] text-slate-500 dark:text-slate-400">
                        ({row.sharePercent}%)
                      </span>
                    </div>
                  </div>

                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${visual.barClass}`}
                      style={{ width: `${widthPercent}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Right: Top Flagged Students */}
        <section
          aria-labelledby="flagged-students-heading"
          data-testid="flagged-students-panel"
          className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col"
        >
          <div className="pb-2.5 border-b border-slate-100 dark:border-slate-800">
            <h2
              id="flagged-students-heading"
              className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200"
            >
              Peserta Perlu Perhatian
            </h2>
          </div>

          {summary.topOffenders.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-8 text-center">
              <ShieldCheck className="h-8 w-8 text-emerald-500 mb-1.5" />
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Ujian Kondusif · 0 Pelanggaran
              </div>
            </div>
          ) : (
            <div className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
              {summary.topOffenders.slice(0, 6).map((offender) => {
                const isLocked = offender.effectiveStatus === 'locked';
                const isBusy = busyAttemptId === offender.attemptId;
                return (
                  <div
                    key={`${offender.studentNisn}-${offender.packageId}`}
                    className="py-2.5 first:pt-0.5 last:pb-0 flex items-center justify-between gap-2.5"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                          {offender.studentName}
                        </span>
                        <span className="font-mono text-[11px] font-bold text-rose-600 dark:text-rose-400 tabular-nums shrink-0">
                          {offender.totalCount}x
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {offender.className} · {offender.latestViolation.category.englishTag} ·{' '}
                        {offender.latestViolation.relativeTime}
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-1.5">
                      {isLocked ? (
                        <button
                          type="button"
                          disabled={isBusy}
                          aria-label={`Buka Kunci ${offender.studentName}`}
                          onClick={() =>
                            handleUnlockAttempt(
                              offender.attemptId,
                              offender.studentName
                            )
                          }
                          className="inline-flex items-center gap-1 rounded-md border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-1 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 disabled:opacity-50"
                        >
                          <Unlock className="h-3 w-3" />
                          <span>{isBusy ? '...' : 'Buka Kunci'}</span>
                        </button>
                      ) : offender.effectiveStatus === 'completed' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Selesai</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                          <Lock className="hidden" />
                          <Clock className="h-3 w-3" />
                          <span>Aktif</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Compact Time-Stamped Real-Time Violation Log */}
      <section
        aria-labelledby="timestamp-log-heading"
        data-testid="violation-timestamp-log"
        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden"
      >
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <h2
              id="timestamp-log-heading"
              className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200"
            >
              Log Stempel Waktu
            </h2>
            <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
              ({summary.filtered.length}/{summary.allScoped.length})
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Cari log pelanggaran"
                placeholder="Cari siswa / NISN / jenis..."
                className="w-full sm:w-56 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 pl-8 pr-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div className="relative">
              <Filter className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <select
                value={categoryFilter}
                onChange={(e) =>
                  setCategoryFilter(e.target.value as ViolationCategoryId | 'ALL')
                }
                aria-label="Filter jenis pelanggaran"
                className="w-full sm:w-48 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 pl-8 pr-2.5 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-100"
              >
                <option value="ALL">Semua Jenis</option>
                {summary.categoryBreakdown.map((row) => (
                  <option key={row.category.id} value={row.category.id}>
                    {row.category.englishTag} ({row.count})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {summary.filtered.length === 0 ? (
          <div className="p-8 text-center">
            <ShieldCheck className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600 mb-1.5" />
            <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              {summary.allScoped.length === 0
                ? 'Belum ada log pelanggaran masuk'
                : 'Tidak ada log sesuai filter'}
            </div>
            {(categoryFilter !== 'ALL' || searchQuery.trim() !== '') && (
              <button
                type="button"
                onClick={() => {
                  setCategoryFilter('ALL');
                  setSearchQuery('');
                }}
                className="mt-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                Reset Filter
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[500px] overflow-y-auto">
            {summary.filtered.map((item) => {
              const visual = CATEGORY_VISUALS[item.category.id];
              const Icon = visual.icon;
              const isUnread = unreadViolationIds.has(item.log.id);
              const attempt = getAttemptForLog(
                item.log.attemptId,
                item.log.packageId,
                item.log.studentNisn
              );
              const attemptStatus = resolveEffectiveAttemptStatus(
                attempt,
                db.security.maxViolationTolerance
              );
              const isLocked = attempt && attemptStatus === 'locked';
              const isBusy = attempt && busyAttemptId === attempt.id;

              return (
                <article
                  key={item.log.id}
                  data-testid="violation-log-entry"
                  className={`relative flex flex-col sm:flex-row sm:items-center gap-2.5 px-4 py-2.5 transition-colors ${
                    isUnread
                      ? 'bg-rose-50/40 dark:bg-rose-950/20'
                      : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`absolute left-0 top-0 bottom-0 w-1 ${visual.borderAccentClass}`}
                  />

                  {/* Compact Timestamp */}
                  <div className="sm:w-28 shrink-0 flex sm:flex-col items-baseline sm:items-start gap-2 sm:gap-0 pl-1">
                    <time
                      dateTime={item.log.timestamp}
                      className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100 tabular-nums"
                    >
                      {item.clockTime}
                    </time>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {item.relativeTime}
                    </span>
                  </div>

                  {/* Main Details */}
                  <div className="flex-1 min-w-0 flex items-start gap-2.5">
                    <span
                      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${visual.iconBgClass} ${visual.iconTextClass}`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs">
                        <span className="font-bold text-slate-900 dark:text-slate-100">
                          {item.category.shortLabel}
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          ({item.category.englishTag})
                        </span>
                        <span className="text-slate-300 dark:text-slate-600">·</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {item.log.studentName}
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          {item.log.className}
                        </span>
                        {isUnread && (
                          <span className="rounded bg-rose-600 px-1 py-0.5 text-[9px] font-bold text-white uppercase leading-none">
                            BARU
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-400 truncate">
                        {item.log.detail || item.log.type} ·{' '}
                        <span className="text-indigo-700 dark:text-indigo-400 font-medium">
                          {item.log.packageTitle}
                        </span>
                      </p>
                    </div>
                  </div>

                  {isLocked && attempt && (
                    <div className="sm:shrink-0 pl-9 sm:pl-0">
                      <button
                        type="button"
                        disabled={Boolean(isBusy)}
                        aria-label={`Buka Kunci ${item.log.studentName} dari log`}
                        onClick={() =>
                          handleUnlockAttempt(attempt.id, item.log.studentName)
                        }
                        className="inline-flex items-center gap-1 rounded-md border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-1 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 disabled:opacity-50 whitespace-nowrap"
                      >
                        <Unlock className="h-3 w-3" />
                        <span>Buka Kunci</span>
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
