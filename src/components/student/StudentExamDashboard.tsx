import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  FileCheck2,
  Lock,
  LogOut,
  Play,
  RotateCcw,
} from 'lucide-react';
import { useCBT } from '../../context/CBTContext';
import type { StudentRecord } from '../../types/cbt';
import {
  computeStudentExamProgress,
  type AssignedExamProgressItem,
} from '../../utils/cbtLogic';
import { SchoolLogo } from '../LandingPortal';
import { ExamProgressBar, type ProgressTone } from './ExamProgressBar';

type FilterTab = 'all' | 'not_started' | 'in_progress' | 'completed';

interface StudentExamDashboardProps {
  student: StudentRecord;
  activeSessionPackageId?: string;
  onSelectExamForStart: (packageId: string) => void;
  onSelectExamForResult: (packageId: string) => void;
  onLogout: () => void;
}

function getStatusMeta(item: AssignedExamProgressItem): {
  label: string;
  tone: ProgressTone;
  textClass: string;
} {
  if (item.status === 'completed') {
    return {
      label: 'Selesai Dikumpulkan',
      tone: 'emerald',
      textClass: 'text-emerald-700 dark:text-emerald-400',
    };
  }
  if (item.status === 'locked') {
    return {
      label: 'Terkunci Sistem',
      tone: 'rose',
      textClass: 'text-rose-700 dark:text-rose-400',
    };
  }
  if (item.status === 'in_progress') {
    return {
      label: 'Sedang Dikerjakan',
      tone: 'amber',
      textClass: 'text-amber-700 dark:text-amber-400',
    };
  }
  return {
    label: 'Belum Dikerjakan',
    tone: 'indigo',
    textClass: 'text-slate-600 dark:text-slate-400',
  };
}

export function StudentExamDashboard({
  student,
  activeSessionPackageId,
  onSelectExamForStart,
  onSelectExamForResult,
  onLogout,
}: StudentExamDashboardProps) {
  const { db } = useCBT();
  const [filter, setFilter] = useState<FilterTab>('all');

  const progress = useMemo(
    () =>
      computeStudentExamProgress({
        student,
        packages: db.packages,
        questions: db.questions,
        attempts: db.attempts,
      }),
    [db.attempts, db.packages, db.questions, student]
  );

  const filteredItems = useMemo(() => {
    if (filter === 'all') return progress.items;
    if (filter === 'completed') {
      return progress.items.filter(
        (i) => i.status === 'completed' || i.status === 'locked'
      );
    }
    return progress.items.filter((i) => i.status === filter);
  }, [filter, progress.items]);

  const featuredItem = useMemo(() => {
    if (activeSessionPackageId) {
      const match = progress.items.find(
        (item) => item.examPackage.id === activeSessionPackageId
      );
      if (match) return match;
    }
    return progress.items.find(
      (item) => item.status === 'in_progress' || item.status === 'not_started'
    );
  }, [activeSessionPackageId, progress.items]);

  const showScores = db.security.showScoreAndExplanationAuto;

  const filterTabs: { id: FilterTab; label: string; count: number }[] = [
    { id: 'all', label: 'Semua', count: progress.totalAssigned },
    { id: 'not_started', label: 'Belum Mulai', count: progress.notStartedCount },
    { id: 'in_progress', label: 'Berjalan', count: progress.inProgressCount },
    { id: 'completed', label: 'Selesai', count: progress.completedCount },
  ];

  return (
    <div className="min-h-screen bg-slate-50/90 dark:bg-slate-950/95 text-slate-900 dark:text-slate-100 flex flex-col batik-shell">
      {/* Clean Single-Row Top Bar */}
      <header className="border-b border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-6 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <SchoolLogo
              src={db.school.logoUrl}
              schoolName={db.school.schoolName}
              size="sm"
            />
            <span className="truncate text-sm sm:text-base font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap">
              {db.school.schoolName}
            </span>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <div className="hidden sm:block text-right text-xs">
              <div className="font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                {student.name}
              </div>
              <div className="font-mono text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
                {student.nisn} · Kelas {student.className}
              </div>
            </div>

            <button
              type="button"
              onClick={onLogout}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors hover:bg-slate-100 dark:hover:bg-slate-700 whitespace-nowrap shrink-0"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Keluar</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-7 sm:px-6 sm:py-9 space-y-8">
        {/* Page Heading + Student Identity Metadata */}
        <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-400">
              Portal Siswa · {db.school.academicYear}
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 text-balance">
              Dashboard Progres Ujian
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              <span>{student.name}</span>
              <span aria-hidden="true" className="mx-1.5 text-slate-400">·</span>
              <span className="font-mono tabular-nums">NISN {student.nisn}</span>
              <span aria-hidden="true" className="mx-1.5 text-slate-400">·</span>
              <span>Kelas {student.className}</span>
            </p>
          </div>

          {featuredItem && (
            <button
              type="button"
              onClick={() => {
                if (
                  featuredItem.status === 'completed' ||
                  featuredItem.status === 'locked'
                ) {
                  onSelectExamForResult(featuredItem.examPackage.id);
                } else {
                  onSelectExamForStart(featuredItem.examPackage.id);
                }
              }}
              className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white transition-colors hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 whitespace-nowrap shrink-0"
            >
              {featuredItem.status === 'completed' || featuredItem.status === 'locked' ? (
                <>
                  <FileCheck2 className="h-4 w-4" aria-hidden="true" />
                  <span>Lihat Hasil Sesi Ini</span>
                </>
              ) : featuredItem.status === 'in_progress' ? (
                <>
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  <span>Lanjutkan Ujian Aktif</span>
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" aria-hidden="true" />
                  <span>Mulai Ujian Terpilih</span>
                </>
              )}
            </button>
          )}
        </section>

        {/* Primary Focal Anchor: Overall Assigned Exam Completion Progress */}
        <section
          aria-label="Ringkasan Penyelesaian Ujian"
          data-testid="student-progress-overview"
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-7 space-y-6"
        >
          <ExamProgressBar
            testId="overall-exam-progress-bar"
            value={progress.completionPercent}
            label="Progres Penyelesaian Ujian Ditugaskan"
            sublabel={
              progress.totalAssigned > 0
                ? `${progress.completedCount} dari ${progress.totalAssigned} paket ujian telah selesai dikumpulkan`
                : 'Belum ada paket ujian yang ditugaskan untuk kelas Anda saat ini'
            }
            tone={progress.completionPercent === 100 && progress.totalAssigned > 0 ? 'emerald' : 'indigo'}
            size="lg"
          />

          {/* Clean Hairline-Divided 4-Column KPI Strip (No Nested Card Boxes) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-4 sm:gap-y-0 sm:divide-x divide-slate-200/80 dark:divide-slate-800 border-t border-slate-100 dark:border-slate-800 pt-5">
            <div className="sm:pr-5">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Total Ditugaskan
              </div>
              <div className="mt-1 font-mono text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                {progress.totalAssigned}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                paket ujian
              </div>
            </div>

            <div className="sm:px-5">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Selesai
              </div>
              <div className="mt-1 font-mono text-2xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                {progress.completedCount}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {progress.lockedCount > 0
                  ? `${progress.lockedCount} terkunci sistem`
                  : 'terkumpul aman'}
              </div>
            </div>

            <div className="sm:px-5">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Sedang Berjalan
              </div>
              <div className="mt-1 font-mono text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                {progress.inProgressCount}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                perlu dilanjutkan
              </div>
            </div>

            <div className="sm:pl-5">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Belum Dikerjakan
              </div>
              <div className="mt-1 font-mono text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                {progress.notStartedCount}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {showScores && progress.averageScore !== null
                  ? `Rata-rata nilai: ${progress.averageScore}`
                  : 'menunggu dimulai'}
              </div>
            </div>
          </div>
        </section>

        {/* Assigned Exams List with Individual Progress Bars */}
        <section className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Daftar Ujian Kelas {student.className}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Pantau progres pengerjaan setiap paket ujian dan pilih paket untuk memulai atau melihat hasil.
              </p>
            </div>

            {/* Interactive Segmented Filter Controls */}
            <div
              role="tablist"
              aria-label="Filter status ujian"
              className="grid grid-cols-2 sm:inline-flex items-center gap-1 rounded-lg bg-slate-200/70 dark:bg-slate-800/90 p-1 shrink-0"
            >
              {filterTabs.map((tab) => {
                const active = filter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setFilter(tab.id)}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 text-center ${
                      active
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    {tab.label}{' '}
                    <span className="font-mono tabular-nums opacity-75">
                      ({tab.count})
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-200/80 dark:divide-slate-800">
            {filteredItems.length === 0 ? (
              <div className="px-6 py-12 text-center space-y-3">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {progress.totalAssigned === 0
                    ? 'Belum ada ujian yang ditugaskan untuk kelas Anda'
                    : 'Tidak ada ujian pada kategori filter ini'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  {progress.totalAssigned === 0
                    ? 'Paket ujian akan muncul otomatis begitu guru pengampu memublikasikannya untuk kelas Anda.'
                    : 'Gunakan tombol di bawah untuk menampilkan kembali seluruh daftar ujian yang ditugaskan.'}
                </p>
                {filter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setFilter('all')}
                    className="inline-flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 whitespace-nowrap"
                  >
                    Tampilkan Semua Ujian
                  </button>
                )}
              </div>
            ) : (
              filteredItems.map((item) => {
                const { examPackage, attempt, status, totalQuestions, answeredCount, itemCompletionPercent } = item;
                const statusMeta = getStatusMeta(item);
                const isSessionPkg = examPackage.id === activeSessionPackageId;
                const isFinished = status === 'completed' || status === 'locked';
                const canShowScore =
                  isFinished &&
                  attempt?.score !== undefined &&
                  (showScores || examPackage.category === 'Latihan Mandiri');

                const progressCaption = isFinished
                  ? status === 'locked'
                    ? 'Sesi terkunci dan dikumpulkan'
                    : `Terkumpul · ${answeredCount} dari ${totalQuestions} soal dijawab`
                  : status === 'in_progress'
                    ? `${answeredCount} dari ${totalQuestions} soal terjawab`
                    : `0 dari ${totalQuestions} soal terjawab`;

                return (
                  <div
                    key={examPackage.id}
                    data-testid={`exam-progress-row-${examPackage.id}`}
                    className="p-5 sm:px-6 sm:py-5 flex flex-col lg:flex-row lg:items-center justify-between gap-5 transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/35"
                  >
                    {/* Left: Exam Identity & Unboxed Metadata */}
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                        <span className="font-semibold text-indigo-700 dark:text-indigo-400">
                          {examPackage.subject}
                        </span>
                        <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
                        <span className="text-slate-600 dark:text-slate-400">
                          {examPackage.category}
                        </span>
                        <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
                        <span className="font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                          {totalQuestions} soal / {examPackage.durationMinutes} menit
                        </span>
                        {isSessionPkg && (
                          <>
                            <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
                            <span className="font-semibold text-slate-900 dark:text-slate-100">
                              Sesi Login Aktif
                            </span>
                          </>
                        )}
                      </div>

                      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 leading-snug">
                        {examPackage.title}
                      </h3>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        <span className={`inline-flex items-center gap-1.5 font-semibold ${statusMeta.textClass}`}>
                          {status === 'completed' ? (
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          ) : status === 'locked' ? (
                            <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          ) : (
                            <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          )}
                          <span>{statusMeta.label}</span>
                        </span>

                        {canShowScore && attempt?.score !== undefined && (
                          <>
                            <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
                            <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                              Nilai: {attempt.score} (KKM {examPackage.kkm})
                            </span>
                          </>
                        )}

                        {isFinished && attempt?.submittedAt && (
                          <>
                            <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
                            <span className="font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                              Selesai {new Date(attempt.submittedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Middle: Per-Exam Progress Bar */}
                    <div className="w-full lg:w-64 shrink-0">
                      <ExamProgressBar
                        value={itemCompletionPercent}
                        label={progressCaption}
                        tone={statusMeta.tone}
                        size="sm"
                      />
                    </div>

                    {/* Right: Action CTA */}
                    <div className="shrink-0">
                      {isFinished ? (
                        <button
                          type="button"
                          onClick={() => onSelectExamForResult(examPackage.id)}
                          className="inline-flex min-h-[40px] w-full lg:w-auto items-center justify-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 transition-colors hover:bg-slate-100 dark:hover:bg-slate-700 whitespace-nowrap"
                        >
                          <span>Lihat Hasil</span>
                          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onSelectExamForStart(examPackage.id)}
                          className={`inline-flex min-h-[40px] w-full lg:w-auto items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                            status === 'in_progress'
                              ? 'bg-amber-600 text-white hover:bg-amber-700'
                              : 'bg-indigo-600 text-white hover:bg-indigo-700'
                          }`}
                        >
                          <span>
                            {status === 'in_progress' ? 'Lanjutkan Ujian' : 'Mulai Ujian'}
                          </span>
                          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
