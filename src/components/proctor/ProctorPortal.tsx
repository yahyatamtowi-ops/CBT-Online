import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BellRing,
  Calendar,
  Clock,
  Eye,
  FileText,
  KeyRound,
  Lock,
  LogOut,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useCBT } from '../../context/CBTContext';
import {
  getProctorEffectiveClassesForPackage,
  getProctorScopedPackages,
  resolveEffectiveAttemptStatus,
} from '../../utils/cbtLogic';
import { DraggableFloatingMenu } from '../DraggableFloatingMenu';
import { FullscreenToggleButton } from '../FullscreenToggleButton';
import { SchoolLogo } from '../LandingPortal';
import {
  LiveProctorToastHub,
  LockedExamNotifications,
} from '../LiveProctorToastHub';
import { ScrollToTopButton } from '../ScrollToTopButton';
import { ToiletPermissionNotifications } from '../ToiletPermissionNotifications';
import { ProctoringAnalytics } from '../teacher/ProctoringAnalytics';
import type { DesktopPushPermission } from '../teacher/TeacherPortal';
import { ViolationNotificationDashboard } from '../teacher/ViolationNotificationDashboard';

type ProctorTab = 'packages' | 'monitoring' | 'alerts';

function getBrowserNotificationPermission(): DesktopPushPermission {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return 'unsupported';
  }
  return Notification.permission;
}

export function ProctorPortal() {
  const { db, session, logout } = useCBT();
  const [activeTab, setActiveTab] = useState<ProctorTab>('packages');

  // Resolve live assignment from DB so Super Admin assignment updates apply immediately
  const liveAssignment = useMemo(() => {
    if (!session) {
      return {
        assignedPackageIds: [] as string[],
        assignedClasses: [] as string[],
        sourceLabel: 'Pengawas',
      };
    }
    if (session.proctorSource === 'proctor') {
      const account = (db.proctors || []).find((p) => p.id === session.userId);
      if (account) {
        return {
          assignedPackageIds: account.assignedPackageIds || [],
          assignedClasses: account.assignedClasses || [],
          sourceLabel: account.nip ? `Pengawas · NIP ${account.nip}` : 'Akun Pengawas',
        };
      }
    }
    if (session.proctorSource === 'teacher') {
      const teacher = db.teachers.find((t) => t.id === session.userId);
      const override = db.proctorConfig?.teacherAssignments?.[session.userId];
      return {
        assignedPackageIds:
          override?.assignedPackageIds ?? session.assignedPackageIds ?? [],
        assignedClasses:
          override?.assignedClasses ?? session.assignedClasses ?? [],
        sourceLabel: teacher?.nip
          ? `Guru Pengawas · NIP ${teacher.nip}`
          : 'Akun Guru (Pengawas)',
      };
    }
    return {
      assignedPackageIds: session.assignedPackageIds || [],
      assignedClasses: session.assignedClasses || [],
      sourceLabel: 'Pengawas Ujian',
    };
  }, [db.proctors, db.teachers, db.proctorConfig, session]);

  const scopedPackages = useMemo(
    () =>
      getProctorScopedPackages(
        db.packages,
        liveAssignment.assignedPackageIds,
        liveAssignment.assignedClasses
      ),
    [db.packages, liveAssignment.assignedPackageIds, liveAssignment.assignedClasses]
  );

  const scopedPackageIds = useMemo(
    () => scopedPackages.map((p) => p.id),
    [scopedPackages]
  );
  const scopedPackageIdSet = useMemo(
    () => new Set(scopedPackageIds),
    [scopedPackageIds]
  );

  const [selectedPackageId, setSelectedPackageId] = useState<string>(
    scopedPackages[0]?.id || ''
  );

  useEffect(() => {
    if (
      scopedPackages.length > 0 &&
      !scopedPackages.some((p) => p.id === selectedPackageId)
    ) {
      setSelectedPackageId(scopedPackages[0].id);
    }
  }, [scopedPackages, selectedPackageId]);

  const readStorageKey = session
    ? `cerdasexam_proctor_read_violations_${session.userId}`
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
      const saved = localStorage.getItem('cerdasexam_proctor_desktop_push');
      return saved !== '0';
    } catch {
      return true;
    }
  });

  const proctorViolations = useMemo(() => {
    const classSet =
      liveAssignment.assignedClasses.length > 0
        ? new Set(liveAssignment.assignedClasses)
        : null;
    return db.violations
      .filter((v) => {
        if (!scopedPackageIdSet.has(v.packageId)) return false;
        if (classSet && !classSet.has(v.className)) return false;
        return true;
      })
      .sort(
        (a, b) =>
          (Date.parse(b.timestamp) || 0) - (Date.parse(a.timestamp) || 0)
      );
  }, [db.violations, scopedPackageIdSet, liveAssignment.assignedClasses]);

  const unreadViolationIds = useMemo(() => {
    const unread = new Set<string>();
    for (const v of proctorViolations) {
      if (!readViolationIds.has(v.id)) {
        unread.add(v.id);
      }
    }
    return unread;
  }, [proctorViolations, readViolationIds]);

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
        localStorage.setItem('cerdasexam_proctor_desktop_push', next ? '1' : '0');
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
          localStorage.setItem('cerdasexam_proctor_desktop_push', '1');
        } catch {
          // Ignore storage error
        }
        return 'Desktop Push Alert berhasil diaktifkan untuk pengawas.';
      }
      return 'Izin Desktop Push Notification tidak diberikan.';
    } catch {
      return 'Gagal meminta izin notifikasi desktop.';
    }
  };



  const handleMarkAllRead = () => {
    const next = new Set(readViolationIds);
    for (const v of proctorViolations) {
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
        // Ignore storage errors
      }
    }
  };

  // EXACTLY 3 Menus as specified: Paket Ujian, Live Monitoring, Notifikasi Pelanggaran
  const navItems: Array<{
    id: ProctorTab;
    label: string;
    shortLabel: string;
    icon: React.ComponentType<{ className?: string }>;
    badgeCount?: number;
  }> = [
    {
      id: 'packages',
      label: 'Paket Ujian',
      shortLabel: 'Paket',
      icon: FileText,
    },
    {
      id: 'monitoring',
      label: 'Live Monitoring',
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
  ];

  const activeNav = navItems.find((n) => n.id === activeTab);
  const activeLabel = activeNav?.label || '';
  const activeShortLabel = activeNav?.shortLabel || activeLabel;

  return (
    <div
      data-testid="proctor-portal"
      className="min-h-screen bg-slate-50/90 dark:bg-slate-950/95 text-slate-900 dark:text-slate-100 flex batik-shell"
    >
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
              Portal Pengawas
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {db.school.schoolName}
            </div>
          </div>
        </div>

        <nav
          aria-label="Menu Pengawas"
          data-testid="proctor-sidebar-nav"
          className="flex-1 p-3 space-y-1"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                data-testid={`proctor-nav-${item.id}`}
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
              {session?.name || 'Pengawas Ujian'}
            </div>
            <div className="text-slate-500 dark:text-slate-400 truncate mt-0.5">
              {liveAssignment.sourceLabel}
            </div>
            <div className="text-[11px] text-indigo-600 dark:text-indigo-400 mt-1 truncate">
              {liveAssignment.assignedClasses.length > 0
                ? `Kelas: ${liveAssignment.assignedClasses.join(', ')}`
                : 'Mengawasi Semua Kelas Terkait'}
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
              <span className="hidden sm:inline">Portal Pengawas</span>
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
              data-testid="proctor-violation-bell-btn"
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

        {/* Unified real-time floating notifications: locked exams, toilet leave, critical & single violations */}
        <LiveProctorToastHub
          role="proctor"
          allowedPackageIds={scopedPackageIds}
          allowedClasses={liveAssignment.assignedClasses}
          soundEnabled={soundEnabled}
          desktopPushEnabled={
            desktopPushEnabled && desktopPushPermission === 'granted'
          }
          onOpenViolations={() => setActiveTab('alerts')}
          onOpenMonitoring={(pkgId) => {
            if (pkgId) setSelectedPackageId(pkgId);
            setActiveTab('monitoring');
          }}
        />

        <main className="flex-1 p-3 pb-16 sm:p-6 sm:pb-16 lg:p-8 lg:pb-10 max-w-7xl w-full mx-auto">
          <LockedExamNotifications
            role="proctor"
            allowedPackageIds={scopedPackageIds}
            allowedClasses={liveAssignment.assignedClasses}
            onOpenMonitoring={(pkgId) => {
              if (pkgId) setSelectedPackageId(pkgId);
              setActiveTab('monitoring');
            }}
          />
          <ToiletPermissionNotifications
            role="proctor"
            allowedPackageIds={scopedPackageIds}
            allowedClasses={liveAssignment.assignedClasses}
          />

          {activeTab === 'packages' && (
            <div className="space-y-4 sm:space-y-6" data-testid="proctor-packages-view">
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
                <div>
                  <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                    Paket Ujian & Kelas yang Diawasi
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                    Daftar paket ujian dan kelas sesuai penugasan Master Admin. Nilai siswa disembunyikan pada mode pengawas.
                  </p>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/40 px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 self-start sm:self-auto">
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  <span>{scopedPackages.length} Paket Diawasi</span>
                </div>
              </div>

              {scopedPackages.length === 0 ? (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center space-y-2">
                  <FileText className="h-8 w-8 mx-auto text-slate-400" />
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Belum ada paket ujian yang ditugaskan kepada akun pengawas ini.
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Hubungi Master Admin pada Menu Pengaturan untuk menambahkan penugasan paket ujian atau kelas.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {scopedPackages.map((pkg) => {
                    const effectiveClasses = getProctorEffectiveClassesForPackage(
                      pkg,
                      liveAssignment.assignedClasses
                    );
                    const classSet =
                      effectiveClasses.length > 0
                        ? new Set(effectiveClasses)
                        : null;
                    const pkgAttempts = db.attempts.filter(
                      (a) =>
                        a.packageId === pkg.id &&
                        (!classSet || classSet.has(a.className))
                    );
                    const activeCount = pkgAttempts.filter(
                      (a) =>
                        resolveEffectiveAttemptStatus(
                          a,
                          db.security.maxViolationTolerance
                        ) === 'in_progress'
                    ).length;
                    const lockedCount = pkgAttempts.filter(
                      (a) =>
                        resolveEffectiveAttemptStatus(
                          a,
                          db.security.maxViolationTolerance
                        ) === 'locked'
                    ).length;
                    const doneCount = pkgAttempts.filter(
                      (a) =>
                        resolveEffectiveAttemptStatus(
                          a,
                          db.security.maxViolationTolerance
                        ) === 'completed'
                    ).length;
                    const totalQuestions = db.questions.filter(
                      (q) => q.packageId === pkg.id
                    ).length;
                    const teacherOwner = db.teachers.find(
                      (t) => t.id === pkg.teacherId
                    );

                    return (
                      <article
                        key={pkg.id}
                        data-testid={`proctor-pkg-card-${pkg.id}`}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 flex flex-col justify-between gap-4 shadow-sm"
                      >
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-[11px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                                {pkg.subject} · {pkg.category}
                              </div>
                              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5 leading-snug">
                                {pkg.title}
                              </h2>
                              {teacherOwner && (
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                  Guru Mapel: {teacherOwner.name}
                                </p>
                              )}
                            </div>
                            <span
                              className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                                pkg.isPublished
                                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                              }`}
                            >
                              {pkg.isPublished ? 'Aktif' : 'Nonaktif'}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800 p-2.5 text-xs">
                            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                              <KeyRound className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                              <span>Token:</span>
                              <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                                {pkg.token}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                              <Clock className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                              <span className="font-mono tabular-nums">
                                {pkg.durationMinutes} mnt · {totalQuestions} soal
                              </span>
                            </div>
                            <div className="col-span-2 flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                              <Users className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                              <span className="font-semibold">Kelas Diawasi:</span>
                              <span className="truncate font-mono text-slate-900 dark:text-slate-100">
                                {effectiveClasses.length > 0
                                  ? effectiveClasses.join(', ')
                                  : 'Semua Kelas'}
                              </span>
                            </div>
                            {(pkg.scheduledDate || pkg.scheduledStartTime) && (
                              <div className="col-span-2 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                                <Calendar className="h-3.5 w-3.5 shrink-0" />
                                <span className="font-mono tabular-nums">
                                  {[
                                    pkg.scheduledDate,
                                    pkg.scheduledStartTime && pkg.scheduledEndTime
                                      ? `${pkg.scheduledStartTime}–${pkg.scheduledEndTime}`
                                      : pkg.scheduledStartTime,
                                    pkg.sessionName,
                                  ]
                                    .filter(Boolean)
                                    .join(' · ')}
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="rounded-lg border border-slate-200 dark:border-slate-800 px-2 py-2">
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                Mengerjakan
                              </div>
                              <div className="text-base font-bold font-mono tabular-nums text-indigo-600 dark:text-indigo-400">
                                {activeCount}
                              </div>
                            </div>
                            <div className="rounded-lg border border-slate-200 dark:border-slate-800 px-2 py-2">
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1">
                                <Lock className="h-3 w-3 text-rose-500" />
                                <span>Terkunci</span>
                              </div>
                              <div className="text-base font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400">
                                {lockedCount}
                              </div>
                            </div>
                            <div className="rounded-lg border border-slate-200 dark:border-slate-800 px-2 py-2">
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                Selesai
                              </div>
                              <div className="text-base font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                                {doneCount}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                          <button
                            type="button"
                            data-testid={`proctor-open-monitoring-${pkg.id}`}
                            onClick={() => {
                              setSelectedPackageId(pkg.id);
                              setActiveTab('monitoring');
                            }}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 whitespace-nowrap"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>Buka Live Monitoring</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPackageId(pkg.id);
                              setActiveTab('alerts');
                            }}
                            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 whitespace-nowrap"
                          >
                            <BellRing className="h-3.5 w-3.5" />
                            <span>Pelanggaran</span>
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'monitoring' && (
            <ProctoringAnalytics
              allowedPackages={scopedPackages}
              allowedClasses={liveAssignment.assignedClasses}
              hideScores={true}
              selectedPackageId={selectedPackageId}
              onSelectPackage={setSelectedPackageId}
            />
          )}

          {activeTab === 'alerts' && (
            <ViolationNotificationDashboard
              allowedPackages={scopedPackages}
              allowedClasses={liveAssignment.assignedClasses}
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
        </main>
      </div>

      <DraggableFloatingMenu
        portalKey="proctor"
        portalTitle="Menu Portal Pengawas"
        ariaLabel="Menu Mengambang Pengawas"
        navItems={navItems}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
      />
      <ScrollToTopButton />
    </div>
  );
}
