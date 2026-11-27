import React, { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  AlertTriangle,
  CloudDownload,
  CloudUpload,
  Database,
  ExternalLink,
  FilePlus2,
  FileSpreadsheet,
  FolderSearch,
  LogOut,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useCBT } from '../../context/CBTContext';
import { resolveAutoSyncDefaults } from '../../config/autoSyncConfig';
import {
  getGoogleAccessToken,
  googleSignIn,
  googleSignOut,
  initGoogleWorkspaceAuth,
} from '../../lib/firebase';
import {
  loadStudentsFromFirestoreSnapshot,
  saveCbtSnapshotToFirestore,
  subscribeToUserSnapshot,
  type CloudSnapshotSummary,
} from '../../services/firestoreSyncService';
import {
  CBT_SHEET_TABS,
  createCbtSpreadsheet,
  getSpreadsheetMetadata,
  listDriveSpreadsheets,
  parseStudentsFromSheetRows,
  readSheetTabValues,
  syncDatabaseToGoogleSheet,
  type DriveSpreadsheetFile,
  type SpreadsheetMetadata,
} from '../../services/googleSheetsService';
import { GoogleSignInButton } from '../GoogleSignInButton';

type PendingWorkspaceMutation =
  | {
      kind: 'create_sheet';
      title: string;
    }
  | {
      kind: 'sync_sheet';
      spreadsheetId: string;
      spreadsheetName: string;
    };

export function CloudWorkspaceSyncCard() {
  const { db, firestoreAutoSync, serverAutoSyncStatus, importStudentsBatch, addClassRoom } = useCBT();
  const envDefaults = resolveAutoSyncDefaults();

  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);

  // Firebase Firestore state
  const [cloudSummary, setCloudSummary] = useState<CloudSnapshotSummary | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Google Drive / Sheets state (pre-filled automatically from Env or Server config when available)
  const [driveFiles, setDriveFiles] = useState<DriveSpreadsheetFile[]>([]);
  const [selectedSpreadsheetId, setSelectedSpreadsheetId] = useState(
    () => envDefaults.spreadsheetId || serverAutoSyncStatus.spreadsheetId || ''
  );
  const [sheetMeta, setSheetMeta] = useState<SpreadsheetMetadata | null>(null);
  const [selectedTabName, setSelectedTabName] = useState('');
  const [newSheetTitle, setNewSheetTitle] = useState(
    `Database CBT ${db.school.schoolName}`
  );

  // Mandatory explicit confirmation dialog state for mutating Google Workspace API calls
  const [pendingMutation, setPendingMutation] =
    useState<PendingWorkspaceMutation | null>(null);

  useEffect(() => {
    const unsubscribe = initGoogleWorkspaceAuth(
      (user, token) => {
        setGoogleUser(user);
        setAccessToken(token);
        setNeedsAuth(!token);
      },
      () => {
        setGoogleUser(null);
        setAccessToken(null);
        setNeedsAuth(true);
        setCloudSummary(null);
        setDriveFiles([]);
        setSheetMeta(null);
      }
    );
    return unsubscribe;
  }, []);

  // Auto-load spreadsheet metadata as soon as an OAuth token and pre-configured spreadsheetId exist
  useEffect(() => {
    const targetId =
      selectedSpreadsheetId ||
      envDefaults.spreadsheetId ||
      serverAutoSyncStatus.spreadsheetId;
    if (!accessToken || !targetId || sheetMeta?.spreadsheetId === targetId) return;
    if (!selectedSpreadsheetId) setSelectedSpreadsheetId(targetId);
    void getSpreadsheetMetadata(accessToken, targetId)
      .then((meta) => {
        setSheetMeta(meta);
        setSelectedTabName((prev) => prev || meta.sheets[0]?.title || '');
      })
      .catch(() => {
        // User can pick another spreadsheet manually if ID is inaccessible
      });
  }, [
    accessToken,
    selectedSpreadsheetId,
    envDefaults.spreadsheetId,
    serverAutoSyncStatus.spreadsheetId,
    sheetMeta?.spreadsheetId,
  ]);

  // Attach Firestore onSnapshot listener only when user is authenticated
  useEffect(() => {
    if (!googleUser) {
      setCloudSummary(null);
      return;
    }
    const unsub = subscribeToUserSnapshot(
      googleUser,
      (summary) => {
        setCloudSummary(summary);
        if (summary?.linkedSpreadsheetId && !selectedSpreadsheetId) {
          setSelectedSpreadsheetId(summary.linkedSpreadsheetId);
        }
      },
      (err) => {
        const msg = err instanceof Error ? err.message : 'Gagal membaca status Firestore.';
        if (msg.includes('Quota exceeded')) {
          setNotice({
            type: 'err',
            text: 'Kuota harian Firestore tercapai. Kuota akan direset keesokan hari.',
          });
        }
      }
    );
    return unsub;
  }, [googleUser]);

  const handleGoogleLogin = async () => {
    setNotice(null);
    setIsSigningIn(true);
    try {
      const result = await googleSignIn();
      setGoogleUser(result.user);
      setAccessToken(result.accessToken);
      setNeedsAuth(false);
      setNotice({
        type: 'ok',
        text: `Berhasil masuk dengan akun Google (${result.user.email || result.user.displayName}). Akses Firebase & Google Sheets aktif.`,
      });
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Autentikasi Google dibatalkan atau gagal.';
      setNotice({ type: 'err', text: msg });
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleGoogleLogout = async () => {
    setNotice(null);
    await googleSignOut();
    setGoogleUser(null);
    setAccessToken(null);
    setNeedsAuth(true);
    setDriveFiles([]);
    setSheetMeta(null);
    setSelectedSpreadsheetId('');
    setSelectedTabName('');
    setNotice({ type: 'ok', text: 'Sesi Google & akses Google Sheets telah diputuskan.' });
  };

  const ensureWorkspaceToken = async (): Promise<string | null> => {
    const token = accessToken || (await getGoogleAccessToken());
    if (!token) {
      setNeedsAuth(true);
      setNotice({
        type: 'err',
        text: 'Silakan klik "Sign in with Google" terlebih dahulu untuk mendapatkan izin akses Google Sheets & Drive.',
      });
      return null;
    }
    return token;
  };

  // --- Firebase Firestore Actions ---
  const handleSaveToFirestore = async () => {
    if (!googleUser) {
      setNotice({
        type: 'err',
        text: 'Masuk dengan akun Google terlebih dahulu untuk menyimpan ke Firebase Firestore.',
      });
      return;
    }
    setNotice(null);
    setBusyAction('fs_save');
    try {
      const result = await saveCbtSnapshotToFirestore(
        googleUser,
        db,
        sheetMeta
          ? { id: sheetMeta.spreadsheetId, name: sheetMeta.title }
          : undefined
      );
      setNotice({
        type: 'ok',
        text: `Data CBT berhasil disimpan ke Firebase Firestore (${result.syncedStudents} siswa [maks. 999], ${result.syncedTeachers} guru, ${result.syncedPackages} paket ujian · ${result.batchCount} batch) & dipublikasikan ke mode berbagi lintas perangkat.`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan ke Firestore.';
      setNotice({
        type: 'err',
        text: msg.includes('Quota exceeded')
          ? 'Kuota harian Firestore telah tercapai dan akan direset keesokan hari.'
          : `Gagal menyimpan ke Firestore: ${msg}`,
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleLoadFromFirestore = async () => {
    if (!googleUser) {
      setNotice({
        type: 'err',
        text: 'Masuk dengan akun Google terlebih dahulu untuk memuat data dari Firestore.',
      });
      return;
    }
    setNotice(null);
    setBusyAction('fs_load');
    try {
      const res = await loadStudentsFromFirestoreSnapshot(googleUser);
      if (!res.snapshotFound) {
        setNotice({
          type: 'err',
          text: 'Belum ada cadangan data CBT yang tersimpan di Firebase Firestore untuk akun ini.',
        });
        return;
      }
      res.classes.forEach((cls) => addClassRoom(cls));
      const importSummary =
        res.students.length > 0
          ? importStudentsBatch(res.students)
          : { added: 0, updated: 0 };
      setNotice({
        type: 'ok',
        text: `Sinkronisasi dari Firebase Firestore selesai: ${importSummary.added} siswa ditambahkan, ${importSummary.updated} diperbarui, ${res.classes.length} kelas terverifikasi.`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal memuat data dari Firestore.';
      setNotice({ type: 'err', text: msg });
    } finally {
      setBusyAction(null);
    }
  };

  // --- Google Drive & Sheets Actions ---
  const handleLoadDriveSpreadsheets = async () => {
    const token = await ensureWorkspaceToken();
    if (!token) return;
    setNotice(null);
    setBusyAction('drive_list');
    try {
      const files = await listDriveSpreadsheets(token);
      setDriveFiles(files);
      if (files.length === 0) {
        setNotice({
          type: 'ok',
          text: 'Tidak ditemukan Google Spreadsheet di Google Drive Anda. Anda dapat membuat Spreadsheet CBT baru di bawah.',
        });
      } else {
        const nextId = selectedSpreadsheetId || files[0].id;
        setSelectedSpreadsheetId(nextId);
        const meta = await getSpreadsheetMetadata(token, nextId);
        setSheetMeta(meta);
        setSelectedTabName(meta.sheets[0]?.title || '');
        setNotice({
          type: 'ok',
          text: `${files.length} Google Spreadsheet ditemukan di Google Drive Anda.`,
        });
      }
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal memuat daftar Spreadsheet dari Drive.',
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleSelectSpreadsheet = async (spreadsheetId: string) => {
    setSelectedSpreadsheetId(spreadsheetId);
    setSheetMeta(null);
    setSelectedTabName('');
    if (!spreadsheetId) return;
    const token = await ensureWorkspaceToken();
    if (!token) return;
    setBusyAction('sheet_meta');
    try {
      const meta = await getSpreadsheetMetadata(token, spreadsheetId);
      setSheetMeta(meta);
      setSelectedTabName(meta.sheets[0]?.title || '');
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal membaca daftar tab Spreadsheet.',
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleImportStudentsFromSheet = async () => {
    const token = await ensureWorkspaceToken();
    if (!token || !selectedSpreadsheetId || !selectedTabName) return;
    setNotice(null);
    setBusyAction('sheet_import');
    try {
      const rows = await readSheetTabValues(token, selectedSpreadsheetId, selectedTabName);
      const parsed = parseStudentsFromSheetRows(rows);
      if (parsed.students.length === 0) {
        setNotice({
          type: 'err',
          text: `Tidak ada data siswa valid pada tab "${selectedTabName}". Pastikan terdapat kolom NISN, Nama, dan Kelas.`,
        });
        return;
      }
      const res = importStudentsBatch(parsed.students);
      setNotice({
        type: 'ok',
        text: `Import dari Google Sheet ("${selectedTabName}") berhasil: ${res.added} siswa ditambahkan, ${res.updated} diperbarui${
          parsed.skipped > 0 ? ` (${parsed.skipped} baris dilewati)` : ''
        }.`,
      });
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal mengimpor siswa dari Google Sheets.',
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleConfirmPendingMutation = async () => {
    if (!pendingMutation) return;
    const mutation = pendingMutation;
    setPendingMutation(null);

    const token = await ensureWorkspaceToken();
    if (!token) return;
    setNotice(null);

    if (mutation.kind === 'create_sheet') {
      setBusyAction('sheet_create');
      try {
        const created = await createCbtSpreadsheet(token, mutation.title);
        setSheetMeta(created);
        setSelectedSpreadsheetId(created.spreadsheetId);
        setSelectedTabName(created.sheets[0]?.title || 'Siswa');
        setDriveFiles((prev) => [
          {
            id: created.spreadsheetId,
            name: created.title,
            webViewLink: created.spreadsheetUrl,
          },
          ...prev.filter((f) => f.id !== created.spreadsheetId),
        ]);
        const syncRes = await syncDatabaseToGoogleSheet(token, created.spreadsheetId, db);
        setNotice({
          type: 'ok',
          text: `Google Spreadsheet "${created.title}" berhasil dibuat dan diisi ${syncRes.totalRows} baris data pada ${syncRes.updatedTabs} tab CBT.`,
        });
      } catch (err) {
        setNotice({
          type: 'err',
          text: err instanceof Error ? err.message : 'Gagal membuat Google Spreadsheet baru.',
        });
      } finally {
        setBusyAction(null);
      }
    } else if (mutation.kind === 'sync_sheet') {
      setBusyAction('sheet_sync');
      try {
        const syncRes = await syncDatabaseToGoogleSheet(token, mutation.spreadsheetId, db);
        const refreshed = await getSpreadsheetMetadata(token, mutation.spreadsheetId);
        setSheetMeta(refreshed);
        setNotice({
          type: 'ok',
          text: `Sinkronisasi ke "${mutation.spreadsheetName}" selesai: ${syncRes.updatedTabs} tab CBT diperbarui (${syncRes.totalRows} total baris data).`,
        });
      } catch (err) {
        setNotice({
          type: 'err',
          text: err instanceof Error ? err.message : 'Gagal menyinkronkan data ke Google Sheets.',
        });
      } finally {
        setBusyAction(null);
      }
    }
  };

  const selectedFile = driveFiles.find((f) => f.id === selectedSpreadsheetId);
  const activeSheetName = sheetMeta?.title || selectedFile?.name || 'Google Spreadsheet Terpilih';
  const activeSheetUrl = sheetMeta?.spreadsheetUrl || selectedFile?.webViewLink || '';

  return (
    <section
      data-testid="cloud-workspace-sync-card"
      className="rounded-xl border border-emerald-200 dark:border-emerald-900/70 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-5"
    >
      {/* Header & Google Sign-In Control */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
              Integrasi Langsung Google Sheets, Drive & Firebase Cloud
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
              Masuk dengan akun Google untuk mencadangkan data CBT ke Firebase Firestore serta membaca atau menulis langsung ke Google Sheets di Google Drive Anda.
            </p>
            {googleUser && (
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>{googleUser.email || googleUser.displayName}</span>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Akses Google Sheets:{' '}
                  <strong className={accessToken ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}>
                    {accessToken ? 'Aktif (Sesi Ini)' : 'Perlu Sign-In Ulang'}
                  </strong>
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0 self-start">
          {needsAuth ? (
            <GoogleSignInButton
              onClick={handleGoogleLogin}
              disabled={isSigningIn}
              label={isSigningIn ? 'Menghubungkan...' : 'Sign in with Google'}
            />
          ) : (
            <button
              type="button"
              onClick={handleGoogleLogout}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 whitespace-nowrap"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Putuskan Google</span>
            </button>
          )}
        </div>
      </div>

      {notice && (
        <div
          role="status"
          data-testid="cloud-workspace-notice"
          className={`rounded-lg border px-4 py-3 text-xs font-medium ${
            notice.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
              : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
          }`}
        >
          {notice.text}
        </div>
      )}

      {/* Two-column Integration Grid: Firebase Cloud & Google Sheets Direct */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Column 1: Firebase Firestore Cloud Backup */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/35 p-4 space-y-3">
            <div className="flex items-start gap-2.5">
              <Database className="h-4 w-4 text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0" />
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Penyimpanan Cloud Firebase Firestore (Maks. 999 Siswa)
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Terhubung otomatis lintas perangkat tanpa perlu Sign-In ulang untuk menerima data sekolah & Apps Script. Masuk dengan Google jika ingin mencadangkan perubahan langsung dari perangkat ini.
                </p>
                {firestoreAutoSync.connected && (
                  <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 mt-1">
                    {firestoreAutoSync.mode === 'admin'
                      ? 'Auto-Sync Firestore Aktif (Baca & Tulis)'
                      : 'Terhubung Otomatis ke Cloud Sekolah (Tanpa Sign-In Ulang)'}
                    {firestoreAutoSync.status === 'syncing'
                      ? ' · Menyinkronkan...'
                      : firestoreAutoSync.lastSyncedAt
                        ? ` · Terakhir: ${firestoreAutoSync.lastSyncedAt}`
                        : ''}
                  </p>
                )}
              </div>
            </div>

          {(cloudSummary || firestoreAutoSync.portalSummary) ? (
            <div
              data-testid="firestore-live-summary"
              className="rounded-lg border border-indigo-200/80 dark:border-indigo-900/60 bg-white dark:bg-slate-900 px-3 py-2.5 text-[11px] space-y-1"
            >
              <div className="font-semibold text-slate-800 dark:text-slate-200">
                Snapshot Cloud: {(cloudSummary || firestoreAutoSync.portalSummary)!.schoolName} ({(cloudSummary || firestoreAutoSync.portalSummary)!.academicYear})
              </div>
              <div className="text-slate-500 dark:text-slate-400 tabular-nums">
                {(cloudSummary || firestoreAutoSync.portalSummary)!.studentCount} siswa · {(cloudSummary || firestoreAutoSync.portalSummary)!.teacherCount} guru ·{' '}
                {(cloudSummary || firestoreAutoSync.portalSummary)!.packageCount} paket · {(cloudSummary || firestoreAutoSync.portalSummary)!.questionCount} soal
              </div>
              {(cloudSummary || firestoreAutoSync.portalSummary)!.updatedAtLabel && (
                <div className="font-mono text-slate-400">
                  Terakhir disimpan: {(cloudSummary || firestoreAutoSync.portalSummary)!.updatedAtLabel}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-white/70 dark:bg-slate-900/50 px-3 py-2.5 text-[11px] text-slate-500 dark:text-slate-400">
              {googleUser
                ? 'Belum ada snapshot tersimpan di cloud. Klik "Simpan ke Firestore" untuk mempublikasikan data hingga 999 siswa ke semua perangkat.'
                : 'Menunggu publikasi awal dari Super Admin. Setelah disimpan sekali ke Firestore, seluruh perangkat lain otomatis terhubung tanpa Sign-In ulang.'}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              disabled={!googleUser || busyAction !== null}
              onClick={handleSaveToFirestore}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 whitespace-nowrap"
            >
              <CloudUpload className="h-3.5 w-3.5" />
              <span>
                {busyAction === 'fs_save' ? 'Menyimpan...' : 'Simpan ke Firestore'}
              </span>
            </button>
            <button
              type="button"
              disabled={!googleUser || busyAction !== null}
              onClick={handleLoadFromFirestore}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap"
            >
              <CloudDownload className="h-3.5 w-3.5" />
              <span>
                {busyAction === 'fs_load' ? 'Memuat...' : 'Muat dari Firestore'}
              </span>
            </button>
          </div>
        </div>

        {/* Column 2: Direct Google Sheets & Drive OAuth Integration */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/35 p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2.5">
              <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Google Sheets Langsung (via Google Drive)
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Pilih Spreadsheet yang ada di Google Drive atau buat baru, lalu impor daftar siswa atau sinkronkan 6 tab data CBT.
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={!accessToken || busyAction !== null}
              onClick={handleLoadDriveSpreadsheets}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 disabled:opacity-50 shrink-0 whitespace-nowrap"
            >
              <FolderSearch className="h-3.5 w-3.5" />
              <span>{busyAction === 'drive_list' ? 'Memuat...' : 'Cari di Drive'}</span>
            </button>
          </div>

          {/* Create new CBT Google Spreadsheet */}
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={newSheetTitle}
              onChange={(e) => setNewSheetTitle(e.target.value)}
              placeholder="Judul Google Spreadsheet baru"
              aria-label="Judul Google Spreadsheet baru"
              className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs text-slate-800 dark:text-slate-100 focus:border-emerald-600 focus:outline-none"
            />
            <button
              type="button"
              disabled={!accessToken || !newSheetTitle.trim() || busyAction !== null}
              onClick={() =>
                setPendingMutation({
                  kind: 'create_sheet',
                  title: newSheetTitle.trim(),
                })
              }
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 whitespace-nowrap"
            >
              <FilePlus2 className="h-3.5 w-3.5" />
              <span>Buat Spreadsheet Baru</span>
            </button>
          </div>

          {/* Select existing Spreadsheet & dynamic Tab name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label
                htmlFor="drive-sheet-select"
                className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1"
              >
                Pilih Google Spreadsheet
              </label>
              <select
                id="drive-sheet-select"
                value={selectedSpreadsheetId}
                disabled={!accessToken || driveFiles.length === 0}
                onChange={(e) => handleSelectSpreadsheet(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-100 disabled:opacity-60"
              >
                <option value="">
                  {driveFiles.length > 0
                    ? '-- Pilih Spreadsheet --'
                    : 'Klik "Cari di Drive" dulu'}
                </option>
                {driveFiles.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="drive-tab-select"
                className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1"
              >
                Pilih Tab Sheet (untuk Impor Siswa)
              </label>
              <select
                id="drive-tab-select"
                value={selectedTabName}
                disabled={!sheetMeta || sheetMeta.sheets.length === 0}
                onChange={(e) => setSelectedTabName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-100 disabled:opacity-60"
              >
                <option value="">
                  {sheetMeta ? '-- Pilih Tab --' : 'Menunggu Spreadsheet'}
                </option>
                {(sheetMeta?.sheets || []).map((tab) => (
                  <option key={tab.sheetId} value={tab.title}>
                    {tab.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              disabled={!accessToken || !selectedSpreadsheetId || busyAction !== null}
              onClick={() =>
                setPendingMutation({
                  kind: 'sync_sheet',
                  spreadsheetId: selectedSpreadsheetId,
                  spreadsheetName: activeSheetName,
                })
              }
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 disabled:opacity-50 whitespace-nowrap"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${busyAction === 'sheet_sync' ? 'animate-spin' : ''}`}
              />
              <span>Ekspor 6 Tab CBT ke Sheet</span>
            </button>

            <button
              type="button"
              disabled={
                !accessToken || !selectedSpreadsheetId || !selectedTabName || busyAction !== null
              }
              onClick={handleImportStudentsFromSheet}
              className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/40 px-3 py-1.5 text-xs font-semibold text-indigo-800 dark:text-indigo-300 hover:bg-indigo-100 disabled:opacity-50 whitespace-nowrap"
            >
              <CloudDownload className="h-3.5 w-3.5" />
              <span>Impor Siswa dari Tab</span>
            </button>

            {activeSheetUrl && (
              <a
                href={activeSheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 whitespace-nowrap"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Buka Sheet</span>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Mandatory Explicit Confirmation Modal for Mutating Google Workspace API Operations */}
      {pendingMutation && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="workspace-confirm-title"
          data-testid="workspace-confirm-dialog"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 backdrop-blur-xs p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h3
                    id="workspace-confirm-title"
                    className="text-sm font-bold text-slate-900 dark:text-slate-100"
                  >
                    {pendingMutation.kind === 'create_sheet'
                      ? 'Konfirmasi Pembuatan Google Spreadsheet'
                      : 'Konfirmasi Pembaruan Data Google Sheets'}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                    {pendingMutation.kind === 'create_sheet' ? (
                      <>
                        Aplikasi akan membuat file Google Spreadsheet baru bernama{' '}
                        <strong className="text-slate-900 dark:text-slate-100">
                          "{pendingMutation.title}"
                        </strong>{' '}
                        di Google Drive Anda dan mengisi 6 tab CBT ({CBT_SHEET_TABS.join(', ')}).
                      </>
                    ) : (
                      <>
                        Isi tab <strong className="text-slate-900 dark:text-slate-100">{CBT_SHEET_TABS.join(', ')}</strong> pada Google Spreadsheet{' '}
                        <strong className="text-slate-900 dark:text-slate-100">
                          "{pendingMutation.spreadsheetName}"
                        </strong>{' '}
                        akan ditimpa dengan data terbaru ({db.students.length} siswa, {db.teachers.length} guru, {db.packages.length} paket, {db.questions.length} soal, {db.attempts.length} nilai, {db.violations.length} pelanggaran).
                      </>
                    )}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPendingMutation(null)}
                aria-label="Tutup dialog konfirmasi"
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setPendingMutation(null)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmPendingMutation}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                {pendingMutation.kind === 'create_sheet'
                  ? 'Ya, Buat & Isi Spreadsheet'
                  : 'Ya, Perbarui Google Sheet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
