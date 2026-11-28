import type { ExamAttempt, ExamPackage, ViolationLog } from '../types/cbt';

export interface CompletionTimeBin {
  id: string;
  label: string;
  minMinutes: number;
  maxMinutes: number;
  count: number;
  percentage: number;
  zone: 'rushed' | 'normal' | 'near_limit';
}

export interface CompletionTimeDistribution {
  bins: CompletionTimeBin[];
  totalCompleted: number;
  medianMinutes: number;
  averageMinutes: number;
  fastestMinutes: number;
  slowestMinutes: number;
  rushedCount: number;
  referenceDurationMinutes: number;
}

export interface ClassScoreSummary {
  className: string;
  averageScore: number;
  minScore: number;
  maxScore: number;
  kkm: number;
  passCount: number;
  completedCount: number;
  totalAttempts: number;
  lockedCount: number;
  violationCount: number;
  passRate: number;
  avgCompletionMinutes: number | null;
  status: 'healthy' | 'warning' | 'problematic';
}

export interface ProblematicSessionAlert {
  packageId: string;
  packageTitle: string;
  subject: string;
  severity: 'high' | 'medium';
  averageScore: number | null;
  kkm: number;
  passRate: number | null;
  lockedCount: number;
  medianMinutes: number | null;
  durationMinutes: number;
  reasons: string[];
}

export interface ExamSummaryAnalyticsResult {
  totalPackages: number;
  totalAttempts: number;
  completedAttempts: number;
  overallAverageScore: number | null;
  overallPassRate: number | null;
  overallKkm: number;
  completionDistribution: CompletionTimeDistribution;
  classSummaries: ClassScoreSummary[];
  problematicSessions: ProblematicSessionAlert[];
}

export interface FloatingPosition {
  x: number;
  y: number;
}

export interface FloatingPopoverPlacement {
  vertical: 'up' | 'down';
  horizontal: 'left' | 'right';
}

/**
 * Computes completion time in minutes for a submitted exam attempt.
 * Returns null if the attempt is not completed or timestamps are invalid.
 */
export function computeAttemptCompletionMinutes(
  attempt: Pick<ExamAttempt, 'status' | 'startedAt' | 'submittedAt' | 'extraMinutes'>,
  packageDurationMinutes: number
): number | null {
  if (attempt.status !== 'completed' || !attempt.startedAt || !attempt.submittedAt) {
    return null;
  }
  const startMs = Date.parse(attempt.startedAt);
  const endMs = Date.parse(attempt.submittedAt);
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
    return null;
  }
  const rawMinutes = (endMs - startMs) / 60_000;
  const maxAllowed = Math.max(
    1,
    (Number.isFinite(packageDurationMinutes) && packageDurationMinutes > 0
      ? packageDurationMinutes
      : 60) + Math.max(0, attempt.extraMinutes || 0)
  );
  const clamped = Math.min(maxAllowed, Math.max(0.5, rawMinutes));
  return Math.round(clamped * 10) / 10;
}

function computeMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const raw =
    sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  return Math.round(raw * 10) / 10;
}

/**
 * Groups completion durations (in minutes) into fixed-width histogram bins
 * suitable for D3.js bar/distribution visualization.
 */
export function buildCompletionTimeDistribution(
  durationsMinutes: number[],
  referenceDurationMinutes: number,
  requestedBins: number = 6
): CompletionTimeDistribution {
  const safeDuration =
    Number.isFinite(referenceDurationMinutes) && referenceDurationMinutes > 0
      ? Math.round(referenceDurationMinutes)
      : 60;

  if (durationsMinutes.length === 0) {
    return {
      bins: [],
      totalCompleted: 0,
      medianMinutes: 0,
      averageMinutes: 0,
      fastestMinutes: 0,
      slowestMinutes: 0,
      rushedCount: 0,
      referenceDurationMinutes: safeDuration,
    };
  }

  const maxObserved = Math.max(...durationsMinutes, safeDuration);
  const binCount = Math.max(4, Math.min(8, requestedBins));
  const rawStep = maxObserved / binCount;
  const niceStep =
    rawStep <= 5
      ? 5
      : rawStep <= 10
        ? 10
        : rawStep <= 15
          ? 15
          : Math.ceil(rawStep / 5) * 5;

  const actualBinCount = Math.max(
    4,
    Math.min(8, Math.ceil(maxObserved / niceStep))
  );

  const rushedThreshold = safeDuration * 0.25;
  const nearLimitThreshold = safeDuration * 0.9;

  const bins: CompletionTimeBin[] = [];
  for (let i = 0; i < actualBinCount; i++) {
    const minM = i * niceStep;
    const maxM = (i + 1) * niceStep;
    const midpoint = (minM + maxM) / 2;
    const zone: CompletionTimeBin['zone'] =
      midpoint <= rushedThreshold
        ? 'rushed'
        : midpoint >= nearLimitThreshold
          ? 'near_limit'
          : 'normal';
    bins.push({
      id: `bin-${minM}-${maxM}`,
      label: `${minM}–${maxM}m`,
      minMinutes: minM,
      maxMinutes: maxM,
      count: 0,
      percentage: 0,
      zone,
    });
  }

  let rushedCount = 0;
  let sum = 0;
  let fastest = Infinity;
  let slowest = 0;

  for (const d of durationsMinutes) {
    sum += d;
    if (d < fastest) fastest = d;
    if (d > slowest) slowest = d;
    if (d <= rushedThreshold) rushedCount += 1;

    const idx = Math.min(
      bins.length - 1,
      Math.max(0, Math.floor(d / niceStep))
    );
    bins[idx].count += 1;
  }

  const total = durationsMinutes.length;
  for (const bin of bins) {
    bin.percentage = Math.round((bin.count / total) * 100);
  }

  return {
    bins,
    totalCompleted: total,
    medianMinutes: computeMedian(durationsMinutes),
    averageMinutes: Math.round((sum / total) * 10) / 10,
    fastestMinutes: Math.round(fastest * 10) / 10,
    slowestMinutes: Math.round(slowest * 10) / 10,
    rushedCount,
    referenceDurationMinutes: safeDuration,
  };
}

/**
 * Computes per-class average score, pass rate, completion duration, and health status.
 */
export function computeClassScoreSummaries(
  attempts: ExamAttempt[],
  packagesById: Map<string, ExamPackage>,
  violations: ViolationLog[] = []
): ClassScoreSummary[] {
  const byClass = new Map<
    string,
    {
      scores: number[];
      kkms: number[];
      passCount: number;
      completedCount: number;
      totalAttempts: number;
      lockedCount: number;
      durations: number[];
    }
  >();

  for (const attempt of attempts) {
    const className = (attempt.className || 'Tanpa Kelas').trim();
    const pkg = packagesById.get(attempt.packageId);
    const kkm = pkg?.kkm ?? 75;
    const duration = pkg?.durationMinutes ?? 60;

    let entry = byClass.get(className);
    if (!entry) {
      entry = {
        scores: [],
        kkms: [],
        passCount: 0,
        completedCount: 0,
        totalAttempts: 0,
        lockedCount: 0,
        durations: [],
      };
      byClass.set(className, entry);
    }

    entry.totalAttempts += 1;
    if (attempt.status === 'locked') {
      entry.lockedCount += 1;
    }

    if (attempt.status === 'completed' && typeof attempt.score === 'number') {
      entry.completedCount += 1;
      entry.scores.push(attempt.score);
      entry.kkms.push(kkm);
      if (attempt.score >= kkm || attempt.passed === true) {
        entry.passCount += 1;
      }
      const mins = computeAttemptCompletionMinutes(attempt, duration);
      if (mins !== null) {
        entry.durations.push(mins);
      }
    }
  }

  const violationsByClass = new Map<string, number>();
  for (const v of violations) {
    const c = (v.className || 'Tanpa Kelas').trim();
    violationsByClass.set(c, (violationsByClass.get(c) ?? 0) + 1);
  }

  const summaries: ClassScoreSummary[] = [];
  for (const [className, entry] of byClass.entries()) {
    if (entry.completedCount === 0) continue;
    const avgScore =
      Math.round(
        (entry.scores.reduce((acc, s) => acc + s, 0) / entry.scores.length) * 10
      ) / 10;
    const avgKkm = Math.round(
      entry.kkms.reduce((acc, k) => acc + k, 0) / entry.kkms.length
    );
    const passRate = Math.round((entry.passCount / entry.completedCount) * 100);
    const avgCompletionMinutes =
      entry.durations.length > 0
        ? Math.round(
            (entry.durations.reduce((acc, d) => acc + d, 0) /
              entry.durations.length) *
              10
          ) / 10
        : null;

    const status: ClassScoreSummary['status'] =
      avgScore < avgKkm - 10 || passRate < 50
        ? 'problematic'
        : avgScore < avgKkm || passRate < 75
          ? 'warning'
          : 'healthy';

    summaries.push({
      className,
      averageScore: avgScore,
      minScore: Math.min(...entry.scores),
      maxScore: Math.max(...entry.scores),
      kkm: avgKkm,
      passCount: entry.passCount,
      completedCount: entry.completedCount,
      totalAttempts: entry.totalAttempts,
      lockedCount: entry.lockedCount,
      violationCount: violationsByClass.get(className) ?? 0,
      passRate,
      avgCompletionMinutes,
      status,
    });
  }

  return summaries.sort((a, b) => a.averageScore - b.averageScore);
}

/**
 * Flags exam sessions (packages) exhibiting low scores, low pass rates,
 * high violation locks, or abnormally rushed completion times.
 */
export function identifyProblematicSessions(
  packages: ExamPackage[],
  attempts: ExamAttempt[],
  violations: ViolationLog[]
): ProblematicSessionAlert[] {
  const alerts: ProblematicSessionAlert[] = [];

  for (const pkg of packages) {
    const pkgAttempts = attempts.filter((a) => a.packageId === pkg.id);
    if (pkgAttempts.length === 0) continue;

    const completed = pkgAttempts.filter(
      (a) => a.status === 'completed' && typeof a.score === 'number'
    );
    const lockedCount = pkgAttempts.filter((a) => a.status === 'locked').length;
    const pkgViolations = violations.filter((v) => v.packageId === pkg.id);

    const reasons: string[] = [];
    let highRiskHits = 0;

    let avgScore: number | null = null;
    let passRate: number | null = null;
    let medianMinutes: number | null = null;

    if (completed.length > 0) {
      const scores = completed.map((a) => a.score as number);
      avgScore =
        Math.round((scores.reduce((s, x) => s + x, 0) / scores.length) * 10) /
        10;
      const passed = completed.filter(
        (a) => (a.score as number) >= pkg.kkm || a.passed === true
      ).length;
      passRate = Math.round((passed / completed.length) * 100);

      if (avgScore < pkg.kkm) {
        reasons.push(`Rata-rata nilai ${avgScore} di bawah KKM (${pkg.kkm})`);
        if (avgScore < pkg.kkm - 10) highRiskHits += 1;
      }
      if (passRate < 60) {
        reasons.push(`Ketuntasan rendah (${passRate}% lulus KKM)`);
        highRiskHits += 1;
      }

      const durations = completed
        .map((a) => computeAttemptCompletionMinutes(a, pkg.durationMinutes))
        .filter((m): m is number => m !== null);
      if (durations.length > 0) {
        medianMinutes = computeMedian(durations);
        if (medianMinutes <= pkg.durationMinutes * 0.25) {
          reasons.push(
            `Waktu selesai terlalu cepat (median ${medianMinutes}m dari ${pkg.durationMinutes}m)`
          );
        }
      }
    }

    const lockedRatio = lockedCount / pkgAttempts.length;
    if (lockedCount >= 2 || (lockedCount >= 1 && lockedRatio >= 0.2)) {
      reasons.push(`${lockedCount} peserta terkunci pelanggaran`);
      highRiskHits += 1;
    } else if (pkgViolations.length >= Math.max(4, pkgAttempts.length * 2)) {
      reasons.push(
        `Lonjakan pelanggaran tinggi (${pkgViolations.length} catatan)`
      );
    }

    if (reasons.length > 0) {
      alerts.push({
        packageId: pkg.id,
        packageTitle: pkg.title,
        subject: pkg.subject,
        severity: highRiskHits > 0 || reasons.length >= 2 ? 'high' : 'medium',
        averageScore: avgScore,
        kkm: pkg.kkm,
        passRate,
        lockedCount,
        medianMinutes,
        durationMinutes: pkg.durationMinutes,
        reasons,
      });
    }
  }

  return alerts.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'high' ? -1 : 1;
    return (a.averageScore ?? 100) - (b.averageScore ?? 100);
  });
}

/**
 * Computes complete Exam Summary Dashboard analytics for a teacher's packages
 * (either aggregated across all teacher packages or scoped to a single package).
 */
export function computeExamSummaryAnalytics(params: {
  packages: ExamPackage[];
  attempts: ExamAttempt[];
  violations: ViolationLog[];
  selectedPackageId?: string;
}): ExamSummaryAnalyticsResult {
  const { packages, attempts, violations, selectedPackageId } = params;
  const scopedPackages =
    selectedPackageId && selectedPackageId !== 'ALL'
      ? packages.filter((p) => p.id === selectedPackageId)
      : packages;

  const packageIds = new Set(scopedPackages.map((p) => p.id));
  const packagesById = new Map(scopedPackages.map((p) => [p.id, p]));

  const scopedAttempts = attempts.filter((a) => packageIds.has(a.packageId));
  const scopedViolations = violations.filter((v) => packageIds.has(v.packageId));

  const completed = scopedAttempts.filter(
    (a) => a.status === 'completed' && typeof a.score === 'number'
  );

  const durations: number[] = [];
  let scoreSum = 0;
  let passCount = 0;
  let kkmSum = 0;

  for (const a of completed) {
    const pkg = packagesById.get(a.packageId);
    const kkm = pkg?.kkm ?? 75;
    const duration = pkg?.durationMinutes ?? 60;
    const score = a.score as number;
    scoreSum += score;
    kkmSum += kkm;
    if (score >= kkm || a.passed === true) {
      passCount += 1;
    }
    const mins = computeAttemptCompletionMinutes(a, duration);
    if (mins !== null) {
      durations.push(mins);
    }
  }

  const refDuration =
    scopedPackages.length === 1
      ? scopedPackages[0].durationMinutes
      : scopedPackages.length > 0
        ? Math.round(
            scopedPackages.reduce((s, p) => s + p.durationMinutes, 0) /
              scopedPackages.length
          )
        : 60;

  const overallKkm =
    completed.length > 0
      ? Math.round(kkmSum / completed.length)
      : scopedPackages.length > 0
        ? Math.round(
            scopedPackages.reduce((s, p) => s + p.kkm, 0) / scopedPackages.length
          )
        : 75;

  return {
    totalPackages: scopedPackages.length,
    totalAttempts: scopedAttempts.length,
    completedAttempts: completed.length,
    overallAverageScore:
      completed.length > 0
        ? Math.round((scoreSum / completed.length) * 10) / 10
        : null,
    overallPassRate:
      completed.length > 0
        ? Math.round((passCount / completed.length) * 100)
        : null,
    overallKkm,
    completionDistribution: buildCompletionTimeDistribution(
      durations,
      refDuration
    ),
    classSummaries: computeClassScoreSummaries(
      scopedAttempts,
      packagesById,
      scopedViolations
    ),
    problematicSessions: identifyProblematicSessions(
      scopedPackages,
      scopedAttempts,
      scopedViolations
    ),
  };
}

/**
 * Clamps a draggable floating button's top-left (x, y) coordinates within the
 * safe viewport area so it can never be dragged off-screen.
 */
export function clampFloatingPosition(params: {
  x: number;
  y: number;
  viewportWidth: number;
  viewportHeight: number;
  buttonSize?: number;
  margin?: number;
  topMargin?: number;
}): FloatingPosition {
  const buttonSize = params.buttonSize ?? 52;
  const margin = params.margin ?? 12;
  const topMargin = params.topMargin ?? 60;
  const maxX = Math.max(margin, params.viewportWidth - buttonSize - margin);
  const maxY = Math.max(topMargin, params.viewportHeight - buttonSize - margin);

  return {
    x: Math.round(Math.min(maxX, Math.max(margin, params.x))),
    y: Math.round(Math.min(maxY, Math.max(topMargin, params.y))),
  };
}

/**
 * Determines which quadrant the floating menu popover should open toward
 * so it stays fully visible inside the mobile viewport.
 */
export function resolveFloatingPopoverPlacement(params: {
  x: number;
  y: number;
  viewportWidth: number;
  viewportHeight: number;
  buttonSize?: number;
}): FloatingPopoverPlacement {
  const size = params.buttonSize ?? 52;
  const centerX = params.x + size / 2;
  const centerY = params.y + size / 2;
  return {
    vertical: centerY > params.viewportHeight * 0.5 ? 'up' : 'down',
    horizontal: centerX > params.viewportWidth * 0.5 ? 'left' : 'right',
  };
}
