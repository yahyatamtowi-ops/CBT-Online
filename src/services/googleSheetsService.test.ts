import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialSeedDatabase } from '../data/seedData.ts';
import {
  buildCbtSheetPayload,
  CBT_SHEET_TABS,
  parseStudentsFromSheetRows,
  safeGoogleSheetCell,
} from './googleSheetsService.ts';

test('safeGoogleSheetCell escapes formula injection prefixes cleanly', () => {
  assert.equal(safeGoogleSheetCell('=SUM(A1:A5)'), "'=SUM(A1:A5)");
  assert.equal(safeGoogleSheetCell('+628123'), "'+628123");
  assert.equal(safeGoogleSheetCell('Andi Pratama'), 'Andi Pratama');
  assert.equal(safeGoogleSheetCell(95), 95);
  assert.equal(safeGoogleSheetCell(true), true);
});

test('buildCbtSheetPayload generates all 6 CBT sheet tabs with header and data rows', () => {
  const db = createInitialSeedDatabase();
  db.students.push({
    id: 'stu_1',
    nisn: '0090001001',
    name: 'Andi Pratama',
    className: 'X-1',
    active: true,
  });
  db.teachers.push({
    id: 'tch_1',
    username: 'hendra',
    nip: '19800101',
    name: 'Drs. Hendra',
    password: 'secret',
    subjects: ['Matematika'],
    classes: ['X-1'],
    active: true,
  });

  const payload = buildCbtSheetPayload(db);
  for (const tab of CBT_SHEET_TABS) {
    assert.ok(Array.isArray(payload[tab]), `Missing tab ${tab}`);
    assert.ok(payload[tab].length >= 1, `Tab ${tab} should have header row`);
  }
  assert.equal(payload.Siswa.length, 2);
  assert.equal(payload.Siswa[1][0], '0090001001');
  assert.equal(payload.Siswa[1][1], 'Andi Pratama');
  assert.equal(payload.Guru.length, 2);
  // Ensure teacher password is NOT exported to Guru tab
  assert.equal(payload.Guru[1].includes('secret'), false);
});

test('parseStudentsFromSheetRows detects header columns and skips invalid rows', () => {
  const rows = [
    ['No', 'NISN', 'Nama Lengkap', 'Kelas', 'Status_Aktif'],
    ['1', "'0081234567", 'Citra Lestari', 'xi-ipa-1', 'Aktif'],
    ['2', '0081234568', 'Dewi Anggraini', 'XI-IPA-1', 'Blokir'],
    ['3', '', 'Tanpa NISN', 'XI-IPA-1', 'Aktif'],
  ];

  const result = parseStudentsFromSheetRows(rows);
  assert.equal(result.students.length, 2);
  assert.equal(result.skipped, 1);
  assert.equal(result.students[0].nisn, '0081234567');
  assert.equal(result.students[0].className, 'XI-IPA-1');
  assert.equal(result.students[0].active, true);
  assert.equal(result.students[1].active, false);
});
