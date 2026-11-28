import React from 'react';
import { AlertTriangle, BookOpen, Clock, ShieldAlert, Users } from 'lucide-react';
import { useCBT } from '../../context/CBTContext';

export function AdminDashboard({
  onNavigate,
}: {
  onNavigate: (tab: 'dashboard' | 'users' | 'schedule' | 'security' | 'audit') => void;
}) {
  const { db } = useCBT();

  const totalStudents = db.students.length;
  const activeStudents = db.students.filter((s) => s.active).length;
  const totalTeachers = db.teachers.length;
  const activeExams = db.packages.filter((p) => p.isPublished).length;
  const inProgressAttempts = db.attempts.filter((a) => a.status === 'in_progress');
  const lockedAttempts = db.attempts.filter((a) => a.status === 'locked');

  const todayDateStr = new Date().toDateString();
  const todayViolations = db.violations.filter(
    (v) => new Date(v.timestamp).toDateString() === todayDateStr
  );

  // Violation breakdown by type for clean horizontal bar chart
  const violationByTypeMap = new Map<string, number>();
  db.violations.forEach((v) => {
    violationByTypeMap.set(v.type, (violationByTypeMap.get(v.type) || 0) + 1);
  });
  const violationBreakdown = Array.from(violationByTypeMap.entries()).sort(
    (a, b) => b[1] - a[1]
  );
  const maxVioCount = Math.max(1, ...violationBreakdown.map(([, c]) => c));

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Dashboard Eksekutif
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {db.school.schoolName} · {db.school.academicYear}
          </p>
        </div>
        <div className="grid grid-cols-2 sm:flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('schedule')}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 whitespace-nowrap text-center"
          >
            Sesi & Token
          </button>
          <button
            type="button"
            onClick={() => onNavigate('security')}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 whitespace-nowrap text-center"
          >
            Keamanan & Tema
          </button>
        </div>
      </div>

      {/* Dense KPI Grid: 2 columns on mobile (5th card full width for symmetry), 5 cols on xl */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-5">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 sm:p-5">
          <div className="flex items-center justify-between text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Total Siswa</span>
            <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-400 shrink-0" />
          </div>
          <p className="mt-1.5 text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
            {totalStudents}
          </p>
          <p className="mt-0.5 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
            {activeStudents} aktif · {totalStudents - activeStudents} blokir
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 sm:p-5">
          <div className="flex items-center justify-between text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Total Guru</span>
            <BookOpen className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-400 shrink-0" />
          </div>
          <p className="mt-1.5 text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
            {totalTeachers}
          </p>
          <p className="mt-0.5 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
            {db.classes.length} kelas aktif
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 sm:p-5">
          <div className="flex items-center justify-between text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Ujian Aktif</span>
            <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
          </div>
          <p className="mt-1.5 text-xl sm:text-2xl font-bold text-indigo-700 dark:text-indigo-400 font-mono tabular-nums">
            {activeExams}
          </p>
          <p className="mt-0.5 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
            Token: {db.schedule.tokensReleased ? 'Dirilis' : 'Ditahan'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 sm:p-5">
          <div className="flex items-center justify-between text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Mengerjakan</span>
            <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          </div>
          <p className="mt-1.5 text-xl sm:text-2xl font-bold text-emerald-700 dark:text-emerald-400 font-mono tabular-nums">
            {inProgressAttempts.length}
          </p>
          <p className="mt-0.5 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
            {db.attempts.filter((a) => a.status === 'completed').length} selesai
          </p>
        </div>

        <div className="col-span-2 xl:col-span-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 sm:p-5 flex items-center justify-between xl:block">
          <div>
            <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400">
              <span>Pelanggaran Hari Ini</span>
            </div>
            <p className="mt-1 text-xl sm:text-2xl font-bold text-rose-700 dark:text-rose-400 font-mono tabular-nums">
              {todayViolations.length}
            </p>
          </div>
          <div className="text-right xl:text-left xl:mt-0.5">
            <ShieldAlert className="h-4 w-4 text-rose-600 dark:text-rose-400 ml-auto mb-1 xl:hidden" />
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
              {lockedAttempts.length} peserta terkunci
            </p>
          </div>
        </div>
      </div>

      {/* Main Split: Violation Distribution Chart & Active Sessions Table */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Violation Chart */}
        <section className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Distribusi Jenis Pelanggaran
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Total {db.violations.length} catatan insiden keamanan tercatat
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('audit')}
              className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 hover:underline whitespace-nowrap"
            >
              Lihat Audit
            </button>
          </div>

          {violationBreakdown.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500 dark:text-slate-400">
              Belum ada pelanggaran keamanan yang tercatat.
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {violationBreakdown.map(([type, count]) => {
                const pct = Math.round((count / maxVioCount) * 100);
                return (
                  <div key={type} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-medium text-slate-700 dark:text-slate-300 truncate">
                        {type}
                      </span>
                      <span className="font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums shrink-0">
                        {count} kasus
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-rose-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Recent Violation Feed */}
        <section className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Log Pelanggaran Terbaru
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Pemantauan otomatis dari seluruh ruang kelas ujian
              </p>
            </div>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
              Batas Toleransi: {db.security.maxViolationTolerance}x
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3 font-semibold">Waktu</th>
                  <th className="px-4 py-3 font-semibold">Siswa</th>
                  <th className="px-4 py-3 font-semibold">Jenis Insiden</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {db.violations.slice(0, 6).map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap tabular-nums">
                      {new Date(v.timestamp).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {v.studentName}
                      </div>
                      <div className="text-slate-500 dark:text-slate-400 font-mono">
                        {v.studentNisn} · {v.className}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 font-medium text-rose-700 dark:text-rose-400">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        <span>{v.type}</span>
                      </div>
                      <div className="text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                        {v.detail}
                      </div>
                    </td>
                  </tr>
                ))}
                {db.violations.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                      Tidak ada catatan pelanggaran hari ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
