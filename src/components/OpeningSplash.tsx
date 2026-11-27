import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { SchoolLogo } from './LandingPortal';

interface OpeningSplashProps {
  logoUrl?: string;
  schoolName: string;
  onComplete: () => void;
}

export function OpeningSplash({
  logoUrl,
  schoolName,
  onComplete,
}: OpeningSplashProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const holdMs = prefersReducedMotion ? 1000 : 2600;
    const exitBufferMs = prefersReducedMotion ? 220 : 520;

    const fadeTimer = window.setTimeout(() => {
      setVisible(false);
    }, holdMs);

    const doneTimer = window.setTimeout(() => {
      onComplete();
    }, holdMs + exitBufferMs);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(doneTimer);
    };
  }, [onComplete]);

  const handleSkip = () => {
    setVisible(false);
    window.setTimeout(() => {
      onComplete();
    }, 260);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="opening-splash"
          data-testid="opening-splash"
          role="dialog"
          aria-label={`Membuka CerdasExam CBT ${schoolName}`}
          onClick={handleSkip}
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.02 }}
          transition={{ duration: 0.48, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-50 flex cursor-pointer flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 px-6 text-center batik-shell overflow-hidden select-none"
        >
          {/* Decorative soft luminous halo behind logo */}
          <motion.div
            aria-hidden="true"
            initial={{ opacity: 0, scale: 0.72 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-none absolute h-64 w-64 sm:h-80 sm:w-80 rounded-full bg-indigo-500/10 dark:bg-indigo-400/10 blur-3xl"
          />

          <div className="relative z-10 flex flex-col items-center max-w-md w-full">
            {/* School Logo Entrance */}
            <motion.div
              initial={{ opacity: 0, scale: 0.78, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-2xl bg-white/95 dark:bg-slate-900/95 p-3 shadow-lg shadow-indigo-950/5 ring-1 ring-slate-200/80 dark:ring-slate-800"
            >
              <SchoolLogo src={logoUrl} schoolName={schoolName} size="xl" />
            </motion.div>

            {/* Brand Title: CerdasExam CBT */}
            <motion.h1
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.55,
                delay: 0.28,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="mt-6 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100"
            >
              CerdasExam CBT
            </motion.h1>

            {/* School Name in Uppercase */}
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.55,
                delay: 0.45,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="mt-2 text-sm sm:text-base font-bold uppercase tracking-[0.2em] text-indigo-700 dark:text-indigo-400 text-balance"
            >
              {schoolName.toUpperCase()}
            </motion.p>

            {/* Subtle animated loading sweep */}
            <div className="mt-7 h-1 w-36 overflow-hidden rounded-full bg-slate-200/90 dark:bg-slate-800">
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{
                  duration: 1.55,
                  delay: 0.35,
                  ease: [0.22, 1, 0.36, 1],
                }}
                style={{ transformOrigin: 'left center' }}
                className="h-full w-full rounded-full bg-indigo-600 dark:bg-indigo-400"
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
