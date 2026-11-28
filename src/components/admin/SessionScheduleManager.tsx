import React, { useMemo, useState } from 'react';
import {
  AlertOctagon,
  CalendarClock,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  KeyRound,
  ListChecks,
  Power,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { useCBT } from '../../context/CBTContext';
import {
  generateExamScheduleCSVTemplate,
  parseExamSchedulesCSV,
} from '../../utils/examScheduleImport';

type ScheduleSubTab = 'controls' | 'registered' | 'bulk_import';

function downloadCsvFile(filename: string, content: string) {
  const blob = new Blob(['\uFEFF' + content], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function SessionScheduleManager() {
  const {
    db,
    updateScheduleConfig,
    forceFinishAllExams,
    togglePackagePublished,
    importExamSchedulesBatch,
  } = useCBT();
  const [subTab, setSubTab] = useState<ScheduleSubTab>('controls');
  const [confirmForceOpen, setConfirmForceOpen] = useState(false);
  const [statusNotice, setStatusNotice] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);
  const [bulkCsvText, setBulkCsvText] = useState('');

  const schedule = db.schedule;
  const activeRunningCount = db.attempts.filter(
    (a) => a.status === 'in_progress'
  ).length;
  const activePackagesCount = db.packages.filter((p) => p.isPublished).length;

  const parsedPreview = useMemo(() => {
    if (!bulkCsvText.trim()) return null;
    return parseExamSchedulesCSV(bulkCsvText, {
      teachers: db.teachers,
      existingPackages: db.packages,
    });
  }, [bulkCsvText, db.teachers, db.packages]);

  const handleToggle = <K extends keyof typeof schedule>(
    key: K,
    value: (typeof schedule)[K]
  ) => {
    updateScheduleConfig({ ...schedule, [key]: value });
    setStatusNotice({
      type: 'ok',
      text: 'Pengaturan jadwal sesi & token berhasil diperbarui.',
    });
  };

  const handleForceFinish = () => {
    const affected = forceFinishAllExams();
    setConfirmForceOpen(false);
    setStatusNotice({
      type: 'ok',
      text: `Tindakan darurat selesai: ${affected} sesi ujian aktif dihentikan dan rilis token dikunci.`,
    });
  };

  const handleDownloadTemplate = () => {
    const csv = generateExamScheduleCSVTemplate(db.teachers, db.classes);
    downloadCsvFile('template-jadwal-ujian-massal.csv', csv);
    setStatusNotice({
      type: 'ok',
      text: 'Template CSV jadwal ujian berhasil diunduh. Isi di Excel/Sheets lalu unggah kembali.',
    });
  };

  const handleLoadSampleTemplate = () => {
    const csv = generateExamScheduleCSVTemplate(db.teachers, db.classes);
    setBulkCsvText(csv);
    setStatusNotice(null);
  };

  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setBulkCsvText(reader.result);
        setStatusNotice(null);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleRunBulkImport = () => {
    const parsed = parseExamSchedulesCSV(bulkCsvText, {
      teachers: db.teachers,
      existingPackages: db.packages,
    });
    if (parsed.rows.length === 0) {
      setStatusNotice({
        type: 'err',
        text:
          parsed.errors[0] ||
          'Tidak ada baris jadwal valid untuk diimpor. Periksa kembali format template.',
      });
      return;
    }
    const res = importExamSchedulesBatch(parsed.rows);
    setBulkCsvText('');
    setSubTab('registered');
    setStatusNotice({
      type: 'ok',
      text: `Impor jadwal massal berhasil: ${res.added} sesi baru, ${res.updated} sesi diperbarui${
        res.newClassesAdded > 0 ? `, ${res.newClassesAdded} kelas baru` : ''
      }${parsed.errors.length > 0 ? ` (${parsed.errors.length} baris dilewati)` : ''}.`,
    });
  };

  const subTabs: Array<{
    id: ScheduleSubTab;
    label: string;
    mobileLabel: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }> = [
    {
      id: 'controls',
      label: 'Kontrol Token & Jam',
      mobileLabel: 'Kontrol',
      icon: KeyRound,
    },
    {
      id: 'registered',
      label: 'Daftar Jadwal',
      mobileLabel: 'Jadwal',
      icon: ListChecks,
      badge: db.packages.length,
    },
    {
      id: 'bulk_import',
      label: 'Impor Massal CSV',
      mobileLabel: 'Impor CSV',
      icon: FileSpreadsheet,
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Compact Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Sesi & Jadwal Ujian
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Kontrol rilis token, jam akses, status paket, dan impor jadwal massal via template CSV.
          </p>
        </div>

        <button
          type="button"
          data-testid="open-bulk-schedule-btn"
          onClick={() => setSubTab('bulk_import')}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-700 whitespace-nowrap shrink-0 w-full sm:w-auto"
        >
          <Upload className="h-3.5 w-3.5" />
          <span>Impor Jadwal Massal</span>
        </button>
      </div>

      {/* Neat Full-Width Compact Sub-Menu Bar */}
      <nav
        aria-label="Sub Menu Sesi dan Jadwal"
        data-testid="schedule-submenu-nav"
        className="grid grid-cols-3 sm:inline-flex gap-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1 shadow-xs w-full sm:w-auto"
      >
        {subTabs.map((item) => {
          const Icon = item.icon;
          const active = subTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              data-testid={`schedule-subtab-${item.id}`}
              onClick={() => setSubTab(item.id)}
              className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-2 sm:px-3.5 py-2 text-[11px] sm:text-xs font-semibold transition-colors whitespace-nowrap min-w-0 ${
                active
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="sm:hidden truncate">{item.mobileLabel}</span>
              <span className="hidden sm:inline">{item.label}</span>
              {typeof item.badge === 'number' && (
                <span
                  className={`rounded px-1 py-0.5 font-mono text-[10px] font-bold tabular-nums leading-none ${
                    active
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {statusNotice && (
        <div
          role="status"
          data-testid="schedule-status-notice"
          className={`rounded-lg border px-3.5 py-2.5 text-xs font-medium ${
            statusNotice.type === 'ok'
              ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200'
              : 'border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-200'
          }`}
        >
          {statusNotice.text}
        </div>
      )}

      {/* SUB-MENU 1: KONTROL TOKEN, JAM AKSES & DARURAT */}
      {subTab === 'controls' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Token Release Control */}
          <section className="lg:col-span-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4">
            <div className="flex items-start gap-2.5">
              <KeyRound className="h-4 w-4 text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0" />
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Kontrol Rilis Token Ujian
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Atur izin login token siswa secara manual atau mengikuti jam sesi.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleToggle('tokenReleaseMode', 'manual')}
                className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                  schedule.tokenReleaseMode === 'manual'
                    ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/50 text-indigo-900 dark:text-indigo-200'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                <div className="font-semibold">Rilis Manual</div>
                <div className="text-[11px] opacity-80 mt-0.5">
                  Buka/tutup akses kapan saja.
                </div>
              </button>
              <button
                type="button"
                onClick={() => handleToggle('tokenReleaseMode', 'auto')}
                className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                  schedule.tokenReleaseMode === 'auto'
                    ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/50 text-indigo-900 dark:text-indigo-200'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                <div className="font-semibold">Rilis Otomatis</div>
                <div className="text-[11px] opacity-80 mt-0.5">
                  Sesuai jam akses aktif.
                </div>
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800 pt-3.5">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Status Rilis Token
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {schedule.tokensReleased
                    ? 'Siswa diizinkan login dengan token.'
                    : 'Login siswa ditahan sementara.'}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={schedule.tokensReleased}
                aria-label="Toggle status rilis token"
                onClick={() =>
                  handleToggle('tokensReleased', !schedule.tokensReleased)
                }
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                  schedule.tokensReleased
                    ? 'bg-emerald-600'
                    : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                    schedule.tokensReleased ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Compact summary strip linking to Registered Packages */}
            <div className="flex items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800 pt-3.5 text-xs">
              <span className="text-slate-600 dark:text-slate-300 font-mono tabular-nums">
                Paket Aktif: <strong>{activePackagesCount}</strong> / {db.packages.length}
              </span>
              <button
                type="button"
                onClick={() => setSubTab('registered')}
                className="font-semibold text-indigo-700 dark:text-indigo-400 hover:underline"
              >
                Kelola Daftar Jadwal →
              </button>
            </div>
          </section>

          {/* Time Window Restriction & Emergency Force Finish */}
          <div className="lg:col-span-6 space-y-4">
            <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-3.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <Clock className="h-4 w-4 text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0" />
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Pembatasan Jam Akses
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Batasi jam login siswa (misal 07:30 – 09:30).
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
                    schedule.enforceTimeWindow
                      ? 'bg-indigo-600'
                      : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                      schedule.enforceTimeWindow
                        ? 'translate-x-6'
                        : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="start-time"
                    className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Jam Mulai
                  </label>
                  <input
                    id="start-time"
                    type="time"
                    value={schedule.accessStartTime}
                    onChange={(e) =>
                      handleToggle('accessStartTime', e.target.value)
                    }
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-sm font-mono tabular-nums text-slate-900 dark:text-slate-100 focus:border-indigo-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="end-time"
                    className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Jam Tutup
                  </label>
                  <input
                    id="end-time"
                    type="time"
                    value={schedule.accessEndTime}
                    onChange={(e) => handleToggle('accessEndTime', e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-sm font-mono tabular-nums text-slate-900 dark:text-slate-100 focus:border-indigo-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>
                  {schedule.enforceTimeWindow
                    ? `Aktif pukul ${schedule.accessStartTime} – ${schedule.accessEndTime}.`
                    : 'Nonaktif: login terbuka selama token dirilis.'}
                </span>
              </div>
            </section>

            {/* Emergency Force Finish All */}
            <section className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/30 p-4 sm:p-5 space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertOctagon className="h-4 w-4 text-rose-600 dark:text-rose-400 mt-0.5 shrink-0" />
                <div>
                  <h2 className="text-sm font-bold text-rose-900 dark:text-rose-200">
                    Kontrol Darurat (Force Finish All)
                  </h2>
                  <p className="text-xs text-rose-800/90 dark:text-rose-300/90 mt-0.5 leading-snug">
                    Hentikan serentak seluruh ujian aktif ({activeRunningCount} siswa) dan kunci token saat keadaan darurat.
                  </p>
                </div>
              </div>

              {schedule.emergencyForceFinishedAt && (
                <p className="text-[11px] font-mono text-rose-700 dark:text-rose-400">
                  Terakhir:{' '}
                  {new Date(schedule.emergencyForceFinishedAt).toLocaleString(
                    'id-ID'
                  )}
                </p>
              )}

              {!confirmForceOpen ? (
                <button
                  type="button"
                  onClick={() => setConfirmForceOpen(true)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-rose-700 w-full sm:w-auto"
                >
                  <Power className="h-3.5 w-3.5" />
                  <span>Force Finish All ({activeRunningCount} Aktif)</span>
                </button>
              ) : (
                <div className="rounded-lg border border-rose-300 dark:border-rose-800 bg-white dark:bg-slate-900 p-3 space-y-2.5">
                  <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    Yakin menghentikan seluruh ujian sekarang?
                  </p>
                  <div className="grid grid-cols-2 sm:flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleForceFinish}
                      className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
                    >
                      Ya, Hentikan
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmForceOpen(false)}
                      className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      Batalkan
                    </button>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {/* SUB-MENU 2: DAFTAR JADWAL & PAKET TERDAFTAR */}
      {subTab === 'registered' && (
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 sm:p-5 space-y-3">
          <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                Jadwal Terdaftar ({db.packages.length})
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                Aktif: {activePackagesCount} · Nonaktif:{' '}
                {db.packages.length - activePackagesCount}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSubTab('bulk_import')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/50 px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 whitespace-nowrap shrink-0"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Tambah CSV</span>
            </button>
          </div>

          {db.packages.length === 0 ? (
            <div className="py-8 text-center space-y-2">
              <CalendarClock className="h-7 w-7 mx-auto text-slate-300 dark:text-slate-600" />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Belum ada sesi atau paket ujian terdaftar. Gunakan menu Impor Massal CSV untuk menambahkan banyak sesi sekaligus.
              </p>
            </div>
          ) : (
            <div
              className="grid grid-cols-1 md:grid-cols-2 gap-2.5"
              data-testid="registered-packages-list"
            >
              {db.packages.map((pkg) => (
                <div
                  key={pkg.id}
                  data-testid={`schedule-pkg-row-${pkg.id}`}
                  className="flex flex-col justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3 text-xs"
                >
                  <div className="min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                        {pkg.title}
                      </span>
                      <span
                        className={`shrink-0 font-semibold text-[11px] ${
                          pkg.isPublished
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {pkg.isPublished ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {pkg.subject} · {pkg.targetClasses.join(', ') || 'Semua Kelas'} · {pkg.durationMinutes}m
                    </div>
                    {(pkg.scheduledDate || pkg.scheduledStartTime || pkg.sessionName) && (
                      <div className="mt-1 text-[11px] font-mono tabular-nums text-indigo-700 dark:text-indigo-400">
                        {[
                          pkg.sessionName,
                          pkg.scheduledDate,
                          pkg.scheduledStartTime && pkg.scheduledEndTime
                            ? `${pkg.scheduledStartTime}–${pkg.scheduledEndTime}`
                            : pkg.scheduledStartTime,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/70 dark:border-slate-700/70">
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
                        setStatusNotice({
                          type: 'ok',
                          text: `Paket "${pkg.title}" berhasil ${nextState ? 'diaktifkan' : 'dinonaktifkan'}.`,
                        });
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
        </section>
      )}

      {/* SUB-MENU 3: IMPOR JADWAL UJIAN MASSAL VIA TEMPLATE */}
      {subTab === 'bulk_import' && (
        <section
          data-testid="bulk-schedule-import-panel"
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-start gap-2.5">
              <FileSpreadsheet className="h-5 w-5 text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0" />
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Impor Jadwal Ujian Massal (Template CSV / Excel)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Unduh template, isi puluhan hingga ratusan sesi ujian sekaligus, lalu unggah file CSV atau tempel data langsung.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:flex items-center gap-2 shrink-0">
              <button
                type="button"
                data-testid="download-schedule-template-btn"
                onClick={handleDownloadTemplate}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 whitespace-nowrap"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Unduh Template</span>
              </button>
              <button
                type="button"
                data-testid="load-sample-schedule-btn"
                onClick={handleLoadSampleTemplate}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/50 px-3 py-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 whitespace-nowrap"
              >
                <CalendarClock className="h-3.5 w-3.5" />
                <span>Muat Contoh</span>
              </button>
            </div>
          </div>

          {/* Upload File Input + Paste Area */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label
                htmlFor="bulk-schedule-file"
                className="text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Unggah File CSV (.csv / .txt) atau Tempel dari Excel / Google Sheets
              </label>
              <label className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer whitespace-nowrap self-start sm:self-auto">
                <Upload className="h-3.5 w-3.5" />
                <span>Pilih File CSV</span>
                <input
                  id="bulk-schedule-file"
                  data-testid="bulk-schedule-file-input"
                  type="file"
                  accept=".csv,.txt,text/csv,text/plain"
                  onChange={handleCsvFileUpload}
                  className="sr-only"
                />
              </label>
            </div>

            <textarea
              data-testid="bulk-schedule-textarea"
              value={bulkCsvText}
              onChange={(e) => setBulkCsvText(e.target.value)}
              rows={6}
              placeholder="Tempel baris CSV/Excel di sini (pisahkan dengan koma, titik koma, atau Tab)&#10;Judul Sesi Ujian,Mata Pelajaran,Kategori,Kelas Target,Username/Nama Guru,Tanggal (YYYY-MM-DD),Jam Mulai,Jam Selesai,Durasi,KKM,Token,Status,Nama Sesi"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-950/60 p-3 text-xs font-mono text-slate-900 dark:text-slate-100 focus:border-indigo-600 focus:outline-none"
            />
          </div>

          {/* Live Validation & Preview Table */}
          {parsedPreview && (
            <div className="space-y-3 border-t border-slate-100 dark:border-slate-800 pt-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono tabular-nums">
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                    Siap impor: {parsedPreview.rows.length} sesi
                  </span>
                  {parsedPreview.warnings.length > 0 && (
                    <span className="text-amber-700 dark:text-amber-400">
                      Peringatan: {parsedPreview.warnings.length}
                    </span>
                  )}
                  {parsedPreview.errors.length > 0 && (
                    <span className="text-rose-700 dark:text-rose-400">
                      Baris tidak valid: {parsedPreview.errors.length}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  data-testid="confirm-bulk-schedule-import-btn"
                  disabled={parsedPreview.rows.length === 0}
                  onClick={handleRunBulkImport}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 w-full sm:w-auto"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Impor {parsedPreview.rows.length} Sesi Jadwal</span>
                </button>
              </div>

              {parsedPreview.errors.length > 0 && (
                <div className="rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50/70 dark:bg-rose-950/40 p-3 text-xs text-rose-800 dark:text-rose-200 space-y-1">
                  {parsedPreview.errors.slice(0, 5).map((err, i) => (
                    <div key={i}>• {err}</div>
                  ))}
                  {parsedPreview.errors.length > 5 && (
                    <div className="opacity-80">
                      +{parsedPreview.errors.length - 5} error lainnya
                    </div>
                  )}
                </div>
              )}

              {parsedPreview.rows.length > 0 && (
                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Sesi & Mapel</th>
                        <th className="px-3 py-2 font-semibold">Kelas</th>
                        <th className="px-3 py-2 font-semibold">Jadwal</th>
                        <th className="px-3 py-2 font-semibold">Token</th>
                        <th className="px-3 py-2 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {parsedPreview.rows.slice(0, 12).map((row) => (
                        <tr key={`${row.rowNumber}-${row.token}`}>
                          <td className="px-3 py-2">
                            <div className="font-semibold text-slate-900 dark:text-slate-100">
                              {row.title}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              {row.subject} · {row.teacherLabel}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-slate-700 dark:text-slate-300">
                            {row.targetClasses.join(', ') || 'Semua'}
                          </td>
                          <td className="px-3 py-2 font-mono tabular-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">
                            {row.scheduledDate || '-'} ·{' '}
                            {row.scheduledStartTime || '-'}
                            {row.scheduledEndTime
                              ? `–${row.scheduledEndTime}`
                              : ''}{' '}
                            ({row.durationMinutes}m)
                          </td>
                          <td className="px-3 py-2 font-mono font-bold text-indigo-700 dark:text-indigo-400">
                            {row.token}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={
                                row.isPublished
                                  ? 'font-semibold text-emerald-700 dark:text-emerald-400'
                                  : 'text-slate-500 dark:text-slate-400'
                              }
                            >
                              {row.isPublished ? 'Aktif' : 'Nonaktif'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parsedPreview.rows.length > 12 && (
                    <div className="bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 text-[11px] text-slate-500 dark:text-slate-400 text-center">
                      Menampilkan 12 dari {parsedPreview.rows.length} sesi siap impor.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
