import React, { useState } from 'react';
import {
  AlertTriangle,
  Database,
  Download,
  History,
  RotateCcw,
  Trash2,
  Upload,
} from 'lucide-react';
import { useCBT } from '../../context/CBTContext';
import { createInitialSeedDatabase } from '../../data/seedData';
import type { AuditLogEntry, SelectiveDeleteOptions } from '../../types/cbt';
import { CloudWorkspaceSyncCard } from './CloudWorkspaceSyncCard';
import { SpreadsheetSyncCard } from './SpreadsheetSyncCard';

const EMPTY_DELETE_SELECTION: SelectiveDeleteOptions = {
  students: false,
  teachers: false,
  classes: false,
  packagesAndQuestions: false,
  attempts: false,
  violations: false,
  auditLogs: false,
};

export function AuditBackupPanel() {
  const {
    db,
    exportDatabaseJSON,
    importDatabaseJSON,
    resetAllData,
    deleteSelectedData,
  } = useCBT();
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | AuditLogEntry['category']>('ALL');
  const [statusMsg, setStatusMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  // Selective delete state
  const [deleteSelection, setDeleteSelection] =
    useState<SelectiveDeleteOptions>(EMPTY_DELETE_SELECTION);
  const [confirmSelectiveDelete, setConfirmSelectiveDelete] = useState(false);

  const selectedCategoryCount = Object.values(deleteSelection).filter(Boolean).length;

  const triggerDownload = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadBackup = () => {
    const json = exportDatabaseJSON();
    triggerDownload(
      `cerdasexam-backup-${new Date().toISOString().slice(0, 10)}.json`,
      json
    );
    setStatusMsg({ type: 'ok', text: 'File backup database JSON berhasil diunduh.' });
  };

  const handleDownloadBackupTemplate = () => {
    const template = JSON.stringify(createInitialSeedDatabase(), null, 2);
    triggerDownload('format-backup-database-cbt.json', template);
    setStatusMsg({ type: 'ok', text: 'Template format-backup-database-cbt.json berhasil diunduh.' });
  };

  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const res = importDatabaseJSON(reader.result);
        setStatusMsg(
          res.ok
            ? { type: 'ok', text: 'Database berhasil dipulihkan dari file backup JSON.' }
            : { type: 'err', text: res.error || 'Gagal memulihkan database.' }
        );
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleRunSelectiveDelete = () => {
    const res = deleteSelectedData(deleteSelection);
    setDeleteSelection(EMPTY_DELETE_SELECTION);
    setConfirmSelectiveDelete(false);
    if (res.deletedCategories.length > 0) {
      setStatusMsg({
        type: 'ok',
        text: `Berhasil menghapus data terpilih: ${res.deletedCategories.join(', ')}.`,
      });
    }
  };

  const toggleDeleteKey = (key: keyof SelectiveDeleteOptions) => {
    setDeleteSelection((prev) => ({ ...prev, [key]: !prev[key] }));
    setConfirmSelectiveDelete(false);
  };

  const selectableItems: Array<{
    key: keyof SelectiveDeleteOptions;
    label: string;
    countLabel: string;
  }> = [
    { key: 'students', label: 'Data Siswa', countLabel: `${db.students.length} siswa` },
    { key: 'teachers', label: 'Data Guru', countLabel: `${db.teachers.length} guru` },
    { key: 'classes', label: 'Daftar Kelas', countLabel: `${db.classes.length} kelas` },
    {
      key: 'packagesAndQuestions',
      label: 'Paket Ujian & Bank Soal',
      countLabel: `${db.packages.length} paket · ${db.questions.length} soal`,
    },
    {
      key: 'attempts',
      label: 'Riwayat Ujian & Nilai',
      countLabel: `${db.attempts.length} riwayat`,
    },
    {
      key: 'violations',
      label: 'Log Pelanggaran Keamanan',
      countLabel: `${db.violations.length} catatan`,
    },
    {
      key: 'auditLogs',
      label: 'Audit Log Aktivitas',
      countLabel: `${db.auditLogs.length} log`,
    },
  ];

  const filteredLogs = db.auditLogs.filter(
    (l) => categoryFilter === 'ALL' || l.category === categoryFilter
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Audit Log, Backup, Reset & Hapus Data
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Pantau aktivitas sistem, ekspor/impor database JSON, reset seluruh data, atau hapus kategori data tertentu.
          </p>
        </div>
      </div>

      {statusMsg && (
        <div
          role="status"
          className={`rounded-lg border px-4 py-3 text-xs font-medium ${
            statusMsg.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
              : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
          }`}
        >
          {statusMsg.text}
        </div>
      )}

      {/* Direct Google Sheets, Drive OAuth & Firebase Firestore Cloud Sync */}
      <CloudWorkspaceSyncCard />

      {/* Google Spreadsheet & Apps Script Auto-Sync Database Panel */}
      <SpreadsheetSyncCard />

      {/* Backup, Restore & Full Reset Card */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Database className="h-5 w-5 text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0" />
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Backup, Restore & Reset Data
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Tersimpan saat ini: {db.students.length} siswa · {db.teachers.length} guru ·{' '}
                {db.classes.length} kelas · {db.packages.length} paket · {db.questions.length} soal ·{' '}
                {db.attempts.length} riwayat ujian.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleDownloadBackupTemplate}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download Format JSON</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadBackup}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-700 whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export Backup JSON</span>
            </button>

            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 whitespace-nowrap">
              <Upload className="h-3.5 w-3.5" />
              <span>Restore dari JSON</span>
              <input
                type="file"
                accept=".json"
                onChange={handleRestoreFile}
                className="hidden"
              />
            </label>

            {!confirmReset ? (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 px-3 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-100 whitespace-nowrap"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset Data</span>
              </button>
            ) : (
              <div className="inline-flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    resetAllData();
                    setConfirmReset(false);
                    setStatusMsg({
                      type: 'ok',
                      text: 'Seluruh data aplikasi berhasil direset ke kondisi awal kosong.',
                    });
                  }}
                  className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700"
                >
                  Konfirmasi Reset Semua Data
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-2 text-xs text-slate-700 dark:text-slate-300"
                >
                  Batal
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* SELECTIVE DELETE PANEL (Hapus Data yang Dipilih) */}
      <section className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-white dark:bg-slate-900 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-start gap-3">
            <Trash2 className="h-5 w-5 text-rose-600 dark:text-rose-400 mt-0.5 shrink-0" />
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Hapus Data (Pilih Kategori Data yang Akan Dihapus)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Centang kategori data tertentu yang ingin dibersihkan tanpa menghapus data lainnya atau pengaturan sekolah.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 text-xs">
            <button
              type="button"
              onClick={() =>
                setDeleteSelection({
                  students: true,
                  teachers: true,
                  classes: true,
                  packagesAndQuestions: true,
                  attempts: true,
                  violations: true,
                  auditLogs: true,
                })
              }
              className="font-semibold text-indigo-700 dark:text-indigo-400 hover:underline whitespace-nowrap"
            >
              Pilih Semua
            </button>
            <span className="text-slate-300">|</span>
            <button
              type="button"
              onClick={() => {
                setDeleteSelection(EMPTY_DELETE_SELECTION);
                setConfirmSelectiveDelete(false);
              }}
              className="font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 whitespace-nowrap"
            >
              Batal Pilih
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {selectableItems.map((item) => {
            const checked = deleteSelection[item.key];
            return (
              <label
                key={item.key}
                className={`flex items-start gap-2.5 rounded-lg border p-3 cursor-pointer transition-colors ${
                  checked
                    ? 'border-rose-400 bg-rose-50/70 dark:border-rose-700 dark:bg-rose-950/30'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleDeleteKey(item.key)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-400 text-rose-600"
                />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {item.label}
                  </div>
                  <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                    {item.countLabel}
                  </div>
                </div>
              </label>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {selectedCategoryCount > 0
              ? `${selectedCategoryCount} kategori data dipilih untuk dihapus permanen.`
              : 'Pilih minimal satu kategori data di atas untuk mengaktifkan tombol hapus.'}
          </span>

          {!confirmSelectiveDelete ? (
            <button
              type="button"
              disabled={selectedCategoryCount === 0}
              onClick={() => setConfirmSelectiveDelete(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:text-slate-500"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Hapus Data Terpilih ({selectedCategoryCount})</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRunSelectiveDelete}
                className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700"
              >
                Ya, Hapus Permanen Sekarang
              </button>
              <button
                type="button"
                onClick={() => setConfirmSelectiveDelete(false)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Batal
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Master Violations Table */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-600" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Rekapitulasi Pelanggaran Seluruh Kelas ({db.violations.length})
            </h2>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3 font-semibold">Timestamp</th>
                <th className="px-4 py-3 font-semibold">Peserta</th>
                <th className="px-4 py-3 font-semibold">Paket Ujian</th>
                <th className="px-4 py-3 font-semibold">Jenis & Detail Pelanggaran</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {db.violations.map((v) => (
                <tr key={v.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3 font-mono text-slate-500 whitespace-nowrap tabular-nums">
                    {new Date(v.timestamp).toLocaleString('id-ID')}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                      {v.studentName}
                    </div>
                    <div className="font-mono text-slate-500">
                      {v.studentNisn} · {v.className}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{v.packageTitle}</td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-rose-700 dark:text-rose-400">{v.type}</div>
                    <div className="text-slate-500">{v.detail}</div>
                  </td>
                </tr>
              ))}
              {db.violations.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                    Belum ada pelanggaran tercatat.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* System Audit Log */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Audit Log Aktivitas Sistem ({filteredLogs.length})
            </h2>
          </div>
          <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 p-1">
            {(
              [
                ['ALL', 'Semua'],
                ['auth', 'Login'],
                ['security', 'Keamanan'],
                ['users', 'Pengguna'],
                ['exam', 'Ujian'],
                ['violation', 'Pelanggaran'],
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setCategoryFilter(val)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  categoryFilter === val
                    ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3 font-semibold">Waktu</th>
                <th className="px-4 py-3 font-semibold">Aktor</th>
                <th className="px-4 py-3 font-semibold">Aktivitas</th>
                <th className="px-4 py-3 font-semibold">Keterangan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredLogs.slice(0, 40).map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3 font-mono text-slate-500 whitespace-nowrap tabular-nums">
                    {new Date(log.timestamp).toLocaleString('id-ID')}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {log.actorName}
                    </span>
                    <span className="ml-1.5 text-slate-400">· {log.actorRole}</span>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">
                    {log.action}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{log.detail}</td>
                </tr>
              ))}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                    Belum ada catatan aktivitas sistem.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
