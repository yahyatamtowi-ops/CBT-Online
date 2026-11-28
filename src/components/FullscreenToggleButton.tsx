import React, { useCallback, useEffect, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';

interface WebkitDocument extends Document {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
}

interface WebkitElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}

function getFullscreenElement(): Element | null {
  if (typeof document === 'undefined') return null;
  const doc = document as WebkitDocument;
  return doc.fullscreenElement || doc.webkitFullscreenElement || null;
}

export function FullscreenToggleButton({
  variant = 'header',
}: {
  variant?: 'landing' | 'header';
}) {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() =>
    Boolean(getFullscreenElement())
  );
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const syncState = () => {
      setIsFullscreen(Boolean(getFullscreenElement()));
    };
    document.addEventListener('fullscreenchange', syncState);
    document.addEventListener('webkitfullscreenchange', syncState);
    return () => {
      document.removeEventListener('fullscreenchange', syncState);
      document.removeEventListener('webkitfullscreenchange', syncState);
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const handleToggleFullscreen = useCallback(async () => {
    setNotice(null);
    const doc = document as WebkitDocument;
    const root = document.documentElement as WebkitElement;

    try {
      if (getFullscreenElement()) {
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        }
        setIsFullscreen(false);
      } else {
        if (root.requestFullscreen) {
          await root.requestFullscreen();
          setIsFullscreen(true);
        } else if (root.webkitRequestFullscreen) {
          await root.webkitRequestFullscreen();
          setIsFullscreen(true);
        } else {
          setNotice('Browser perangkat ini belum mendukung mode layar penuh.');
        }
      }
    } catch {
      setNotice('Layar penuh dibatasi browser. Tekan F11 atau buka di tab baru.');
    }
  }, []);

  const baseStyle =
    variant === 'landing'
      ? isFullscreen
        ? 'inline-flex min-h-[38px] items-center gap-2 rounded-xl border border-indigo-300 dark:border-indigo-700 bg-indigo-50/95 dark:bg-indigo-950/80 px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-200 shadow-xs backdrop-blur-sm transition-colors hover:bg-indigo-100 dark:hover:bg-indigo-900/80 whitespace-nowrap'
        : 'inline-flex min-h-[38px] items-center gap-2 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-xs backdrop-blur-sm transition-colors hover:border-indigo-300 hover:bg-indigo-50/70 hover:text-indigo-700 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/60 dark:hover:text-indigo-300 whitespace-nowrap'
      : isFullscreen
        ? 'inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/70 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-200 transition-colors hover:bg-indigo-100 dark:hover:bg-indigo-900/80 whitespace-nowrap'
        : 'inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700 whitespace-nowrap';

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={handleToggleFullscreen}
        aria-pressed={isFullscreen}
        aria-label={
          isFullscreen
            ? 'Keluar dari Mode Layar Penuh'
            : 'Aktifkan Mode Layar Penuh'
        }
        title={isFullscreen ? 'Keluar Layar Penuh (Esc)' : 'Mode Layar Penuh (Fullscreen)'}
        data-testid="fullscreen-toggle-btn"
        className={`${baseStyle} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600`}
      >
        {isFullscreen ? (
          <Minimize2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        ) : (
          <Maximize2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        )}
        <span className="hidden sm:inline">
          {isFullscreen ? 'Keluar Layar Penuh' : 'Layar Penuh'}
        </span>
        <span className="sm:hidden">
          {isFullscreen ? 'Normal' : 'Fullscreen'}
        </span>
      </button>

      {notice && (
        <div
          role="status"
          className={`absolute ${variant === 'landing' ? 'left-0' : 'right-0'} top-full z-50 mt-2 w-64 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/95 px-3 py-2 text-[11px] font-medium text-amber-800 dark:text-amber-200 shadow-lg`}
        >
          {notice}
        </div>
      )}
    </div>
  );
}
