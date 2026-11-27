import type { CBTDatabase, StudentRecord } from '../types/cbt';

export interface DriveSpreadsheetFile {
  id: string;
  name: string;
  modifiedTime?: string;
  webViewLink?: string;
}

export interface SpreadsheetMetadata {
  spreadsheetId: string;
  title: string;
  spreadsheetUrl: string;
  sheets: Array<{ sheetId: number; title: string }>;
}

export const CBT_SHEET_TABS = [
  'Siswa',
  'Guru',
  'Paket_Ujian',
  'Bank_Soal',
  'Rekap_Nilai',
  'Pelanggaran',
] as const;

export function safeGoogleSheetCell(value: unknown): string | number | boolean {
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  const text = value == null ? '' : String(value);
  if (/^[=+\-@]/.test(text)) {
    return `'${text}`;
  }
  return text;
}

export function buildCbtSheetPayload(
  db: CBTDatabase
): Record<(typeof CBT_SHEET_TABS)[number], Array<Array<string | number | boolean>>> {
  const studentsRows: Array<Array<string | number | boolean>> = [
    ['NISN', 'Nama', 'Kelas', 'Status_Aktif', 'Alasan_Blokir'],
    ...db.students.map((s) => [
      safeGoogleSheetCell(s.nisn),
      safeGoogleSheetCell(s.name),
      safeGoogleSheetCell(s.className),
      s.active ? 'Aktif' : 'Blokir',
      safeGoogleSheetCell(s.blockReason || ''),
    ]),
  ];

  const teachersRows: Array<Array<string | number | boolean>> = [
    ['Username', 'NIP', 'Nama', 'Mata_Pelajaran', 'Kelas_Ampuan', 'Status_Aktif'],
    ...db.teachers.map((t) => [
      safeGoogleSheetCell(t.username),
      safeGoogleSheetCell(t.nip),
      safeGoogleSheetCell(t.name),
      safeGoogleSheetCell(t.subjects.join(', ')),
      safeGoogleSheetCell(t.classes.join(', ')),
      t.active ? 'Aktif' : 'Blokir',
    ]),
  ];

  const packagesRows: Array<Array<string | number | boolean>> = [
    ['ID_Paket', 'Judul_Paket', 'Mapel', 'Kategori', 'Kelas_Target', 'Durasi_Menit', 'KKM', 'Token', 'Status'],
    ...db.packages.map((p) => [
      safeGoogleSheetCell(p.id),
      safeGoogleSheetCell(p.title),
      safeGoogleSheetCell(p.subject),
      safeGoogleSheetCell(p.category),
      safeGoogleSheetCell(p.targetClasses.join(', ')),
      p.durationMinutes,
      p.kkm,
      safeGoogleSheetCell(p.token),
      p.isPublished ? 'Terbit' : 'Draf',
    ]),
  ];

  const questionsRows: Array<Array<string | number | boolean>> = [
    ['ID_Paket', 'Tipe', 'Pertanyaan', 'Opsi_A', 'Opsi_B', 'Opsi_C', 'Opsi_D', 'Opsi_E', 'Kunci', 'Bobot_Poin'],
    ...db.questions.map((q) => {
      const opt = (id: string) => q.options?.find((o) => o.id === id)?.text || '';
      const key =
        q.type === 'single_choice'
          ? q.correctOptionId || ''
          : q.type === 'multiple_choice'
            ? (q.correctOptionIds || []).join(',')
            : q.type === 'true_false'
              ? q.correctBoolean
                ? 'BENAR'
                : 'SALAH'
              : (q.matchingPairs || []).map((m) => `${m.left}=${m.right}`).join('; ');
      return [
        safeGoogleSheetCell(q.packageId),
        safeGoogleSheetCell(q.type),
        safeGoogleSheetCell(q.prompt),
        safeGoogleSheetCell(opt('A')),
        safeGoogleSheetCell(opt('B')),
        safeGoogleSheetCell(opt('C')),
        safeGoogleSheetCell(opt('D')),
        safeGoogleSheetCell(opt('E')),
        safeGoogleSheetCell(key),
        q.points,
      ];
    }),
  ];

  const attemptsRows: Array<Array<string | number | boolean>> = [
    ['NISN', 'Nama_Siswa', 'Kelas', 'ID_Paket', 'Status', 'Nilai', 'Benar', 'Total_Soal', 'Pelanggaran', 'Lulus', 'Waktu_Selesai'],
    ...db.attempts.map((a) => [
      safeGoogleSheetCell(a.studentNisn),
      safeGoogleSheetCell(a.studentName),
      safeGoogleSheetCell(a.className),
      safeGoogleSheetCell(a.packageId),
      safeGoogleSheetCell(a.status),
      a.score ?? 0,
      a.correctCount ?? 0,
      a.totalQuestions ?? 0,
      a.violationCount,
      a.passed ? 'Lulus' : 'Belum',
      safeGoogleSheetCell(a.submittedAt || a.startedAt),
    ]),
  ];

  const violationsRows: Array<Array<string | number | boolean>> = [
    ['Waktu', 'NISN', 'Nama_Siswa', 'Kelas', 'Paket_Ujian', 'Jenis', 'Detail'],
    ...db.violations.map((v) => [
      safeGoogleSheetCell(v.timestamp),
      safeGoogleSheetCell(v.studentNisn),
      safeGoogleSheetCell(v.studentName),
      safeGoogleSheetCell(v.className),
      safeGoogleSheetCell(v.packageTitle),
      safeGoogleSheetCell(v.type),
      safeGoogleSheetCell(v.detail),
    ]),
  ];

  return {
    Siswa: studentsRows,
    Guru: teachersRows,
    Paket_Ujian: packagesRows,
    Bank_Soal: questionsRows,
    Rekap_Nilai: attemptsRows,
    Pelanggaran: violationsRows,
  };
}

export function parseStudentsFromSheetRows(rows: string[][]): {
  students: Array<Omit<StudentRecord, 'id'>>;
  skipped: number;
} {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { students: [], skipped: 0 };
  }

  let nisnIdx = 0;
  let nameIdx = 1;
  let classIdx = 2;
  let statusIdx = 3;
  let startRow = 0;

  const firstRow = rows[0].map((c) => String(c || '').trim().toLowerCase());
  const detectedNisn = firstRow.findIndex((h) => h.includes('nisn'));
  const detectedName = firstRow.findIndex((h) => h.includes('nama'));
  const detectedClass = firstRow.findIndex((h) => h.includes('kelas'));
  const detectedStatus = firstRow.findIndex((h) => h.includes('status') || h.includes('aktif'));

  if (detectedNisn !== -1 || detectedName !== -1) {
    startRow = 1;
    if (detectedNisn !== -1) nisnIdx = detectedNisn;
    if (detectedName !== -1) nameIdx = detectedName;
    if (detectedClass !== -1) classIdx = detectedClass;
    if (detectedStatus !== -1) statusIdx = detectedStatus;
  }

  const students: Array<Omit<StudentRecord, 'id'>> = [];
  let skipped = 0;

  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((c) => !String(c || '').trim())) continue;

    const nisn = String(row[nisnIdx] ?? '').trim().replace(/^'+/, '');
    const name = String(row[nameIdx] ?? '').trim();
    const className = String(row[classIdx] ?? '').trim().toUpperCase() || 'X-1';
    const rawStatus = String(row[statusIdx] ?? 'Aktif').trim().toLowerCase();
    const active = !(
      rawStatus.includes('blokir') ||
      rawStatus === 'nonaktif' ||
      rawStatus === 'false' ||
      rawStatus === '0'
    );

    if (!nisn || !name) {
      skipped += 1;
      continue;
    }

    students.push({
      nisn,
      name,
      className,
      active,
    });
  }

  return { students, skipped };
}

async function handleGoogleApiResponse<T>(res: Response, fallbackMessage: string): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as {
    error?: { message?: string; status?: string };
  };
  if (!res.ok) {
    const apiMsg = data?.error?.message;
    throw new Error(apiMsg ? `${fallbackMessage}: ${apiMsg}` : `${fallbackMessage} (HTTP ${res.status})`);
  }
  return data as T;
}

export async function listDriveSpreadsheets(accessToken: string): Promise<DriveSpreadsheetFile[]> {
  const query = encodeURIComponent(
    "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false"
  );
  const fields = encodeURIComponent('files(id,name,modifiedTime,webViewLink)');
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&orderBy=modifiedTime%20desc&pageSize=25&fields=${fields}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await handleGoogleApiResponse<{ files?: DriveSpreadsheetFile[] }>(
    res,
    'Gagal memuat daftar Google Spreadsheet dari Drive'
  );
  return data.files || [];
}

export async function getSpreadsheetMetadata(
  accessToken: string,
  spreadsheetId: string
): Promise<SpreadsheetMetadata> {
  const fields = encodeURIComponent(
    'spreadsheetId,spreadsheetUrl,properties.title,sheets.properties(sheetId,title)'
  );
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=${fields}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  const data = await handleGoogleApiResponse<{
    spreadsheetId: string;
    spreadsheetUrl: string;
    properties?: { title?: string };
    sheets?: Array<{ properties?: { sheetId?: number; title?: string } }>;
  }>(res, 'Gagal membaca metadata Google Spreadsheet');

  return {
    spreadsheetId: data.spreadsheetId,
    title: data.properties?.title || 'Google Spreadsheet',
    spreadsheetUrl: data.spreadsheetUrl,
    sheets: (data.sheets || []).map((s, idx) => ({
      sheetId: s.properties?.sheetId ?? idx,
      title: s.properties?.title || `Sheet${idx + 1}`,
    })),
  };
}

export async function createCbtSpreadsheet(
  accessToken: string,
  title: string
): Promise<SpreadsheetMetadata> {
  const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: { title },
      sheets: CBT_SHEET_TABS.map((tabName) => ({
        properties: { title: tabName },
      })),
    }),
  });

  const data = await handleGoogleApiResponse<{
    spreadsheetId: string;
    spreadsheetUrl: string;
    properties?: { title?: string };
    sheets?: Array<{ properties?: { sheetId?: number; title?: string } }>;
  }>(res, 'Gagal membuat Google Spreadsheet baru');

  return {
    spreadsheetId: data.spreadsheetId,
    title: data.properties?.title || title,
    spreadsheetUrl: data.spreadsheetUrl,
    sheets: (data.sheets || []).map((s, idx) => ({
      sheetId: s.properties?.sheetId ?? idx,
      title: s.properties?.title || CBT_SHEET_TABS[idx] || `Sheet${idx + 1}`,
    })),
  };
}

export async function readSheetTabValues(
  accessToken: string,
  spreadsheetId: string,
  sheetTitle: string
): Promise<string[][]> {
  const escapedTitle = sheetTitle.replace(/'/g, "''");
  const range = encodeURIComponent(`'${escapedTitle}'!A1:Z2000`);
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${range}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  const data = await handleGoogleApiResponse<{ values?: string[][] }>(
    res,
    `Gagal membaca isi tab "${sheetTitle}"`
  );
  return data.values || [];
}

export async function syncDatabaseToGoogleSheet(
  accessToken: string,
  spreadsheetId: string,
  db: CBTDatabase
): Promise<{ updatedTabs: number; totalRows: number }> {
  const meta = await getSpreadsheetMetadata(accessToken, spreadsheetId);
  const existingTitles = new Set(meta.sheets.map((s) => s.title));
  const missingTabs = CBT_SHEET_TABS.filter((tab) => !existingTitles.has(tab));

  if (missingTabs.length > 0) {
    const addRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: missingTabs.map((title) => ({
            addSheet: { properties: { title } },
          })),
        }),
      }
    );
    await handleGoogleApiResponse(addRes, 'Gagal membuat tab CBT pada Spreadsheet');
  }

  // Clear existing data in CBT tabs before writing clean rows
  const clearRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchClear`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ranges: CBT_SHEET_TABS.map((tab) => `'${tab}'!A1:Z5000`),
      }),
    }
  );
  await handleGoogleApiResponse(clearRes, 'Gagal membersihkan rentang tab Spreadsheet');

  const payload = buildCbtSheetPayload(db);
  const dataRanges = CBT_SHEET_TABS.map((tab) => ({
    range: `'${tab}'!A1`,
    values: payload[tab],
  }));

  const writeRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: dataRanges,
      }),
    }
  );
  await handleGoogleApiResponse(writeRes, 'Gagal menulis data CBT ke Google Spreadsheet');

  const totalRows = CBT_SHEET_TABS.reduce((sum, tab) => sum + Math.max(0, payload[tab].length - 1), 0);
  return { updatedTabs: CBT_SHEET_TABS.length, totalRows };
}
