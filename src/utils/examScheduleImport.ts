import type { ExamCategory, ExamPackage, TeacherAccount } from '../types/cbt';

export interface ParsedExamScheduleRow {
  rowNumber: number;
  title: string;
  subject: string;
  category: ExamCategory;
  targetClasses: string[];
  teacherId: string;
  teacherLabel: string;
  scheduledDate: string; // YYYY-MM-DD or ''
  scheduledStartTime: string; // HH:mm or ''
  scheduledEndTime: string; // HH:mm or ''
  durationMinutes: number;
  minSubmitMinutes: number;
  kkm: number;
  token: string;
  isPublished: boolean;
  sessionName: string;
}

export interface ParseExamSchedulesResult {
  rows: ParsedExamScheduleRow[];
  errors: string[];
  warnings: string[];
}

export const EXAM_SCHEDULE_CSV_HEADERS = [
  'Judul Sesi Ujian',
  'Mata Pelajaran',
  'Kategori',
  'Kelas Target',
  'Username/Nama Guru',
  'Tanggal (YYYY-MM-DD)',
  'Jam Mulai (HH:MM)',
  'Jam Selesai (HH:MM)',
  'Durasi (Menit)',
  'KKM',
  'Token (Opsional)',
  'Status (Aktif/Nonaktif)',
  'Nama Sesi',
];

/**
 * Generates an Excel/Google Sheets compatible CSV template for bulk uploading exam schedules.
 */
export function generateExamScheduleCSVTemplate(
  sampleTeachers: Pick<TeacherAccount, 'username' | 'name'>[] = [],
  sampleClasses: string[] = []
): string {
  const teacher1 = sampleTeachers[0]?.username || 'guru1';
  const teacher2 = sampleTeachers[1]?.username || teacher1;
  const cls1 = sampleClasses.slice(0, 2).join(' | ') || 'XI IPA 1 | XI IPA 2';
  const cls2 = sampleClasses.slice(2, 4).join(' | ') || 'XI IPS 1 | XI IPS 2';
  const cls3 = sampleClasses[0] || 'XII IPA 1';

  const today = new Date();
  const formatYmd = (offsetDays: number) => {
    const d = new Date(today.getTime() + offsetDays * 86_400_000);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const rows = [
    EXAM_SCHEDULE_CSV_HEADERS,
    [
      'PAS Matematika Wajib',
      'Matematika',
      'UTS / PTS',
      cls1,
      teacher1,
      formatYmd(1),
      '07:30',
      '09:00',
      '90',
      '75',
      'PASMAT1',
      'Aktif',
      'Sesi 1',
    ],
    [
      'PAS Bahasa Indonesia',
      'Bahasa Indonesia',
      'UTS / PTS',
      cls2,
      teacher2,
      formatYmd(1),
      '09:30',
      '11:00',
      '90',
      '75',
      'PASBIN2',
      'Aktif',
      'Sesi 2',
    ],
    [
      'Ulangan Harian Biologi Bab 3',
      'Biologi',
      'Ulangan Resmi',
      cls3,
      teacher1,
      formatYmd(2),
      '08:00',
      '09:00',
      '60',
      '78',
      '',
      'Nonaktif',
      'Sesi 1',
    ],
  ];

  return rows
    .map((cols) =>
      cols
        .map((cell) => {
          const val = String(cell ?? '');
          return /[",;\n]/.test(val) ? `"${val.replace(/"/g, '""')}"` : val;
        })
        .join(',')
    )
    .join('\n');
}

function detectDelimiter(headerLine: string): ',' | ';' | '\t' {
  const tabs = (headerLine.match(/\t/g) || []).length;
  const semis = (headerLine.match(/;/g) || []).length;
  const commas = (headerLine.match(/,/g) || []).length;
  if (tabs >= semis && tabs >= commas && tabs > 0) return '\t';
  if (semis > commas) return ';';
  return ',';
}

function splitDelimitedLine(line: string, delimiter: ',' | ';' | '\t'): string[] {
  const out: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      out.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  out.push(current.trim());
  return out;
}

function normalizeDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  // YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(trimmed);
  if (isoMatch) {
    const y = Number(isoMatch[1]);
    const m = Number(isoMatch[2]);
    const d = Number(isoMatch[3]);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 2000 && y <= 2100) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    return null;
  }
  // DD/MM/YYYY or DD-MM-YYYY (common Indonesian Excel format)
  const idMatch = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(trimmed);
  if (idMatch) {
    const d = Number(idMatch[1]);
    const m = Number(idMatch[2]);
    const y = Number(idMatch[3]);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 2000 && y <= 2100) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    return null;
  }
  return null;
}

function normalizeTime(raw: string): string | null {
  const trimmed = raw.trim().replace('.', ':');
  if (!trimmed) return '';
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(trimmed);
  if (!match) return null;
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function diffMinutes(startHHMM: string, endHHMM: string): number | null {
  if (!startHHMM || !endHHMM) return null;
  const [sh, sm] = startHHMM.split(':').map(Number);
  const [eh, em] = endHHMM.split(':').map(Number);
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  if (end <= start) return null;
  return end - start;
}

function normalizeCategory(raw: string): ExamCategory {
  const lower = raw.trim().toLowerCase();
  if (
    lower.includes('uts') ||
    lower.includes('pts') ||
    lower.includes('pas') ||
    lower.includes('uas') ||
    lower.includes('sumatif') ||
    lower.includes('tengah') ||
    lower.includes('akhir')
  ) {
    return 'UTS / PTS';
  }
  if (
    lower.includes('latihan') ||
    lower.includes('try') ||
    lower.includes('mandiri') ||
    lower.includes('kuis')
  ) {
    return 'Latihan Mandiri';
  }
  return 'Ulangan Resmi';
}

function normalizePublished(raw: string): boolean {
  const lower = raw.trim().toLowerCase();
  if (!lower) return true;
  if (
    lower === 'nonaktif' ||
    lower === 'tidak' ||
    lower === 'false' ||
    lower === '0' ||
    lower === 'draft' ||
    lower === 'off' ||
    lower === 'tutup'
  ) {
    return false;
  }
  return true;
}

function generateDeterministicToken(seedText: string, usedTokens: Set<string>): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let hash = 2166136261;
  for (let i = 0; i < seedText.length; i++) {
    hash ^= seedText.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  let attempt = 0;
  while (attempt < 50) {
    let h = (hash + attempt * 2654435761) >>> 0;
    let tok = '';
    for (let j = 0; j < 6; j++) {
      tok += alphabet[h % alphabet.length];
      h = Math.imul(h ^ (h >>> 13), 1597334677) >>> 0;
    }
    if (!usedTokens.has(tok)) {
      usedTokens.add(tok);
      return tok;
    }
    attempt += 1;
  }
  const fallback = `JDW${String(usedTokens.size + 101).slice(-3)}`;
  usedTokens.add(fallback);
  return fallback;
}

function matchTeacher(
  rawTeacher: string,
  teachers: TeacherAccount[]
): { id: string; label: string; matched: boolean } {
  const q = rawTeacher.trim().toLowerCase();
  if (q && teachers.length > 0) {
    const found = teachers.find(
      (t) =>
        t.username.trim().toLowerCase() === q ||
        t.nip.trim().toLowerCase() === q ||
        t.name.trim().toLowerCase() === q ||
        t.name.trim().toLowerCase().includes(q)
    );
    if (found) {
      return { id: found.id, label: found.name, matched: true };
    }
  }
  if (teachers.length > 0) {
    return {
      id: teachers[0].id,
      label: teachers[0].name,
      matched: !q,
    };
  }
  return {
    id: 'admin-scheduled',
    label: rawTeacher.trim() || 'Super Admin',
    matched: !q,
  };
}

/**
 * Parses CSV / semicolon Excel / tab-separated bulk exam schedules text
 * into validated ExamPackage-ready rows.
 */
export function parseExamSchedulesCSV(
  rawText: string,
  options: {
    teachers?: TeacherAccount[];
    existingPackages?: ExamPackage[];
  } = {}
): ParseExamSchedulesResult {
  const teachers = options.teachers ?? [];
  const existingTokens = new Set(
    (options.existingPackages ?? []).map((p) => p.token.trim().toUpperCase())
  );
  const usedInBatch = new Set<string>();

  const cleaned = rawText.replace(/^\uFEFF/, '').trim();
  if (!cleaned) {
    return {
      rows: [],
      errors: ['Isi template CSV jadwal ujian masih kosong.'],
      warnings: [],
    };
  }

  const rawLines = cleaned
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));

  if (rawLines.length === 0) {
    return {
      rows: [],
      errors: ['Tidak ada baris data jadwal yang ditemukan.'],
      warnings: [],
    };
  }

  const delimiter = detectDelimiter(rawLines[0]);
  const firstCols = splitDelimitedLine(rawLines[0], delimiter);
  const firstLower = firstCols.map((c) => c.toLowerCase());
  const looksLikeHeader = firstLower.some(
    (c) =>
      c.includes('judul') ||
      c.includes('mata pelajaran') ||
      c.includes('mapel') ||
      c.includes('kelas') ||
      c.includes('tanggal')
  );

  // Detect optional leading "No" column (common when pasting from Excel)
  const hasLeadingNoCol =
    looksLikeHeader && (firstLower[0] === 'no' || firstLower[0] === 'no.');

  const dataStartIdx = looksLikeHeader ? 1 : 0;
  const rows: ParsedExamScheduleRow[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  for (let i = dataStartIdx; i < rawLines.length; i++) {
    const rowNumber = i + 1;
    let cols = splitDelimitedLine(rawLines[i], delimiter);
    if (hasLeadingNoCol && cols.length > 1) {
      cols = cols.slice(1);
    }

    const title = (cols[0] ?? '').trim();
    const subject = (cols[1] ?? '').trim();
    const categoryRaw = (cols[2] ?? '').trim();
    const classesRaw = (cols[3] ?? '').trim();
    const teacherRaw = (cols[4] ?? '').trim();
    const dateRaw = (cols[5] ?? '').trim();
    const startRaw = (cols[6] ?? '').trim();
    const endRaw = (cols[7] ?? '').trim();
    const durationRaw = (cols[8] ?? '').trim();
    const kkmRaw = (cols[9] ?? '').trim();
    const tokenRaw = (cols[10] ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const statusRaw = (cols[11] ?? '').trim();
    const sessionRaw = (cols[12] ?? '').trim();

    if (!title || !subject) {
      errors.push(
        `Baris ${rowNumber}: Kolom Judul Sesi Ujian dan Mata Pelajaran wajib diisi.`
      );
      continue;
    }

    const scheduledDate = normalizeDate(dateRaw);
    if (scheduledDate === null) {
      errors.push(
        `Baris ${rowNumber} ("${title}"): Format tanggal "${dateRaw}" tidak valid (gunakan YYYY-MM-DD atau DD/MM/YYYY).`
      );
      continue;
    }

    const scheduledStartTime = normalizeTime(startRaw);
    if (scheduledStartTime === null) {
      errors.push(
        `Baris ${rowNumber} ("${title}"): Format Jam Mulai "${startRaw}" tidak valid (gunakan HH:MM).`
      );
      continue;
    }

    const scheduledEndTime = normalizeTime(endRaw);
    if (scheduledEndTime === null) {
      errors.push(
        `Baris ${rowNumber} ("${title}"): Format Jam Selesai "${endRaw}" tidak valid (gunakan HH:MM).`
      );
      continue;
    }

    const inferredDuration = diffMinutes(scheduledStartTime, scheduledEndTime);
    if (scheduledStartTime && scheduledEndTime && inferredDuration === null) {
      errors.push(
        `Baris ${rowNumber} ("${title}"): Jam Selesai (${scheduledEndTime}) harus lebih besar dari Jam Mulai (${scheduledStartTime}).`
      );
      continue;
    }

    const parsedDuration = Number(durationRaw);
    const durationMinutes =
      Number.isFinite(parsedDuration) && parsedDuration > 0
        ? Math.max(5, Math.min(240, Math.round(parsedDuration)))
        : inferredDuration !== null
          ? Math.max(5, Math.min(240, inferredDuration))
          : 60;

    const parsedKkm = Number(kkmRaw);
    const kkm =
      Number.isFinite(parsedKkm) && kkmRaw !== ''
        ? Math.max(0, Math.min(100, Math.round(parsedKkm)))
        : 75;

    const targetClasses = Array.from(
      new Set(
        classesRaw
          .split(/[|/,;]+/)
          .map((c) => c.trim().toUpperCase())
          .filter(Boolean)
      )
    );

    const teacherMatch = matchTeacher(teacherRaw, teachers);
    if (teacherRaw && !teacherMatch.matched) {
      warnings.push(
        `Baris ${rowNumber} ("${title}"): Guru "${teacherRaw}" tidak ditemukan, dialihkan ke ${teacherMatch.label}.`
      );
    }

    let token = tokenRaw;
    if (!token) {
      const combinedUsed = new Set([...existingTokens, ...usedInBatch]);
      token = generateDeterministicToken(
        `${title}|${subject}|${scheduledDate}|${scheduledStartTime}|${rowNumber}`,
        combinedUsed
      );
    } else if (usedInBatch.has(token)) {
      errors.push(
        `Baris ${rowNumber} ("${title}"): Token "${token}" duplikat di dalam file impor.`
      );
      continue;
    }
    usedInBatch.add(token);

    rows.push({
      rowNumber,
      title,
      subject,
      category: normalizeCategory(categoryRaw),
      targetClasses,
      teacherId: teacherMatch.id,
      teacherLabel: teacherMatch.label,
      scheduledDate,
      scheduledStartTime,
      scheduledEndTime,
      durationMinutes,
      minSubmitMinutes: Math.min(15, Math.floor(durationMinutes / 3)),
      kkm,
      token,
      isPublished: normalizePublished(statusRaw),
      sessionName: sessionRaw || (scheduledStartTime ? `Sesi ${scheduledStartTime}` : ''),
    });
  }

  return { rows, errors, warnings };
}
