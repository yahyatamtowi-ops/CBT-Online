import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Clock,
  GraduationCap,
  KeyRound,
  Lock,
  Megaphone,
  ShieldCheck,
} from 'lucide-react';
import { useCBT } from '../context/CBTContext';
import {
  computeStudentExamProgress,
  lookupStudentAvailableTokens,
} from '../utils/cbtLogic';
import { StaffLoginPage, type StaffRole } from './StaffLoginPage';
import { ExamProgressBar } from './student/ExamProgressBar';
import { FullscreenToggleButton } from './FullscreenToggleButton';

export function SchoolLogo({
  src,
  schoolName,
  size = 'md',
}: {
  src?: string;
  schoolName: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const dim =
    size === 'sm'
      ? 'h-9 w-9'
      : size === 'xl'
        ? 'h-20 w-20 sm:h-24 sm:w-24'
        : size === 'lg'
          ? 'h-16 w-16 sm:h-20 sm:w-20'
          : 'h-12 w-12';

  const iconDim =
    size === 'sm'
      ? 'h-5 w-5'
      : size === 'xl'
        ? 'h-10 w-10'
        : size === 'lg'
          ? 'h-8 w-8'
          : 'h-6 w-6';

  if (!src || failed) {
    return (
      <div
        className={`${dim} flex shrink-0 items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300`}
        aria-label={`Logo ${schoolName}`}
      >
        <GraduationCap className={iconDim} />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`Logo ${schoolName}`}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${dim} shrink-0 rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white object-contain p-1`}
    />
  );
}

export function LandingPortal() {
  const { db, loginStudent } = useCBT();

  // Separate full-screen page state for Guru & Super Admin login
  const [staffLoginRole, setStaffLoginRole] = useState<StaffRole | null>(null);

  // Student login state (NISN + Token only)
  const [nisn, setNisn] = useState('');
  const [token, setToken] = useState('');
  const [studentError, setStudentError] = useState<string | null>(null);

  // Automatic real-time token lookup whenever NISN is typed
  const tokenLookup = useMemo(
    () =>
      lookupStudentAvailableTokens({
        nisn,
        students: db.students,
        packages: db.packages,
        schedule: db.schedule,
      }),
    [db.packages, db.schedule, db.students, nisn]
  );

  const previewProgress = useMemo(() => {
    if (tokenLookup.status !== 'ready') return null;
    return computeStudentExamProgress({
      student: tokenLookup.student,
      packages: db.packages,
      questions: db.questions,
      attempts: db.attempts,
    });
  }, [db.attempts, db.packages, db.questions, tokenLookup]);

  // Render separate full-screen login page for Guru & Super Admin
  if (staffLoginRole) {
    return (
      <StaffLoginPage
        initialRole={staffLoginRole}
        onBackToStudent={() => setStaffLoginRole(null)}
      />
    );
  }

  const handleStudentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStudentError(null);
    const res = loginStudent({ nisn, token });
    if (!res.ok) {
      setStudentError(res.error || 'Gagal masuk ke Portal Siswa.');
    }
  };

  const activeSecurityFeatures = [
    db.security.requireFullscreen && 'Layar Penuh',
    db.security.requireCameraMonitoring && 'Kamera & Audio Pengawas',
    db.security.detectTabSwitchAndSplitScreen && 'Deteksi Pindah Tab',
    db.security.blockRightClickAndCopyPaste && 'Blokir Copy-Paste',
    db.security.enableDynamicWatermark && 'Watermark Dinamis',
  ].filter(Boolean) as string[];

  return (
    <div className="min-h-screen bg-slate-50/90 dark:bg-slate-950/95 text-slate-900 dark:text-slate-100 flex flex-col batik-shell">
      {/* Top Utility Bar: Fullscreen Bar + Icon-Only Staff Login Triggers */}
      <div className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6 sm:pt-5 flex items-center justify-between gap-2">
        <FullscreenToggleButton variant="landing" />
        <div
          role="group"
          aria-label="Akses Portal Pengelola"
          className="inline-flex items-center gap-1 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm p-1 shadow-xs"
        >
          <button
            type="button"
            onClick={() => setStaffLoginRole('teacher')}
            aria-label="Login Guru"
            title="Login Guru"
            className="inline-flex h-10 w-10 sm:h-9 sm:w-9 items-center justify-center rounded-lg text-slate-600 dark:text-slate-300 transition-colors hover:bg-indigo-50 hover:text-indigo-700 dark:hover:bg-indigo-950/70 dark:hover:text-indigo-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            <BookOpen className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setStaffLoginRole('admin')}
            aria-label="Login Super Admin"
            title="Login Super Admin"
            className="inline-flex h-10 w-10 sm:h-9 sm:w-9 items-center justify-center rounded-lg text-slate-600 dark:text-slate-300 transition-colors hover:bg-indigo-50 hover:text-indigo-700 dark:hover:bg-indigo-950/70 dark:hover:text-indigo-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Main Content: Application Identity + Student Portal Card */}
      <main className="mx-auto flex w-full max-w-6xl flex-1 items-center px-4 py-5 sm:px-6 sm:py-8 lg:py-10">
        <section className="grid w-full grid-cols-1 gap-6 sm:gap-8 lg:grid-cols-12 lg:items-center">
          {/* Left Column: Keterangan Identitas Aplikasi (Logo Centered Above Full-Width Text) */}
          <div className="lg:col-span-7 space-y-5 sm:space-y-6">
            <div className="flex flex-col items-center text-center">
              <div className="rounded-2xl bg-white/95 dark:bg-slate-900/95 p-2 shadow-xs ring-1 ring-slate-200/80 dark:ring-slate-800">
                <SchoolLogo
                  src={db.school.logoUrl}
                  schoolName={db.school.schoolName}
                  size="lg"
                />
              </div>

              <div className="mt-4 w-full space-y-2">
                <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-400">
                  CerdasExam CBT · {db.school.academicYear}
                </p>
                <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100 text-balance leading-tight">
                  {db.school.schoolName}
                </h1>
                <p className="mx-auto max-w-2xl text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
                  Aplikasi Ujian Berbasis Komputer (Computer-Based Test) resmi sekolah dengan verifikasi NISN, token sesi otomatis, dan pengawasan anti-curang terpadu.
                </p>
              </div>
            </div>

            {/* Active School Announcement: Icon & Label Centered Above Full-Width Body */}
            {db.school.announcementActive && (
              <div className="rounded-2xl border border-amber-200/90 bg-amber-50/85 dark:border-amber-800/70 dark:bg-amber-950/35 backdrop-blur-xs p-4 sm:p-5 shadow-2xs">
                <div className="flex items-center justify-center gap-2 pb-2.5 border-b border-amber-200/70 dark:border-amber-800/50">
                  <Megaphone className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" />
                  <p className="text-xs font-bold text-amber-800 dark:text-amber-300">
                    Pengumuman Aktif Sekolah
                  </p>
                </div>
                <div className="mt-3 space-y-1.5 text-center sm:text-left">
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                    {db.school.announcementTitle}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                    {db.school.announcementText}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Bilah Portal Siswa + Keamanan Ujian Aktif Below */}
          <div className="lg:col-span-5 space-y-4">
            <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm p-5 sm:p-7 shadow-sm">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 shrink-0">
                  <GraduationCap className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Portal Siswa
                  </h2>
                  <p className="hidden sm:block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Masukkan NISN Anda untuk memunculkan Token Ujian aktif.
                  </p>
                </div>
              </div>

              {studentError && (
                <div
                  role="alert"
                  className="mt-4 flex items-start gap-2.5 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 px-3.5 py-3 text-xs text-rose-800 dark:text-rose-200"
                >
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                  <span>{studentError}</span>
                </div>
              )}

              <form onSubmit={handleStudentSubmit} className="mt-4 sm:mt-5 space-y-4">
                {/* NISN Field */}
                <div>
                  <label
                    htmlFor="student-nisn"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    NISN
                  </label>
                  <input
                    id="student-nisn"
                    type="text"
                    inputMode="numeric"
                    value={nisn}
                    onChange={(e) => {
                      setNisn(e.target.value);
                      setStudentError(null);
                    }}
                    placeholder="Ketikkan NISN peserta ujian"
                    autoComplete="off"
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm font-mono text-slate-900 dark:text-slate-100 placeholder:font-sans placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                  />
                </div>

                {/* Automatic Token Display Right Below NISN Input */}
                {tokenLookup.status === 'ready' && (
                  <div
                    data-testid="auto-token-box"
                    className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-950/40 p-3.5 space-y-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-800 dark:text-emerald-300 min-w-0">
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                        <span className="truncate">{tokenLookup.student.name}</span>
                      </span>
                      <span className="font-mono text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 shrink-0">
                        Kelas {tokenLookup.student.className}
                      </span>
                    </div>

                    {previewProgress && previewProgress.totalAssigned > 0 && (
                      <div className="border-t border-emerald-200/70 dark:border-emerald-800/60 pt-2.5">
                        <ExamProgressBar
                          testId="landing-student-progress-bar"
                          value={previewProgress.completionPercent}
                          label={`Progres Ujian (${previewProgress.completedCount}/${previewProgress.totalAssigned} selesai)`}
                          tone={previewProgress.completionPercent === 100 ? 'emerald' : 'indigo'}
                          size="sm"
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      {tokenLookup.packages.map((pkg) => (
                        <div
                          key={pkg.id}
                          className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200/80 dark:border-emerald-800/80 bg-white dark:bg-slate-900 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                              {pkg.subject}
                            </div>
                            <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                              {pkg.title}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="block text-[10px] uppercase tracking-wider text-slate-400">
                              Token
                            </span>
                            <span className="inline-flex items-center gap-1 font-mono text-sm font-bold tracking-widest text-indigo-700 dark:text-indigo-400 select-all">
                              <KeyRound className="h-3.5 w-3.5" />
                              <span>{pkg.token}</span>
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <p className="text-[11px] text-emerald-800 dark:text-emerald-300 leading-relaxed">
                      Ketikkan Token yang muncul di atas pada bilah <strong>Token Ujian</strong> di bawah.
                    </p>
                  </div>
                )}

                {tokenLookup.status === 'blocked' && (
                  <div
                    role="alert"
                    className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 px-3.5 py-2.5 text-xs text-rose-800 dark:text-rose-200"
                  >
                    <strong>{tokenLookup.student.name}</strong> ({tokenLookup.student.className}) — Akses ujian sedang dinonaktifkan
                    {tokenLookup.student.blockReason
                      ? ` (${tokenLookup.student.blockReason})`
                      : ''}
                    . Hubungi Administrator.
                  </div>
                )}

                {tokenLookup.status === 'schedule_closed' && (
                  <div className="flex items-start gap-2 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-3.5 py-2.5 text-xs text-amber-900 dark:text-amber-200">
                    <Clock className="h-4 w-4 shrink-0 mt-0.5 text-amber-700 dark:text-amber-400" />
                    <div>
                      <div className="font-semibold">
                        {tokenLookup.student.name} ({tokenLookup.student.className})
                      </div>
                      <div className="mt-0.5">{tokenLookup.reason}</div>
                    </div>
                  </div>
                )}

                {tokenLookup.status === 'no_exam' && (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-3.5 py-2.5 text-xs text-slate-600 dark:text-slate-300">
                    Peserta terverifikasi: <strong>{tokenLookup.student.name}</strong> (Kelas{' '}
                    {tokenLookup.student.className}). Belum ada paket ujian aktif untuk kelas Anda saat ini.
                  </div>
                )}

                {tokenLookup.status === 'not_found' && nisn.trim().length >= 5 && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    NISN belum ditemukan pada database sekolah. Pastikan nomor NISN benar.
                  </p>
                )}

                {/* Token Ujian Field */}
                <div>
                  <label
                    htmlFor="student-token"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Token Ujian
                  </label>
                  <input
                    id="student-token"
                    type="text"
                    value={token}
                    onChange={(e) => {
                      setToken(e.target.value.toUpperCase());
                      setStudentError(null);
                    }}
                    placeholder="Ketikkan Token Ujian yang muncul"
                    autoComplete="off"
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm font-mono uppercase tracking-wider text-slate-900 dark:text-slate-100 placeholder:normal-case placeholder:tracking-normal placeholder:font-sans placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full min-h-[46px] rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                >
                  Masuk Portal Siswa
                </button>
              </form>
            </div>

            {/* Active Security Summary Moved Directly Below Student Login Card */}
            <div
              data-testid="active-security-note"
              className="flex items-start gap-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/75 backdrop-blur-xs px-4 py-3 text-xs text-slate-600 dark:text-slate-400"
            >
              <Lock className="h-4 w-4 shrink-0 mt-0.5 text-indigo-600 dark:text-indigo-400" />
              <p className="leading-relaxed">
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  Keamanan Ujian Aktif:{' '}
                </span>
                {activeSecurityFeatures.length > 0
                  ? `${activeSecurityFeatures.join(' · ')} (toleransi maksimal ${db.security.maxViolationTolerance}x peringatan).`
                  : 'Mode ujian fleksibel.'}
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
