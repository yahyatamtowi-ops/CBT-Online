import React, { useState } from 'react';
import {
  AlertTriangle,
  Cloud,
  Database,
  Download,
  FileSpreadsheet,
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

type AuditSubMenu = 'cloud' | 'spreadsheet' | 'backup' | 'violations' | 'audit';

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
    deleteViolationLogs,
    deleteAuditLogs,
  } = useCBT();
  const [activeSubMenu, setActiveSubMenu] = useState<AuditSubMenu>('cloud');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | AuditLogEntry['category']>('ALL');
  const [statusMsg, setStatusMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  // Violations sub-menu delete bar state
  const [selectedViolationIds, setSelectedViolationIds] = useState<Set<string>>(new Set());
  const [confirmClearViolations, setConfirmClearViolations] = useState(false);

  // Audit log sub-menu delete bar state
  const [selectedAuditIds, setSelectedAuditIds] = useState<Set<string>>(new Set());
  const [confirmClearAudit, setConfirmClearAudit] = useState(false);

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

  const subMenus: Array<{
    id: AuditSubMenu;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }> = [
    { id: 'cloud', label: 'Firebase & Cloud', icon: Cloud },
    { id: 'spreadsheet', label: 'Spreadsheet & Script', icon: FileSpreadsheet },
    { id: 'backup', label: 'Backup & Hapus Data', icon: Database },
    {
      id: 'violations',
      label: 'Pelanggaran',
      icon: AlertTriangle,
      badge: db.violations.length,
    },
    {
      id: 'audit',
      label: 'Audit Log',
      icon: History,
      badge: db.auditLogs.length,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Audit Log, Sinkronisasi & Backup Data
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Pilih sub-menu di bawah untuk mengelola Cloud, Spreadsheet, Backup/Hapus Data, Pelanggaran, dan Audit Log tanpa perlu menggulir panjang.
          </p>
        </div>
      </div>

      {/* Horizontal Sub-Menu Navigation */}
      <nav
        aria-label="Sub Menu Audit dan Backup Data"
        data-testid="audit-submenu-nav"
        className="flex flex-wrap gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1.5 shadow-xs"
      >
        {subMenus.map((item) => {
          const Icon = item.icon;
          const active = activeSubMenu === item.id;
          return (
            <button
              key={item.id}
              type="button"
              data-testid={`audit-submenu-${item.id}`}
              onClick={() => setActiveSubMenu(item.id)}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                active
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span>{item.label}</span>
              {typeof item.badge === 'number' && (
                <span
                  className={`rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums ${
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

      {/* Sub-Menu 1: Direct Google Sheets, Drive OAuth & Firebase Firestore Cloud Sync */}
      {activeSubMenu === 'cloud' && <CloudWorkspaceSyncCard />}

      {/* Sub-Menu 2: Google Spreadsheet & Apps Script Auto-Sync Database Panel */}
      {activeSubMenu === 'spreadsheet' && <SpreadsheetSyncCard />}

      {/* Sub-Menu 3: Backup, Restore, Full Reset & Selective Delete */}
      {activeSubMenu === 'backup' && (
        <div className="space-y-5">
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
        </div>
      )}

      {/* Sub-Menu 4: Master Violations Table */}
      {activeSubMenu === 'violations' && (() => {
        const allViolationIds = db.violations.map((v) => v.id);
        const validSelectedViolations = allViolationIds.filter((id) =>
          selectedViolationIds.has(id)
        );
        const allViolationsSelected =
          allViolationIds.length > 0 &&
          validSelectedViolations.length === allViolationIds.length;

        const toggleViolationRow = (id: string) => {
          setSelectedViolationIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
          });
        };

        const toggleAllViolations = () => {
          if (allViolationsSelected) {
            setSelectedViolationIds(new Set());
          } else {
            setSelectedViolationIds(new Set(allViolationIds));
          }
        };

        return (
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-600" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Rekapitulasi Pelanggaran Seluruh Kelas ({db.violations.length})
                </h2>
              </div>
            </div>

            {/* Bilah Hapus Pelanggaran */}
            <div
              data-testid="violations-delete-bar"
              className="flex flex-wrap items-center justify-between gap-2.5 bg-rose-50/60 dark:bg-rose-950/20 px-5 py-2.5 border-b border-rose-100 dark:border-rose-900/50 text-xs"
            >
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <Trash2 className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                <span className="font-semibold">Bilah Hapus Data Pelanggaran</span>
                {validSelectedViolations.length > 0 && (
                  <span className="font-mono text-[11px] text-rose-700 dark:text-rose-300">
                    · {validSelectedViolations.length} dipilih
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  data-testid="delete-selected-violations-btn"
                  disabled={validSelectedViolations.length === 0}
                  onClick={() => {
                    const removed = deleteViolationLogs({ ids: validSelectedViolations });
                    setSelectedViolationIds(new Set());
                    setStatusMsg({
                      type: 'ok',
                      text: `${removed} catatan pelanggaran terpilih berhasil dihapus.`,
                    });
                  }}
                  className="inline-flex items-center gap-1 rounded-md border border-rose-300 dark:border-rose-800 bg-white dark:bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/50 disabled:opacity-45 disabled:cursor-not-allowed"
                >
                  <Trash2 className="h-3 w-3" />
                  <span>Hapus Terpilih ({validSelectedViolations.length})</span>
                </button>

                <button
                  type="button"
                  data-testid="trim-violations-btn"
                  disabled={db.violations.length <= 20}
                  onClick={() => {
                    const removed = deleteViolationLogs({ keepLatest: 20 });
                    setSelectedViolationIds(new Set());
                    setStatusMsg({
                      type: 'ok',
                      text: `${removed} catatan pelanggaran lama dipangkas (menyisakan 20 terbaru).`,
                    });
                  }}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-45 disabled:cursor-not-allowed"
                >
                  <span>Sisakan 20 Terbaru</span>
                </button>

                {!confirmClearViolations ? (
                  <button
                    type="button"
                    data-testid="clear-all-violations-btn"
                    disabled={db.violations.length === 0}
                    onClick={() => setConfirmClearViolations(true)}
                    className="inline-flex items-center gap-1 rounded-md bg-rose-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-rose-700 disabled:opacity-45 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>Hapus Semua</span>
                  </button>
                ) : (
                  <div className="inline-flex items-center gap-1.5">
                    <button
                      type="button"
                      data-testid="confirm-clear-all-violations-btn"
                      onClick={() => {
                        const removed = deleteViolationLogs({ clearAll: true });
                        setSelectedViolationIds(new Set());
                        setConfirmClearViolations(false);
                        setStatusMsg({
                          type: 'ok',
                          text: `Seluruh ${removed} catatan pelanggaran berhasil dibersihkan.`,
                        });
                      }}
                      className="rounded-md bg-rose-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-rose-700"
                    >
                      Ya, Hapus Semua
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClearViolations(false)}
                      className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300"
                    >
                      Batal
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        aria-label="Pilih semua data pelanggaran"
                        checked={allViolationsSelected}
                        onChange={toggleAllViolations}
                        disabled={db.violations.length === 0}
                        className="h-3.5 w-3.5 rounded border-slate-400 text-rose-600"
                      />
                    </th>
                    <th className="px-4 py-3 font-semibold">Timestamp</th>
                    <th className="px-4 py-3 font-semibold">Peserta</th>
                    <th className="px-4 py-3 font-semibold">Paket Ujian</th>
                    <th className="px-4 py-3 font-semibold">Jenis & Detail Pelanggaran</th>
                    <th className="px-4 py-3 font-semibold text-right">Hapus</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {db.violations.map((v) => {
                    const checked = selectedViolationIds.has(v.id);
                    return (
                      <tr
                        key={v.id}
                        className={
                          checked
                            ? 'bg-rose-50/50 dark:bg-rose-950/25'
                            : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40'
                        }
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            aria-label={`Pilih pelanggaran ${v.studentName}`}
                            checked={checked}
                            onChange={() => toggleViolationRow(v.id)}
                            className="h-3.5 w-3.5 rounded border-slate-400 text-rose-600"
                          />
                        </td>
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
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            aria-label={`Hapus pelanggaran ${v.studentName}`}
                            onClick={() => {
                              deleteViolationLogs({ ids: [v.id] });
                              setSelectedViolationIds((prev) => {
                                const next = new Set(prev);
                                next.delete(v.id);
                                return next;
                              });
                              setStatusMsg({
                                type: 'ok',
                                text: `1 catatan pelanggaran (${v.studentName}) dihapus.`,
                              });
                            }}
                            className="inline-flex items-center justify-center rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50 dark:hover:text-rose-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {db.violations.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                        Belum ada pelanggaran tercatat.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        );
      })()}

      {/* Sub-Menu 5: System Audit Log */}
      {activeSubMenu === 'audit' && (() => {
        const visibleLogs = filteredLogs.slice(0, 60);
        const visibleLogIds = visibleLogs.map((l) => l.id);
        const validSelectedAudits = filteredLogs
          .map((l) => l.id)
          .filter((id) => selectedAuditIds.has(id));
        const allVisibleAuditsSelected =
          visibleLogIds.length > 0 &&
          visibleLogIds.every((id) => selectedAuditIds.has(id));

        const toggleAuditRow = (id: string) => {
          setSelectedAuditIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
          });
        };

        const toggleAllVisibleAudits = () => {
          if (allVisibleAuditsSelected) {
            setSelectedAuditIds(new Set());
          } else {
            setSelectedAuditIds(new Set(visibleLogIds));
          }
        };

        return (
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

            {/* Bilah Hapus Audit Log */}
            <div
              data-testid="audit-delete-bar"
              className="flex flex-wrap items-center justify-between gap-2.5 bg-rose-50/60 dark:bg-rose-950/20 px-5 py-2.5 border-b border-rose-100 dark:border-rose-900/50 text-xs"
            >
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <Trash2 className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                <span className="font-semibold">Bilah Hapus Audit Log</span>
                {validSelectedAudits.length > 0 && (
                  <span className="font-mono text-[11px] text-rose-700 dark:text-rose-300">
                    · {validSelectedAudits.length} dipilih
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  data-testid="delete-selected-audit-btn"
                  disabled={validSelectedAudits.length === 0}
                  onClick={() => {
                    const removed = deleteAuditLogs({ ids: validSelectedAudits });
                    setSelectedAuditIds(new Set());
                    setStatusMsg({
                      type: 'ok',
                      text: `${removed} catatan audit log terpilih berhasil dihapus.`,
                    });
                  }}
                  className="inline-flex items-center gap-1 rounded-md border border-rose-300 dark:border-rose-800 bg-white dark:bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/50 disabled:opacity-45 disabled:cursor-not-allowed"
                >
                  <Trash2 className="h-3 w-3" />
                  <span>Hapus Terpilih ({validSelectedAudits.length})</span>
                </button>

                <button
                  type="button"
                  data-testid="trim-audit-btn"
                  disabled={db.auditLogs.length <= 20}
                  onClick={() => {
                    const removed = deleteAuditLogs({ keepLatest: 20 });
                    setSelectedAuditIds(new Set());
                    setStatusMsg({
                      type: 'ok',
                      text: `${removed} catatan audit log lama dipangkas (menyisakan 20 terbaru).`,
                    });
                  }}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-45 disabled:cursor-not-allowed"
                >
                  <span>Sisakan 20 Terbaru</span>
                </button>

                {!confirmClearAudit ? (
                  <button
                    type="button"
                    data-testid="clear-all-audit-btn"
                    disabled={db.auditLogs.length === 0}
                    onClick={() => setConfirmClearAudit(true)}
                    className="inline-flex items-center gap-1 rounded-md bg-rose-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-rose-700 disabled:opacity-45 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>Hapus Semua</span>
                  </button>
                ) : (
                  <div className="inline-flex items-center gap-1.5">
                    <button
                      type="button"
                      data-testid="confirm-clear-all-audit-btn"
                      onClick={() => {
                        const removed = deleteAuditLogs({ clearAll: true });
                        setSelectedAuditIds(new Set());
                        setConfirmClearAudit(false);
                        setStatusMsg({
                          type: 'ok',
                          text: `Seluruh ${removed} catatan audit log berhasil dibersihkan.`,
                        });
                      }}
                      className="rounded-md bg-rose-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-rose-700"
                    >
                      Ya, Hapus Semua
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClearAudit(false)}
                      className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300"
                    >
                      Batal
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        aria-label="Pilih semua audit log"
                        checked={allVisibleAuditsSelected}
                        onChange={toggleAllVisibleAudits}
                        disabled={visibleLogs.length === 0}
                        className="h-3.5 w-3.5 rounded border-slate-400 text-rose-600"
                      />
                    </th>
                    <th className="px-4 py-3 font-semibold">Waktu</th>
                    <th className="px-4 py-3 font-semibold">Aktor</th>
                    <th className="px-4 py-3 font-semibold">Aktivitas</th>
                    <th className="px-4 py-3 font-semibold">Keterangan</th>
                    <th className="px-4 py-3 font-semibold text-right">Hapus</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {visibleLogs.map((log) => {
                    const checked = selectedAuditIds.has(log.id);
                    return (
                      <tr
                        key={log.id}
                        className={
                          checked
                            ? 'bg-rose-50/50 dark:bg-rose-950/25'
                            : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40'
                        }
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            aria-label={`Pilih audit log ${log.action}`}
                            checked={checked}
                            onChange={() => toggleAuditRow(log.id)}
                            className="h-3.5 w-3.5 rounded border-slate-400 text-rose-600"
                          />
                        </td>
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
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            aria-label={`Hapus audit log ${log.action}`}
                            onClick={() => {
                              deleteAuditLogs({ ids: [log.id] });
                              setSelectedAuditIds((prev) => {
                                const next = new Set(prev);
                                next.delete(log.id);
                                return next;
                              });
                              setStatusMsg({
                                type: 'ok',
                                text: `1 catatan audit log (${log.action}) dihapus.`,
                              });
                            }}
                            className="inline-flex items-center justify-center rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50 dark:hover:text-rose-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredLogs.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                        Belum ada catatan aktivitas sistem.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        );
      })()}
    </div>
  );
}
