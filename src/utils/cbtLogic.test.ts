import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MIN_ESSAY_QUESTIONS,
  MAX_ESSAY_QUESTIONS,
  applyBulkDeleteById,
  applyBulkUserStatus,
  applyCollectiveQuestionEdits,
  applySelectiveDelete,
  autoDistributePackagePoints,
  buildGradesCSV,
  calculateExamScore,
  computeItemAnalysis,
  computeStudentExamProgress,
  computeUnlockExtraMinutes,
  distributeQuestionWeights,
  evaluateCameraBehavior,
  evaluateEssayAnswerSemantic,
  evaluateQuestionCorrectness,
  evaluateViolationEscalation,
  findStudentPackageAttempt,
  formatSecondsToClock,
  generateGoogleAppsScriptCode,
  generateQuestionsCSVTemplate,
  generateStudentsCSVTemplate,
  generateTeachersCSVTemplate,
  getRemainingMinSubmitSeconds,
  isAttemptViolationLocked,
  isWithinScheduleWindow,
  lookupStudentAvailableTokens,
  mergeExamAttempts,
  normalizeAttemptStatus,
  parseQuestionsBulkText,
  parseStudentsCSV,
  parseTeachersCSV,
  resolveEffectiveAttemptStatus,
  seededShuffle,
  shouldApplyRemotePull,
  validateAppsScriptUrl,
  validateEssayQuestionLimit,
  validateStudentLogin,
} from './cbtLogic';
import { buildViolationVoiceMessage } from './audioAlert';
import {
  diagnoseAppsScriptHtmlResponse,
  forwardToAppsScript,
  validateAppsScriptRedirectUrl,
  validateStrictAppsScriptUrl,
} from './appsScriptProxy';
import { createInitialSeedDatabase, DEFAULT_SCHOOL_LOGO } from '../data/seedData';
import type {
  ExamAttempt,
  ExamPackage,
  GlobalSecurityConfig,
  Question,
  SessionScheduleConfig,
  StudentRecord,
} from '../types/cbt';

const sampleQuestions: Question[] = [
  {
    id: 'q1',
    packageId: 'pkg-1',
    type: 'single_choice',
    prompt: 'Hukum II Newton menyatakan hubungan antara gaya, massa, dan percepatan adalah?',
    options: [
      { id: 'A', text: 'F = m × a' },
      { id: 'B', text: 'F = m / a' },
      { id: 'C', text: 'F = m + a' },
      { id: 'D', text: 'F = a / m' },
    ],
    correctOptionId: 'A',
    points: 25,
    explanation: 'F = m × a.',
  },
  {
    id: 'q2',
    packageId: 'pkg-1',
    type: 'multiple_choice',
    prompt: 'Pilih semua besaran vektor!',
    options: [
      { id: 'A', text: 'Kecepatan' },
      { id: 'B', text: 'Massa' },
      { id: 'C', text: 'Gaya' },
      { id: 'D', text: 'Suhu' },
    ],
    correctOptionIds: ['A', 'C'],
    points: 25,
    explanation: 'Kecepatan dan Gaya memiliki nilai serta arah.',
  },
  {
    id: 'q3',
    packageId: 'pkg-1',
    type: 'matching',
    prompt: 'Jodohkan besaran dengan satuan SI-nya.',
    matchingPairs: [
      { id: 'p1', left: 'Gaya', right: 'Newton (N)' },
      { id: 'p2', left: 'Energi', right: 'Joule (J)' },
    ],
    points: 25,
    explanation: 'Gaya -> Newton, Energi -> Joule.',
  },
  {
    id: 'q4',
    packageId: 'pkg-1',
    type: 'true_false',
    prompt: 'Cahaya merambat lebih cepat di ruang hampa daripada di dalam air.',
    correctBoolean: true,
    points: 25,
    explanation: 'Benar, indeks bias air > 1 sehingga kecepatan cahaya melambat.',
  },
];

test('initial seed database uses SMA Negeri 1 Kabun defaults and empty user tables', () => {
  const seed = createInitialSeedDatabase();
  assert.equal(seed.school.schoolName, 'SMA Negeri 1 Kabun');
  assert.equal(seed.school.logoUrl, DEFAULT_SCHOOL_LOGO);
  assert.equal(seed.adminAccount.username, 'smansakabun');
  assert.equal(seed.adminAccount.password, 'Smansakabun123!');
  assert.equal(seed.security.requireCameraMonitoring, true);
  assert.equal(seed.students.length, 0);
  assert.equal(seed.teachers.length, 0);
  assert.equal(seed.classes.length, 0);
  assert.equal(seed.packages.length, 0);
});

test('evaluateQuestionCorrectness handles all 4 question types accurately', () => {
  assert.equal(evaluateQuestionCorrectness(sampleQuestions[0], 'A').isCorrect, true);
  assert.equal(evaluateQuestionCorrectness(sampleQuestions[0], 'B').earnedPoints, 0);

  assert.equal(evaluateQuestionCorrectness(sampleQuestions[1], ['C', 'A']).isCorrect, true);
  assert.equal(evaluateQuestionCorrectness(sampleQuestions[1], ['A']).isCorrect, false);

  const partialMatch = evaluateQuestionCorrectness(sampleQuestions[2], {
    p1: 'Newton (N)',
    p2: 'Newton (N)',
  });
  assert.equal(partialMatch.isCorrect, false);
  assert.equal(partialMatch.earnedPoints, 12.5);

  const fullMatch = evaluateQuestionCorrectness(sampleQuestions[2], {
    p1: 'Newton (N)',
    p2: 'Joule (J)',
  });
  assert.equal(fullMatch.isCorrect, true);
  assert.equal(fullMatch.earnedPoints, 25);

  assert.equal(evaluateQuestionCorrectness(sampleQuestions[3], true).isCorrect, true);
  assert.equal(evaluateQuestionCorrectness(sampleQuestions[3], false).isCorrect, false);
});

test('calculateExamScore computes weighted score and KKM pass status', () => {
  const fullScore = calculateExamScore(
    sampleQuestions,
    {
      q1: 'A',
      q2: ['A', 'C'],
      q3: { p1: 'Newton (N)', p2: 'Joule (J)' },
      q4: true,
    },
    75
  );
  assert.equal(fullScore.score, 100);
  assert.equal(fullScore.correctCount, 4);
  assert.equal(fullScore.passed, true);
});

test('seededShuffle is deterministic for the same seed and preserves all elements', () => {
  const input = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6'];
  const first = seededShuffle(input, 'student-123-pkg-1');
  const second = seededShuffle(input, 'student-123-pkg-1');
  assert.deepEqual(first, second);
  assert.deepEqual([...first].sort(), [...input].sort());
});

test('validateStudentLogin and lookupStudentAvailableTokens work with NISN and Token only', () => {
  const students: StudentRecord[] = [
    { id: 's1', nisn: '0084512001', name: 'Siswa Aktif', className: 'X-IPA-1', active: true },
    {
      id: 's2',
      nisn: '0084512002',
      name: 'Siswa Diblokir',
      className: 'X-IPA-1',
      active: false,
      blockReason: 'Administrasi belum selesai',
    },
    { id: 's3', nisn: '0084512003', name: 'Siswa Kelas Lain', className: 'XI-IPS-1', active: true },
  ];
  const packages: ExamPackage[] = [
    {
      id: 'pkg-1',
      teacherId: 't1',
      title: 'UTS Fisika',
      subject: 'Fisika',
      targetClasses: ['X-IPA-1'],
      category: 'Ulangan Resmi',
      durationMinutes: 60,
      minSubmitMinutes: 15,
      kkm: 75,
      token: 'FISIKA26',
      shuffleQuestions: true,
      shuffleOptions: true,
      isPublished: true,
      createdAt: '2026-11-25T00:00:00.000Z',
    },
  ];
  const schedule: SessionScheduleConfig = {
    tokenReleaseMode: 'manual',
    tokensReleased: true,
    enforceTimeWindow: true,
    accessStartTime: '07:30',
    accessEndTime: '09:30',
    autoReleaseDateTime: '07:30',
    emergencyForceFinishedAt: null,
  };

  const validTime = new Date(2026, 10, 25, 8, 15, 0);
  const outsideTime = new Date(2026, 10, 25, 11, 0, 0);

  // Automatic token lookup when NISN is typed
  const readyLookup = lookupStudentAvailableTokens({
    nisn: '0084512001',
    students,
    packages,
    schedule,
    now: validTime,
  });
  assert.equal(readyLookup.status, 'ready');
  if (readyLookup.status === 'ready') {
    assert.equal(readyLookup.packages.length, 1);
    assert.equal(readyLookup.packages[0].token, 'FISIKA26');
  }

  assert.equal(
    lookupStudentAvailableTokens({
      nisn: '0084512002',
      students,
      packages,
      schedule,
      now: validTime,
    }).status,
    'blocked'
  );
  assert.equal(
    lookupStudentAvailableTokens({
      nisn: '0084512003',
      students,
      packages,
      schedule,
      now: validTime,
    }).status,
    'no_exam'
  );
  assert.equal(
    lookupStudentAvailableTokens({
      nisn: '0084512001',
      students,
      packages,
      schedule,
      now: outsideTime,
    }).status,
    'schedule_closed'
  );

  // Login using ONLY NISN and Token
  assert.equal(
    validateStudentLogin({
      nisn: '0084512001',
      token: 'fisika26',
      students,
      packages,
      schedule,
      now: validTime,
    }).ok,
    true
  );

  const blocked = validateStudentLogin({
    nisn: '0084512002',
    token: 'FISIKA26',
    students,
    packages,
    schedule,
    now: validTime,
  });
  assert.equal(blocked.ok, false);
  assert.match(blocked.error ?? '', /dinonaktifkan/i);

  assert.equal(
    isWithinScheduleWindow({ ...schedule, tokensReleased: false }, validTime).allowed,
    false
  );
  assert.equal(isWithinScheduleWindow(schedule, outsideTime).allowed, false);
});

test('evaluateViolationEscalation locks exam once violations exceed tolerance', () => {
  const sec: GlobalSecurityConfig = {
    requireFullscreen: true,
    detectTabSwitchAndSplitScreen: true,
    blockRightClickAndCopyPaste: true,
    enableDynamicWatermark: true,
    requireCameraMonitoring: true,
    showScoreAndExplanationAuto: true,
    maxViolationTolerance: 3,
  };

  assert.equal(evaluateViolationEscalation(0, sec).shouldAutoLock, false);
  assert.equal(evaluateViolationEscalation(2, sec).shouldAutoLock, false);
  assert.equal(evaluateViolationEscalation(3, sec).shouldAutoLock, true);
});

test('evaluateCameraBehavior detects sustained looking left/right and talking violations', () => {
  const focused = evaluateCameraBehavior({
    horizontalShift: 0.05,
    lateralMotionScore: 0.04,
    audioRms: 0.01,
    consecutiveTurnFrames: 0,
    consecutiveSpeechFrames: 0,
  });
  assert.equal(focused.status, 'focused');
  assert.equal(focused.shouldFlagViolation, false);

  const lookingRight = evaluateCameraBehavior({
    horizontalShift: 0.32,
    lateralMotionScore: 0.25,
    audioRms: 0.01,
    consecutiveTurnFrames: 2,
    consecutiveSpeechFrames: 0,
  });
  assert.equal(lookingRight.shouldFlagViolation, true);
  assert.match(lookingRight.violationType ?? '', /Melihat Kanan/i);

  const talking = evaluateCameraBehavior({
    horizontalShift: 0.02,
    lateralMotionScore: 0.02,
    audioRms: 0.14,
    consecutiveTurnFrames: 0,
    consecutiveSpeechFrames: 2,
  });
  assert.equal(talking.shouldFlagViolation, true);
  assert.match(talking.violationType ?? '', /Mengobrol/i);
});

test('CSV templates round-trip cleanly through parsers', () => {
  const studentRes = parseStudentsCSV(generateStudentsCSVTemplate());
  assert.equal(studentRes.students.length, 2);
  assert.equal(studentRes.errors.length, 0);

  const teacherRes = parseTeachersCSV(generateTeachersCSVTemplate());
  assert.equal(teacherRes.teachers.length, 1);
  assert.equal(teacherRes.errors.length, 0);

  const questionRes = parseQuestionsBulkText(generateQuestionsCSVTemplate(), 'pkg-1');
  assert.equal(questionRes.questions.length, 4);
  assert.equal(questionRes.errors.length, 0);
  assert.equal(questionRes.questions[0].options?.length, 5);
  assert.equal(questionRes.questions[0].options?.[4].id, 'E');
  assert.equal(questionRes.questions[0].correctOptionId, 'B');
  assert.equal(questionRes.questions[1].options?.length, 4);
  assert.equal(questionRes.questions[1].correctOptionId, 'C');
  assert.equal(questionRes.questions[2].options?.length, 5);
  assert.deepEqual(questionRes.questions[2].correctOptionIds, ['A', 'C', 'E']);
  assert.equal(questionRes.questions[3].type, 'true_false');
});

test('applySelectiveDelete clears only chosen categories and leaves others intact', () => {
  const mockDb = {
    students: [{ id: '1' }],
    teachers: [{ id: 't1' }],
    classes: ['X-IPA-1'],
    packages: [{ id: 'p1' }],
    questions: [{ id: 'q1' }],
    attempts: [{ id: 'a1' }],
    violations: [{ id: 'v1' }],
    auditLogs: [{ id: 'l1' }],
  };

  const { nextDb, deletedCategories } = applySelectiveDelete(mockDb, {
    students: true,
    teachers: false,
    classes: false,
    packagesAndQuestions: false,
    attempts: true,
    violations: true,
    auditLogs: false,
  });

  assert.equal(nextDb.students.length, 0);
  assert.equal(nextDb.attempts.length, 0);
  assert.equal(nextDb.violations.length, 0);
  assert.equal(nextDb.teachers.length, 1);
  assert.equal(nextDb.classes.length, 1);
  assert.equal(nextDb.packages.length, 1);
  assert.equal(deletedCategories.length, 3);
});

test('getRemainingMinSubmitSeconds, computeItemAnalysis, and buildGradesCSV work accurately', () => {
  const started = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const remaining = getRemainingMinSubmitSeconds(started, 15, Date.now());
  assert.ok(remaining >= 598 && remaining <= 601);
  assert.equal(formatSecondsToClock(905), '15:05');

  const attempts: ExamAttempt[] = [
    {
      id: 'att-1',
      packageId: 'pkg-1',
      studentId: 's1',
      studentNisn: '0084512001',
      studentName: 'Peserta 1',
      className: 'X-IPA-1',
      status: 'completed',
      startedAt: '2026-11-25T08:00:00.000Z',
      submittedAt: '2026-11-25T08:40:00.000Z',
      extraMinutes: 0,
      currentQuestionIndex: 3,
      questionOrder: ['q1', 'q2', 'q3', 'q4'],
      optionOrders: {},
      answers: { q1: 'A', q2: ['A', 'C'], q3: { p1: 'Newton (N)', p2: 'Joule (J)' }, q4: true },
      flaggedQuestionIds: [],
      violationCount: 0,
      score: 100,
    },
  ];
  const analysis = computeItemAnalysis(sampleQuestions, attempts);
  assert.equal(analysis[0].correctPercent, 100);
  const pkg: ExamPackage = {
    id: 'pkg-1',
    teacherId: 't1',
    title: 'UTS Fisika',
    subject: 'Fisika',
    targetClasses: ['X-IPA-1'],
    category: 'Ulangan Resmi',
    durationMinutes: 60,
    minSubmitMinutes: 15,
    kkm: 75,
    token: 'FISIKA26',
    shuffleQuestions: true,
    shuffleOptions: true,
    isPublished: true,
    createdAt: '2026-11-25T00:00:00.000Z',
  };
  assert.match(buildGradesCSV(pkg, attempts), /Peserta 1/);
});

test('distributeQuestionWeights supports equal_target, uniform, by_type, and scoped targetIds', () => {
  const threeQuestions = sampleQuestions.slice(0, 3);
  const equal = distributeQuestionWeights(threeQuestions, {
    mode: 'equal_target',
    targetTotal: 100,
  });
  const totalEqual = Number(equal.reduce((sum, q) => sum + q.points, 0).toFixed(2));
  assert.equal(totalEqual, 100);
  assert.equal(equal[0].points, 33.33);
  assert.equal(equal[1].points, 33.33);
  assert.equal(equal[2].points, 33.34);

  const uniformScoped = distributeQuestionWeights(
    sampleQuestions,
    { mode: 'uniform', pointsPerQuestion: 15 },
    ['q1', 'q3']
  );
  assert.equal(uniformScoped[0].points, 15);
  assert.equal(uniformScoped[1].points, 25);
  assert.equal(uniformScoped[2].points, 15);
  assert.equal(uniformScoped[3].points, 25);

  const byType = distributeQuestionWeights(sampleQuestions, {
    mode: 'by_type',
    weightsByType: {
      single_choice: 5,
      multiple_choice: 10,
      matching: 12,
      true_false: 3,
    },
  });
  assert.deepEqual(
    byType.map((q) => q.points),
    [5, 10, 12, 3]
  );
});

test('applyCollectiveQuestionEdits immutably updates targeted questions only', () => {
  const updated = applyCollectiveQuestionEdits(sampleQuestions, [
    {
      id: 'q1',
      prompt: 'Pertanyaan fisika diperbarui',
      points: 40,
      correctOptionId: 'B',
      explanation: 'Pembahasan baru',
    },
    {
      id: 'q4',
      correctBoolean: false,
      points: 10,
    },
  ]);

  assert.notEqual(updated, sampleQuestions);
  assert.equal(updated[0].prompt, 'Pertanyaan fisika diperbarui');
  assert.equal(updated[0].points, 40);
  assert.equal(updated[0].correctOptionId, 'B');
  assert.equal(updated[0].explanation, 'Pembahasan baru');
  assert.equal(sampleQuestions[0].points, 25);

  // Untouched question remains identical
  assert.equal(updated[1], sampleQuestions[1]);
  assert.equal(updated[3].correctBoolean, false);
  assert.equal(updated[3].points, 10);
});

test('validateAppsScriptUrl enforces HTTPS and Google Apps Script domains', () => {
  const validExec = validateAppsScriptUrl(
    ' https://script.google.com/macros/s/AKfycb123456/exec '
  );
  assert.equal(validExec.ok, true);
  assert.equal(
    validExec.normalizedUrl,
    'https://script.google.com/macros/s/AKfycb123456/exec'
  );

  assert.equal(validateAppsScriptUrl('').ok, false);
  assert.equal(
    validateAppsScriptUrl('http://script.google.com/macros/s/AKfycb123/exec').ok,
    false
  );
  assert.equal(
    validateAppsScriptUrl('https://example.com/macros/s/AKfycb123/exec').ok,
    false
  );
  assert.equal(
    validateAppsScriptUrl('https://script.google.com/home').ok,
    false
  );
});

test('generateGoogleAppsScriptCode embeds syncSecret, school name, and chunked sync handlers', () => {
  const code = generateGoogleAppsScriptCode({
    syncSecret: "SMANSA'2026",
    schoolName: 'SMA Negeri 1 Kabun',
  });
  assert.match(code, /SMA Negeri 1 Kabun/);
  assert.match(code, /var SYNC_SECRET = 'SMANSA\\'2026';/);
  assert.match(code, /var MASTER_SHEET = 'CBT_Master_JSON';/);
  assert.match(code, /function doGet\(e\)/);
  assert.match(code, /function doPost\(e\)/);
  assert.match(code, /function mirrorReadableSheets\(ss, db\)/);
});

test('validateStrictAppsScriptUrl normalizes /u/N/ URLs and blocks /dev or SSRF targets', () => {
  const multiAccount = validateStrictAppsScriptUrl(
    'https://script.google.com/macros/u/1/s/AKfycb123/exec'
  );
  assert.equal(multiAccount.ok, true);
  assert.equal(
    multiAccount.normalizedUrl,
    'https://script.google.com/macros/s/AKfycb123/exec'
  );

  const workspace = validateStrictAppsScriptUrl(
    'https://script.google.com/a/macros/guru.sma.belajar.id/s/AKfycb123/exec'
  );
  assert.equal(workspace.ok, true);

  assert.equal(
    validateStrictAppsScriptUrl('https://script.google.com/macros/s/AKfycb123/dev').ok,
    false
  );
  assert.equal(
    validateStrictAppsScriptUrl('https://169.254.169.254/latest/meta-data').ok,
    false
  );
  assert.equal(
    validateStrictAppsScriptUrl('https://script.google.com:8443/macros/s/AKfycb123/exec').ok,
    false
  );
});

test('validateAppsScriptRedirectUrl allows Google echo host and flags auth or external redirects', () => {
  assert.equal(
    validateAppsScriptRedirectUrl(
      'https://script.googleusercontent.com/macros/echo?user_content_key=abc',
      'https://script.google.com/macros/s/AKfycb123/exec'
    ).ok,
    true
  );

  const authHop = validateAppsScriptRedirectUrl(
    'https://accounts.google.com/ServiceLogin?continue=...',
    'https://script.google.com/macros/s/AKfycb123/exec'
  );
  assert.equal(authHop.ok, false);
  assert.equal(authHop.isAuthRedirect, true);

  const ssrfHop = validateAppsScriptRedirectUrl(
    'http://127.0.0.1:3000/internal',
    'https://script.google.com/macros/s/AKfycb123/exec'
  );
  assert.equal(ssrfHop.ok, false);
});

test('forwardToAppsScript follows POST -> 302 -> GET Google redirect and diagnoses HTML errors', async () => {
  const calls: Array<{ url: string; method: string; body?: unknown }> = [];
  const mockFetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const urlStr = String(url);
    calls.push({ url: urlStr, method: init?.method || 'GET', body: init?.body });
    if (calls.length === 1) {
      return new Response(null, {
        status: 302,
        headers: {
          location: 'https://script.googleusercontent.com/macros/echo?user_content_key=ok1',
        },
      });
    }
    return new Response(
      JSON.stringify({
        ok: true,
        spreadsheetName: 'Database SMANSA Kabun',
        updatedAt: '2026-11-26T00:00:00.000Z',
      }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  }) as typeof fetch;

  const pushRes = await forwardToAppsScript(
    {
      webAppUrl: 'https://script.google.com/macros/s/AKfycb123/exec',
      action: 'push',
      secret: 'KEY123',
      database: { students: [] },
    },
    mockFetch
  );

  assert.equal(pushRes.httpStatus, 200);
  assert.equal(pushRes.body.ok, true);
  assert.equal(pushRes.body.spreadsheetName, 'Database SMANSA Kabun');
  assert.equal(calls.length, 2);
  assert.equal(calls[0].method, 'POST');
  assert.equal(calls[1].method, 'GET');
  assert.equal(calls[1].body, undefined);

  const diagLogin = diagnoseAppsScriptHtmlResponse(
    '<html><title>Sign in - Google Accounts</title></html>',
    200
  );
  assert.match(diagLogin, /login/i);

  const diagFn = diagnoseAppsScriptHtmlResponse(
    'Script function not found: doGet',
    200
  );
  assert.match(diagFn, /doGet\/doPost/i);
});

test('parseQuestionsBulkText automatically preserves A-E or A-D options across pipe, CSV, and multiline formats', () => {
  // 1. Headerless pipe-delimited mix: 5-option PG (with & without explanation), 4-option PG, 5-option PGK
  const pipeInput = [
    'PG | Planet terbesar di tata surya? | Merkurius | Venus | Bumi | Mars | Jupiter | E | Jupiter adalah planet terbesar.',
    'PG | Unsur kimia dengan lambang O? | Hidrogen | Helium | Karbon | Nitrogen | Oksigen | E',
    'PG | Hasil 6 x 7 adalah? | 36 | 42 | 48 | 54 | B | 6 dikali 7 sama dengan 42.',
    'PGK | Pilih bilangan prima! | 2 | 4 | 6 | 9 | 11 | A,E | 2 dan 11 adalah bilangan prima.',
  ].join('\n');

  const pipeRes = parseQuestionsBulkText(pipeInput, 'pkg-ae');
  assert.equal(pipeRes.errors.length, 0);
  assert.equal(pipeRes.questions.length, 4);

  assert.deepEqual(
    pipeRes.questions[0].options?.map((o) => o.id),
    ['A', 'B', 'C', 'D', 'E']
  );
  assert.equal(pipeRes.questions[0].correctOptionId, 'E');
  assert.equal(pipeRes.questions[0].explanation, 'Jupiter adalah planet terbesar.');

  assert.deepEqual(
    pipeRes.questions[1].options?.map((o) => o.id),
    ['A', 'B', 'C', 'D', 'E']
  );
  assert.equal(pipeRes.questions[1].correctOptionId, 'E');

  assert.deepEqual(
    pipeRes.questions[2].options?.map((o) => o.id),
    ['A', 'B', 'C', 'D']
  );
  assert.equal(pipeRes.questions[2].correctOptionId, 'B');

  assert.deepEqual(
    pipeRes.questions[3].options?.map((o) => o.id),
    ['A', 'B', 'C', 'D', 'E']
  );
  assert.deepEqual(pipeRes.questions[3].correctOptionIds, ['A', 'E']);

  // 2. Quoted comma-separated CSV with header including OpsiE
  const csvInput = [
    'Tipe,Pertanyaan,OpsiA,OpsiB,OpsiC,OpsiD,OpsiE,Kunci,Pembahasan',
    'PG,"Ibu kota provinsi Riau, Indonesia, adalah?",Medan,Padang,Jambi,Palembang,Pekanbaru,E,"Pekanbaru adalah ibu kota Riau."',
    'PG,"Simbol kimia air?",CO2,H2O,NaCl,O2,,B,"Rumus air adalah H2O."',
  ].join('\n');
  const csvRes = parseQuestionsBulkText(csvInput, 'pkg-csv');
  assert.equal(csvRes.errors.length, 0);
  assert.equal(csvRes.questions.length, 2);
  assert.equal(csvRes.questions[0].options?.length, 5);
  assert.equal(csvRes.questions[0].options?.[4].text, 'Pekanbaru');
  assert.equal(csvRes.questions[0].correctOptionId, 'E');
  assert.equal(csvRes.questions[1].options?.length, 4);
  assert.equal(csvRes.questions[1].correctOptionId, 'B');

  // 3. Natural pasted multi-line Word/text question blocks (A-E and A-D)
  const multilineInput = `
1. Organel sel yang berfungsi sebagai tempat respirasi seluler adalah...
A. Ribosom
B. Lisosom
C. Badan Golgi
D. Vakuola
E. Mitokondria
Kunci: E
Pembahasan: Mitokondria menghasilkan ATP melalui respirasi seluler.

2. Hasil dari 15 + 25 adalah...
A. 30
B. 35
C. 40
D. 45
Kunci: C
`;
  const multiRes = parseQuestionsBulkText(multilineInput, 'pkg-word');
  assert.equal(multiRes.errors.length, 0);
  assert.equal(multiRes.questions.length, 2);
  assert.deepEqual(
    multiRes.questions[0].options?.map((o) => o.id),
    ['A', 'B', 'C', 'D', 'E']
  );
  assert.equal(multiRes.questions[0].correctOptionId, 'E');
  assert.match(multiRes.questions[0].explanation, /Mitokondria/);
  assert.deepEqual(
    multiRes.questions[1].options?.map((o) => o.id),
    ['A', 'B', 'C', 'D']
  );
  assert.equal(multiRes.questions[1].correctOptionId, 'C');

  // 4. Scoring works accurately when Option E is the answer
  const scoreRes = calculateExamScore(
    [pipeRes.questions[0], pipeRes.questions[3]],
    {
      [pipeRes.questions[0].id]: 'E',
      [pipeRes.questions[3].id]: ['E', 'A'],
    },
    75
  );
  assert.equal(scoreRes.score, 100);
  assert.equal(scoreRes.correctCount, 2);
  assert.equal(scoreRes.passed, true);
});

test('isWithinScheduleWindow handles :00 end minutes and 00:xx start hours accurately', () => {
  const schedule: SessionScheduleConfig = {
    tokenReleaseMode: 'manual',
    tokensReleased: true,
    enforceTimeWindow: true,
    accessStartTime: '00:00',
    accessEndTime: '09:00',
    autoReleaseDateTime: '07:00',
    emergencyForceFinishedAt: null,
  };

  assert.equal(
    isWithinScheduleWindow(schedule, new Date(2026, 10, 26, 0, 15, 0)).allowed,
    true
  );
  assert.equal(
    isWithinScheduleWindow(schedule, new Date(2026, 10, 26, 9, 0, 0)).allowed,
    true
  );
  assert.equal(
    isWithinScheduleWindow(schedule, new Date(2026, 10, 26, 9, 5, 0)).allowed,
    false
  );
});

test('shouldApplyRemotePull protects unpushed local imports from being overwritten by stale background pulls', () => {
  // 1. Background pull blocked when local changes are pending/unpushed
  const pendingGuard = shouldApplyRemotePull({
    isManual: false,
    hasPendingLocalChanges: true,
    pullStartedMutationVersion: 3,
    currentMutationVersion: 3,
    localLastSyncedAt: '2026-11-26T08:00:00.000Z',
    remoteUpdatedAt: '2026-11-26T09:00:00.000Z',
    localHasData: true,
    remoteHasData: true,
  });
  assert.equal(pendingGuard.apply, false);
  assert.equal(pendingGuard.reason, 'pending_local_changes');

  // 2. Background pull blocked when a local import happened while pull was in flight
  const midPullGuard = shouldApplyRemotePull({
    isManual: false,
    hasPendingLocalChanges: false,
    pullStartedMutationVersion: 2,
    currentMutationVersion: 3,
    localLastSyncedAt: '2026-11-26T08:00:00.000Z',
    remoteUpdatedAt: '2026-11-26T09:00:00.000Z',
    localHasData: true,
    remoteHasData: true,
  });
  assert.equal(midPullGuard.apply, false);
  assert.equal(midPullGuard.reason, 'stale_pull_during_mutation');

  // 3. Background pull blocked when remote snapshot is older or equal to local lastSyncedAt
  const staleTimestampGuard = shouldApplyRemotePull({
    isManual: false,
    hasPendingLocalChanges: false,
    pullStartedMutationVersion: 1,
    currentMutationVersion: 1,
    localLastSyncedAt: '2026-11-26T09:00:00.000Z',
    remoteUpdatedAt: '2026-11-26T08:55:00.000Z',
    localHasData: true,
    remoteHasData: true,
  });
  assert.equal(staleTimestampGuard.apply, false);
  assert.equal(staleTimestampGuard.reason, 'remote_not_newer');

  // 4. Background pull allowed when clean and remote is strictly newer
  const freshRemoteGuard = shouldApplyRemotePull({
    isManual: false,
    hasPendingLocalChanges: false,
    pullStartedMutationVersion: 1,
    currentMutationVersion: 1,
    localLastSyncedAt: '2026-11-26T08:00:00.000Z',
    remoteUpdatedAt: '2026-11-26T09:15:00.000Z',
    localHasData: true,
    remoteHasData: true,
  });
  assert.equal(freshRemoteGuard.apply, true);
  assert.equal(freshRemoteGuard.reason, 'newer_remote_data');

  // 5. Explicit manual Pull always allowed when remote has valid data
  const manualGuard = shouldApplyRemotePull({
    isManual: true,
    hasPendingLocalChanges: true,
    pullStartedMutationVersion: 1,
    currentMutationVersion: 4,
    localLastSyncedAt: '2026-11-26T10:00:00.000Z',
    remoteUpdatedAt: '2026-11-26T08:00:00.000Z',
    localHasData: true,
    remoteHasData: true,
  });
  assert.equal(manualGuard.apply, true);
  assert.equal(manualGuard.reason, 'manual_pull');
});

test('parseStudentsCSV handles Indonesian Excel semicolons, leading No column, and apostrophe-prefixed NISN', () => {
  const excelWithHeader = `No;NISN;Nama Lengkap;Kelas;Status
1;'0081112233;Aisyah Putri;X-IPA-1;Aktif
2;'0081112234;Budi Pratama;x-ipa-2;Diblokir`;

  const res1 = parseStudentsCSV(excelWithHeader);
  assert.equal(res1.errors.length, 0);
  assert.equal(res1.students.length, 2);
  assert.equal(res1.students[0].nisn, '0081112233');
  assert.equal(res1.students[0].name, 'Aisyah Putri');
  assert.equal(res1.students[0].className, 'X-IPA-1');
  assert.equal(res1.students[0].active, true);
  assert.equal(res1.students[1].nisn, '0081112234');
  assert.equal(res1.students[1].className, 'X-IPA-2');
  assert.equal(res1.students[1].active, false);

  // Headerless paste from Excel with leading No column
  const headerlessExcel = `1\t0089990001\tCitra Lestari\tXI-IPS-1
2\t0089990002\tDimas Anggara\tXI-IPS-2`;
  const res2 = parseStudentsCSV(headerlessExcel);
  assert.equal(res2.errors.length, 0);
  assert.equal(res2.students.length, 2);
  assert.equal(res2.students[0].nisn, '0089990001');
  assert.equal(res2.students[0].name, 'Citra Lestari');
  assert.equal(res2.students[1].className, 'XI-IPS-2');
});

test('generateGoogleAppsScriptCode guards formula cells and wraps readable mirror tabs in try/catch', () => {
  const code = generateGoogleAppsScriptCode({ syncSecret: 'rahasia', schoolName: 'SMAN 1 Kabun' });
  assert.match(code, /function safeSheetCell/);
  assert.match(code, /try\s*\{\s*mirrorReadableSheets\(ss, payload\.database\);/);
});

test('applyBulkUserStatus and applyBulkDeleteById update only selected records cleanly', () => {
  const users: StudentRecord[] = [
    { id: 's1', nisn: '001', name: 'Alya', className: 'X-IPA-1', active: true },
    { id: 's2', nisn: '002', name: 'Bima', className: 'X-IPA-1', active: true },
    { id: 's3', nisn: '003', name: 'Citra', className: 'X-IPA-2', active: true },
  ];

  const blocked = applyBulkUserStatus(users, ['s1', 's3'], false, 'Administrasi');
  assert.equal(blocked.affectedCount, 2);
  assert.equal(blocked.nextItems[0].active, false);
  assert.equal(blocked.nextItems[0].blockReason, 'Administrasi');
  assert.equal(blocked.nextItems[1].active, true);
  assert.equal(blocked.nextItems[2].active, false);

  const reactivated = applyBulkUserStatus(blocked.nextItems, ['s1'], true);
  assert.equal(reactivated.affectedCount, 1);
  assert.equal(reactivated.nextItems[0].active, true);
  assert.equal(reactivated.nextItems[0].blockReason, undefined);
  assert.equal(reactivated.nextItems[2].active, false);

  const deleted = applyBulkDeleteById(reactivated.nextItems, ['s2', 's3']);
  assert.equal(deleted.removedCount, 2);
  assert.deepEqual(
    deleted.nextItems.map((u) => u.id),
    ['s1']
  );
});

test('computeStudentExamProgress calculates overall and per-exam completion accurately', () => {
  const student: StudentRecord = {
    id: 'stu-1',
    nisn: '0081000001',
    name: 'Nadia Putri',
    className: 'XI D',
    active: true,
  };

  const packages: ExamPackage[] = [
    {
      id: 'pkg-1',
      teacherId: 't-1',
      title: 'UTS Bahasa Indonesia',
      subject: 'Bahasa Indonesia',
      targetClasses: ['XI D'],
      category: 'Ulangan Resmi',
      durationMinutes: 60,
      minSubmitMinutes: 15,
      kkm: 75,
      token: 'BI2026',
      shuffleQuestions: false,
      shuffleOptions: false,
      isPublished: true,
      createdAt: '2026-11-01T00:00:00.000Z',
    },
    {
      id: 'pkg-2',
      teacherId: 't-1',
      title: 'Latihan Matematika',
      subject: 'Matematika',
      targetClasses: ['XI D'],
      category: 'Latihan Mandiri',
      durationMinutes: 45,
      minSubmitMinutes: 0,
      kkm: 75,
      token: 'MTK2026',
      shuffleQuestions: false,
      shuffleOptions: false,
      isPublished: true,
      createdAt: '2026-11-02T00:00:00.000Z',
    },
    {
      id: 'pkg-3',
      teacherId: 't-1',
      title: 'Ujian Fisika',
      subject: 'Fisika',
      targetClasses: ['XI D'],
      category: 'Ulangan Resmi',
      durationMinutes: 60,
      minSubmitMinutes: 15,
      kkm: 75,
      token: 'FIS2026',
      shuffleQuestions: false,
      shuffleOptions: false,
      isPublished: true,
      createdAt: '2026-11-03T00:00:00.000Z',
    },
    {
      id: 'pkg-other-class',
      teacherId: 't-1',
      title: 'Ujian Kelas XII',
      subject: 'Biologi',
      targetClasses: ['XII A'],
      category: 'Ulangan Resmi',
      durationMinutes: 60,
      minSubmitMinutes: 15,
      kkm: 75,
      token: 'BIO2026',
      shuffleQuestions: false,
      shuffleOptions: false,
      isPublished: true,
      createdAt: '2026-11-03T00:00:00.000Z',
    },
  ];

  const questions: Question[] = [
    {
      id: 'q-1',
      packageId: 'pkg-1',
      type: 'single_choice',
      prompt: 'Soal 1',
      options: [
        { id: 'A', text: 'Satu' },
        { id: 'B', text: 'Dua' },
      ],
      correctOptionId: 'A',
      points: 10,
      explanation: 'Pembahasan',
    },
    {
      id: 'q-2a',
      packageId: 'pkg-2',
      type: 'single_choice',
      prompt: 'Soal 2A',
      options: [
        { id: 'A', text: 'Benar' },
        { id: 'B', text: 'Salah' },
      ],
      correctOptionId: 'A',
      points: 5,
      explanation: 'Pembahasan',
    },
    {
      id: 'q-2b',
      packageId: 'pkg-2',
      type: 'single_choice',
      prompt: 'Soal 2B',
      options: [
        { id: 'A', text: 'Benar' },
        { id: 'B', text: 'Salah' },
      ],
      correctOptionId: 'A',
      points: 5,
      explanation: 'Pembahasan',
    },
  ];

  const attempts: ExamAttempt[] = [
    {
      id: 'att-1',
      packageId: 'pkg-1',
      studentId: 'stu-1',
      studentNisn: '0081000001',
      studentName: 'Nadia Putri',
      className: 'XI D',
      status: 'completed',
      startedAt: '2026-11-26T08:00:00.000Z',
      submittedAt: '2026-11-26T08:30:00.000Z',
      extraMinutes: 0,
      currentQuestionIndex: 0,
      questionOrder: ['q-1'],
      optionOrders: {},
      answers: { 'q-1': 'A' },
      flaggedQuestionIds: [],
      violationCount: 0,
      score: 90,
      correctCount: 1,
      totalQuestions: 1,
      passed: true,
    },
    {
      id: 'att-2',
      packageId: 'pkg-2',
      studentId: 'stu-1',
      studentNisn: '0081000001',
      studentName: 'Nadia Putri',
      className: 'XI D',
      status: 'in_progress',
      startedAt: '2026-11-26T09:00:00.000Z',
      extraMinutes: 0,
      currentQuestionIndex: 1,
      questionOrder: ['q-2a', 'q-2b'],
      optionOrders: {},
      answers: { 'q-2a': 'A' },
      flaggedQuestionIds: [],
      violationCount: 0,
    },
  ];

  const summary = computeStudentExamProgress({
    student,
    packages,
    questions,
    attempts,
  });

  assert.equal(summary.totalAssigned, 3);
  assert.equal(summary.completedCount, 1);
  assert.equal(summary.inProgressCount, 1);
  assert.equal(summary.notStartedCount, 1);
  assert.equal(summary.completionPercent, 33);
  assert.equal(summary.averageScore, 90);
  // Ordering: in_progress first, not_started second, completed third
  assert.deepEqual(
    summary.items.map((i) => i.examPackage.id),
    ['pkg-2', 'pkg-3', 'pkg-1']
  );
  assert.equal(summary.items[0].itemCompletionPercent, 50);
  assert.equal(summary.items[0].answeredCount, 1);
  assert.equal(summary.items[1].itemCompletionPercent, 0);
  assert.equal(summary.items[2].itemCompletionPercent, 100);
});

test('isAttemptViolationLocked and resolveEffectiveAttemptStatus prevent locked students from showing +5 Menit', () => {
  const baseAttempt: ExamAttempt = {
    id: 'att-lock-1',
    packageId: 'pkg-1',
    studentId: 'stu-1',
    studentNisn: '0097740630',
    studentName: 'ALDANIA ARRAHMA',
    className: 'XI D',
    status: 'locked',
    startedAt: '2026-11-28T02:53:31.339Z',
    extraMinutes: 0,
    currentQuestionIndex: 10,
    questionOrder: ['q1'],
    optionOrders: {},
    answers: {},
    flaggedQuestionIds: [],
    violationCount: 4,
    lockReason: 'Terkunci Sistem (Indikasi Kecurangan)',
  };

  assert.equal(normalizeAttemptStatus(' LOCKED '), 'locked');
  assert.equal(normalizeAttemptStatus('in_progress'), 'in_progress');
  assert.equal(isAttemptViolationLocked(baseAttempt, 3), true);
  assert.equal(resolveEffectiveAttemptStatus(baseAttempt, 3), 'locked');

  // Even if status drifted to in_progress while lockReason or >maxViolationTolerance remains, MUST resolve to locked!
  const driftedLockReason: ExamAttempt = {
    ...baseAttempt,
    status: 'in_progress',
    violationCount: 2,
    lockReason: 'Terkunci Sistem (Indikasi Kecurangan)',
  };
  assert.equal(resolveEffectiveAttemptStatus(driftedLockReason, 3), 'locked');

  const exceededTolerance: ExamAttempt = {
    ...baseAttempt,
    status: 'in_progress',
    lockReason: undefined,
    violationCount: 4,
  };
  assert.equal(resolveEffectiveAttemptStatus(exceededTolerance, 3), 'locked');

  // Completed attempt with historical violations stays completed
  const completedWithWarnings: ExamAttempt = {
    ...baseAttempt,
    status: 'completed',
    lockReason: undefined,
    violationCount: 4,
  };
  assert.equal(resolveEffectiveAttemptStatus(completedWithWarnings, 3), 'completed');

  // Unlocked attempt (violationCount reset, no lockReason) resolves cleanly to in_progress
  const unlockedAttempt: ExamAttempt = {
    ...baseAttempt,
    status: 'in_progress',
    lockReason: undefined,
    violationCount: 0,
    unlockedAt: '2026-11-28T03:10:00.000Z',
  };
  assert.equal(resolveEffectiveAttemptStatus(unlockedAttempt, 3), 'in_progress');
});

test('findStudentPackageAttempt matches by NISN after re-import and prioritizes locked attempts over stale duplicates', () => {
  const student: Pick<StudentRecord, 'id' | 'nisn'> = {
    id: 'stu-fs-new-id',
    nisn: '0097740630',
  };

  const staleInProgress: ExamAttempt = {
    id: 'att-old',
    packageId: 'pkg-1',
    studentId: 'stu-fs-new-id',
    studentNisn: '0097740630',
    studentName: 'ALDANIA ARRAHMA',
    className: 'XI D',
    status: 'in_progress',
    startedAt: '2026-11-28T02:50:00.000Z',
    extraMinutes: 0,
    currentQuestionIndex: 1,
    questionOrder: ['q1'],
    optionOrders: {},
    answers: {},
    flaggedQuestionIds: [],
    violationCount: 0,
  };

  const lockedByOldId: ExamAttempt = {
    ...staleInProgress,
    id: 'att-locked',
    studentId: 'stu-csv-1795749933416-271',
    status: 'locked',
    violationCount: 4,
    lockReason: 'Terkunci Sistem (Indikasi Kecurangan)',
    submittedAt: '2026-11-28T02:56:17.096Z',
  };

  const matched = findStudentPackageAttempt(
    [staleInProgress, lockedByOldId],
    student,
    'pkg-1',
    3
  );
  assert.equal(matched?.id, 'att-locked');
  assert.equal(resolveEffectiveAttemptStatus(matched, 3), 'locked');
});

test('computeUnlockExtraMinutes guarantees resume time when exam expired while locked', () => {
  const startedAt = '2026-11-28T01:00:00.000Z';
  const durationMinutes = 60;
  // 20 minutes after start -> 40 min left -> no extra minutes needed
  const stillHasTime = computeUnlockExtraMinutes(
    { startedAt, extraMinutes: 0 },
    durationMinutes,
    Date.parse('2026-11-28T01:20:00.000Z'),
    10
  );
  assert.equal(stillHasTime, 0);

  // 90 minutes after start (already 30 min past original end) -> grants enough extraMinutes for 10 min resume
  const expiredWhileLocked = computeUnlockExtraMinutes(
    { startedAt, extraMinutes: 0 },
    durationMinutes,
    Date.parse('2026-11-28T02:30:00.000Z'),
    10
  );
  assert.equal(expiredWhileLocked, 40);
});

test('mergeExamAttempts preserves newer teacher unlock against stale remote locked snapshot', () => {
  const remoteStaleLocked: ExamAttempt = {
    id: 'att-1',
    packageId: 'pkg-1',
    studentId: 'stu-1',
    studentNisn: '0097740630',
    studentName: 'ALDANIA ARRAHMA',
    className: 'XI D',
    status: 'locked',
    startedAt: '2026-11-28T02:53:31.339Z',
    submittedAt: '2026-11-28T02:56:17.096Z',
    extraMinutes: 0,
    currentQuestionIndex: 49,
    questionOrder: ['q1'],
    optionOrders: {},
    answers: { q1: 'A' },
    flaggedQuestionIds: [],
    violationCount: 4,
    lockReason: 'Terkunci Sistem (Indikasi Kecurangan)',
  };

  const localUnlocked: ExamAttempt = {
    ...remoteStaleLocked,
    status: 'in_progress',
    submittedAt: undefined,
    lockReason: undefined,
    violationCount: 0,
    unlockedAt: '2026-11-28T03:05:00.000Z',
    updatedAt: '2026-11-28T03:05:00.000Z',
  };

  // Teacher unlocked locally, then stale remote locked snapshot arrives -> keep unlocked!
  const mergedTeacherSide = mergeExamAttempts([localUnlocked], [remoteStaleLocked], 3);
  assert.equal(mergedTeacherSide.length, 1);
  assert.equal(mergedTeacherSide[0].status, 'in_progress');
  assert.equal(mergedTeacherSide[0].violationCount, 0);

  // Student is locked locally, teacher unlocks remotely -> student pull receives unlock!
  const mergedStudentSide = mergeExamAttempts([remoteStaleLocked], [localUnlocked], 3);
  assert.equal(mergedStudentSide.length, 1);
  assert.equal(mergedStudentSide[0].status, 'in_progress');
  assert.equal(mergedStudentSide[0].unlockedAt, '2026-11-28T03:05:00.000Z');
});

test('evaluateEssayAnswerSemantic grades exact, paraphrased, partial, and empty answers proportionally', () => {
  const answerKey =
    'Fotosintesis adalah proses tumbuhan hijau mengubah energi cahaya matahari, air, dan karbon dioksida menjadi glukosa serta oksigen.';
  const keywords = ['tumbuhan', 'cahaya matahari', 'air', 'karbon dioksida', 'glukosa', 'oksigen'];

  // 1. Exact match -> 100%
  const exact = evaluateEssayAnswerSemantic(answerKey, answerKey, keywords, 20);
  assert.equal(exact.matchPercent, 100);
  assert.equal(exact.earnedPoints, 20);
  assert.equal(exact.isCorrect, true);

  // 2. Different diction with the exact same semantic meaning -> high score & proportional points
  const paraphrased = evaluateEssayAnswerSemantic(
    'Asimilasi merupakan mekanisme tanaman berklorofil mengkonversi sinar surya, H2O, dan CO2 untuk memproduksi gula karbohidrat beserta O2.',
    answerKey,
    keywords,
    20
  );
  assert.ok(
    paraphrased.matchPercent >= 75,
    `Expected paraphrased matchPercent >= 75, got ${paraphrased.matchPercent}`
  );
  assert.equal(paraphrased.isCorrect, true);
  assert.ok(paraphrased.earnedPoints >= 15 && paraphrased.earnedPoints <= 20);

  // 3. Partial answer -> intermediate proportional points
  const partial = evaluateEssayAnswerSemantic(
    'Tanaman memakai sinar matahari dan air untuk menghasilkan gula.',
    answerKey,
    keywords,
    20
  );
  assert.ok(partial.earnedPoints > 0 && partial.earnedPoints < 20);

  // 4. Empty or completely unrelated answer -> 0 points
  const empty = evaluateEssayAnswerSemantic('   ', answerKey, keywords, 20);
  assert.equal(empty.earnedPoints, 0);
  assert.equal(empty.matchPercent, 0);
  assert.equal(empty.isCorrect, false);

  const unrelated = evaluateEssayAnswerSemantic(
    'Sepak bola dimainkan oleh sebelas pemain di stadion rumput.',
    answerKey,
    keywords,
    20
  );
  assert.equal(unrelated.isCorrect, false);
  assert.ok(unrelated.matchPercent < 20);
});

test('validateEssayQuestionLimit enforces 5 to 10 essay questions per package', () => {
  assert.equal(MIN_ESSAY_QUESTIONS, 5);
  assert.equal(MAX_ESSAY_QUESTIONS, 10);

  const makeEssay = (i: number, pkg = 'pkg-e'): Question => ({
    id: `qe-${i}`,
    packageId: pkg,
    type: 'essay',
    prompt: `Esai ${i}`,
    essayAnswerKey: `Kunci esai ${i}`,
    points: 20,
    explanation: '',
  });

  // 0 essays -> valid (not an essay package)
  const zero = validateEssayQuestionLimit([], 'pkg-e');
  assert.equal(zero.isValidRange, true);
  assert.equal(zero.isUnderMin, false);
  assert.equal(zero.canAddMore, true);

  // 3 essays -> under minimum 5
  const three = validateEssayQuestionLimit([1, 2, 3].map((i) => makeEssay(i)), 'pkg-e');
  assert.equal(three.essayCount, 3);
  assert.equal(three.isUnderMin, true);
  assert.equal(three.isValidRange, false);
  assert.equal(three.canAddMore, true);

  // 5 essays -> valid
  const five = validateEssayQuestionLimit([1, 2, 3, 4, 5].map((i) => makeEssay(i)), 'pkg-e');
  assert.equal(five.essayCount, 5);
  assert.equal(five.isUnderMin, false);
  assert.equal(five.isValidRange, true);
  assert.equal(five.canAddMore, true);

  // 10 essays -> valid and at max
  const ten = validateEssayQuestionLimit(
    Array.from({ length: 10 }, (_, idx) => makeEssay(idx + 1)),
    'pkg-e'
  );
  assert.equal(ten.essayCount, 10);
  assert.equal(ten.isValidRange, true);
  assert.equal(ten.isAtMax, true);
  assert.equal(ten.canAddMore, false);
});

test('autoDistributePackagePoints balances target package questions to exact total 100 without touching other packages', () => {
  const mixed: Question[] = [
    ...Array.from({ length: 6 }, (_, i) => ({
      id: `p1-q${i + 1}`,
      packageId: 'pkg-1',
      type: 'essay' as const,
      prompt: `Soal esai ${i + 1}`,
      essayAnswerKey: `Kunci ${i + 1}`,
      points: 10,
      explanation: '',
    })),
    {
      id: 'p2-q1',
      packageId: 'pkg-2',
      type: 'single_choice',
      prompt: 'Paket lain',
      options: [
        { id: 'A', text: '1' },
        { id: 'B', text: '2' },
      ],
      correctOptionId: 'A',
      points: 50,
      explanation: '',
    },
  ];

  const balanced = autoDistributePackagePoints(mixed, 'pkg-1', 100);
  const pkg1Total = Number(
    balanced
      .filter((q) => q.packageId === 'pkg-1')
      .reduce((sum, q) => sum + q.points, 0)
      .toFixed(2)
  );
  assert.equal(pkg1Total, 100);
  assert.equal(balanced.find((q) => q.id === 'p2-q1')?.points, 50);
});

test('parseQuestionsBulkText parses ESAI lines and calculateExamScore returns essayGrades', () => {
  const bulk =
    'ESAI | Jelaskan pengertian inflasi! | Inflasi adalah kenaikan harga barang dan jasa secara umum dan terus menerus dalam jangka waktu tertentu. | kenaikan harga;barang jasa;terus menerus | Inflasi menurunkan daya beli uang.';
  const parsed = parseQuestionsBulkText(bulk, 'pkg-esai');
  assert.equal(parsed.errors.length, 0);
  assert.equal(parsed.questions.length, 1);
  assert.equal(parsed.questions[0].type, 'essay');
  assert.match(parsed.questions[0].essayAnswerKey ?? '', /kenaikan harga/i);
  assert.deepEqual(parsed.questions[0].essayKeywords, [
    'kenaikan harga',
    'barang jasa',
    'terus menerus',
  ]);

  const scored = calculateExamScore(
    parsed.questions,
    {
      [parsed.questions[0].id]:
        'Inflasi merupakan lonjakan harga produk dan jasa secara meluas yang berlangsung terus menerus.',
    },
    75
  );
  assert.ok(scored.score >= 70, `Expected essay score >= 70, got ${scored.score}`);
  assert.ok(scored.essayGrades[parsed.questions[0].id]);
  assert.ok(scored.essayGrades[parsed.questions[0].id].matchPercent >= 70);
});

test('teacher-activated packages (allowIndependentAccess) bypass admin schedule hold for Ulangan, Latihan, and UTS', () => {
  const students: StudentRecord[] = [
    { id: 's1', nisn: '0089001122', name: 'Rizky Pratama', className: 'X-IPA-1', active: true },
  ];
  const teacherActivatedPkg: ExamPackage = {
    id: 'pkg-uts-guru',
    teacherId: 't1',
    title: 'UTS Biologi Mandiri',
    subject: 'Biologi',
    targetClasses: ['X-IPA-1'],
    category: 'UTS / PTS',
    durationMinutes: 60,
    minSubmitMinutes: 10,
    kkm: 75,
    token: 'UTSBI01',
    shuffleQuestions: true,
    shuffleOptions: true,
    isPublished: true,
    allowIndependentAccess: true,
    teacherActivatedAt: '2026-11-27T10:00:00.000Z',
    createdAt: '2026-11-27T09:00:00.000Z',
  };
  const closedSchedule: SessionScheduleConfig = {
    tokenReleaseMode: 'manual',
    tokensReleased: false,
    enforceTimeWindow: true,
    accessStartTime: '07:00',
    accessEndTime: '08:00',
    autoReleaseDateTime: '07:00',
    emergencyForceFinishedAt: null,
  };
  const afternoonTime = new Date(2026, 10, 27, 14, 30, 0);

  const lookup = lookupStudentAvailableTokens({
    nisn: '0089001122',
    students,
    packages: [teacherActivatedPkg],
    schedule: closedSchedule,
    now: afternoonTime,
  });
  assert.equal(lookup.status, 'ready');
  if (lookup.status === 'ready') {
    assert.equal(lookup.packages.length, 1);
    assert.equal(lookup.packages[0].token, 'UTSBI01');
  }

  const login = validateStudentLogin({
    nisn: '0089001122',
    token: 'UTSBI01',
    students,
    packages: [teacherActivatedPkg],
    schedule: closedSchedule,
    now: afternoonTime,
  });
  assert.equal(login.ok, true);
  assert.equal(login.examPackage?.id, 'pkg-uts-guru');
});

test('upgraded evaluateCameraBehavior detects eyeYaw, looking down, missing face, and multiple faces', () => {
  const yawStep1 = evaluateCameraBehavior({
    horizontalShift: 0.04,
    eyeYawScore: -0.22,
    lateralMotionScore: 0.05,
    audioRms: 0.01,
    consecutiveTurnFrames: 0,
    consecutiveSpeechFrames: 0,
  });
  assert.equal(yawStep1.status, 'looking_away');
  assert.equal(yawStep1.shouldFlagViolation, false);
  assert.equal(yawStep1.nextTurnFrames, 1);

  const yawStep2 = evaluateCameraBehavior({
    horizontalShift: 0.04,
    eyeYawScore: -0.22,
    lateralMotionScore: 0.05,
    audioRms: 0.01,
    consecutiveTurnFrames: yawStep1.nextTurnFrames,
    consecutiveSpeechFrames: 0,
  });
  assert.equal(yawStep2.shouldFlagViolation, true);
  assert.match(yawStep2.violationDetail ?? '', /ke kiri/i);

  const lookDown = evaluateCameraBehavior({
    horizontalShift: 0.01,
    verticalShift: 0.24,
    lateralMotionScore: 0.02,
    audioRms: 0.01,
    consecutiveTurnFrames: 0,
    consecutiveSpeechFrames: 0,
    consecutiveVerticalFrames: 1,
  });
  assert.equal(lookDown.status, 'looking_down');
  assert.equal(lookDown.shouldFlagViolation, true);
  assert.match(lookDown.violationType ?? '', /Menunduk/i);

  const noFace = evaluateCameraBehavior({
    horizontalShift: 0,
    lateralMotionScore: 0,
    audioRms: 0,
    faceDetected: false,
    faceCount: 0,
    consecutiveTurnFrames: 0,
    consecutiveSpeechFrames: 0,
    consecutiveMissingFaceFrames: 1,
  });
  assert.equal(noFace.status, 'no_face');
  assert.equal(noFace.shouldFlagViolation, true);
  assert.match(noFace.violationType ?? '', /Wajah Tidak Terdeteksi/i);

  const multiFace = evaluateCameraBehavior({
    horizontalShift: 0,
    lateralMotionScore: 0,
    audioRms: 0,
    faceDetected: true,
    faceCount: 2,
    consecutiveTurnFrames: 0,
    consecutiveSpeechFrames: 0,
    consecutiveMissingFaceFrames: 1,
  });
  assert.equal(multiFace.status, 'multiple_faces');
  assert.equal(multiFace.shouldFlagViolation, true);
  assert.match(multiFace.violationType ?? '', /Lebih dari 1 Wajah/i);
});

test('buildViolationVoiceMessage generates tailored Indonesian female reprimands', () => {
  const ssMsg = buildViolationVoiceMessage({
    type: 'Upaya Screenshot / Cetak Layar',
    severity: 'warning',
    count: 1,
    maxTolerance: 3,
  });
  assert.match(ssMsg, /tangkapan layar/i);
  assert.match(ssMsg, /peringatan ke 1 dari 3/i);

  const notifMsg = buildViolationVoiceMessage({
    type: 'Membuka Bilah Notifikasi / Geser Tepi Atas',
    severity: 'warning',
    count: 2,
    maxTolerance: 3,
  });
  assert.match(notifMsg, /bilah notifikasi/i);

  const camMsg = buildViolationVoiceMessage({
    type: 'Deteksi Kamera: Melihat Kanan / Kiri',
    severity: 'warning',
  });
  assert.match(camMsg, /menoleh/i);

  const lockedMsg = buildViolationVoiceMessage({
    type: 'Pindah Tab',
    severity: 'critical',
  });
  assert.match(lockedMsg, /dikunci otomatis/i);
});







