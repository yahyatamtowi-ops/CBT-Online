import test from 'node:test';
import assert from 'node:assert/strict';
import type {
  ExamAttempt,
  ToiletPermissionRequest,
  ViolationLog,
} from '../types/cbt';
import {
  applyLiveEventToSlices,
  filterScopedLockedAttempts,
  filterScopedViolations,
  mergeLiveAttempts,
  mergeLiveToiletRequests,
  mergeLiveViolations,
} from './realtimeSync';
import { classifyViolation } from './violationAnalytics';

function makeViolation(id: string, pkgId: string, className: string, ts: string): ViolationLog {
  return {
    id,
    attemptId: `att-${id}`,
    studentNisn: '0114459934',
    studentName: 'Siswa Uji',
    className,
    packageId: pkgId,
    packageTitle: 'Bahasa Indonesia',
    type: 'Deteksi Kamera & Audio: Keluar Jangkauan Kamera & Suara Mengobrol',
    detail: 'Wajah keluar dari jangkauan kamera disertai suara mengobrol.',
    timestamp: ts,
  };
}

function makeToilet(
  id: string,
  status: ToiletPermissionRequest['status'],
  pkgId = 'pkg-1',
  className = 'XI E'
): ToiletPermissionRequest {
  return {
    id,
    attemptId: 'att-1',
    studentId: 'stu-1',
    studentNisn: '0114459934',
    studentName: 'Siswa Uji',
    className,
    packageId: pkgId,
    packageTitle: 'Bahasa Indonesia',
    reason: 'Izin ke Toilet',
    status,
    requestedAt: '2026-11-28T09:00:00.000Z',
  };
}

function makeAttempt(
  id: string,
  overrides: Partial<ExamAttempt> = {}
): ExamAttempt {
  return {
    id,
    packageId: 'pkg-1',
    studentId: 'stu-1',
    studentNisn: '0114459934',
    studentName: 'Siswa Uji',
    className: 'XI E',
    status: 'in_progress',
    startedAt: '2026-11-28T08:00:00.000Z',
    extraMinutes: 0,
    currentQuestionIndex: 0,
    questionOrder: ['q1'],
    optionOrders: {},
    answers: {},
    flaggedQuestionIds: [],
    violationCount: 0,
    ...overrides,
  };
}

test('mergeLiveViolations deduplicates by id and sorts newest first', () => {
  const v1 = makeViolation('v1', 'pkg-1', 'XI E', '2026-11-28T09:00:00.000Z');
  const v2 = makeViolation('v2', 'pkg-1', 'XI E', '2026-11-28T09:05:00.000Z');
  const merged = mergeLiveViolations([v1], [v2, v1]);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].id, 'v2');
  assert.equal(merged[1].id, 'v1');
  // Re-merging identical item returns same reference (no spurious re-renders)
  assert.equal(mergeLiveViolations(merged, [v2]), merged);
});

test('mergeLiveToiletRequests advances lifecycle pending -> confirmed -> returned without regressing', () => {
  const pending = makeToilet('t1', 'pending');
  const confirmed: ToiletPermissionRequest = {
    ...pending,
    status: 'confirmed',
    confirmedAt: '2026-11-28T09:01:00.000Z',
    confirmedByName: 'Tamtowi Yahya, S.Pd.',
  };
  const returned: ToiletPermissionRequest = {
    ...confirmed,
    status: 'returned',
    returnedAt: '2026-11-28T09:05:00.000Z',
  };

  const step1 = mergeLiveToiletRequests([], [pending]);
  assert.equal(step1[0].status, 'pending');

  const step2 = mergeLiveToiletRequests(step1, [confirmed]);
  assert.equal(step2[0].status, 'confirmed');
  assert.equal(step2[0].confirmedByName, 'Tamtowi Yahya, S.Pd.');

  // Stale pending update must not regress confirmed status
  const step2Stale = mergeLiveToiletRequests(step2, [pending]);
  assert.equal(step2Stale, step2);
  assert.equal(step2Stale[0].status, 'confirmed');

  const step3 = mergeLiveToiletRequests(step2, [returned]);
  assert.equal(step3[0].status, 'returned');
});

test('applyLiveEventToSlices applies violation lock, unlock, and reset events accurately', () => {
  const lockedAttempt = makeAttempt('att-1', {
    status: 'locked',
    violationCount: 3,
    lockReason: 'Terkunci Sistem (Indikasi Kecurangan)',
    updatedAt: '2026-11-28T09:10:00.000Z',
  });
  const v = makeViolation('v-lock', 'pkg-1', 'XI E', '2026-11-28T09:10:00.000Z');

  const afterLock = applyLiveEventToSlices(
    { violations: [], toiletRequests: [], attempts: [makeAttempt('att-1')] },
    {
      eventId: 'evt-1',
      senderId: 'student-tab',
      sentAt: '2026-11-28T09:10:00.000Z',
      kind: 'violation_recorded',
      violation: v,
      attempt: lockedAttempt,
    },
    3
  );
  assert.equal(afterLock.changed, true);
  assert.equal(afterLock.violations.length, 1);
  assert.equal(afterLock.attempts[0].status, 'locked');

  // Unlock broadcast clears locked status immediately
  const unlockedAttempt = makeAttempt('att-1', {
    status: 'in_progress',
    violationCount: 0,
    unlockedAt: '2026-11-28T09:11:00.000Z',
    updatedAt: '2026-11-28T09:11:00.000Z',
  });
  const afterUnlock = applyLiveEventToSlices(
    afterLock,
    {
      eventId: 'evt-2',
      senderId: 'teacher-tab',
      sentAt: '2026-11-28T09:11:00.000Z',
      kind: 'attempt_updated',
      attempt: unlockedAttempt,
    },
    3
  );
  assert.equal(afterUnlock.attempts[0].status, 'in_progress');
  assert.equal(afterUnlock.attempts[0].violationCount, 0);

  // Reset broadcast removes attempt
  const afterReset = mergeLiveAttempts(afterUnlock.attempts, [], 3, ['att-1']);
  assert.equal(afterReset.length, 0);
});

test('filterScopedLockedAttempts and filterScopedViolations scope accurately by admin, teacher, and proctor roles', () => {
  const attempts = [
    makeAttempt('a1', { packageId: 'pkg-1', className: 'XI E', status: 'locked', violationCount: 3 }),
    makeAttempt('a2', { packageId: 'pkg-1', className: 'XI D', status: 'locked', violationCount: 3 }),
    makeAttempt('a3', { packageId: 'pkg-2', className: 'X A', status: 'locked', violationCount: 3 }),
    makeAttempt('a4', { packageId: 'pkg-1', className: 'XI E', status: 'in_progress', violationCount: 1 }),
  ];

  // Admin sees all 3 locked attempts
  assert.equal(
    filterScopedLockedAttempts({
      attempts,
      maxViolationTolerance: 3,
      role: 'admin',
    }).length,
    3
  );

  // Teacher of pkg-1 sees a1 and a2 only
  assert.deepEqual(
    filterScopedLockedAttempts({
      attempts,
      maxViolationTolerance: 3,
      role: 'teacher',
      allowedPackageIds: ['pkg-1'],
    }).map((a) => a.id).sort(),
    ['a1', 'a2']
  );

  // Proctor assigned to pkg-1 & class XI E sees a1 only
  assert.deepEqual(
    filterScopedLockedAttempts({
      attempts,
      maxViolationTolerance: 3,
      role: 'proctor',
      allowedPackageIds: ['pkg-1'],
      allowedClasses: ['XI E'],
    }).map((a) => a.id),
    ['a1']
  );

  const violations = [
    makeViolation('v1', 'pkg-1', 'XI E', '2026-11-28T09:00:00.000Z'),
    makeViolation('v2', 'pkg-2', 'X A', '2026-11-28T09:01:00.000Z'),
  ];
  assert.equal(
    filterScopedViolations({
      violations,
      role: 'proctor',
      allowedPackageIds: ['pkg-1'],
      allowedClasses: ['XI E'],
    }).length,
    1
  );
  assert.equal(
    classifyViolation(
      'Deteksi Kamera & Audio: Keluar Jangkauan Kamera & Suara Mengobrol',
      'Wajah peserta keluar dari jangkauan kamera disertai suara percakapan/mengobrol.'
    ).id,
    'face_out_of_frame'
  );
});
