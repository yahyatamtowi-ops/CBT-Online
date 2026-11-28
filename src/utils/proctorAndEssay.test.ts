import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateEssayAnswerSemantic,
  filterActiveToiletRequests,
  getProctorEffectiveClassesForPackage,
  getProctorScopedPackages,
  validateProctorLogin,
} from './cbtLogic';
import { classifyViolation } from './violationAnalytics';
import type {
  ExamPackage,
  ProctorAccount,
  ProctorConfig,
  TeacherAccount,
  ToiletPermissionRequest,
} from '../types/cbt';

describe('High-Precision Essay Semantic Grading', () => {
  it('awards high score (>= 0.75) for accurate paraphrase with different diction', () => {
    const res = evaluateEssayAnswerSemantic(
      'Tumbuhan hijau memanfaatkan sinar mentari bersama air dan karbon dioksida untuk membuat zat makanan berupa glukosa serta melepaskan gas oksigen.',
      'Fotosintesis adalah proses tumbuhan menggunakan cahaya matahari, air, dan CO2 untuk menghasilkan glukosa dan oksigen.',
      ['cahaya matahari', 'air', 'glukosa', 'oksigen'],
      20,
      'Jelaskan proses fotosintesis pada tumbuhan hijau!'
    );
    assert.ok(
      res.scoreRatio >= 0.75,
      `Expected >= 0.75 for valid paraphrase, got ${res.scoreRatio} (${res.feedback})`
    );
    assert.ok(res.earnedPoints >= 15);
  });

  it('heavily penalizes negation reversal even when keywords match', () => {
    const res = evaluateEssayAnswerSemantic(
      'Proses fotosintesis tidak memerlukan cahaya matahari, tidak membutuhkan air, dan bukan menghasilkan oksigen.',
      'Fotosintesis memerlukan cahaya matahari dan air untuk menghasilkan glukosa dan oksigen.',
      ['cahaya matahari', 'air', 'oksigen'],
      20,
      'Jelaskan syarat terjadinya fotosintesis!'
    );
    assert.ok(
      res.scoreRatio <= 0.35,
      `Expected heavy negation penalty <= 0.35, got ${res.scoreRatio} (${res.feedback})`
    );
  });

  it('penalizes antonym contradiction (berkurang vs meningkat)', () => {
    const res = evaluateEssayAnswerSemantic(
      'Ketika suhu dinaikkan, energi kinetik partikel menurun dan laju reaksi kimia berkurang.',
      'Ketika suhu dinaikkan, energi kinetik partikel meningkat sehingga laju reaksi kimia bertambah cepat.',
      [],
      10,
      'Bagaimana pengaruh kenaikan suhu terhadap laju reaksi?'
    );
    assert.ok(
      res.scoreRatio <= 0.45,
      `Expected antonym contradiction penalty <= 0.45, got ${res.scoreRatio} (${res.feedback})`
    );
  });

  it('penalizes wrong critical numeric facts (year/value mismatch)', () => {
    const res = evaluateEssayAnswerSemantic(
      'Proklamasi kemerdekaan Republik Indonesia dibacakan oleh Soekarno dan Hatta pada tanggal 17 Agustus 1949.',
      'Proklamasi kemerdekaan Indonesia dibacakan pada tanggal 17 Agustus 1945 oleh Ir. Soekarno dan Drs. Mohammad Hatta.',
      [],
      10,
      'Kapan dan oleh siapa Proklamasi Kemerdekaan Indonesia dibacakan?'
    );
    const exactRes = evaluateEssayAnswerSemantic(
      'Proklamasi kemerdekaan Republik Indonesia dibacakan oleh Soekarno dan Hatta pada tanggal 17 Agustus 1945.',
      'Proklamasi kemerdekaan Indonesia dibacakan pada tanggal 17 Agustus 1945 oleh Ir. Soekarno dan Drs. Mohammad Hatta.',
      [],
      10,
      'Kapan dan oleh siapa Proklamasi Kemerdekaan Indonesia dibacakan?'
    );
    assert.ok(
      res.scoreRatio < exactRes.scoreRatio,
      `Wrong year (${res.scoreRatio}) must score strictly lower than exact year (${exactRes.scoreRatio})`
    );
  });

  it('rejects prompt-copying answers with very low score', () => {
    const prompt =
      'Jelaskan dampak perubahan iklim global terhadap ekosistem pesisir dan terumbu karang di Indonesia';
    const res = evaluateEssayAnswerSemantic(
      'Jelaskan dampak perubahan iklim global terhadap ekosistem pesisir dan terumbu karang di Indonesia.',
      'Kenaikan suhu air laut menyebabkan pemutihan terumbu karang, abrasi pantai, dan naiknya permukaan air laut yang merusak habitat pesisir.',
      [],
      20,
      prompt
    );
    assert.ok(
      res.scoreRatio <= 0.2,
      `Prompt-copy must be rejected <= 0.2, got ${res.scoreRatio} (${res.feedback})`
    );
  });
});

describe('Proctor Login, Package Scoping & Toilet Permission Filtering', () => {
  const proctors: ProctorAccount[] = [
    {
      id: 'proc-1',
      name: 'Budi Pengawas',
      username: 'pengawas1',
      password: 'secret',
      nip: '19880101',
      assignedPackageIds: ['pkg-a'],
      assignedClasses: ['XII IPA 1'],
      active: true,
    },
    {
      id: 'proc-2',
      name: 'Pengawas Nonaktif',
      username: 'pengawas_off',
      password: 'secret',
      assignedPackageIds: [],
      assignedClasses: [],
      active: false,
    },
  ];

  const teachers: TeacherAccount[] = [
    {
      id: 't-1',
      nip: '19750101',
      name: 'Siti Guru',
      username: 'siti',
      password: 'guru123',
      subjects: ['Matematika'],
      classes: ['XII IPA 1', 'XII IPA 2'],
      active: true,
    },
  ];

  const packages: ExamPackage[] = [
    {
      id: 'pkg-a',
      teacherId: 't-1',
      title: 'UTS Matematika',
      subject: 'Matematika',
      targetClasses: ['XII IPA 1', 'XII IPA 2'],
      category: 'UTS / PTS',
      durationMinutes: 90,
      minSubmitMinutes: 15,
      kkm: 75,
      token: 'MTK1',
      shuffleQuestions: false,
      shuffleOptions: false,
      isPublished: true,
      createdAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'pkg-b',
      teacherId: 't-1',
      title: 'UTS Fisika',
      subject: 'Fisika',
      targetClasses: ['XII IPS 1'],
      category: 'UTS / PTS',
      durationMinutes: 90,
      minSubmitMinutes: 15,
      kkm: 75,
      token: 'FIS1',
      shuffleQuestions: false,
      shuffleOptions: false,
      isPublished: true,
      createdAt: '2026-01-01T00:00:00Z',
    },
  ];

  it('blocks login when proctor mode is disabled by Super Admin', () => {
    const config: ProctorConfig = {
      enabled: false,
      allowTeacherAccountsAsProctor: true,
      teacherAssignments: {},
    };
    const res = validateProctorLogin({
      username: 'pengawas1',
      password: 'secret',
      proctorConfig: config,
      proctors,
      teachers,
    });
    assert.equal(res.ok, false);
    assert.match(res.error || '', /dinonaktifkan/i);
  });

  it('authenticates dedicated active proctor and rejects inactive proctor', () => {
    const config: ProctorConfig = {
      enabled: true,
      allowTeacherAccountsAsProctor: false,
      teacherAssignments: {},
    };
    const okRes = validateProctorLogin({
      username: 'pengawas1',
      password: 'secret',
      proctorConfig: config,
      proctors,
      teachers,
    });
    assert.equal(okRes.ok, true);
    assert.equal(okRes.proctorSource, 'proctor');
    assert.deepEqual(okRes.assignedPackageIds, ['pkg-a']);
    assert.deepEqual(okRes.assignedClasses, ['XII IPA 1']);

    const offRes = validateProctorLogin({
      username: 'pengawas_off',
      password: 'secret',
      proctorConfig: config,
      proctors,
      teachers,
    });
    assert.equal(offRes.ok, false);
  });

  it('honors allowTeacherAccountsAsProctor and teacherAssignments overrides', () => {
    const allowedConfig: ProctorConfig = {
      enabled: true,
      allowTeacherAccountsAsProctor: true,
      teacherAssignments: {
        't-1': {
          assignedPackageIds: ['pkg-b'],
          assignedClasses: ['XII IPS 1'],
        },
      },
    };
    const okRes = validateProctorLogin({
      username: 'siti',
      password: 'guru123',
      proctorConfig: allowedConfig,
      proctors,
      teachers,
    });
    assert.equal(okRes.ok, true);
    assert.equal(okRes.proctorSource, 'teacher');
    assert.deepEqual(okRes.assignedPackageIds, ['pkg-b']);
    assert.deepEqual(okRes.assignedClasses, ['XII IPS 1']);

    const blockedConfig: ProctorConfig = {
      enabled: true,
      allowTeacherAccountsAsProctor: false,
      teacherAssignments: {},
    };
    const blockedRes = validateProctorLogin({
      username: 'siti',
      password: 'guru123',
      proctorConfig: blockedConfig,
      proctors,
      teachers,
    });
    assert.equal(blockedRes.ok, false);
  });

  it('scopes packages, effective classes, and active toilet requests properly', () => {
    const scoped = getProctorScopedPackages(packages, ['pkg-a'], ['XII IPA 1']);
    assert.deepEqual(
      scoped.map((p) => p.id),
      ['pkg-a']
    );
    assert.deepEqual(
      getProctorEffectiveClassesForPackage(packages[0], ['XII IPA 1']),
      ['XII IPA 1']
    );

    const requests: ToiletPermissionRequest[] = [
      {
        id: 'req-1',
        attemptId: 'att-1',
        studentId: 's-1',
        studentNisn: '001',
        studentName: 'Ahmad',
        className: 'XII IPA 1',
        packageId: 'pkg-a',
        packageTitle: 'UTS Matematika',
        reason: 'Izin ke Toilet',
        status: 'pending',
        requestedAt: '2026-06-01T08:05:00Z',
      },
      {
        id: 'req-2',
        attemptId: 'att-2',
        studentId: 's-2',
        studentNisn: '002',
        studentName: 'Bina',
        className: 'XII IPA 2',
        packageId: 'pkg-a',
        packageTitle: 'UTS Matematika',
        reason: 'Izin ke Toilet',
        status: 'confirmed',
        requestedAt: '2026-06-01T08:04:00Z',
      },
      {
        id: 'req-3',
        attemptId: 'att-3',
        studentId: 's-3',
        studentNisn: '003',
        studentName: 'Cici',
        className: 'XII IPA 1',
        packageId: 'pkg-a',
        packageTitle: 'UTS Matematika',
        reason: 'Izin ke Toilet',
        status: 'returned',
        requestedAt: '2026-06-01T08:01:00Z',
      },
    ];

    const proctorVisible = filterActiveToiletRequests({
      requests,
      role: 'proctor',
      allowedPackageIds: ['pkg-a'],
      allowedClasses: ['XII IPA 1'],
    });
    assert.deepEqual(
      proctorVisible.map((r) => r.id),
      ['req-1']
    );

    const adminVisible = filterActiveToiletRequests({
      requests,
      role: 'admin',
    });
    assert.deepEqual(
      adminVisible.map((r) => r.id),
      ['req-1', 'req-2']
    );
  });
});

describe('Screenshot / Screen Capture Violation Classification', () => {
  it('classifies screenshot, PrintScreen, screen capture, and 3-finger gestures as high-severity screenshot_print', () => {
    const samples = [
      ['Percobaan Screenshot / Cetak', 'Siswa menekan tombol PrintScreen saat ujian berlangsung.'],
      ['Deteksi Tangkapan Layar', 'Gestur 3 jari screenshot terdeteksi pada perangkat HP.'],
      ['Screen Capture Blocked', 'Upaya rekam layar (getDisplayMedia) dicegah sistem.'],
    ];
    for (const [type, detail] of samples) {
      const cat = classifyViolation(type, detail);
      assert.equal(cat.id, 'screenshot_print', `Expected screenshot_print for "${type}"`);
      assert.equal(cat.severity, 'high');
    }
  });
});
