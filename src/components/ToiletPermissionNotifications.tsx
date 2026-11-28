import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Clock, DoorOpen, UserCheck } from 'lucide-react';
import { useCBT } from '../context/CBTContext';
import type { Role } from '../types/cbt';
import { filterActiveToiletRequests, formatSecondsToClock } from '../utils/cbtLogic';

function playToiletRequestChime() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.07, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
    window.setTimeout(() => {
      ctx.close().catch(() => {});
    }, 380);
  } catch {
    // Ignore autoplay restriction
  }
}

export function ToiletPermissionNotifications({
  role,
  allowedPackageIds,
  allowedClasses,
}: {
  role: Role;
  allowedPackageIds?: string[];
  allowedClasses?: string[];
}) {
  const { db, confirmToiletLeave } = useCBT();
  const [nowMs, setNowMs] = useState(() => Date.now());

  const activeRequests = useMemo(
    () =>
      filterActiveToiletRequests({
        requests: db.toiletRequests || [],
        role,
        allowedPackageIds,
        allowedClasses,
      }),
    [db.toiletRequests, role, allowedPackageIds, allowedClasses]
  );

  // Tick elapsed seconds while any toilet permission request is active
  useEffect(() => {
    if (activeRequests.length === 0) return;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [activeRequests.length]);

  // Chime softly when a brand new pending toilet leave request arrives
  const knownIdsRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    const pendingIds = activeRequests
      .filter((r) => r.status === 'pending')
      .map((r) => r.id);
    if (knownIdsRef.current === null) {
      knownIdsRef.current = new Set(pendingIds);
      return;
    }
    let hasNew = false;
    for (const id of pendingIds) {
      if (!knownIdsRef.current.has(id)) {
        knownIdsRef.current.add(id);
        hasNew = true;
      }
    }
    if (hasNew) {
      playToiletRequestChime();
    }
  }, [activeRequests]);

  if (activeRequests.length === 0) return null;

  const pendingCount = activeRequests.filter((r) => r.status === 'pending').length;

  return (
    <section
      aria-label="Notifikasi Izin Toilet Siswa"
      data-testid="toilet-permission-notifications"
      className="mb-4 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/90 dark:bg-amber-950/35 p-3 sm:p-4 space-y-2.5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300">
            <DoorOpen className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-xs font-bold text-amber-950 dark:text-amber-100">
              Permintaan Izin Toilet Siswa ({activeRequests.length})
            </h2>
            <p className="text-[11px] text-amber-800 dark:text-amber-300">
              {pendingCount > 0
                ? `${pendingCount} siswa menunggu konfirmasi izin. Deteksi pelanggaran otomatis dijeda sementara.`
                : 'Semua izin toilet aktif telah dikonfirmasi. Menunggu siswa kembali melanjutkan soal.'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {activeRequests.map((req) => {
          const startedMs = Date.parse(req.requestedAt) || nowMs;
          const elapsedSec = Math.max(0, Math.floor((nowMs - startedMs) / 1000));
          const isPending = req.status === 'pending';

          return (
            <div
              key={req.id}
              data-testid={`toilet-request-card-${req.id}`}
              className="flex items-center justify-between gap-2.5 rounded-lg border border-amber-200 dark:border-amber-800/80 bg-white dark:bg-slate-900 px-3 py-2.5 text-xs"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold text-slate-900 dark:text-slate-100 truncate">
                    {req.studentName}
                  </span>
                  <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                    ({req.className})
                  </span>
                </div>
                <div className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-400 truncate">
                  {req.packageTitle} ·{' '}
                  <span className="inline-flex items-center gap-0.5 font-mono tabular-nums text-amber-700 dark:text-amber-400 font-semibold">
                    <Clock className="h-3 w-3 inline" />
                    {formatSecondsToClock(elapsedSec)}
                  </span>
                </div>
                {!isPending && req.confirmedByName && (
                  <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                    <UserCheck className="h-3 w-3 shrink-0" />
                    <span>Dikonfirmasi oleh {req.confirmedByName}</span>
                  </div>
                )}
              </div>

              <div className="shrink-0">
                {isPending ? (
                  <button
                    type="button"
                    data-testid="confirm-toilet-leave-btn"
                    onClick={() => confirmToiletLeave(req.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 whitespace-nowrap"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Konfirmasi Izin</span>
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>Disetujui</span>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
