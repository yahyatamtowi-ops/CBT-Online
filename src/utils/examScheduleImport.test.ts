import test from 'node:test';
import assert from 'node:assert/strict';
import type { TeacherAccount } from '../types/cbt';
import {
  generateExamScheduleCSVTemplate,
  parseExamSchedulesCSV,
} from './examScheduleImport';

const MOCK_TEACHERS: TeacherAccount[] = [
  {
    id: 'teacher-1',
    username: 'siti.mat',
    nip: '198501012010012001',
    name: 'Ibu Siti Rahayu, S.Pd',
    password: '123',
    subjects: ['Matematika'],
    classes: ['XI IPA 1', 'XI IPA 2'],
    active: true,
  },
  {
    id: 'teacher-2',
    username: 'budi.bio',
    nip: '198602022011011002',
    name: 'Pak Budi Hartono, M.Pd',
    password: '123',
    subjects: ['Biologi'],
    classes: ['XI IPA 1', 'XII IPA 1'],
    active: true,
  },
];

test('generateExamScheduleCSVTemplate round-trips cleanly through parseExamSchedulesCSV', () => {
  const csv = generateExamScheduleCSVTemplate(MOCK_TEACHERS, [
    'XI IPA 1',
    'XI IPA 2',
    'XI IPS 1',
  ]);
  const res = parseExamSchedulesCSV(csv, { teachers: MOCK_TEACHERS });
  assert.equal(res.errors.length, 0);
  assert.equal(res.rows.length, 3);
  assert.equal(res.rows[0].title, 'PAS Matematika Wajib');
  assert.equal(res.rows[0].teacherId, 'teacher-1');
  assert.deepEqual(res.rows[0].targetClasses, ['XI IPA 1', 'XI IPA 2']);
  assert.equal(res.rows[0].token, 'PASMAT1');
  assert.equal(res.rows[0].isPublished, true);

  // Row 3 has blank token -> auto-generated 6-char token & status Nonaktif
  assert.equal(res.rows[2].token.length, 6);
  assert.equal(res.rows[2].isPublished, false);
});

test('parseExamSchedulesCSV handles Indonesian Excel semicolons, leading No column, DD/MM/YYYY dates, and inferred duration', () => {
  const raw = [
    'No;Judul Sesi Ujian;Mata Pelajaran;Kategori;Kelas Target;Username/Nama Guru;Tanggal;Jam Mulai;Jam Selesai;Durasi;KKM;Token;Status;Nama Sesi',
    '1;UTS Fisika Gelombang 1;Fisika;UTS;XI IPA 1 | XI IPA 2;Pak Budi Hartono, M.Pd;05/12/2026;07.30;09.00;;78;FIS001;Aktif;Sesi 1',
    '2;Latihan Kimia Organik;Kimia;Latihan;XII IPA 1;siti.mat;2026-12-06;10:00;10:45;45;70;;Draft;Sesi 2',
  ].join('\n');

  const res = parseExamSchedulesCSV(raw, { teachers: MOCK_TEACHERS });
  assert.equal(res.errors.length, 0);
  assert.equal(res.rows.length, 2);

  assert.equal(res.rows[0].scheduledDate, '2026-12-05');
  assert.equal(res.rows[0].scheduledStartTime, '07:30');
  assert.equal(res.rows[0].scheduledEndTime, '09:00');
  assert.equal(res.rows[0].durationMinutes, 90); // inferred from 07:30 -> 09:00
  assert.equal(res.rows[0].teacherId, 'teacher-2');
  assert.equal(res.rows[0].category, 'UTS / PTS');

  assert.equal(res.rows[1].category, 'Latihan Mandiri');
  assert.equal(res.rows[1].isPublished, false);
  assert.equal(res.rows[1].durationMinutes, 45);
});

test('parseExamSchedulesCSV reports invalid time windows, invalid dates, missing required fields, and duplicate batch tokens', () => {
  const raw = [
    'Judul Sesi Ujian,Mata Pelajaran,Kategori,Kelas Target,Username/Nama Guru,Tanggal,Jam Mulai,Jam Selesai,Durasi,KKM,Token,Status,Nama Sesi',
    ',Matematika,UTS,XI IPA 1,siti.mat,2026-12-01,08:00,09:00,60,75,TOK111,Aktif,Sesi 1',
    'Sesi Invalid Time,Matematika,UTS,XI IPA 1,siti.mat,2026-12-01,10:00,09:00,60,75,TOK222,Aktif,Sesi 1',
    'Sesi Valid 1,Matematika,UTS,XI IPA 1,siti.mat,2026-12-01,08:00,09:00,60,75,DUP999,Aktif,Sesi 1',
    'Sesi Duplicate Token,Biologi,UTS,XI IPA 1,budi.bio,2026-12-01,09:30,10:30,60,75,DUP999,Aktif,Sesi 2',
  ].join('\n');

  const res = parseExamSchedulesCSV(raw, { teachers: MOCK_TEACHERS });
  assert.equal(res.rows.length, 1);
  assert.equal(res.rows[0].title, 'Sesi Valid 1');
  assert.equal(res.errors.length, 3);
  assert.ok(res.errors.some((e) => /wajib diisi/i.test(e)));
  assert.ok(res.errors.some((e) => /lebih besar/i.test(e)));
  assert.ok(res.errors.some((e) => /duplikat/i.test(e)));
});
