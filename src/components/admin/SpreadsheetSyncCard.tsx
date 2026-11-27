import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Cloud,
  CloudDownload,
  CloudUpload,
  Code2,
  Copy,
  Download,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { useCBT } from '../../context/CBTContext';
import { buildNetlifyEnvSnippet } from '../../config/autoSyncConfig';
import type { SpreadsheetSyncConfig } from '../../types/cbt';
import {
  generateGoogleAppsScriptCode,
  validateAppsScriptUrl,
} from '../../utils/cbtLogic';

export function SpreadsheetSyncCard() {
  const {
    db,
    syncRuntime,
    serverAutoSyncStatus,
    updateSpreadsheetSyncConfig,
    testSpreadsheetConnection,
    pushDatabaseToSpreadsheet,
    pullDatabaseFromSpreadsheet,
  } = useCBT();

  const [form, setForm] = useState<SpreadsheetSyncConfig>(db.spreadsheetSync);

  useEffect(() => {
    setForm(db.spreadsheetSync);
  }, [db.spreadsheetSync]);
  const [showScriptCode, setShowScriptCode] = useState(false);
  const [showNetlifyEnv, setShowNetlifyEnv] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedNetlifyEnv, setCopiedNetlifyEnv] = useState(false);
  const [busyAction, setBusyAction] = useState<'test' | 'push' | 'pull' | null>(null);
  const [localNotice, setLocalNotice] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);

  const urlCheck = useMemo(
    () => (form.webAppUrl.trim() ? validateAppsScriptUrl(form.webAppUrl) : null),
    [form.webAppUrl]
  );

  const generatedScript = useMemo(
    () =>
      generateGoogleAppsScriptCode({
        syncSecret: form.syncSecret,
        schoolName: db.school.schoolName,
      }),
    [db.school.schoolName, form.syncSecret]
  );

  const hasActiveEndpoint =
    Boolean(form.webAppUrl.trim()) || serverAutoSyncStatus.serverConfigured;

  const netlifyEnvSnippet = useMemo(
    () =>
      buildNetlifyEnvSnippet({
        webAppUrl: form.webAppUrl,
        spreadsheetUrl: form.spreadsheetUrl,
        syncSecret: form.syncSecret,
      }),
    [form.webAppUrl, form.spreadsheetUrl, form.syncSecret]
  );

  const copyTextWithFallback = async (text: string): Promise<boolean> => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // Fallback below for iframe / restricted clipboard contexts
    }
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      return ok;
    } catch {
      return false;
    }
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalNotice(null);
    const trimmedUrl = form.webAppUrl.trim();
    const shouldAutoEnable =
      !form.enabled &&
      !db.spreadsheetSync.enabled &&
      Boolean(trimmedUrl) &&
      validateAppsScriptUrl(trimmedUrl).ok;
    const nextConfig: SpreadsheetSyncConfig = shouldAutoEnable
      ? { ...form, enabled: true }
      : form;

    if (nextConfig.enabled && !serverAutoSyncStatus.serverConfigured) {
      const check = validateAppsScriptUrl(nextConfig.webAppUrl);
      if (!check.ok) {
        setLocalNotice({
          type: 'err',
          text: check.error || 'URL Web App Google Apps Script tidak valid.',
        });
        return;
      }
    }
    setForm(nextConfig);
    updateSpreadsheetSyncConfig(nextConfig);
    setLocalNotice({
      type: 'ok',
      text: nextConfig.enabled
        ? 'Pengaturan penyimpanan otomatis Google Spreadsheet & Apps Script disimpan dan diaktifkan.'
        : 'Pengaturan Google Spreadsheet disimpan (mode otomatis nonaktif).',
    });
  };

  const handleCopyNetlifyEnv = async () => {
    setShowNetlifyEnv(true);
    const copied = await copyTextWithFallback(netlifyEnvSnippet);
    if (copied) {
      setCopiedNetlifyEnv(true);
      window.setTimeout(() => setCopiedNetlifyEnv(false), 2500);
      setLocalNotice({
        type: 'ok',
        text: 'Variabel lingkungan Netlify berhasil disalin. Tempel di Netlify -> Environment variables agar aplikasi otomatis terhubung setelah deploy.',
      });
    } else {
      setLocalNotice({
        type: 'ok',
        text: 'Daftar variabel Netlify ditampilkan di bawah — salin lalu tempel ke Netlify -> Site configuration -> Environment variables.',
      });
    }
  };

  const handleTest = async () => {
    setLocalNotice(null);
    setBusyAction('test');
    const res = await testSpreadsheetConnection(form);
    if (res.ok && res.spreadsheetUrl && !form.spreadsheetUrl.trim()) {
      setForm((prev) => ({ ...prev, spreadsheetUrl: res.spreadsheetUrl || '' }));
    }
    setLocalNotice({ type: res.ok ? 'ok' : 'err', text: res.message });
    setBusyAction(null);
  };

  const handlePushNow = async () => {
    setLocalNotice(null);
    setBusyAction('push');
    const res = await pushDatabaseToSpreadsheet(form);
    setLocalNotice({ type: res.ok ? 'ok' : 'err', text: res.message });
    setBusyAction(null);
  };

  const handlePullNow = async () => {
    setLocalNotice(null);
    setBusyAction('pull');
    const res = await pullDatabaseFromSpreadsheet(form, { manual: true });
    setLocalNotice({ type: res.ok ? 'ok' : 'err', text: res.message });
    setBusyAction(null);
  };

  const handleCopyScript = async () => {
    const copied = await copyTextWithFallback(generatedScript);
    if (copied) {
      setCopiedCode(true);
      window.setTimeout(() => setCopiedCode(false), 2000);
    } else {
      setLocalNotice({
        type: 'err',
        text: 'Gagal menyalin otomatis. Silakan salin langsung dari kotak kode atau unduh file Code.gs.',
      });
    }
  };

  const handleDownloadScript = () => {
    const blob = new Blob([generatedScript], {
      type: 'text/plain;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Code.gs';
    a.click();
    URL.revokeObjectURL(url);
    setLocalNotice({
      type: 'ok',
      text: 'Berkas Code.gs berhasil diunduh. Tempelkan ke Google Apps Script lalu terapkan sebagai Aplikasi Web.',
    });
  };

  const lastSyncedLabel = db.spreadsheetSync.lastSyncedAt
    ? new Date(db.spreadsheetSync.lastSyncedAt).toLocaleString('id-ID')
    : 'Belum pernah tersinkron';

  return (
    <section
      data-testid="spreadsheet-sync-card"
      className="rounded-xl border border-indigo-200 dark:border-indigo-900/70 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-5"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400">
            <Cloud className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
              Penyimpanan Database Google Spreadsheet & Apps Script
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
              Hubungkan aplikasi CBT ke Google Spreadsheet melalui Web App Google Apps Script agar data siswa, guru, paket soal, nilai, dan pelanggaran tersimpan serta sinkron otomatis.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
              <span>
                Status:{' '}
                <strong
                  className={
                    db.spreadsheetSync.enabled
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-slate-600 dark:text-slate-300'
                  }
                >
                  {db.spreadsheetSync.enabled || serverAutoSyncStatus.serverConfigured
                    ? serverAutoSyncStatus.serverConfigured
                      ? 'Terhubung Otomatis (Server/Netlify Env)'
                      : 'Terhubung Otomatis'
                    : 'Lokal (Manual)'}
                </strong>
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                Sinkron terakhir: {lastSyncedLabel}
              </span>
              {syncRuntime.status === 'syncing' && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-indigo-700 dark:text-indigo-400 font-semibold">
                    Sedang menyinkronkan...
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Master Toggle */}
        <label className="inline-flex cursor-pointer items-center gap-2.5 self-start rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-3.5 py-2 shrink-0">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, enabled: e.target.checked }))
            }
            aria-label="Aktifkan sinkronisasi otomatis Google Spreadsheet"
            className="h-4 w-4 rounded border-slate-400 text-indigo-600"
          />
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
            Sinkronisasi Otomatis
          </span>
        </label>
      </div>

      {localNotice && (
        <div
          role="status"
          data-testid="spreadsheet-sync-notice"
          className={`rounded-lg border px-4 py-3 text-xs font-medium ${
            localNotice.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
              : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
          }`}
        >
          {localNotice.text}
        </div>
      )}

      {/* Configuration Form */}
      <form onSubmit={handleSaveConfig} className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="lg:col-span-2">
            <label
              htmlFor="gas-webapp-url"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
            >
              URL Web App Google Apps Script (Deployment <code className="font-mono">/exec</code>)
            </label>
            <input
              id="gas-webapp-url"
              type="url"
              value={form.webAppUrl}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, webAppUrl: e.target.value }))
              }
              placeholder="https://script.google.com/macros/s/AKfycb.../exec"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-xs font-mono text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            />
            {urlCheck && !urlCheck.ok && (
              <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">
                {urlCheck.error}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="gas-secret"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
            >
              Kunci Rahasia Sinkronisasi (Opsional — <code className="font-mono">SYNC_SECRET</code>)
            </label>
            <input
              id="gas-secret"
              type="text"
              value={form.syncSecret}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, syncSecret: e.target.value }))
              }
              placeholder="Contoh: SMANSA_CBT_2026"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 focus:border-indigo-600 focus:outline-none"
            />
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              Otomatis disisipkan ke kode <code className="font-mono">Code.gs</code> di bawah agar endpoint hanya menerima permintaan dari aplikasi ini.
            </p>
          </div>

          <div>
            <label
              htmlFor="gas-sheet-url"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
            >
              Tautan Google Spreadsheet (Opsional — untuk akses cepat)
            </label>
            <div className="flex gap-2">
              <input
                id="gas-sheet-url"
                type="url"
                value={form.spreadsheetUrl}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, spreadsheetUrl: e.target.value }))
                }
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 focus:border-indigo-600 focus:outline-none"
              />
              {form.spreadsheetUrl.trim() && (
                <a
                  href={form.spreadsheetUrl.trim()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 whitespace-nowrap"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Buka</span>
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Auto-sync behavior controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-4">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={form.autoPushOnChange}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  autoPushOnChange: e.target.checked,
                }))
              }
              className="mt-0.5 h-4 w-4 rounded border-slate-400 text-indigo-600"
            />
            <div className="text-xs">
              <div className="font-semibold text-slate-900 dark:text-slate-100">
                Auto-Push Saat Berubah
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Otomatis kirim ke Spreadsheet setiap ada perubahan data/nilai.
              </div>
            </div>
          </label>

          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={form.autoPullOnLoad}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  autoPullOnLoad: e.target.checked,
                }))
              }
              className="mt-0.5 h-4 w-4 rounded border-slate-400 text-indigo-600"
            />
            <div className="text-xs">
              <div className="font-semibold text-slate-900 dark:text-slate-100">
                Auto-Pull Saat Dibuka
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Muat data terbaru dari Spreadsheet otomatis saat membuka aplikasi.
              </div>
            </div>
          </label>

          <div className="text-xs">
            <label
              htmlFor="gas-interval"
              className="block font-semibold text-slate-900 dark:text-slate-100 mb-1"
            >
              Sinkronisasi Berkala (Pull)
            </label>
            <select
              id="gas-interval"
              value={form.autoPullIntervalSeconds}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  autoPullIntervalSeconds: Number(e.target.value),
                }))
              }
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200"
            >
              <option value={0}>Nonaktif (Hanya saat buka & ubah)</option>
              <option value={30}>Setiap 30 detik</option>
              <option value={60}>Setiap 1 menit</option>
              <option value={300}>Setiap 5 menit</option>
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 whitespace-nowrap"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Simpan Pengaturan Spreadsheet</span>
            </button>

            <button
              type="button"
              disabled={busyAction !== null || !hasActiveEndpoint}
              onClick={handleTest}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 whitespace-nowrap"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${busyAction === 'test' ? 'animate-spin' : ''}`}
              />
              <span>Uji Koneksi</span>
            </button>

            <button
              type="button"
              disabled={busyAction !== null || !hasActiveEndpoint}
              onClick={handlePushNow}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-3.5 py-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 disabled:opacity-50 whitespace-nowrap"
            >
              <CloudUpload className="h-3.5 w-3.5" />
              <span>Kirim ke Spreadsheet (Push)</span>
            </button>

            <button
              type="button"
              disabled={busyAction !== null || !hasActiveEndpoint}
              onClick={handlePullNow}
              className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/40 px-3.5 py-2 text-xs font-semibold text-indigo-800 dark:text-indigo-300 hover:bg-indigo-100 disabled:opacity-50 whitespace-nowrap"
            >
              <CloudDownload className="h-3.5 w-3.5" />
              <span>Ambil dari Spreadsheet (Pull)</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopyNetlifyEnv}
              data-testid="copy-netlify-env-btn"
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/40 px-3 py-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 whitespace-nowrap"
            >
              {copiedNetlifyEnv ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>Env Netlify Tersalin</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Salin Env Netlify</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowScriptCode((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 whitespace-nowrap"
            >
              <Code2 className="h-3.5 w-3.5" />
              <span>
                {showScriptCode
                  ? 'Sembunyikan Kode Apps Script'
                  : 'Lihat Kode Google Apps Script (Code.gs)'}
              </span>
            </button>
          </div>
        </div>
      </form>

      {/* Collapsible Netlify Environment Variables Panel */}
      {showNetlifyEnv && (
        <div
          data-testid="netlify-env-panel"
          className="rounded-xl border border-emerald-200 dark:border-emerald-900/70 bg-emerald-50/40 dark:bg-emerald-950/20 p-4 space-y-2.5"
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Konfigurasi Otomatis Netlify (Environment Variables)
              </h3>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                Tempel nilai berikut di <strong>Netlify &rarr; Site configuration &rarr; Environment variables</strong> agar Spreadsheet & Apps Script otomatis terhubung tanpa pengaturan manual di setiap perangkat.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowNetlifyEnv(false)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50"
            >
              Tutup
            </button>
          </div>
          <pre className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-900 p-3 text-[11px] font-mono text-emerald-200 leading-relaxed select-all">
            <code>{netlifyEnvSnippet}</code>
          </pre>
        </div>
      )}

      {/* Collapsible Google Apps Script Generator & Deployment Guide */}
      {showScriptCode && (
        <div
          data-testid="apps-script-code-panel"
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 p-4 space-y-3"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Kode Google Apps Script Siap Pakai (<code className="font-mono">Code.gs</code>)
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Otomatis membuat tab <code className="font-mono">CBT_Master_JSON</code>, <code className="font-mono">Siswa</code>, <code className="font-mono">Guru</code>, <code className="font-mono">Paket_Ujian</code>, <code className="font-mono">Bank_Soal</code>, <code className="font-mono">Rekap_Nilai</code>, dan <code className="font-mono">Pelanggaran</code> di Google Spreadsheet Anda.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCopyScript}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 whitespace-nowrap"
              >
                {copiedCode ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    <span>Tersalin</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Salin Code.gs</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleDownloadScript}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 whitespace-nowrap"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Unduh Code.gs</span>
              </button>
            </div>
          </div>

          <ol className="list-decimal list-inside space-y-1 text-xs text-slate-600 dark:text-slate-300">
            <li>Buka Google Spreadsheet baru, lalu pilih menu <strong>Ekstensi &rarr; Apps Script</strong>.</li>
            <li>Hapus kode bawaan, tempel seluruh kode <code className="font-mono">Code.gs</code> di bawah, lalu simpan.</li>
            <li>Klik <strong>Terapkan &rarr; Deployment baru &rarr; Aplikasi Web</strong>. Set <em>Jalankan sebagai: Saya</em> dan <em>Yang memiliki akses: Siapa saja</em>.</li>
            <li>Salin URL Web App (<code className="font-mono">/exec</code>), tempel ke kolom di atas, lalu klik <strong>Uji Koneksi</strong> dan <strong>Simpan Pengaturan</strong>.</li>
          </ol>

          <pre className="max-h-72 overflow-auto rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-900 p-3.5 text-[11px] font-mono text-slate-100 leading-relaxed">
            <code>{generatedScript}</code>
          </pre>
        </div>
      )}
    </section>
  );
}
