import test from 'node:test';
import assert from 'node:assert/strict';
import type { ExamAttempt, ExamPackage, ViolationLog } from '../types/cbt';
import {
  buildCompletionTimeDistribution,
  clampFloatingPosition,
  computeAttemptCompletionMinutes,
  computeClassScoreSummaries,
  computeExamSummaryAnalytics,
  identifyProblematicSessions,
  resolveFloatingPopoverPlacement,
} from './examSummaryAnalytics';

function makePackage(overrides: Partial<ExamPackage> = {}): ExamPackage {
  return {
    id: 'pkg-math',
    teacherId: 'teacher-1',
    title: 'UTS Matematika Wajib',
    subject: 'Matematika',
    targetClasses: ['XI IPA 1', 'XI IPA 2'],
    category: 'UTS / PTS',
    durationMinutes: 60,
    minSubmitMinutes: 15,
    kkm: 75,
    token: 'MAT123',
    shuffleQuestions: true,
    shuffleOptions: true,
    isPublished: true,
    createdAt: '2026-11-28T07:00:00.000Z',
    ...overrides,
  };
}

function makeAttempt(overrides: Partial<ExamAttempt> = {}): ExamAttempt {
  return {
    id: 'att-1',
    packageId: 'pkg-math',
    studentId: 'stu-1',
    studentNisn: '0012345678',
    studentName: 'Budi Santoso',
    className: 'XI IPA 1',
    status: 'completed',
    startedAt: '2026-11-28T08:00:00.000Z',
    submittedAt: '2026-11-28T08:42:00.000Z',
    extraMinutes: 0,
    currentQuestionIndex: 0,
    questionOrder: [],
    optionOrders: {},
    answers: {},
    flaggedQuestionIds: [],
    violationCount: 0,
    score: 84,
    passed: true,
    ...overrides,
  };
}

test('computeAttemptCompletionMinutes computes and clamps valid completion durations', () => {
  const valid = makeAttempt({
    startedAt: '2026-11-28T08:00:00.000Z',
    submittedAt: '2026-11-28T08:37:30.000Z',
  });
  assert.equal(computeAttemptCompletionMinutes(valid, 60), 37.5);

  const inProgress = makeAttempt({ status: 'in_progress', submittedAt: undefined });
  assert.equal(computeAttemptCompletionMinutes(inProgress, 60), null);

  const overtimeClamped = makeAttempt({
    startedAt: '2026-11-28T08:00:00.000Z',
    submittedAt: '2026-11-28T10:30:00.000Z',
    extraMinutes: 10,
  });
  assert.equal(computeAttemptCompletionMinutes(overtimeClamped, 60), 70);
});

test('buildCompletionTimeDistribution creates histogram bins, median, and rushed count accurately', () => {
  const dist = buildCompletionTimeDistribution([10, 12, 28, 35, 42, 56], 60);
  assert.equal(dist.totalCompleted, 6);
  assert.equal(dist.rushedCount, 2); // <= 15m (25% of 60m)
  assert.equal(dist.fastestMinutes, 10);
  assert.equal(dist.slowestMinutes, 56);
  assert.equal(dist.medianMinutes, 31.5);
  assert.ok(dist.bins.length >= 4);
  const sumCounts = dist.bins.reduce((s, b) => s + b.count, 0);
  assert.equal(sumCounts, 6);
});

test('computeClassScoreSummaries calculates per-class averages, pass rates, and problematic status', () => {
  const pkg = makePackage({ kkm: 75 });
  const map = new Map([[pkg.id, pkg]]);
  const attempts: ExamAttempt[] = [
    makeAttempt({ id: 'a1', className: 'XI IPA 1', score: 88, passed: true }),
    makeAttempt({ id: 'a2', className: 'XI IPA 1', score: 82, passed: true }),
    makeAttempt({ id: 'a3', className: 'XI IPA 2', score: 52, passed: false }),
    makeAttempt({ id: 'a4', className: 'XI IPA 2', score: 60, passed: false }),
    makeAttempt({ id: 'a5', className: 'XI IPA 2', status: 'locked', score: undefined }),
  ];

  const summaries = computeClassScoreSummaries(attempts, map);
  assert.equal(summaries.length, 2);
  // Sorted lowest average first so problematic classes stand out immediately
  assert.equal(summaries[0].className, 'XI IPA 2');
  assert.equal(summaries[0].averageScore, 56);
  assert.equal(summaries[0].passRate, 0);
  assert.equal(summaries[0].lockedCount, 1);
  assert.equal(summaries[0].status, 'problematic');

  assert.equal(summaries[1].className, 'XI IPA 1');
  assert.equal(summaries[1].averageScore, 85);
  assert.equal(summaries[1].passRate, 100);
  assert.equal(summaries[1].status, 'healthy');
});

test('identifyProblematicSessions flags sessions with low scores, rushed times, or locked students', () => {
  const healthyPkg = makePackage({ id: 'pkg-ok', title: 'Latihan Biologi', kkm: 70 });
  const riskyPkg = makePackage({ id: 'pkg-risk', title: 'UTS Fisika', kkm: 75, durationMinutes: 60 });

  const attempts: ExamAttempt[] = [
    makeAttempt({
      id: 'ok-1',
      packageId: 'pkg-ok',
      score: 90,
      passed: true,
      startedAt: '2026-11-28T08:00:00.000Z',
      submittedAt: '2026-11-28T08:40:00.000Z',
    }),
    makeAttempt({
      id: 'r-1',
      packageId: 'pkg-risk',
      score: 50,
      passed: false,
      startedAt: '2026-11-28T08:00:00.000Z',
      submittedAt: '2026-11-28T08:08:00.000Z',
    }),
    makeAttempt({
      id: 'r-2',
      packageId: 'pkg-risk',
      score: 58,
      passed: false,
      startedAt: '2026-11-28T08:00:00.000Z',
      submittedAt: '2026-11-28T08:11:00.000Z',
    }),
    makeAttempt({
      id: 'r-3',
      packageId: 'pkg-risk',
      status: 'locked',
      score: undefined,
    }),
  ];

  const violations: ViolationLog[] = [];
  const alerts = identifyProblematicSessions([healthyPkg, riskyPkg], attempts, violations);
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].packageId, 'pkg-risk');
  assert.equal(alerts[0].severity, 'high');
  assert.ok(alerts[0].reasons.some((r) => /di bawah KKM/i.test(r)));
  assert.ok(alerts[0].reasons.some((r) => /terlalu cepat/i.test(r)));
  assert.ok(alerts[0].reasons.some((r) => /terkunci pelanggaran/i.test(r)));
});

test('computeExamSummaryAnalytics scopes cleanly by selectedPackageId', () => {
  const pkg1 = makePackage({ id: 'p1', kkm: 75 });
  const pkg2 = makePackage({ id: 'p2', kkm: 80 });
  const attempts = [
    makeAttempt({ id: 'a1', packageId: 'p1', className: 'X A', score: 80, passed: true }),
    makeAttempt({ id: 'a2', packageId: 'p2', className: 'X B', score: 60, passed: false }),
  ];

  const allRes = computeExamSummaryAnalytics({
    packages: [pkg1, pkg2],
    attempts,
    violations: [],
    selectedPackageId: 'ALL',
  });
  assert.equal(allRes.completedAttempts, 2);
  assert.equal(allRes.overallAverageScore, 70);
  assert.equal(allRes.classSummaries.length, 2);

  const p1Res = computeExamSummaryAnalytics({
    packages: [pkg1, pkg2],
    attempts,
    violations: [],
    selectedPackageId: 'p1',
  });
  assert.equal(p1Res.completedAttempts, 1);
  assert.equal(p1Res.overallAverageScore, 80);
  assert.equal(p1Res.classSummaries.length, 1);
  assert.equal(p1Res.classSummaries[0].className, 'X A');
});

test('clampFloatingPosition and resolveFloatingPopoverPlacement keep draggable menu inside viewport', () => {
  const clampedLow = clampFloatingPosition({
    x: -50,
    y: 10,
    viewportWidth: 390,
    viewportHeight: 844,
    buttonSize: 52,
    margin: 12,
    topMargin: 60,
  });
  assert.deepEqual(clampedLow, { x: 12, y: 60 });

  const clampedHigh = clampFloatingPosition({
    x: 500,
    y: 999,
    viewportWidth: 390,
    viewportHeight: 844,
    buttonSize: 52,
    margin: 12,
    topMargin: 60,
  });
  assert.deepEqual(clampedHigh, { x: 326, y: 780 });

  assert.deepEqual(
    resolveFloatingPopoverPlacement({
      x: 320,
      y: 740,
      viewportWidth: 390,
      viewportHeight: 844,
    }),
    { vertical: 'up', horizontal: 'left' }
  );

  assert.deepEqual(
    resolveFloatingPopoverPlacement({
      x: 20,
      y: 80,
      viewportWidth: 390,
      viewportHeight: 844,
    }),
    { vertical: 'down', horizontal: 'right' }
  );
});
