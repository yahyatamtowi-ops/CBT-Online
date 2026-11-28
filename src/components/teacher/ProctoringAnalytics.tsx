import React, { useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock,
  Download,
  Lock,
  PlusCircle,
  RefreshCw,
  RotateCcw,
  Unlock,
} from 'lucide-react';
import { useCBT } from '../../context/CBTContext';
import type { ExamPackage, TeacherAccount } from '../../types/cbt';
import {
  buildGradesCSV,
  computeItemAnalysis,
  findStudentPackageAttempt,
  isQuestionAnswered,
  resolveEffectiveAttemptStatus,
} from '../../utils/cbtLogic';

export function ProctoringAnalytics({
  teacher,
  allowedPackages,
  allowedClasses,
  hideScores = false,
  selectedPackageId,
  onSelectPackage,
}: {
  teacher?: TeacherAccount;
  allowedPackages?: ExamPackage[];
  allowedClasses?: string[];
  hideScores?: boolean;
  selectedPackageId: string;
  onSelectPackage: (id: string) => void;
}) {
  const {
    db,
    unlockOrResetAttempt,
    addExtraTimeToAttempt,
    pullDatabaseFromSpreadsheet,
    syncRuntime,
  } = useCBT();
  const [subView, setSubView] = useState<'proctoring' | 'analysis'>('proctoring');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [notice, setNotice] = useState<string | null>(null);
  const [busyAttemptId, setBusyAttemptId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const myPackages = allowedPackages
    ? allowedPackages
    : teacher
      ? db.packages.filter((p) => p.teacherId === teacher.id)
      : db.packages;
  const currentPkg =
    myPackages.find((p) => p.id === selectedPackageId) || myPackages[0];

  if (!currentPkg) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-sm text-slate-600 dark:text-slate-400">
        Belum ada paket ujian untuk dipantau.
      </div>
    );
  }

  const normalizedAllowedClasses = (allowedClasses || []).filter(Boolean);
  const pkgQuestions = db.questions.filter((q) => q.packageId === currentPkg.id);
  const pkgAttempts = db.attempts.filter(
    (a) =>
      a.packageId === currentPkg.id &&
      (normalizedAllowedClasses.length === 0 ||
        normalizedAllowedClasses.includes(a.className))
  );
  const attemptedStudentIds = new Set(pkgAttempts.map((a) => a.studentId));
  const attemptedStudentNisns = new Set(
    pkgAttempts.map((a) => a.studentNisn.trim()).filter(Boolean)
  );
  const targetStudents = db.students.filter((s) => {
    const matchesAllowedClass =
      normalizedAllowedClasses.length === 0 ||
      normalizedAllowedClasses.includes(s.className);
    if (!matchesAllowedClass) return false;
    return (
      currentPkg.targetClasses.length === 0 ||
      currentPkg.targetClasses.includes(s.className) ||
      attemptedStudentIds.has(s.id) ||
      attemptedStudentNisns.has(s.nisn.trim())
    );
  });

  // Merge target students with their authoritative attempt status so locked students ALWAYS show "Buka Kunci"
  const rosterRows = targetStudents.map((student) => {
    const attempt = findStudentPackageAttempt(
      pkgAttempts,
      student,
      currentPkg.id,
      db.security.maxViolationTolerance
    );
    const status = resolveEffectiveAttemptStatus(
      attempt,
      db.security.maxViolationTolerance
    );
    return { student, attempt, status };
  });

  const filteredRoster = rosterRows.filter(
    (r) => statusFilter === 'ALL' || r.status === statusFilter
  );

  const itemAnalysis = computeItemAnalysis(pkgQuestions, pkgAttempts);

  const completedCount = rosterRows.filter((r) => r.status === 'completed').length;
  const inProgressCount = rosterRows.filter((r) => r.status === 'in_progress').length;
  const lockedCount = rosterRows.filter((r) => r.status === 'locked').length;
  const notStartedCount = rosterRows.filter((r) => r.status === 'not_started').length;

  const handleRefreshLive = async () => {
    setIsRefreshing(true);
    try {
      const res = await pullDatabaseFromSpreadsheet(undefined, { manual: true });
      setNotice(
        res.ok
          ? 'Data Live Monitoring berhasil diperbarui dari server.'
          : res.message
      );
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleExportCSV = () => {
    const csv = buildGradesCSV(currentPkg, pkgAttempts);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rekap-nilai-${currentPkg.token.toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setNotice('Rekap nilai dan status kejujuran berhasil diunduh dalam format CSV.');
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {hideScores ? 'Live Monitoring Pengawas' : 'Live Monitoring & Analisis Soal'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {hideScores
              ? 'Pantau progres peserta real-time, kejujuran, dan buka kunci siswa yang terkunci pelanggaran.'
              : 'Pantau peserta real-time, buka kunci pelanggaran, tambah waktu & analisis soal.'}
          </p>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:flex-nowrap items-center gap-2 shrink-0">
          <select
            value={currentPkg.id}
            onChange={(e) => onSelectPackage(e.target.value)}
            aria-label="Pilih paket ujian untuk monitoring"
            className="col-span-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 w-full sm:w-64 truncate"
          >
            {myPackages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} ({p.token})
              </option>
            ))}
          </select>

          <button
            type="button"
            disabled={isRefreshing || syncRuntime.status === 'syncing'}
            onClick={handleRefreshLive}
            className={`${hideScores ? 'col-span-2' : ''} inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 whitespace-nowrap shrink-0`}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Memuat...' : 'Segarkan'}</span>
          </button>

          {!hideScores && (
            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 whitespace-nowrap shrink-0"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export CSV</span>
            </button>
          )}
        </div>
      </div>

      {notice && (
        <div
          role="status"
          className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 px-3.5 py-2.5 text-xs font-medium text-emerald-800 dark:text-emerald-200"
        >
          {notice}
        </div>
      )}

      {/* Summary Strip */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 sm:p-4">
          <div className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">Belum Login</div>
          <div className="mt-1 text-xl font-bold font-mono tabular-nums text-slate-700 dark:text-slate-200">
            {notStartedCount}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 sm:p-4">
          <div className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">Mengerjakan</div>
          <div className="mt-1 text-xl font-bold font-mono tabular-nums text-indigo-700 dark:text-indigo-400">
            {inProgressCount}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 sm:p-4">
          <div className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">Terkunci</div>
          <div className="mt-1 text-xl font-bold font-mono tabular-nums text-rose-700 dark:text-rose-400">
            {lockedCount}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 sm:p-4">
          <div className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">Selesai</div>
          <div className="mt-1 text-xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
            {completedCount}
          </div>
        </div>
      </div>

      {/* View Switcher & Status Filter (Symmetric full-width grids on mobile) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
        {!hideScores ? (
          <div
            role="tablist"
            aria-label="Sub Menu Monitoring"
            className="grid grid-cols-2 sm:inline-flex gap-1 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-100/90 dark:bg-slate-900/80 p-1 w-full sm:w-auto"
          >
            <button
              type="button"
              role="tab"
              aria-selected={subView === 'proctoring'}
              onClick={() => setSubView('proctoring')}
              className={`min-h-[36px] rounded-lg px-2.5 sm:px-3.5 py-1.5 text-[11px] sm:text-xs font-semibold transition-colors whitespace-nowrap ${
                subView === 'proctoring'
                  ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 shadow-xs ring-1 ring-slate-200/70 dark:ring-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <span className="sm:hidden">Proctoring ({rosterRows.length})</span>
              <span className="hidden sm:inline">Proctoring Dashboard ({rosterRows.length})</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={subView === 'analysis'}
              onClick={() => setSubView('analysis')}
              className={`min-h-[36px] rounded-lg px-2.5 sm:px-3.5 py-1.5 text-[11px] sm:text-xs font-semibold transition-colors whitespace-nowrap ${
                subView === 'analysis'
                  ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 shadow-xs ring-1 ring-slate-200/70 dark:ring-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <span className="sm:hidden">Analisis Soal ({pkgQuestions.length})</span>
              <span className="hidden sm:inline">Analisis Butir Soal ({pkgQuestions.length})</span>
            </button>
          </div>
        ) : (
          <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            Total Peserta Diawasi: <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{rosterRows.length}</span> siswa
          </div>
        )}

        {subView === 'proctoring' && (
          <div className="grid grid-cols-6 sm:flex gap-1 rounded-xl border border-slate-200/70 dark:border-slate-800 bg-slate-100/90 dark:bg-slate-900/80 p-1 w-full sm:w-auto">
            {(
              [
                ['ALL', 'Semua', 'col-span-2'],
                ['in_progress', 'Aktif', 'col-span-2'],
                ['locked', 'Terkunci', 'col-span-2'],
                ['completed', 'Selesai', 'col-span-3'],
                ['not_started', 'Belum Login', 'col-span-3'],
              ] as const
            ).map(([val, label, spanClass]) => (
              <button
                key={val}
                type="button"
                onClick={() => setStatusFilter(val)}
                className={`${spanClass} sm:col-span-1 min-h-[32px] rounded-lg px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-semibold transition-colors whitespace-nowrap ${
                  statusFilter === val
                    ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 shadow-xs ring-1 ring-slate-200/70 dark:ring-slate-700'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* PROCTORING TABLE */}
      {subView === 'proctoring' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3 font-semibold">Peserta</th>
                  <th className="px-4 py-3 font-semibold">Status & Progres</th>
                  <th className="px-4 py-3 font-semibold">Kejujuran</th>
                  {!hideScores && (
                    <th className="px-4 py-3 font-semibold text-right">Nilai</th>
                  )}
                  <th className="px-4 py-3 font-semibold text-right">
                    {hideScores ? 'Aksi Pengawas' : 'Aksi Cepat Guru'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredRoster.map(({ student, attempt, status }) => {
                  const answeredCount = attempt
                    ? pkgQuestions.filter((q) =>
                        isQuestionAnswered(q, attempt.answers[q.id])
                      ).length
                    : 0;
                  return (
                    <tr key={student.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {student.name}
                        </div>
                        <div className="font-mono text-slate-500 dark:text-slate-400">
                          {student.nisn} · {student.className}
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        {status === 'not_started' && (
                          <span className="text-slate-500 dark:text-slate-400 font-medium">
                            Belum Login
                          </span>
                        )}
                        {status === 'in_progress' && attempt && (
                          <div>
                            <div className="inline-flex items-center gap-1 font-semibold text-indigo-700 dark:text-indigo-400">
                              <Clock className="h-3.5 w-3.5" />
                              <span>
                                Sedang Mengerjakan · Soal #{attempt.currentQuestionIndex + 1}
                              </span>
                            </div>
                            <div className="text-slate-500 dark:text-slate-400 font-mono mt-0.5 tabular-nums">
                              Terjawab {answeredCount}/{pkgQuestions.length}
                              {attempt.extraMinutes > 0 && ` · +${attempt.extraMinutes}m ekstra`}
                            </div>
                          </div>
                        )}
                        {status === 'locked' && (
                          <div className="inline-flex items-center gap-1 font-semibold text-rose-700 dark:text-rose-400">
                            <Lock className="h-3.5 w-3.5" />
                            <span>Terkunci Pelanggaran</span>
                          </div>
                        )}
                        {status === 'completed' && (
                          <div className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Selesai Dikumpulkan</span>
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        {!attempt ? (
                          <span className="text-slate-400">—</span>
                        ) : attempt.violationCount === 0 ? (
                          <span className="font-medium text-emerald-700 dark:text-emerald-400">
                            Jujur (0x)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-400">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            <span className="font-mono tabular-nums">
                              {attempt.violationCount}x pelanggaran
                            </span>
                          </span>
                        )}
                      </td>

                      {!hideScores && (
                        <td className="px-4 py-3.5 text-right font-mono tabular-nums">
                          {attempt?.score !== undefined ? (
                            <div>
                              <span
                                className={`font-bold text-sm ${
                                  attempt.score >= currentPkg.kkm
                                    ? 'text-emerald-700 dark:text-emerald-400'
                                    : 'text-rose-700 dark:text-rose-400'
                                }`}
                              >
                                {attempt.score}
                              </span>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                {attempt.score >= currentPkg.kkm ? 'Lulus KKM' : 'Remedial'}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      )}

                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        {attempt ? (
                          <div className="inline-flex items-center gap-1.5">
                            {busyAttemptId === attempt.id ? (
                              <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                                <RefreshCw className="h-3 w-3 animate-spin" />
                                <span>Menyimpan...</span>
                              </span>
                            ) : (
                              <>
                                {status === 'locked' && (
                                  <button
                                    type="button"
                                    aria-label={`Buka Kunci ${student.name}`}
                                    onClick={async () => {
                                      setBusyAttemptId(attempt.id);
                                      try {
                                        const res = await unlockOrResetAttempt(attempt.id, 'unlock');
                                        setNotice(res.message);
                                      } finally {
                                        setBusyAttemptId(null);
                                      }
                                    }}
                                    className="inline-flex items-center gap-1 rounded-md border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60"
                                  >
                                    <Unlock className="h-3 w-3" />
                                    <span>Buka Kunci</span>
                                  </button>
                                )}
                                {status === 'in_progress' && (
                                  <button
                                    type="button"
                                    aria-label={`Tambah 5 Menit ${student.name}`}
                                    onClick={() => {
                                      addExtraTimeToAttempt(attempt.id, 5);
                                      setNotice(
                                        `Waktu pengerjaan ${student.name} ditambah +5 menit.`
                                      );
                                    }}
                                    className="inline-flex items-center gap-1 rounded-md border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/50 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50"
                                  >
                                    <PlusCircle className="h-3 w-3" />
                                    <span>+5 Menit</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  aria-label={`Reset ${student.name}`}
                                  onClick={async () => {
                                    setBusyAttemptId(attempt.id);
                                    try {
                                      const res = await unlockOrResetAttempt(attempt.id, 'reset');
                                      setNotice(res.message);
                                    } finally {
                                      setBusyAttemptId(null);
                                    }
                                  }}
                                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                                >
                                  <RotateCcw className="h-3 w-3" />
                                  <span>Reset</span>
                                </button>
                              </>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">Menunggu login</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filteredRoster.length === 0 && (
                  <tr>
                    <td colSpan={hideScores ? 4 : 5} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                      Tidak ada peserta pada kategori status ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ITEM ANALYSIS VIEW */}
      {!hideScores && subView === 'analysis' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Analisis Tingkat Kesukaran Butir Soal
              </h2>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Dihitung dari {completedCount + lockedCount} peserta yang telah selesai/dikunci
            </span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {itemAnalysis.map((row) => {
              const barColor =
                row.difficultyLabel === 'Mudah'
                  ? 'bg-emerald-500'
                  : row.difficultyLabel === 'Sedang'
                  ? 'bg-amber-500'
                  : row.difficultyLabel === 'Sukar'
                  ? 'bg-rose-500'
                  : 'bg-slate-300 dark:bg-slate-700';
              const textColor =
                row.difficultyLabel === 'Mudah'
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : row.difficultyLabel === 'Sedang'
                  ? 'text-amber-700 dark:text-amber-400'
                  : row.difficultyLabel === 'Sukar'
                  ? 'text-rose-700 dark:text-rose-400'
                  : 'text-slate-500 dark:text-slate-400';

              return (
                <div key={row.questionId} className="p-5 space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div className="space-y-0.5 max-w-2xl">
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                          Soal #{row.questionNumber}
                        </span>
                        <span className="mx-1.5">·</span>
                        <span className={`font-semibold ${textColor}`}>
                          Kategori: {row.difficultyLabel}
                        </span>
                      </div>
                      <p className="text-xs text-slate-800 dark:text-slate-200 line-clamp-2">
                        {row.prompt}
                      </p>
                    </div>

                    <div className="text-left sm:text-right font-mono text-xs tabular-nums shrink-0">
                      <div className="font-bold text-slate-900 dark:text-slate-100">
                        {row.correctPercent}% Benar
                      </div>
                      <div className="text-slate-500 dark:text-slate-400">
                        {row.correctCount} benar · {row.wrongCount} salah
                      </div>
                    </div>
                  </div>

                  <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${barColor}`}
                      style={{ width: `${row.correctPercent}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {itemAnalysis.length === 0 && (
              <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                Belum ada butir soal untuk dianalisis pada paket ujian ini.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
