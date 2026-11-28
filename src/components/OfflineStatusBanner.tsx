import React, { useEffect, useState } from 'react';
import { CheckCircle2, CloudOff, RefreshCw } from 'lucide-react';
import {
  clearOfflineSyncQueue,
  readOfflineSyncQueue,
} from '../utils/offlineExamCache';

export function OfflineStatusBanner() {
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [reconnectedNotice, setReconnectedNotice] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState<number>(
    () => readOfflineSyncQueue().pendingAnswerUpdates
  );

  useEffect(() => {
    const syncQueueCount = () => {
      setPendingCount(readOfflineSyncQueue().pendingAnswerUpdates);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setReconnectedNotice(null);
      syncQueueCount();
    };

    const handleOnline = () => {
      setIsOnline(true);
      const q = readOfflineSyncQueue();
      if (q.pendingAnswerUpdates > 0 || q.pendingSubmissions.length > 0) {
        setReconnectedNotice(
          'Koneksi internet kembali normal — data ujian offline otomatis disinkronkan.'
        );
        clearOfflineSyncQueue();
        setPendingCount(0);
      } else {
        setReconnectedNotice('Koneksi internet kembali terhubung.');
      }
      window.setTimeout(() => {
        setReconnectedNotice(null);
      }, 5000);
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    const poll = window.setInterval(syncQueueCount, 3000);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      window.clearInterval(poll);
    };
  }, []);

  if (!isOnline) {
    return (
      <div
        role="status"
        aria-live="polite"
        data-testid="offline-status-banner"
        className="fixed bottom-3 left-3 right-3 sm:right-auto sm:max-w-md z-50 flex items-center gap-2.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50/95 dark:bg-amber-950/95 px-3.5 py-2.5 text-xs text-amber-950 dark:text-amber-100 shadow-lg backdrop-blur-sm"
      >
        <CloudOff className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <div className="min-w-0 leading-snug">
          <div className="font-bold">Mode Offline Aktif — Ujian Tetap Aman</div>
          <div className="text-[11px] text-amber-800 dark:text-amber-200">
            Aset & jawaban disimpan di cache perangkat
            {pendingCount > 0 ? ` (${pendingCount} perubahan menunggu sinkron)` : ''}.
            Otomatis tersinkron saat koneksi pulih.
          </div>
        </div>
      </div>
    );
  }

  if (reconnectedNotice) {
    return (
      <div
        role="status"
        aria-live="polite"
        data-testid="online-restored-banner"
        className="fixed bottom-3 left-3 right-3 sm:right-auto sm:max-w-md z-50 flex items-center gap-2 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50/95 dark:bg-emerald-950/95 px-3.5 py-2.5 text-xs font-semibold text-emerald-900 dark:text-emerald-100 shadow-lg backdrop-blur-sm"
      >
        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <span className="flex-1">{reconnectedNotice}</span>
        <RefreshCw className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
      </div>
    );
  }

  return null;
}
