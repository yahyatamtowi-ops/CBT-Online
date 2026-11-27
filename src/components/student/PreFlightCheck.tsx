import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  CameraOff,
  CheckCircle2,
  Clock,
  LogOut,
  Mic,
  MonitorCheck,
  ShieldAlert,
  Wifi,
  XCircle,
} from 'lucide-react';
import { useCBT } from '../../context/CBTContext';
import type { ExamAttempt, ExamPackage, StudentRecord } from '../../types/cbt';
import { SchoolLogo } from '../LandingPortal';

interface CheckItem {
  id: string;
  label: string;
  detail: string;
  passed: boolean;
}

export function PreFlightCheck({
  student,
  examPackage,
  existingAttempt,
  questionCount,
  onStartExam,
  onBackToDashboard,
  onLogout,
}: {
  student: StudentRecord;
  examPackage: ExamPackage;
  existingAttempt?: ExamAttempt;
  questionCount: number;
  onStartExam: () => void;
  onBackToDashboard?: () => void;
  onLogout: () => void;
}) {
  const { db } = useCBT();
  const [checks, setChecks] = useState<CheckItem[]>([]);
  const [checking, setChecking] = useState(true);
  const [agreedRules, setAgreedRules] = useState(false);

  const requireCamera = db.security.requireCameraMonitoring;
  const [cameraStatus, setCameraStatus] = useState<
    'idle' | 'requesting' | 'ready' | 'error'
  >('idle');
  const [micReady, setMicReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const requestCameraPermission = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus('error');
      setCameraError(
        'Browser atau perangkat Anda tidak mendukung akses kamera pengawas.'
      );
      return;
    }

    stopCameraStream();
    setCameraStatus('requesting');
    setCameraError(null);

    try {
      let stream: MediaStream;
      let hasAudio = false;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: 'user' },
          audio: true,
        });
        hasAudio = stream.getAudioTracks().length > 0;
      } catch {
        // Fallback to video-only if microphone hardware is absent
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: 'user' },
          audio: false,
        });
        hasAudio = false;
      }

      streamRef.current = stream;
      setMicReady(hasAudio);
      setCameraStatus('ready');
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err) {
      setCameraStatus('error');
      setMicReady(false);
      const errName = err instanceof Error ? err.name : '';
      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        setCameraError(
          'Izin kamera ditolak. Mohon izinkan akses Kamera & Mikrofon pada pengaturan browser lalu klik Coba Lagi.'
        );
      } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        setCameraError(
          'Kamera tidak ditemukan pada perangkat ini. Pastikan kamera terpasang dan aktif.'
        );
      } else {
        setCameraError(
          'Gagal mengaktifkan kamera pengawas. Pastikan tidak ada aplikasi lain yang sedang menggunakan kamera.'
        );
      }
    }
  }, [stopCameraStream]);

  // Attach stream to video element once rendered
  useEffect(() => {
    if (cameraStatus === 'ready' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraStatus]);

  // Clean up camera tracks on unmount
  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, [stopCameraStream]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const hasLocalStorage = (() => {
        try {
          const k = '__cbt_test__';
          localStorage.setItem(k, '1');
          localStorage.removeItem(k);
          return true;
        } catch {
          return false;
        }
      })();

      const hasFullscreen = Boolean(
        document.documentElement.requestFullscreen ||
          (document.documentElement as unknown as { webkitRequestFullscreen?: unknown })
            .webkitRequestFullscreen
      );

      const isOnline = navigator.onLine;
      const viewportOk = window.innerWidth >= 320 && window.innerHeight >= 480;

      setChecks([
        {
          id: 'storage',
          label: 'Penyimpanan Auto-Save (LocalStorage)',
          detail: hasLocalStorage
            ? 'Aktif — Jawaban akan tersimpan otomatis pada setiap klik.'
            : 'Tidak tersedia — Mohon aktifkan penyimpanan browser.',
          passed: hasLocalStorage,
        },
        {
          id: 'fullscreen',
          label: 'Dukungan Mode Layar Penuh (Fullscreen API)',
          detail: hasFullscreen
            ? 'Browser mendukung penguncian layar penuh ujian.'
            : 'Mode fullscreen terbatas pada perangkat ini (mode pengawasan fokus tetap aktif).',
          passed: true,
        },
        {
          id: 'network',
          label: 'Koneksi Jaringan & Sinkronisasi',
          detail: isOnline
            ? 'Terhubung — Siap sinkronisasi sesi.'
            : 'Sedang offline — Pastikan jaringan tersedia sebelum memulai.',
          passed: isOnline,
        },
        {
          id: 'viewport',
          label: 'Kompatibilitas Resolusi Layar',
          detail: `${window.innerWidth} × ${window.innerHeight} piksel — Memenuhi standar tampilan soal.`,
          passed: viewportOk,
        },
      ]);
      setChecking(false);
    }, 350);

    return () => clearTimeout(timer);
  }, []);

  const cameraRequirementMet = !requireCamera || cameraStatus === 'ready';
  const hasQuestions = questionCount > 0;
  const allPassed =
    !checking &&
    hasQuestions &&
    checks.length > 0 &&
    checks.every((c) => c.passed) &&
    cameraRequirementMet;

  const handleProceed = () => {
    stopCameraStream();
    onStartExam();
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
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Verifikasi Pra-Ujian Peserta (Pre-Flight Check)
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onBackToDashboard && (
              <button
                type="button"
                onClick={() => {
                  stopCameraStream();
                  onBackToDashboard();
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 whitespace-nowrap"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Dashboard Progres</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                stopCameraStream();
                onLogout();
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 whitespace-nowrap"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Keluar</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6 space-y-6">
        {/* Identity & Exam Package Summary */}
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-400">
                {examPackage.subject} · {examPackage.category}
              </p>
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                {examPackage.title}
              </h1>
            </div>
            <div className="text-left sm:text-right text-xs">
              <div className="font-semibold text-slate-900 dark:text-slate-100">{student.name}</div>
              <div className="font-mono text-slate-500 dark:text-slate-400">
                NISN {student.nisn} · Kelas {student.className}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-slate-500 dark:text-slate-400 block">Jumlah Soal</span>
              <span className="mt-0.5 block font-mono text-base font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                {questionCount} Butir
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block">Durasi Pengerjaan</span>
              <span className="mt-0.5 block font-mono text-base font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                {examPackage.durationMinutes} Menit
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block">Minimal Waktu Submit</span>
              <span className="mt-0.5 block font-mono text-base font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                {examPackage.minSubmitMinutes} Menit
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block">Batas Toleransi</span>
              <span className="mt-0.5 block font-mono text-base font-bold text-rose-700 dark:text-rose-400 tabular-nums">
                {db.security.maxViolationTolerance}x Peringatan
              </span>
            </div>
          </div>
        </section>

        {/* System Compatibility Checks */}
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <MonitorCheck className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Pengecekan Kompatibilitas Perangkat & Browser
            </h2>
          </div>

          {checking ? (
            <div className="py-6 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <Wifi className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <span>Memeriksa kompatibilitas sistem dan koneksi...</span>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {checks.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <div>
                    <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      {item.label}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{item.detail}</p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-semibold shrink-0 ${
                      item.passed ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'
                    }`}
                  >
                    {item.passed ? (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Siap</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4" />
                        <span>Gagal</span>
                      </>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Mandatory Camera & Mic Proctoring Verification */}
        {requireCamera && (
          <section className="rounded-xl border border-indigo-200 dark:border-indigo-900 bg-white dark:bg-slate-900 p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <Camera className="h-5 w-5 text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0" />
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Verifikasi Wajib Kamera & Mikrofon Pengawas
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Kamera memantau arah pandangan (kanan/kiri) dan mikrofon memantau aktivitas mengobrol selama ujian.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={requestCameraPermission}
                disabled={cameraStatus === 'requesting'}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 whitespace-nowrap shrink-0"
              >
                <Camera className="h-3.5 w-3.5" />
                <span>
                  {cameraStatus === 'requesting'
                    ? 'Meminta Izin...'
                    : cameraStatus === 'ready'
                    ? 'Uji Ulang Kamera'
                    : 'Aktifkan Kamera & Mikrofon'}
                </span>
              </button>
            </div>

            {cameraError && (
              <div
                role="alert"
                className="rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 p-3 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2"
              >
                <CameraOff className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{cameraError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
              <div className="sm:col-span-5">
                <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-900 flex items-center justify-center">
                  {cameraStatus === 'ready' ? (
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="h-full w-full object-cover -scale-x-100"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-1.5 text-slate-400 text-xs px-4 text-center">
                      <CameraOff className="h-6 w-6" />
                      <span>Pratinjau kamera belum aktif</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="sm:col-span-7 space-y-2.5 text-xs">
                <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 px-3.5 py-2.5">
                  <span className="font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <Camera className="h-4 w-4 text-slate-500" />
                    Status Kamera Depan
                  </span>
                  <span
                    className={`font-semibold ${
                      cameraStatus === 'ready'
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {cameraStatus === 'ready' ? 'Aktif & Terdeteksi' : 'Wajib Diaktifkan'}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 px-3.5 py-2.5">
                  <span className="font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <Mic className="h-4 w-4 text-slate-500" />
                    Deteksi Suara / Mengobrol
                  </span>
                  <span
                    className={`font-semibold ${
                      micReady
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {cameraStatus === 'ready'
                      ? micReady
                        ? 'Mikrofon Siap'
                        : 'Kamera Saja (Mikrofon Tidak Tersedia)'
                      : 'Menunggu Izin'}
                  </span>
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Pastikan wajah berada di tengah layar dengan pencahayaan cukup sebelum menekan Mulai Ujian.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Active Security Policies Warning */}
        <section className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/30 p-5 space-y-3">
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="h-5 w-5 text-amber-700 dark:text-amber-400 mt-0.5 shrink-0" />
            <div className="space-y-1.5 text-xs text-amber-950 dark:text-amber-200">
              <h2 className="font-bold">Tata Tertib & Sistem Keamanan Anti-Curang</h2>
              <ul className="list-disc pl-4 space-y-1 text-amber-900 dark:text-amber-300">
                {db.security.requireCameraMonitoring && (
                  <li>
                    Kamera & mikrofon pengawas wajib aktif selama ujian. Menoleh ke kanan/kiri secara berulang atau mengobrol akan dicatat sebagai pelanggaran.
                  </li>
                )}
                {db.security.requireFullscreen && (
                  <li>
                    Ujian wajib dijalankan dalam mode Layar Penuh (Fullscreen). Keluar dari layar penuh akan langsung dicatat sebagai pelanggaran.
                  </li>
                )}
                {db.security.detectTabSwitchAndSplitScreen && (
                  <li>
                    Dilarang berpindah tab browser, membuka aplikasi lain, atau menggunakan fitur Split Screen / jendela mengambang.
                  </li>
                )}
                {db.security.blockRightClickAndCopyPaste && (
                  <li>
                    Klik kanan, salin-tempel (Copy-Paste), cetak layar (PrintScreen), dan inspeksi browser dinonaktifkan.
                  </li>
                )}
                {db.security.enableDynamicWatermark && (
                  <li>
                    Watermark identitas (NISN & Nama) akan tampil transparan di layar soal untuk keamanan ujian.
                  </li>
                )}
                <li>
                  Pelanggaran melebihi <strong>{db.security.maxViolationTolerance} kali</strong> akan mengunci dan mengumpulkan ujian Anda secara otomatis.
                </li>
              </ul>
            </div>
          </div>

          <label className="flex items-center gap-2.5 pt-2 border-t border-amber-200/80 dark:border-amber-800/80 text-xs font-semibold text-slate-900 dark:text-slate-100 cursor-pointer">
            <input
              type="checkbox"
              checked={agreedRules}
              onChange={(e) => setAgreedRules(e.target.checked)}
              className="h-4 w-4 rounded border-slate-400 text-indigo-600"
            />
            <span>
              Saya memahami tata tertib ujian dan siap mengerjakan dengan jujur.
            </span>
          </label>
        </section>

        {!hasQuestions && (
          <div
            role="alert"
            className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 px-4 py-3 text-xs font-medium text-rose-800 dark:text-rose-200"
          >
            Paket ujian ini belum memiliki butir soal. Mohon hubungi guru pengampu sebelum memulai ujian.
          </div>
        )}

        {/* Primary Action */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <Clock className="h-4 w-4" />
            <span>
              {existingAttempt
                ? 'Sesi sebelumnya ditemukan. Klik tombol untuk melanjutkan pengerjaan.'
                : 'Timer akan mulai berjalan begitu Anda menekan tombol Mulai Ujian.'}
            </span>
          </div>

          <button
            type="button"
            disabled={!allPassed || !agreedRules}
            onClick={handleProceed}
            className="w-full sm:w-auto rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:text-slate-500 dark:disabled:text-slate-400 whitespace-nowrap"
          >
            {existingAttempt ? 'Lanjutkan Ujian Sekarang' : 'Mulai Ujian Sekarang'}
          </button>
        </div>
      </main>
    </div>
  );
}
