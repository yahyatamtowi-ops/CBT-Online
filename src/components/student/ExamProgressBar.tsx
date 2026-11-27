import React from 'react';

export type ProgressTone = 'indigo' | 'emerald' | 'amber' | 'rose';
export type ProgressSize = 'sm' | 'md' | 'lg';

interface ExamProgressBarProps {
  value: number;
  label: string;
  sublabel?: string;
  tone?: ProgressTone;
  size?: ProgressSize;
  showPercent?: boolean;
  className?: string;
  testId?: string;
}

const TRACK_HEIGHT: Record<ProgressSize, string> = {
  sm: 'h-2',
  md: 'h-2.5',
  lg: 'h-3.5',
};

const FILL_CLASS: Record<ProgressTone, string> = {
  indigo: 'bg-indigo-600 dark:bg-indigo-500',
  emerald: 'bg-emerald-600 dark:bg-emerald-500',
  amber: 'bg-amber-500 dark:bg-amber-400',
  rose: 'bg-rose-600 dark:bg-rose-500',
};

const PERCENT_TEXT_CLASS: Record<ProgressTone, string> = {
  indigo: 'text-indigo-700 dark:text-indigo-400',
  emerald: 'text-emerald-700 dark:text-emerald-400',
  amber: 'text-amber-700 dark:text-amber-400',
  rose: 'text-rose-700 dark:text-rose-400',
};

/**
 * Accessible horizontal progress bar component for tracking student exam completion.
 * Uses compositor-only transform scaling and tabular numerals for crisp numeric alignment.
 */
export function ExamProgressBar({
  value,
  label,
  sublabel,
  tone = 'indigo',
  size = 'md',
  showPercent = true,
  className = '',
  testId,
}: ExamProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(Number.isFinite(value) ? value : 0)));
  const resolvedTone: ProgressTone = clamped === 100 && tone === 'indigo' ? 'emerald' : tone;

  return (
    <div className={`w-full ${className}`} data-testid={testId}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <span
            className={`block truncate font-semibold text-slate-800 dark:text-slate-100 ${
              size === 'lg' ? 'text-sm' : 'text-xs'
            }`}
          >
            {label}
          </span>
          {sublabel && (
            <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
              {sublabel}
            </span>
          )}
        </div>
        {showPercent && (
          <span
            className={`shrink-0 font-mono font-bold tabular-nums ${
              size === 'lg' ? 'text-base sm:text-lg' : 'text-xs'
            } ${PERCENT_TEXT_CLASS[resolvedTone]}`}
          >
            {clamped}%
          </span>
        )}
      </div>

      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clamped}
        className={`w-full overflow-hidden rounded-full bg-slate-200/90 dark:bg-slate-800 ${TRACK_HEIGHT[size]}`}
      >
        <div
          className={`h-full w-full origin-left rounded-full transition-transform duration-300 ease-out motion-reduce:transition-none ${FILL_CLASS[resolvedTone]}`}
          style={{ transform: `scaleX(${clamped / 100})` }}
        />
      </div>
    </div>
  );
}
