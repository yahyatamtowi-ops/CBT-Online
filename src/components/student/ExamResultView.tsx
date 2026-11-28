import React, { useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Lock,
  LogOut,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { useCBT } from '../../context/CBTContext';
import type { ExamAttempt, ExamPackage, Question } from '../../types/cbt';
import {
  evaluateQuestionCorrectness,
  isAttemptViolationLocked,
} from '../../utils/cbtLogic';
import { SchoolLogo } from '../LandingPortal';

export function ExamResultView({
  attempt,
  examPackage,
  questions,
  onBackToDashboard,
  onLogout,
}: {
  attempt: ExamAttempt;
  examPackage: ExamPackage;
  questions: Question[];
  onBackToDashboard?: () => void;
  onLogout: () => void;
}) {
  const { db, pullDatabaseFromSpreadsheet } = useCBT();
  const [checkingUnlock, setCheckingUnlock] = useState(false);
  const [checkMsg, setCheckMsg] = useState<string | null>(null);
  const isLocked = isAttemptViolationLocked(attempt, db.security.maxViolationTolerance);
  const showScoreAndReview =
    db.security.showScoreAndExplanationAuto ||
    examPackage.category === 'Latihan Mandiri';

  const handleCheckUnlock = async () => {
    setCheckingUnlock(true);
    setCheckMsg(null);
    try {
      const res = await pullDatabaseFromSpreadsheet(undefined, { manual: true });
      if (!res.ok) {
        setCheckMsg(res.message);
      } else {
        setCheckMsg('Status terbaru berhasil diperiksa. Jika guru sudah membuka kunci, sesi akan otomatis terbuka.');
      }
    } finally {
      setCheckingUnlock(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/90 dark:bg-slate-950/95 text-slate-900 dark:text-slate-100 flex flex-col batik-shell">
      <header className="border-b border-slate-200/90 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <SchoolLogo
              src={db.school.logoUrl}
              schoolName={db.school.schoolName}
              size="sm"
            />
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {db.school.schoolName}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Bukti Pengumpulan Ujian CBT</div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onBackToDashboard && (
              <button
                type="button"
                onClick={onBackToDashboard}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 whitespace-nowrap"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Dashboard Progres</span>
              </button>
            )}
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 dark:bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:hover:bg-indigo-700 whitespace-nowrap"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Kembali ke Beranda</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6 space-y-6">
        {/* Status Banner */}
        <section
          className={`rounded-xl border p-6 space-y-4 ${
            isLocked
              ? 'border-rose-300 dark:border-rose-800 bg-rose-50/70 dark:bg-rose-950/30'
              : 'border-emerald-200 dark:border-emerald-900 bg-white dark:bg-slate-900'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              {isLocked ? (
                <Lock className="h-8 w-8 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              )}
              <div>
                <p
                  className={`text-xs font-bold ${
                    isLocked ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'
                  }`}
                >
                  {isLocked
                    ? attempt.lockReason || 'Terkunci Sistem (Indikasi Kecurangan)'
                    : 'Ujian Berhasil Dikumpulkan'}
                </p>
                <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                  {examPackage.title}
                </h1>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  Peserta: <strong className="text-slate-900 dark:text-slate-100">{attempt.studentName}</strong> · NISN{' '}
                  <span className="font-mono">{attempt.studentNisn}</span> · Kelas{' '}
                  {attempt.className}
                </p>
              </div>
            </div>

            {showScoreAndReview && attempt.score !== undefined && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-6 py-4 text-center shrink-0">
                <div className="text-xs text-slate-500 dark:text-slate-400">Nilai Akhir</div>
                <div
                  className={`text-3xl font-bold font-mono tabular-nums mt-0.5 ${
                    attempt.score >= examPackage.kkm
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-rose-700 dark:text-rose-400'
                  }`}
                >
                  {attempt.score}
                </div>
                <div className="text-xs font-semibold mt-1 text-slate-700 dark:text-slate-200">
                  {attempt.score >= examPackage.kkm
                    ? `Lulus (KKM ${examPackage.kkm})`
                    : `Belum Tuntas (KKM ${examPackage.kkm})`}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-slate-200/80 dark:border-slate-800 pt-4 text-xs">
            <div>
              <span className="text-slate-500 dark:text-slate-400 block">Status Kejujuran</span>
              <span
                className={`font-semibold ${
                  isLocked
                    ? 'text-rose-700 dark:text-rose-400'
                    : attempt.violationCount === 0
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-amber-700 dark:text-amber-400'
                }`}
              >
                {isLocked
                  ? `Terkunci (${attempt.violationCount}x)`
                  : attempt.violationCount === 0
                  ? 'Jujur (0 Pelanggaran)'
                  : `${attempt.violationCount}x Peringatan`}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block">Jawaban Benar</span>
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                {showScoreAndReview
                  ? `${attempt.correctCount ?? 0} / ${questions.length}`
                  : 'Disembunyikan Admin'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block">Waktu Selesai</span>
              <span className="font-mono text-slate-700 dark:text-slate-300 tabular-nums">
                {attempt.submittedAt
                  ? new Date(attempt.submittedAt).toLocaleTimeString('id-ID')
                  : '-'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block">Kategori Paket</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{examPackage.category}</span>
            </div>
          </div>

          {isLocked && (
            <div className="rounded-lg border border-rose-200 dark:border-rose-800 bg-white/80 dark:bg-slate-900/80 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs text-rose-800 dark:text-rose-200">
                  Sesi Anda dikunci otomatis karena melampaui batas toleransi pelanggaran keamanan. Hubungi guru pengampu untuk membuka kunci ujian.
                </p>
                {checkMsg && (
                  <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                    {checkMsg}
                  </p>
                )}
              </div>
              <button
                type="button"
                disabled={checkingUnlock}
                onClick={handleCheckUnlock}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 disabled:opacity-60 whitespace-nowrap shrink-0"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${checkingUnlock ? 'animate-spin' : ''}`} />
                <span>{checkingUnlock ? 'Memeriksa...' : 'Cek Status Buka Kunci'}</span>
              </button>
            </div>
          )}
        </section>

        {/* Automatic Pembahasan Review */}
        {showScoreAndReview ? (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Pembahasan & Evaluasi Jawaban
              </h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {questions.length} butir soal
              </span>
            </div>

            {questions.map((q, idx) => {
              const ans = attempt.answers[q.id];
              const res = evaluateQuestionCorrectness(
                q,
                ans,
                attempt.essayGrades?.[q.id]
              );

              const lookupOption = (optId: string) => {
                const found = q.options?.find((o) => o.id === optId);
                return found ? `${optId}. ${found.text}` : optId;
              };

              const formatAnswer = (val: typeof ans) => {
                if (val === undefined || val === null) return 'Tidak dijawab';
                if (q.type === 'essay') {
                  return typeof val === 'string' && val.trim()
                    ? val.trim()
                    : 'Tidak dijawab';
                }
                if (typeof val === 'boolean') return val ? 'BENAR' : 'SALAH';
                if (Array.isArray(val))
                  return val.length > 0 ? val.map(lookupOption).join(' · ') : 'Tidak dijawab';
                if (typeof val === 'object') {
                  return Object.entries(val)
                    .map(([pairId, chosen]) => {
                      const left =
                        q.matchingPairs?.find((p) => p.id === pairId)?.left || pairId;
                      return `${left} → ${chosen || '-'}`;
                    })
                    .join(' · ');
                }
                return lookupOption(val);
              };

              const formatKey = () => {
                if (q.type === 'essay') return q.essayAnswerKey || '-';
                if (q.type === 'single_choice')
                  return q.correctOptionId ? lookupOption(q.correctOptionId) : '-';
                if (q.type === 'multiple_choice')
                  return (q.correctOptionIds || []).map(lookupOption).join(' · ');
                if (q.type === 'true_false') return q.correctBoolean ? 'BENAR' : 'SALAH';
                if (q.type === 'matching') {
                  return (q.matchingPairs || [])
                    .map((p) => `${p.left} → ${p.right}`)
                    .join(' · ');
                }
                return '-';
              };

              const essaySimilarityPct =
                q.type === 'essay' && res.essayGrade
                  ? res.essayGrade.matchPercent
                  : null;

              return (
                <article
                  key={q.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-xs flex flex-wrap items-center gap-1.5">
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                        Soal #{idx + 1}
                      </span>
                      <span className="text-slate-400">·</span>
                      <span
                        className={`inline-flex items-center gap-1 font-semibold ${
                          res.isCorrect
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : res.earnedPoints > 0
                              ? 'text-amber-700 dark:text-amber-400'
                              : 'text-rose-700 dark:text-rose-400'
                        }`}
                      >
                        {res.isCorrect ? (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>
                              {q.type === 'essay'
                                ? `Sesuai Makna (${essaySimilarityPct}%)`
                                : 'Benar'}
                            </span>
                          </>
                        ) : res.earnedPoints > 0 && q.type === 'essay' ? (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Sebagian Sesuai ({essaySimilarityPct}%)</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="h-3.5 w-3.5" />
                            <span>
                              {q.type === 'essay' && essaySimilarityPct !== null
                                ? `Kurang Tepat (${essaySimilarityPct}%)`
                                : 'Kurang Tepat'}
                            </span>
                          </>
                        )}
                      </span>
                    </div>
                    <span className="font-mono text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      +{res.earnedPoints} / {res.maxPoints} poin
                    </span>
                  </div>

                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 leading-relaxed">
                    {q.prompt}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-3">
                      <span className="text-slate-500 dark:text-slate-400 block">Jawaban Anda</span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100 whitespace-pre-wrap">
                        {formatAnswer(ans)}
                      </span>
                    </div>
                    <div className="rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50/70 dark:bg-emerald-950/40 p-3">
                      <span className="text-emerald-700 dark:text-emerald-400 block">
                        {q.type === 'essay' ? 'Kunci Jawaban Acuan Makna' : 'Kunci Jawaban'}
                      </span>
                      <span className="font-semibold text-emerald-950 dark:text-emerald-200 whitespace-pre-wrap">
                        {formatKey()}
                      </span>
                    </div>
                  </div>

                  {q.type === 'essay' && res.essayGrade?.feedback && (
                    <div className="rounded-lg border border-indigo-100 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/30 px-3 py-2 text-xs text-indigo-900 dark:text-indigo-200">
                      <span className="font-semibold">Evaluasi Koreksi Otomatis: </span>
                      {res.essayGrade.feedback}
                    </div>
                  )}

                  <div className="text-xs text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-2.5">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">Pembahasan: </span>
                    {q.explanation}
                  </div>
                </article>
              );
            })}
          </section>
        ) : (
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center space-y-2">
            <ShieldCheck className="h-8 w-8 mx-auto text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Nilai & Pembahasan Disembunyikan Sementara
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Administrator sekolah menonaktifkan penayangan nilai otomatis. Hasil ujian Anda telah tercatat aman dan akan diumumkan oleh guru pengampu.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
