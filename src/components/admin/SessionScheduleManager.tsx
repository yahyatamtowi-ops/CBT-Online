import React, { useState } from 'react';
import { AlertOctagon, Clock, KeyRound, Power, ShieldCheck } from 'lucide-react';
import { useCBT } from '../../context/CBTContext';

export function SessionScheduleManager() {
  const { db, updateScheduleConfig, forceFinishAllExams, togglePackagePublished } = useCBT();
  const [confirmForceOpen, setConfirmForceOpen] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const schedule = db.schedule;
  const activeRunningCount = db.attempts.filter((a) => a.status === 'in_progress').length;

  const handleToggle = <K extends keyof typeof schedule>(
    key: K,
    value: (typeof schedule)[K]
  ) => {
    updateScheduleConfig({ ...schedule, [key]: value });
    setStatusNotice('Pengaturan jadwal sesi & token berhasil diperbarui.');
  };

  const handleForceFinish = () => {
    const affected = forceFinishAllExams();
    setConfirmForceOpen(false);
    setStatusNotice(
      `Tindakan darurat dijalankan: ${affected} sesi ujian aktif telah dihentikan serentak dan rilis token dikunci.`
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Manajemen Sesi & Jadwal Ujian
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Atur kontrol rilis token, pembatasan jam akses ujian, dan kontrol darurat serentak.
        </p>
      </div>

      {statusNotice && (
        <div
          role="status"
          className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 px-4 py-3 text-xs font-medium text-emerald-800 dark:text-emerald-200"
        >
          {statusNotice}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Token Release Control */}
        <section className="lg:col-span-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
          <div className="flex items-start gap-3">
            <KeyRound className="h-5 w-5 text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0" />
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Kontrol Rilis Token Ujian
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Tentukan apakah siswa dapat login menggunakan token ujian saat ini atau menunggu jadwal.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Mode Rilis Token
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleToggle('tokenReleaseMode', 'manual')}
                className={`rounded-lg border px-3.5 py-2.5 text-left text-xs transition-colors ${
                  schedule.tokenReleaseMode === 'manual'
                    ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/50 text-indigo-900 dark:text-indigo-200'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                <div className="font-semibold">Rilis Manual</div>
                <div className="text-[11px] opacity-80 mt-0.5">
                  Admin membuka/menutup akses kapan saja.
                </div>
              </button>
              <button
                type="button"
                onClick={() => handleToggle('tokenReleaseMode', 'auto')}
                className={`rounded-lg border px-3.5 py-2.5 text-left text-xs transition-colors ${
                  schedule.tokenReleaseMode === 'auto'
                    ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/50 text-indigo-900 dark:text-indigo-200'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                <div className="font-semibold">Rilis Otomatis</div>
                <div className="text-[11px] opacity-80 mt-0.5">
                  Mengikuti jendela waktu sesi ujian aktif.
                </div>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-4">
            <div>
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Status Rilis Token Saat Ini
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {schedule.tokensReleased
                  ? 'Siswa diizinkan memverifikasi token dan memulai ujian.'
                  : 'Seluruh login siswa ditahan sementara oleh Administrator.'}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={schedule.tokensReleased}
              aria-label="Toggle status rilis token"
              onClick={() => handleToggle('tokensReleased', !schedule.tokensReleased)}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                schedule.tokensReleased ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                  schedule.tokensReleased ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Active tokens preview */}
          <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Token Paket Ujian Terdaftar ({db.packages.length})
              </p>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Aktif: {db.packages.filter((p) => p.isPublished).length}/{db.packages.length}
              </span>
            </div>
            {db.packages.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 py-3">
                Belum ada paket ujian yang dibuat oleh guru.
              </p>
            ) : (
              <div className="space-y-2" data-testid="registered-packages-list">
                {db.packages.map((pkg) => (
                  <div
                    key={pkg.id}
                    data-testid={`schedule-pkg-row-${pkg.id}`}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 px-3.5 py-2.5 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {pkg.title}
                        </span>
                        <span
                          className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                            pkg.isPublished
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300'
                              : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {pkg.isPublished ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </div>
                      <div className="mt-0.5 text-slate-500 dark:text-slate-400 truncate">
                        {pkg.subject} · {pkg.targetClasses.join(', ') || 'Semua Kelas'}
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0">
                      <span className="font-mono font-bold text-indigo-700 dark:text-indigo-400 tracking-wider">
                        {pkg.token}
                      </span>
                      <button
                        type="button"
                        data-testid={`toggle-pkg-active-${pkg.id}`}
                        aria-label={`${pkg.isPublished ? 'Nonaktifkan' : 'Aktifkan'} paket ${pkg.title}`}
                        onClick={() => {
                          const nextState = !pkg.isPublished;
                          togglePackagePublished(pkg.id);
                          setStatusNotice(
                            `Paket "${pkg.title}" berhasil ${nextState ? 'diaktifkan' : 'dinonaktifkan'}.`
                          );
                        }}
                        className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-colors whitespace-nowrap ${
                          pkg.isPublished
                            ? 'border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50'
                            : 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50'
                        }`}
                      >
                        <Power className="h-3 w-3" />
                        <span>{pkg.isPublished ? 'Nonaktifkan' : 'Aktifkan'}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Time Window Restriction & Emergency Force Finish */}
        <div className="lg:col-span-6 space-y-6">
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0" />
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Pembatasan Jam Akses Ujian
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Batasi jam login siswa (misal: 07:30 – 09:30).
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={schedule.enforceTimeWindow}
                aria-label="Toggle pembatasan jam akses ujian"
                onClick={() =>
                  handleToggle('enforceTimeWindow', !schedule.enforceTimeWindow)
                }
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                  schedule.enforceTimeWindow ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                    schedule.enforceTimeWindow ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="start-time"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Jam Mulai Akses
                </label>
                <input
                  id="start-time"
                  type="time"
                  value={schedule.accessStartTime}
                  onChange={(e) => handleToggle('accessStartTime', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-mono tabular-nums text-slate-900 dark:text-slate-100 focus:border-indigo-600 focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="end-time"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Jam Tutup Akses
                </label>
                <input
                  id="end-time"
                  type="time"
                  value={schedule.accessEndTime}
                  onChange={(e) => handleToggle('accessEndTime', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-mono tabular-nums text-slate-900 dark:text-slate-100 focus:border-indigo-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
              <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>
                {schedule.enforceTimeWindow
                  ? `Aktif: Login siswa hanya diterima pukul ${schedule.accessStartTime} – ${schedule.accessEndTime}.`
                  : 'Nonaktif: Siswa dapat masuk kapan saja selama token dirilis.'}
              </span>
            </div>
          </section>

          {/* Emergency Force Finish All */}
          <section className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/30 p-6 space-y-4">
            <div className="flex items-start gap-3">
              <AlertOctagon className="h-5 w-5 text-rose-600 dark:text-rose-400 mt-0.5 shrink-0" />
              <div>
                <h2 className="text-sm font-bold text-rose-900 dark:text-rose-200">
                  Kontrol Darurat — Hentikan Semua Ujian (Force Finish All)
                </h2>
                <p className="text-xs text-rose-800/90 dark:text-rose-300/90 mt-1 leading-relaxed">
                  Gunakan hanya dalam kondisi darurat (kebocoran soal, gangguan jaringan massal, atau keadaan kahar). Seluruh peserta yang sedang mengerjakan ({activeRunningCount} siswa) akan langsung dikumpulkan jawabannya dan rilis token dikunci.
                </p>
              </div>
            </div>

            {schedule.emergencyForceFinishedAt && (
              <p className="text-xs font-mono text-rose-700 dark:text-rose-400">
                Terakhir dijalankan:{' '}
                {new Date(schedule.emergencyForceFinishedAt).toLocaleString('id-ID')}
              </p>
            )}

            {!confirmForceOpen ? (
              <button
                type="button"
                onClick={() => setConfirmForceOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-rose-700"
              >
                <Power className="h-4 w-4" />
                <span>Force Finish All ({activeRunningCount} Sesi Aktif)</span>
              </button>
            ) : (
              <div className="rounded-lg border border-rose-300 dark:border-rose-800 bg-white dark:bg-slate-900 p-4 space-y-3">
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Konfirmasi Tindakan Darurat: Yakin menghentikan seluruh ujian sekarang?
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleForceFinish}
                    className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700"
                  >
                    Ya, Hentikan Semua Ujian
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmForceOpen(false)}
                    className="rounded-lg border border-slate-300 dark:border-slate-700 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    Batalkan
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
