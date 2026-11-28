import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Lock,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { useCBT } from '../context/CBTContext';
import { SchoolLogo } from './LandingPortal';

export type StaffRole = 'teacher' | 'proctor' | 'admin';

interface StaffLoginPageProps {
  initialRole: StaffRole;
  onBackToStudent: () => void;
}

export function StaffLoginPage({
  initialRole,
  onBackToStudent,
}: StaffLoginPageProps) {
  const { db, loginTeacher, loginProctor, loginAdmin } = useCBT();
  const [role, setRole] = useState<StaffRole>(initialRole);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const proctorEnabled = db.proctorConfig?.enabled !== false;
  const allowTeacherAsProctor = db.proctorConfig?.allowTeacherAccountsAsProctor !== false;

  const handleRoleSwitch = (nextRole: StaffRole) => {
    setRole(nextRole);
    setUsername('');
    setPassword('');
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (role === 'teacher') {
      const res = loginTeacher(username, password);
      if (!res.ok) setError(res.error || 'Gagal masuk ke Portal Guru.');
    } else if (role === 'proctor') {
      const res = loginProctor(username, password);
      if (!res.ok) setError(res.error || 'Gagal masuk ke Portal Pengawas.');
    } else {
      const res = loginAdmin(username, password);
      if (!res.ok) setError(res.error || 'Gagal masuk ke Portal Super Admin.');
    }
  };

  const userInputId =
    role === 'teacher'
      ? 'teacher-user'
      : role === 'proctor'
        ? 'proctor-user'
        : 'admin-user';
  const passInputId =
    role === 'teacher'
      ? 'teacher-pass'
      : role === 'proctor'
        ? 'proctor-pass'
        : 'admin-pass';

  return (
    <div
      data-testid="staff-login-page"
      className="min-h-screen bg-slate-50/90 dark:bg-slate-950/95 text-slate-900 dark:text-slate-100 flex flex-col batik-shell"
    >
      {/* Top Bar: Back to Student Portal */}
      <div className="mx-auto w-full max-w-5xl px-4 pt-5 sm:px-6 flex items-center justify-between">
        <button
          type="button"
          onClick={onBackToStudent}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xs px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-xs transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          <span>Kembali ke Portal Siswa</span>
        </button>
      </div>

      {/* Centered Separate Staff Login View */}
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6">
        {/* School Identity Centered Above Form */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="rounded-2xl bg-white/95 dark:bg-slate-900/95 p-2 shadow-xs ring-1 ring-slate-200/80 dark:ring-slate-800">
            <SchoolLogo
              src={db.school.logoUrl}
              schoolName={db.school.schoolName}
              size="lg"
            />
          </div>
          <p className="mt-3 text-xs font-semibold text-indigo-700 dark:text-indigo-400">
            CerdasExam CBT · {db.school.academicYear}
          </p>
          <h1 className="mt-1 text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {db.school.schoolName}
          </h1>
        </div>

        {/* Dedicated Staff Login Card */}
        <div className="w-full rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm p-6 sm:p-7 shadow-sm">
          {/* Role Switcher */}
          <div
            role="tablist"
            aria-label="Pilih Portal Pengelola"
            className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={role === 'teacher'}
              onClick={() => handleRoleSwitch('teacher')}
              className={`inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                role === 'teacher'
                  ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <BookOpen className="h-3.5 w-3.5 shrink-0" />
              <span>Guru</span>
            </button>
            <button
              type="button"
              role="tab"
              data-testid="staff-tab-proctor"
              aria-selected={role === 'proctor'}
              onClick={() => handleRoleSwitch('proctor')}
              className={`inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                role === 'proctor'
                  ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <UserCheck className="h-3.5 w-3.5 shrink-0" />
              <span>Pengawas</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={role === 'admin'}
              onClick={() => handleRoleSwitch('admin')}
              className={`inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                role === 'admin'
                  ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
              <span>Admin</span>
            </button>
          </div>

          <div className="mt-5 pb-4 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {role === 'teacher'
                ? 'Masuk Portal Guru'
                : role === 'proctor'
                  ? 'Masuk Portal Pengawas Ujian'
                  : 'Masuk Portal Super Admin'}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {role === 'teacher'
                ? 'Kelola paket ujian, bank soal, serta pantau nilai kelas Anda.'
                : role === 'proctor'
                  ? allowTeacherAsProctor
                    ? 'Pantau ujian & buka kunci siswa. Bisa masuk dengan akun Pengawas atau akun Guru.'
                    : 'Pantau ujian & buka kunci siswa menggunakan akun Pengawas dari Super Admin.'
                  : 'Kendali penuh manajemen pengguna, jadwal sesi, tema, dan keamanan.'}
            </p>
          </div>

          {role === 'proctor' && !proctorEnabled && (
            <div
              role="alert"
              className="mt-4 flex items-start gap-2.5 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-3.5 py-3 text-xs text-amber-900 dark:text-amber-200"
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <span>
                Mode Pengawas Ujian saat ini dinonaktifkan oleh Super Admin. Aktifkan melalui menu Keamanan &amp; Pengaturan jika ujian menggunakan pengawas.
              </span>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="mt-4 flex items-start gap-2.5 rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 px-3.5 py-3 text-xs text-rose-800 dark:text-rose-200"
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label
                htmlFor={userInputId}
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
              >
                {role === 'teacher'
                  ? 'Username / NIP'
                  : role === 'proctor'
                    ? allowTeacherAsProctor
                      ? 'Username Pengawas / NIP Guru'
                      : 'Username Pengawas'
                    : 'Username Administrator'}
              </label>
              <input
                id={userInputId}
                type="text"
                autoFocus
                autoComplete="username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setError(null);
                }}
                placeholder={
                  role === 'teacher'
                    ? 'Masukkan username atau NIP'
                    : role === 'proctor'
                      ? 'Masukkan username pengawas'
                      : 'Masukkan username administrator'
                }
                className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
              />
            </div>

            <div>
              <label
                htmlFor={passInputId}
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Password
              </label>
              <input
                id={passInputId}
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                placeholder="Masukkan password"
                className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
              />
            </div>

            <button
              type="submit"
              disabled={role === 'proctor' && !proctorEnabled}
              className="w-full min-h-[46px] rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:text-slate-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              {role === 'teacher'
                ? 'Masuk Dashboard Guru'
                : role === 'proctor'
                  ? 'Masuk Portal Pengawas'
                  : 'Masuk Konsol Super Admin'}
            </button>
          </form>
        </div>

        <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 text-center">
          <Lock className="h-3.5 w-3.5 shrink-0 text-indigo-600 dark:text-indigo-400" />
          <span>Akses khusus pendidik, pengawas ujian, dan administrator resmi sekolah.</span>
        </p>
      </main>
    </div>
  );
}

