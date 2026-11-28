import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateCameraBehavior,
  parseBulkClassNames,
  parseQuestionsBulkText,
  parseStudentsCSV,
  parseTeachersCSV,
} from './cbtLogic';
import { parseExamSchedulesCSV } from './examScheduleImport';
import {
  buildXlsxBufferFromRows,
  parseXlsxBufferToCsv,
} from './spreadsheetImport';

test('parseBulkClassNames parses multi-line, comma, semicolon, and pipe lists with deduplication', () => {
  const raw = 'x ipa 1, X IPA 2; X-IPS-1\nX-IPS-2 | x ipa 1\n  XI-IPA-1  \nX-IPA-EXIST';
  const result = parseBulkClassNames(raw, ['X-IPA-EXIST', 'XII-IPA-1']);
  assert.deepEqual(result.toAdd, ['X IPA 1', 'X IPA 2', 'X-IPS-1', 'X-IPS-2', 'XI-IPA-1']);
  assert.deepEqual(result.duplicates, ['X IPA 1', 'X-IPA-EXIST']);
});

test('XLSX buffer round-trips students, teachers, questions, and exam schedules while preserving leading zeros', () => {
  // 1. Students XLSX
  const stuBuf = buildXlsxBufferFromRows([
    ['NISN', 'Nama', 'Kelas', 'Status_Aktif'],
    ['0081234567', 'Budi Santoso', 'X-IPA-1', 'Aktif'],
    ['0089876543', 'Siti Aminah', 'X-IPA-2', 'Blokir'],
  ]);
  const { csvText: stuCsv } = parseXlsxBufferToCsv(stuBuf);
  const stuParsed = parseStudentsCSV(stuCsv);
  assert.equal(stuParsed.students.length, 2);
  assert.equal(stuParsed.students[0].nisn, '0081234567');
  assert.equal(stuParsed.students[1].active, false);

  // 2. Teachers XLSX
  const teacherBuf = buildXlsxBufferFromRows([
    ['Username', 'NIP', 'Nama', 'Password', 'Mapel', 'Kelas'],
    ['guru_bio', '198501012010011001', 'Dra. Kartini', 'guru123', 'Biologi;IPA', 'X-IPA-1;X-IPA-2'],
  ]);
  const { csvText: teacherCsv } = parseXlsxBufferToCsv(teacherBuf);
  const teacherParsed = parseTeachersCSV(teacherCsv);
  assert.equal(teacherParsed.teachers.length, 1);
  assert.equal(teacherParsed.teachers[0].nip, '198501012010011001');
  assert.deepEqual(teacherParsed.teachers[0].subjects, ['Biologi', 'IPA']);
  assert.deepEqual(teacherParsed.teachers[0].classes, ['X-IPA-1', 'X-IPA-2']);

  // 3. Questions XLSX
  const qBuf = buildXlsxBufferFromRows([
    ['TIPE', 'PERTANYAAN', 'A', 'B', 'C', 'D', 'E', 'KUNCI', 'PEMBAHASAN'],
    ['PG', 'Hasil dari 2 + 3 adalah?', '4', '5', '6', '7', '8', 'B', '2 + 3 = 5'],
    ['BS', 'Air mendidih pada suhu 100°C pada 1 atm.', 'Benar', 'Sifat fisika air', '', '', '', '', ''],
  ]);
  const { csvText: qCsv } = parseXlsxBufferToCsv(qBuf);
  const qParsed = parseQuestionsBulkText(qCsv, 'pkg-xlsx');
  assert.equal(qParsed.questions.length, 2);
  assert.equal(qParsed.questions[0].correctOptionId, 'B');
  assert.equal(qParsed.questions[1].correctBoolean, true);

  // 4. Exam Schedules XLSX
  const schedBuf = buildXlsxBufferFromRows([
    [
      'Judul Sesi Ujian',
      'Mata Pelajaran',
      'Kategori',
      'Kelas Target',
      'Username/Nama Guru',
      'Tanggal (YYYY-MM-DD)',
      'Jam Mulai',
      'Jam Selesai',
      'Durasi',
      'KKM',
      'Token',
      'Status',
      'Nama Sesi',
    ],
    [
      'UTS Fisika X',
      'Fisika',
      'UTS / PTS',
      'X-IPA-1;X-IPA-2',
      'guru_bio',
      '2026-12-01',
      '08:00',
      '09:30',
      '90',
      '75',
      'FIS123',
      'Aktif',
      'Sesi 1',
    ],
  ]);
  const { csvText: schedCsv } = parseXlsxBufferToCsv(schedBuf);
  const schedParsed = parseExamSchedulesCSV(schedCsv, {
    teachers: [],
    existingPackages: [],
  });
  assert.equal(schedParsed.rows.length, 1);
  assert.equal(schedParsed.rows[0].title, 'UTS Fisika X');
  assert.equal(schedParsed.rows[0].token, 'FIS123');
});

test('evaluateCameraBehavior prevents startup violations during warmup/calibration and ignores blinks & normal in-frame faces', () => {
  // During startup warmup grace period, even dark/occluded/missing frames MUST return 0 violations
  const warmup = evaluateCameraBehavior({
    horizontalShift: 0.9,
    eyeYawScore: 0.9,
    lateralMotionScore: 0.9,
    audioRms: 0.5,
    faceDetected: false,
    faceCount: 0,
    cameraOccluded: true,
    consecutiveTurnFrames: 10,
    consecutiveSpeechFrames: 10,
    consecutiveMissingFaceFrames: 10,
    inWarmupGrace: true,
  });
  assert.equal(warmup.status, 'focused');
  assert.equal(warmup.shouldFlagViolation, false);
  assert.equal(warmup.nextMissingFaceFrames, 0);
  assert.equal(warmup.nextTurnFrames, 0);

  // During baseline calibration, MUST return 0 violations
  const calibrating = evaluateCameraBehavior({
    horizontalShift: 0.6,
    eyeYawScore: 0.6,
    lateralMotionScore: 0.5,
    audioRms: 0,
    faceDetected: false,
    faceCount: 0,
    consecutiveTurnFrames: 5,
    consecutiveSpeechFrames: 0,
    consecutiveMissingFaceFrames: 5,
    isCalibrating: true,
  });
  assert.equal(calibrating.status, 'focused');
  assert.equal(calibrating.shouldFlagViolation, false);

  // Eye blinks & subtle transient lateral motion (without sustained head turn) NEVER trigger violations
  const blink = evaluateCameraBehavior({
    horizontalShift: 0.08,
    eyeYawScore: 0.14,
    lateralMotionScore: 0.48,
    audioRms: 0.01,
    faceDetected: true,
    faceCount: 1,
    faceAreaRatio: 0.85,
    consecutiveTurnFrames: 3,
    consecutiveSpeechFrames: 0,
  });
  assert.equal(blink.status, 'focused');
  assert.equal(blink.shouldFlagViolation, false);
  assert.equal(blink.nextTurnFrames, 0);

  // Face clearly inside frame even further back (faceAreaRatio: 0.24) MUST remain focused
  const inFrameFar = evaluateCameraBehavior({
    horizontalShift: 0.15,
    eyeYawScore: -0.18,
    lateralMotionScore: 0.08,
    audioRms: 0.01,
    faceDetected: true,
    faceCount: 1,
    faceAreaRatio: 0.24,
    faceOutOfBounds: false,
    consecutiveTurnFrames: 0,
    consecutiveSpeechFrames: 0,
    consecutiveMissingFaceFrames: 4,
  });
  assert.equal(inFrameFar.status, 'focused');
  assert.equal(inFrameFar.shouldFlagViolation, false);
});
