import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, LogIn, LogOut } from 'lucide-react';
import { SchoolLogo } from './LandingPortal';

export type TransitionLoaderKind = 'login' | 'logout' | 'submitting_exam';

export interface TransitionOverlayState {
  id: number;
  kind: TransitionLoaderKind;
  title: string;
  subtitle: string;
}

interface TransitionLoaderProps {
  overlay: TransitionOverlayState | null;
  logoUrl?: string;
  schoolName: string;
}

export function TransitionLoader({
  overlay,
  logoUrl,
  schoolName,
}: TransitionLoaderProps) {
  const isExamSubmit = overlay?.kind === 'submitting_exam';
  const isLogout = overlay?.kind === 'logout';

  return (
    <AnimatePresence>
      {overlay && (
        <motion.div
          key={`transition-loader-${overlay.id}`}
          data-testid="transition-loader"
          data-loader-kind={overlay.kind}
          role="status"
          aria-live="polite"
          aria-label={overlay.title}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-50/92 dark:bg-slate-950/92 backdrop-blur-md px-6 text-center batik-shell select-none"
        >
          {/* Ambient glow halo */}
          <motion.div
            aria-hidden="true"
            initial={{ opacity: 0, scale: 0.75 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className={`pointer-events-none absolute h-64 w-64 sm:h-72 sm:w-72 rounded-full blur-3xl ${
              isExamSubmit
                ? 'bg-emerald-500/15 dark:bg-emerald-400/15'
                : isLogout
                  ? 'bg-slate-400/15 dark:bg-slate-500/15'
                  : 'bg-indigo-500/15 dark:bg-indigo-400/15'
            }`}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -6 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 flex w-full max-w-sm flex-col items-center rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 px-6 py-8 shadow-xl shadow-slate-950/5"
          >
            {/* Orbital Spinner Ring + School Logo */}
            <div className="relative flex items-center justify-center">
              <motion.div
                aria-hidden="true"
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.25, ease: 'linear' }}
                className={`h-24 w-24 rounded-full border-[3px] border-transparent ${
                  isExamSubmit
                    ? 'border-t-emerald-600 border-r-emerald-400/50 dark:border-t-emerald-400 dark:border-r-emerald-500/40'
                    : isLogout
                      ? 'border-t-slate-600 border-r-indigo-400/50 dark:border-t-slate-300 dark:border-r-indigo-400/40'
                      : 'border-t-indigo-600 border-r-indigo-400/50 dark:border-t-indigo-400 dark:border-r-indigo-500/40'
                }`}
              />
              <motion.div
                aria-hidden="true"
                animate={{ rotate: -360 }}
                transition={{ repeat: Infinity, duration: 2.1, ease: 'linear' }}
                className="absolute h-20 w-20 rounded-full border-2 border-dashed border-slate-200 dark:border-slate-700"
              />
              <div className="absolute flex items-center justify-center rounded-xl bg-white dark:bg-slate-900 p-1 shadow-xs">
                <SchoolLogo src={logoUrl} schoolName={schoolName} size="md" />
              </div>
              <span
                className={`absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white dark:border-slate-900 shadow-xs ${
                  isExamSubmit
                    ? 'bg-emerald-600 text-white'
                    : isLogout
                      ? 'bg-slate-700 text-white'
                      : 'bg-indigo-600 text-white'
                }`}
              >
                {isExamSubmit ? (
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                ) : isLogout ? (
                  <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
                )}
              </span>
            </div>

            {/* Title & Subtitle */}
            <h2 className="mt-5 text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {overlay.title}
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              {overlay.subtitle}
            </p>

            {/* Animated Progress Sweep Bar */}
            <div className="mt-5 h-1.5 w-44 overflow-hidden rounded-full bg-slate-200/90 dark:bg-slate-800">
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{
                  duration: isExamSubmit ? 0.85 : 0.68,
                  ease: [0.22, 1, 0.36, 1],
                }}
                style={{ transformOrigin: 'left center' }}
                className={`h-full w-full rounded-full ${
                  isExamSubmit
                    ? 'bg-emerald-600 dark:bg-emerald-400'
                    : isLogout
                      ? 'bg-slate-600 dark:bg-slate-300'
                      : 'bg-indigo-600 dark:bg-indigo-400'
                }`}
              />
            </div>

            <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
              CerdasExam CBT · {schoolName.toUpperCase()}
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
