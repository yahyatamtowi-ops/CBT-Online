import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyViolation,
  computeViolationDashboardSummary,
  detectCriticalViolationBursts,
  evaluateIncomingCriticalAlerts,
  formatViolationRelativeTime,
} from './violationAnalytics';
import type { ExamAttempt, ViolationLog } from '../types/cbt';

test('classifyViolation accurately categorizes Indonesian and English anti-cheat violations', () => {
  assert.equal(
    classifyViolation('Deteksi Kamera: Wajah Tidak Terdeteksi').id,
    'face_out_of_frame'
  );
  assert.equal(
    classifyViolation('Face out of frame detected').id,
    'face_out_of_frame'
  );
  assert.equal(
    classifyViolation('Deteksi Kamera: Terdeteksi Lebih dari 1 Wajah').id,
    'multiple_faces'
  );
  assert.equal(
    classifyViolation('Multiple faces detected').id,
    'multiple_faces'
  );
  assert.equal(
    classifyViolation('Pindah Tab / Kehilangan Fokus').id,
    'tab_switching'
  );
  assert.equal(
    classifyViolation('Tab switching detected').id,
    'tab_switching'
  );
  assert.equal(
    classifyViolation('Deteksi Kamera: Melihat Kanan / Kiri').id,
    'head_gaze_away'
  );
  assert.equal(
    classifyViolation('Deteksi Kamera: Menunduk / Mengalihkan Pandangan').id,
    'head_gaze_away'
  );
  assert.equal(
    classifyViolation('Upaya Screenshot / Cetak Layar').id,
    'screenshot_print'
  );
  assert.equal(
    classifyViolation('Membuka Bilah Notifikasi / Geser Tepi Atas').id,
    'notification_bar'
  );
  assert.equal(
    classifyViolation('Deteksi Kamera & Audio: Terindikasi Mengobrol').id,
    'audio_talking'
  );
  assert.equal(
    classifyViolation('Percobaan DevTools').id,
    'other'
  );
});

test('formatViolationRelativeTime formats seconds, minutes, and hours cleanly', () => {
  const now = Date.parse('2026-11-28T08:00:00.000Z');
  assert.equal(formatViolationRelativeTime('2026-11-28T07:59:50.000Z', now), 'Baru saja');
  assert.equal(formatViolationRelativeTime('2026-11-28T07:59:15.000Z', now), '45 dtk lalu');
  assert.equal(formatViolationRelativeTime('2026-11-28T07:56:00.000Z', now), '4 mnt lalu');
  assert.equal(formatViolationRelativeTime('2026-11-28T06:00:00.000Z', now), '2 jam lalu');
});

test('computeViolationDashboardSummary scopes to teacher packages, computes KPIs, breakdown, filters, and top offenders', () => {
  const nowMs = Date.parse('2026-11-28T08:10:00.000Z');
  const violations: ViolationLog[] = [
    {
      id: 'v-1',
      attemptId: 'att-1',
      studentNisn: '0081110001',
      studentName: 'Alya Putri',
      className: 'XI-IPA-1',
      packageId: 'pkg-bio',
      packageTitle: 'UTS Biologi',
      type: 'Deteksi Kamera: Wajah Tidak Terdeteksi',
      detail: 'Wajah peserta keluar dari bingkai kamera.',
      timestamp: '2026-11-28T08:09:30.000Z', // 30s ago (within 5 min)
    },
    {
      id: 'v-2',
      attemptId: 'att-1',
      studentNisn: '0081110001',
      studentName: 'Alya Putri',
      className: 'XI-IPA-1',
      packageId: 'pkg-bio',
      packageTitle: 'UTS Biologi',
      type: 'Deteksi Kamera: Terdeteksi Lebih dari 1 Wajah',
      detail: 'Terdeteksi 2 orang di depan layar.',
      timestamp: '2026-11-28T08:08:00.000Z', // 2 min ago
    },
    {
      id: 'v-3',
      attemptId: 'att-2',
      studentNisn: '0081110002',
      studentName: 'Bima Pratama',
      className: 'XI-IPA-1',
      packageId: 'pkg-bio',
      packageTitle: 'UTS Biologi',
      type: 'Pindah Tab / Kehilangan Fokus',
      detail: 'Berpindah tab browser.',
      timestamp: '2026-11-28T07:50:00.000Z', // 20 min ago
    },
    {
      id: 'v-other-teacher',
      attemptId: 'att-99',
      studentNisn: '0081119999',
      studentName: 'Siswa Guru Lain',
      className: 'XII-IPS-1',
      packageId: 'pkg-other',
      packageTitle: 'Ekonomi Guru Lain',
      type: 'Pindah Tab / Kehilangan Fokus',
      detail: 'Tidak boleh muncul di guru Biologi.',
      timestamp: '2026-11-28T08:09:55.000Z',
    },
  ];

  const attempts: ExamAttempt[] = [
    {
      id: 'att-1',
      packageId: 'pkg-bio',
      studentId: 's1',
      studentNisn: '0081110001',
      studentName: 'Alya Putri',
      className: 'XI-IPA-1',
      status: 'locked',
      startedAt: '2026-11-28T07:30:00.000Z',
      extraMinutes: 0,
      currentQuestionIndex: 2,
      questionOrder: ['q1'],
      optionOrders: {},
      answers: {},
      flaggedQuestionIds: [],
      violationCount: 4,
      lockReason: 'Terkunci Sistem',
    },
  ];

  const summary = computeViolationDashboardSummary({
    violations,
    attempts,
    teacherPackageIds: ['pkg-bio'],
    nowMs,
  });

  // Must exclude other teacher's package
  assert.equal(summary.kpis.totalViolations, 3);
  assert.equal(summary.kpis.last5MinCount, 2);
  assert.equal(summary.kpis.uniqueStudentsCount, 2);
  assert.equal(summary.kpis.highSeverityCount, 3);

  // Reverse chronological ordering
  assert.deepEqual(
    summary.allScoped.map((i) => i.log.id),
    ['v-1', 'v-2', 'v-3']
  );

  // Top offender is Alya Putri with 2 violations & effectiveStatus 'locked'
  assert.equal(summary.topOffenders[0].studentName, 'Alya Putri');
  assert.equal(summary.topOffenders[0].totalCount, 2);
  assert.equal(summary.topOffenders[0].effectiveStatus, 'locked');

  // Category filter works cleanly
  const multiOnly = computeViolationDashboardSummary({
    violations,
    attempts,
    teacherPackageIds: ['pkg-bio'],
    categoryFilter: 'multiple_faces',
    nowMs,
  });
  assert.equal(multiOnly.filtered.length, 1);
  assert.equal(multiOnly.filtered[0].log.id, 'v-2');

  // Search filter works on both Indonesian and English category labels
  const searchTab = computeViolationDashboardSummary({
    violations,
    attempts,
    teacherPackageIds: ['pkg-bio'],
    searchQuery: 'tab switching',
    nowMs,
  });
  assert.equal(searchTab.filtered.length, 1);
  assert.equal(searchTab.filtered[0].log.studentName, 'Bima Pratama');
});

test('detectCriticalViolationBursts and evaluateIncomingCriticalAlerts trigger only on >=2 high-severity flags within 30 seconds', () => {
  const baseMs = Date.parse('2026-11-28T09:00:00.000Z');
  const iso = (offsetSec: number) => new Date(baseMs + offsetSec * 1000).toISOString();

  const violations: ViolationLog[] = [
    // Student A: 2 high-severity flags 12 seconds apart -> CRITICAL!
    {
      id: 'crit-1',
      attemptId: 'att-a',
      studentNisn: '00810001',
      studentName: 'Raka Pratama',
      className: 'XI-IPA-1',
      packageId: 'pkg-bio',
      packageTitle: 'UTS Biologi',
      type: 'Wajah Tidak Terdeteksi',
      detail: 'Face out of frame',
      timestamp: iso(0),
    },
    {
      id: 'crit-2',
      attemptId: 'att-a',
      studentNisn: '00810001',
      studentName: 'Raka Pratama',
      className: 'XI-IPA-1',
      packageId: 'pkg-bio',
      packageTitle: 'UTS Biologi',
      type: 'Lebih dari 1 Wajah',
      detail: 'Multiple faces detected',
      timestamp: iso(12),
    },
    // Student B: 2 high-severity flags 45 seconds apart -> NOT critical (>30s)
    {
      id: 'spread-1',
      attemptId: 'att-b',
      studentNisn: '00810002',
      studentName: 'Nadia Putri',
      className: 'XI-IPA-1',
      packageId: 'pkg-bio',
      packageTitle: 'UTS Biologi',
      type: 'Pindah Tab / Kehilangan Fokus',
      detail: 'Tab switching',
      timestamp: iso(0),
    },
    {
      id: 'spread-2',
      attemptId: 'att-b',
      studentNisn: '00810002',
      studentName: 'Nadia Putri',
      className: 'XI-IPA-1',
      packageId: 'pkg-bio',
      packageTitle: 'UTS Biologi',
      type: 'Upaya Screenshot',
      detail: 'Screenshot attempt',
      timestamp: iso(45),
    },
    // Student C: 2 medium-severity flags 5 seconds apart -> NOT critical (medium severity)
    {
      id: 'med-1',
      attemptId: 'att-c',
      studentNisn: '00810003',
      studentName: 'Bagas Saputra',
      className: 'XI-IPA-2',
      packageId: 'pkg-bio',
      packageTitle: 'UTS Biologi',
      type: 'Melihat Kanan/Kiri',
      detail: 'Looking away',
      timestamp: iso(0),
    },
    {
      id: 'med-2',
      attemptId: 'att-c',
      studentNisn: '00810003',
      studentName: 'Bagas Saputra',
      className: 'XI-IPA-2',
      packageId: 'pkg-bio',
      packageTitle: 'UTS Biologi',
      type: 'Membuka Bilah Notifikasi',
      detail: 'Notification bar',
      timestamp: iso(5),
    },
  ];

  const bursts = detectCriticalViolationBursts({
    violations,
    teacherPackageIds: ['pkg-bio'],
    windowMs: 30_000,
    minHighSeverityCount: 2,
  });

  assert.equal(bursts.length, 1);
  assert.equal(bursts[0].studentName, 'Raka Pratama');
  assert.equal(bursts[0].countInWindow, 2);
  assert.equal(bursts[0].windowSeconds, 30);
  assert.equal(bursts[0].latestViolationId, 'crit-2');
  assert.deepEqual(
    bursts[0].categories.map((c) => c.id),
    ['multiple_faces', 'face_out_of_frame']
  );

  // Incoming evaluation triggers when crit-2 arrives live
  const triggered = evaluateIncomingCriticalAlerts({
    allTeacherViolations: violations,
    newlyArrivedViolations: [violations[1]],
  });
  assert.equal(triggered.length, 1);
  assert.equal(triggered[0].studentName, 'Raka Pratama');

  // Incoming medium-severity or spaced high-severity does NOT trigger
  const notTriggered = evaluateIncomingCriticalAlerts({
    allTeacherViolations: violations,
    newlyArrivedViolations: [violations[3], violations[5]],
  });
  assert.equal(notTriggered.length, 0);
});
