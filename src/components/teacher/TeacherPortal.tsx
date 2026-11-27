import React, { useState } from 'react';
import {
  Activity,
  BookOpen,
  FileText,
  LogOut,
} from 'lucide-react';
import { useCBT } from '../../context/CBTContext';
import { SchoolLogo } from '../LandingPortal';
import { ExamPackageManager } from './ExamPackageManager';
import { ProctoringAnalytics } from './ProctoringAnalytics';
import { QuestionBankEditor } from './QuestionBankEditor';

type TeacherTab = 'packages' | 'questions' | 'proctoring';

export function TeacherPortal() {
  const { db, session, logout } = useCBT();
  const teacher =
    db.teachers.find((t) => t.id === session?.userId) || db.teachers[0];

  const myPackages = db.packages.filter((p) => p.teacherId === teacher?.id);
  const [activeTab, setActiveTab] = useState<TeacherTab>('packages');
  const [selectedPackageId, setSelectedPackageId] = useState<string>(
    myPackages[0]?.id || ''
  );

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
  }> = [
    {
      id: 'packages',
      label: 'Paket Ujian Saya',
      shortLabel: 'Paket Ujian',
      icon: FileText,
    },
    {
      id: 'questions',
      label: 'Bank Soal & Editor',
      shortLabel: 'Bank Soal',
      icon: BookOpen,
    },
    {
      id: 'proctoring',
      label: 'Live Monitoring & Nilai',
      shortLabel: 'Monitor',
      icon: Activity,
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
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
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
        <header className="flex items-center justify-between gap-3 border-b border-slate-200/90 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5 min-w-0">
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
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {activeLabel}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={logout}
            className="lg:hidden inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Keluar</span>
          </button>
        </header>

        <main className="flex-1 p-4 pb-24 sm:p-6 sm:pb-24 lg:p-8 lg:pb-8 max-w-7xl w-full mx-auto">
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
        </main>
      </div>

      {/* Fixed Bottom Navigation Bar for Tablet & Mobile (< lg) */}
      <nav
        aria-label="Menu Bawah Guru"
        data-testid="teacher-bottom-nav"
        className="fixed bottom-0 inset-x-0 z-40 lg:hidden border-t border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md pb-safe shadow-[0_-4px_20px_-6px_rgba(15,23,42,0.12)]"
      >
        <div className="mx-auto grid max-w-xl grid-cols-3 items-stretch">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                aria-current={active ? 'page' : undefined}
                className={`relative flex min-h-[60px] flex-col items-center justify-center gap-1 px-2 py-2 text-[11px] font-semibold transition-colors ${
                  active
                    ? 'text-indigo-700 dark:text-indigo-400'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute top-0 inset-x-4 h-0.5 rounded-b-full bg-indigo-600 dark:bg-indigo-400"
                  />
                )}
                <Icon className="h-5 w-5 shrink-0" />
                <span className="truncate max-w-full leading-none">
                  {item.shortLabel}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
