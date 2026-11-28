import React, { useMemo, useState } from 'react';
import {
  BellRing,
  CalendarClock,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useCBT } from '../../context/CBTContext';
import { filterActiveToiletRequests } from '../../utils/cbtLogic';
import { filterScopedLockedAttempts } from '../../utils/realtimeSync';
import { SchoolLogo } from '../LandingPortal';
import { ScrollToTopButton } from '../ScrollToTopButton';
import { FullscreenToggleButton } from '../FullscreenToggleButton';
import { DraggableFloatingMenu } from '../DraggableFloatingMenu';
import {
  LiveProctorToastHub,
  LockedExamNotifications,
} from '../LiveProctorToastHub';
import { ToiletPermissionNotifications } from '../ToiletPermissionNotifications';
import { AdminDashboard } from './AdminDashboard';
import { AuditBackupPanel } from './AuditBackupPanel';
import { GlobalSecuritySettings } from './GlobalSecuritySettings';
import { SessionScheduleManager } from './SessionScheduleManager';
import { UserManagement } from './UserManagement';

type AdminTab = 'dashboard' | 'users' | 'schedule' | 'security' | 'audit';

export function AdminPortal() {
  const { db, session, logout } = useCBT();
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [auditSubMenu, setAuditSubMenu] = useState<
    'cloud' | 'spreadsheet' | 'backup' | 'violations' | 'audit'
  >('cloud');

  const liveLockedCount = useMemo(
    () =>
      filterScopedLockedAttempts({
        attempts: db.attempts || [],
        maxViolationTolerance: db.security.maxViolationTolerance,
        role: 'admin',
      }).length,
    [db.attempts, db.security.maxViolationTolerance]
  );

  const pendingToiletCount = useMemo(
    () =>
      filterActiveToiletRequests({
        requests: db.toiletRequests || [],
        role: 'admin',
      }).filter((r) => r.status === 'pending').length,
    [db.toiletRequests]
  );

  const liveAlertTotal =
    liveLockedCount + pendingToiletCount + (db.violations?.length || 0);

  const openViolationsTab = () => {
    setAuditSubMenu('violations');
    setActiveTab('audit');
  };

  const navItems: Array<{
    id: AdminTab;
    label: string;
    shortLabel: string;
    icon: React.ComponentType<{ className?: string }>;
    badgeCount?: number;
  }> = [
    {
      id: 'dashboard',
      label: 'Dashboard Eksekutif',
      shortLabel: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      id: 'users',
      label: 'Manajemen Pengguna',
      shortLabel: 'Pengguna',
      icon: Users,
    },
    {
      id: 'schedule',
      label: 'Sesi & Jadwal Ujian',
      shortLabel: 'Jadwal',
      icon: CalendarClock,
    },
    {
      id: 'security',
      label: 'Keamanan, Tema & Identitas',
      shortLabel: 'Keamanan',
      icon: ShieldCheck,
    },
    {
      id: 'audit',
      label: 'Audit & Backup Data',
      shortLabel: 'Audit',
      icon: ClipboardList,
      badgeCount: db.violations.length > 0 ? db.violations.length : undefined,
    },
  ];

  const activeLabel = navItems.find((n) => n.id === activeTab)?.label || '';

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
              Portal Super Admin
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {db.school.schoolName}
            </div>
          </div>
        </div>

        <nav aria-label="Menu Super Admin" className="flex-1 p-3 space-y-1">
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
              {session?.name}
            </div>
            <div className="text-slate-500 dark:text-slate-400">
              Administrator Pusat
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
              <span className="hidden sm:inline">Super Admin</span>
              <span className="hidden sm:inline mx-1.5">/</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {activeLabel}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              data-testid="admin-live-alert-bell-btn"
              onClick={openViolationsTab}
              aria-label={
                liveAlertTotal > 0
                  ? `Buka Notifikasi Pelanggaran (${liveAlertTotal} catatan aktif)`
                  : 'Buka Notifikasi Pelanggaran'
              }
              className={`relative inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border px-2 sm:px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                liveLockedCount > 0 || pendingToiletCount > 0
                  ? 'border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50'
                  : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              <BellRing
                className={`h-3.5 w-3.5 ${
                  liveLockedCount > 0 || pendingToiletCount > 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : ''
                }`}
              />
              <span className="hidden sm:inline">Notifikasi</span>
              {liveAlertTotal > 0 && (
                <span className="rounded bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold text-white font-mono tabular-nums leading-none">
                  {liveAlertTotal > 99 ? '99+' : liveAlertTotal}
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

        <LiveProctorToastHub
          role="admin"
          onOpenViolations={openViolationsTab}
          onOpenMonitoring={() => setActiveTab('dashboard')}
        />

        <main className="flex-1 p-3 pb-16 sm:p-6 sm:pb-16 lg:p-8 lg:pb-10 max-w-7xl w-full mx-auto">
          <LockedExamNotifications
            role="admin"
            onOpenMonitoring={() => setActiveTab('dashboard')}
          />
          <ToiletPermissionNotifications role="admin" />
          {activeTab === 'dashboard' && (
            <AdminDashboard onNavigate={(t) => setActiveTab(t)} />
          )}
          {activeTab === 'users' && <UserManagement />}
          {activeTab === 'schedule' && <SessionScheduleManager />}
          {activeTab === 'security' && <GlobalSecuritySettings />}
          {activeTab === 'audit' && (
            <AuditBackupPanel initialSubMenu={auditSubMenu} />
          )}
        </main>
      </div>

      {/* Draggable Floating Navigation Button for Mobile & Tablet (< lg) */}
      <DraggableFloatingMenu
        portalKey="admin"
        portalTitle="Menu Super Admin"
        ariaLabel="Menu Mengambang Super Admin"
        navItems={navItems}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
      />
      <ScrollToTopButton />
    </div>
  );
}
