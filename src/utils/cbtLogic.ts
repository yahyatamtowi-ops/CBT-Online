import type {
  ExamAttempt,
  ExamPackage,
  GlobalSecurityConfig,
  Question,
  SessionScheduleConfig,
  StudentAnswerValue,
  StudentAttemptStatus,
  StudentRecord,
} from '../types/cbt';

/**
 * Deterministic PRNG (Mulberry32) so question/option shuffling stays stable per attempt.
 */
export function seededShuffle<T>(items: T[], seedStr: string): T[] {
  const arr = [...items];
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let seed = h >>> 0;

  const nextRandom = () => {
    seed += 0x6d2b79f5;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(nextRandom() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function isQuestionAnswered(
  question: Question,
  answer: StudentAnswerValue | undefined
): boolean {
  if (answer === undefined || answer === null) return false;
  switch (question.type) {
    case 'single_choice':
      return typeof answer === 'string' && answer.trim().length > 0;
    case 'multiple_choice':
      return Array.isArray(answer) && answer.length > 0;
    case 'true_false':
      return typeof answer === 'boolean';
    case 'matching': {
      if (typeof answer !== 'object' || Array.isArray(answer)) return false;
      const pairs = question.matchingPairs ?? [];
      if (pairs.length === 0) return false;
      return pairs.every(
        (pair) => typeof answer[pair.id] === 'string' && answer[pair.id].trim().length > 0
      );
    }
    default:
      return false;
  }
}

export function evaluateQuestionCorrectness(
  question: Question,
  answer: StudentAnswerValue | undefined
): { isCorrect: boolean; earnedPoints: number; maxPoints: number } {
  const maxPoints = question.points > 0 ? question.points : 10;
  if (answer === undefined || answer === null) {
    return { isCorrect: false, earnedPoints: 0, maxPoints };
  }

  switch (question.type) {
    case 'single_choice': {
      const isCorrect =
        typeof answer === 'string' && answer === question.correctOptionId;
      return { isCorrect, earnedPoints: isCorrect ? maxPoints : 0, maxPoints };
    }
    case 'multiple_choice': {
      const expected = [...(question.correctOptionIds ?? [])].sort();
      const actual = Array.isArray(answer) ? [...new Set(answer)].sort() : [];
      const isCorrect =
        expected.length > 0 &&
        expected.length === actual.length &&
        expected.every((val, idx) => val === actual[idx]);
      return { isCorrect, earnedPoints: isCorrect ? maxPoints : 0, maxPoints };
    }
    case 'true_false': {
      const isCorrect =
        typeof answer === 'boolean' && answer === question.correctBoolean;
      return { isCorrect, earnedPoints: isCorrect ? maxPoints : 0, maxPoints };
    }
    case 'matching': {
      const pairs = question.matchingPairs ?? [];
      if (
        pairs.length === 0 ||
        typeof answer !== 'object' ||
        Array.isArray(answer)
      ) {
        return { isCorrect: false, earnedPoints: 0, maxPoints };
      }
      let matchedCount = 0;
      for (const pair of pairs) {
        if (answer[pair.id] === pair.right) {
          matchedCount += 1;
        }
      }
      const isCorrect = matchedCount === pairs.length;
      const earnedPoints = Number(((matchedCount / pairs.length) * maxPoints).toFixed(2));
      return { isCorrect, earnedPoints, maxPoints };
    }
    default:
      return { isCorrect: false, earnedPoints: 0, maxPoints };
  }
}

export interface ExamScoreSummary {
  score: number; // 0-100 rounded to 1 decimal
  earnedPoints: number;
  totalPoints: number;
  correctCount: number;
  totalQuestions: number;
  passed: boolean;
}

export function calculateExamScore(
  questions: Question[],
  answers: Record<string, StudentAnswerValue>,
  kkm: number
): ExamScoreSummary {
  if (questions.length === 0) {
    return {
      score: 0,
      earnedPoints: 0,
      totalPoints: 0,
      correctCount: 0,
      totalQuestions: 0,
      passed: false,
    };
  }

  let earnedPoints = 0;
  let totalPoints = 0;
  let correctCount = 0;

  for (const q of questions) {
    const result = evaluateQuestionCorrectness(q, answers[q.id]);
    earnedPoints += result.earnedPoints;
    totalPoints += result.maxPoints;
    if (result.isCorrect) {
      correctCount += 1;
    }
  }

  const score =
    totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 1000) / 10 : 0;

  return {
    score,
    earnedPoints: Math.round(earnedPoints * 100) / 100,
    totalPoints,
    correctCount,
    totalQuestions: questions.length,
    passed: score >= kkm,
  };
}

export interface ItemAnalysisRow {
  questionId: string;
  questionNumber: number;
  prompt: string;
  type: Question['type'];
  answeredCount: number;
  correctCount: number;
  wrongCount: number;
  correctPercent: number;
  difficultyLabel: 'Mudah' | 'Sedang' | 'Sukar' | 'Belum Ada Data';
}

export function computeItemAnalysis(
  questions: Question[],
  attempts: ExamAttempt[]
): ItemAnalysisRow[] {
  const finishedAttempts = attempts.filter(
    (a) => a.status === 'completed' || a.status === 'locked'
  );

  return questions.map((q, idx) => {
    let answeredCount = 0;
    let correctCount = 0;
    let wrongCount = 0;

    for (const attempt of finishedAttempts) {
      const ans = attempt.answers[q.id];
      if (isQuestionAnswered(q, ans)) {
        answeredCount += 1;
      }
      const res = evaluateQuestionCorrectness(q, ans);
      if (res.isCorrect) {
        correctCount += 1;
      } else {
        wrongCount += 1;
      }
    }

    const total = finishedAttempts.length;
    const correctPercent = total > 0 ? Math.round((correctCount / total) * 100) : 0;

    let difficultyLabel: ItemAnalysisRow['difficultyLabel'] = 'Belum Ada Data';
    if (total > 0) {
      if (correctPercent >= 70) difficultyLabel = 'Mudah';
      else if (correctPercent >= 35) difficultyLabel = 'Sedang';
      else difficultyLabel = 'Sukar';
    }

    return {
      questionId: q.id,
      questionNumber: idx + 1,
      prompt: q.prompt,
      type: q.type,
      answeredCount,
      correctCount,
      wrongCount,
      correctPercent,
      difficultyLabel,
    };
  });
}

export function isWithinScheduleWindow(
  schedule: SessionScheduleConfig,
  now: Date = new Date()
): { allowed: boolean; reason?: string } {
  if (!schedule.tokensReleased && schedule.tokenReleaseMode === 'manual') {
    return {
      allowed: false,
      reason: 'Token ujian belum dirilis oleh Administrator sekolah.',
    };
  }

  if (schedule.enforceTimeWindow) {
    const [startH, startM] = schedule.accessStartTime.split(':').map(Number);
    const [endH, endM] = schedule.accessEndTime.split(':').map(Number);
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const safeStartH = Number.isFinite(startH) ? startH : 0;
    const safeStartM = Number.isFinite(startM) ? startM : 0;
    const safeEndH = Number.isFinite(endH) ? endH : 23;
    const safeEndM = Number.isFinite(endM) ? endM : 59;
    const startMinutes = safeStartH * 60 + safeStartM;
    const endMinutes = safeEndH * 60 + safeEndM;

    if (nowMinutes < startMinutes || nowMinutes > endMinutes) {
      return {
        allowed: false,
        reason: `Sesi ujian hanya dapat diakses pada pukul ${schedule.accessStartTime} – ${schedule.accessEndTime}.`,
      };
    }
  }

  return { allowed: true };
}

export interface StudentLoginValidationResult {
  ok: boolean;
  error?: string;
  student?: StudentRecord;
  examPackage?: ExamPackage;
}

export type StudentTokenLookupResult =
  | { status: 'empty' }
  | { status: 'not_found' }
  | { status: 'blocked'; student: StudentRecord }
  | { status: 'schedule_closed'; student: StudentRecord; reason: string }
  | { status: 'no_exam'; student: StudentRecord }
  | { status: 'ready'; student: StudentRecord; packages: ExamPackage[] };

export function lookupStudentAvailableTokens(params: {
  nisn: string;
  students: StudentRecord[];
  packages: ExamPackage[];
  schedule: SessionScheduleConfig;
  now?: Date;
}): StudentTokenLookupResult {
  const cleanNisn = params.nisn.trim();
  if (!cleanNisn) {
    return { status: 'empty' };
  }

  const student = params.students.find((s) => s.nisn === cleanNisn);
  if (!student) {
    return { status: 'not_found' };
  }

  if (!student.active) {
    return { status: 'blocked', student };
  }

  const scheduleCheck = isWithinScheduleWindow(params.schedule, params.now);
  if (!scheduleCheck.allowed) {
    return {
      status: 'schedule_closed',
      student,
      reason:
        scheduleCheck.reason || 'Sesi ujian belum dibuka oleh Administrator.',
    };
  }

  const availablePackages = params.packages.filter(
    (p) =>
      p.isPublished &&
      (p.targetClasses.length === 0 ||
        p.targetClasses.includes(student.className))
  );

  if (availablePackages.length === 0) {
    return { status: 'no_exam', student };
  }

  return { status: 'ready', student, packages: availablePackages };
}

export function validateStudentLogin(params: {
  nisn: string;
  name?: string;
  className?: string;
  token: string;
  students: StudentRecord[];
  packages: ExamPackage[];
  schedule: SessionScheduleConfig;
  now?: Date;
}): StudentLoginValidationResult {
  const cleanNisn = params.nisn.trim();
  const cleanClass = (params.className || '').trim();
  const cleanToken = params.token.trim().toUpperCase();

  if (!cleanNisn || !cleanToken) {
    return {
      ok: false,
      error: 'Mohon lengkapi NISN dan Token Ujian.',
    };
  }

  const student = params.students.find((s) => s.nisn === cleanNisn);
  if (!student) {
    return {
      ok: false,
      error: `NISN "${cleanNisn}" tidak terdaftar dalam database sekolah. Hubungi pengawas atau Administrator.`,
    };
  }

  if (!student.active) {
    return {
      ok: false,
      error: `Akses ujian Anda sedang dinonaktifkan${
        student.blockReason ? ` (${student.blockReason})` : ''
      }. Hubungi Administrator sekolah.`,
    };
  }

  if (cleanClass && student.className.toLowerCase() !== cleanClass.toLowerCase()) {
    return {
      ok: false,
      error: `Kelas yang dipilih (${cleanClass}) tidak sesuai dengan data siswa terdaftar (${student.className}).`,
    };
  }

  const scheduleCheck = isWithinScheduleWindow(params.schedule, params.now);
  if (!scheduleCheck.allowed) {
    return { ok: false, error: scheduleCheck.reason };
  }

  const examPackage = params.packages.find(
    (p) => p.token.toUpperCase() === cleanToken && p.isPublished
  );
  if (!examPackage) {
    return {
      ok: false,
      error: `Token ujian "${cleanToken}" tidak valid atau paket ujian belum dipublikasikan.`,
    };
  }

  if (
    examPackage.targetClasses.length > 0 &&
    !examPackage.targetClasses.includes(student.className)
  ) {
    return {
      ok: false,
      error: `Paket ujian "${examPackage.title}" tidak ditujukan untuk kelas ${student.className}.`,
    };
  }

  return { ok: true, student, examPackage };
}

export function getRemainingMinSubmitSeconds(
  startedAtIso: string,
  minSubmitMinutes: number,
  nowMs: number = Date.now()
): number {
  if (minSubmitMinutes <= 0) return 0;
  const elapsedSec = Math.max(
    0,
    Math.floor((nowMs - new Date(startedAtIso).getTime()) / 1000)
  );
  const requiredSec = minSubmitMinutes * 60;
  return Math.max(0, requiredSec - elapsedSec);
}

export function getRemainingExamSeconds(
  startedAtIso: string,
  durationMinutes: number,
  extraMinutes: number,
  nowMs: number = Date.now()
): number {
  const totalSec = (durationMinutes + extraMinutes) * 60;
  const elapsedSec = Math.max(
    0,
    Math.floor((nowMs - new Date(startedAtIso).getTime()) / 1000)
  );
  return Math.max(0, totalSec - elapsedSec);
}

export function evaluateViolationEscalation(
  currentViolationCount: number,
  security: GlobalSecurityConfig
): { nextCount: number; shouldAutoLock: boolean; remainingBeforeLock: number } {
  const nextCount = currentViolationCount + 1;
  const limit = Math.max(1, Math.min(5, security.maxViolationTolerance));
  const shouldAutoLock = nextCount > limit;
  const remainingBeforeLock = Math.max(0, limit - nextCount);
  return { nextCount, shouldAutoLock, remainingBeforeLock };
}

export interface ParsedStudentCSVResult {
  students: Omit<StudentRecord, 'id'>[];
  errors: string[];
}

function stripBom(text: string): string {
  return text.replace(/^\uFEFF/, '');
}

/**
 * Splits a single CSV/delimited line honoring quoted values and escaped double-quotes.
 */
function splitDelimitedRow(line: string, delimiter: string): string[] {
  const cols: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      cols.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  cols.push(current.trim());
  return cols;
}

function detectRowDelimiter(line: string, preferred?: string): string {
  if (preferred && line.includes(preferred)) return preferred;
  if (line.includes('|')) return '|';
  if (line.includes('\t')) return '\t';
  if (line.includes(';')) return ';';
  return ',';
}

function cleanCellToken(val: string | undefined): string {
  return (val || '').trim().replace(/^'+/, '').trim();
}

export function parseStudentsCSV(csvText: string): ParsedStudentCSVResult {
  const lines = stripBom(csvText)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const students: Omit<StudentRecord, 'id'>[] = [];
  const errors: string[] = [];

  let headerDelimiter: string | undefined;
  let colMap: { nisn: number; name: number; className: number; status: number } | null = null;

  lines.forEach((line, idx) => {
    const delimiter = detectRowDelimiter(line, headerDelimiter);
    const parts = splitDelimitedRow(line, delimiter);

    // Detect header row & dynamically map column indices (supports optional leading "No" column from Excel)
    if (idx === 0) {
      const lowerCols = parts.map((p) => p.toLowerCase().replace(/[^a-z0-9]/g, ''));
      const nisnIdx = lowerCols.findIndex((c) => c === 'nisn' || c.includes('nisn') || c === 'nis');
      const nameIdx = lowerCols.findIndex((c) => c.includes('nama') || c === 'name');
      const classIdx = lowerCols.findIndex((c) => c.includes('kelas') || c === 'class' || c === 'rombel');
      const statusIdx = lowerCols.findIndex((c) => c.includes('status') || c.includes('aktif'));

      if (nisnIdx !== -1 && nameIdx !== -1) {
        headerDelimiter = delimiter;
        colMap = {
          nisn: nisnIdx,
          name: nameIdx,
          className: classIdx !== -1 ? classIdx : nameIdx + 1,
          status: statusIdx !== -1 ? statusIdx : (classIdx !== -1 ? classIdx : nameIdx + 1) + 1,
        };
        return;
      }
    }

    if (parts.length < 3) {
      errors.push(`Baris ${idx + 1}: Format tidak valid (minimal NISN, Nama, Kelas).`);
      return;
    }

    let nisnRaw = '';
    let nameRaw = '';
    let classRaw = '';
    let statusRaw = 'Aktif';

    if (colMap) {
      nisnRaw = parts[colMap.nisn] || '';
      nameRaw = parts[colMap.name] || '';
      classRaw = parts[colMap.className] || '';
      statusRaw = parts[colMap.status] || 'Aktif';
    } else if (
      parts.length >= 4 &&
      /^\d{1,4}\.?$/.test(cleanCellToken(parts[0])) &&
      /^\d{5,}$/.test(cleanCellToken(parts[1]))
    ) {
      // Auto-detect headerless Excel paste with leading "No" column: [No, NISN, Nama, Kelas, Status?]
      nisnRaw = parts[1] || '';
      nameRaw = parts[2] || '';
      classRaw = parts[3] || '';
      statusRaw = parts[4] || 'Aktif';
    } else {
      nisnRaw = parts[0] || '';
      nameRaw = parts[1] || '';
      classRaw = parts[2] || '';
      statusRaw = parts[3] || 'Aktif';
    }

    const nisn = cleanCellToken(nisnRaw).replace(/\s+/g, '');
    const name = cleanCellToken(nameRaw);
    const className = cleanCellToken(classRaw);

    if (!nisn || !name || !className) {
      errors.push(`Baris ${idx + 1}: NISN, Nama, atau Kelas kosong.`);
      return;
    }
    const statusLower = cleanCellToken(statusRaw).toLowerCase();
    const active = !(
      statusLower === 'nonaktif' ||
      statusLower === 'blokir' ||
      statusLower === 'diblokir' ||
      statusLower === 'tidak aktif' ||
      statusLower === 'false' ||
      statusLower === '0'
    );
    students.push({
      nisn,
      name,
      className: className.toUpperCase(),
      active,
      blockReason: active ? undefined : 'Dinonaktifkan via import CSV',
    });
  });

  return { students, errors };
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;

function isSingleKeyToken(val: string | undefined): boolean {
  return /^[A-E]$/i.test((val || '').trim());
}

function isMultiKeyToken(val: string | undefined): boolean {
  const clean = (val || '').trim();
  if (!clean) return false;
  return /^[A-E](\s*[,;/&\s]\s*[A-E])*$/i.test(clean);
}

function extractMultiKeys(raw: string | undefined, validIds: string[]): string[] {
  const matches = (raw || '').toUpperCase().match(/[A-E]/g) || [];
  const unique = [...new Set(matches)].filter((id) => validIds.includes(id));
  return unique.length > 0 ? unique : validIds.slice(0, 1);
}

function parseNaturalBlockQuestions(
  rawText: string,
  packageId: string
): { questions: Question[]; errors: string[] } | null {
  const lines = stripBom(rawText)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // Detect natural numbered/lettered choice blocks (A. / B. / C. / D. / E.)
  const optionLineRegex = /^([A-E])\s*[.)\]:-]\s*(.+)$/i;
  const keyLineRegex = /^(?:kunci(?:\s+jawaban)?|jawaban|answer)\s*[:=-]\s*(.+)$/i;
  const explLineRegex = /^(?:pembahasan|penjelasan|keterangan)\s*[:=-]\s*(.+)$/i;
  const pointsLineRegex = /^(?:bobot(?:\s+poin)?|poin|skor)\s*[:=-]\s*(\d+(?:[.,]\d+)?)$/i;

  const hasOptionLines = lines.filter((l) => optionLineRegex.test(l)).length >= 2;
  if (!hasOptionLines) return null;

  const questions: Question[] = [];
  const errors: string[] = [];
  let currentPromptParts: string[] = [];
  let currentOptions: { id: string; text: string }[] = [];
  let currentKeys: string[] = [];
  let currentExplanation = '';
  let currentPoints = 10;

  const flushCurrent = (blockIndex: number) => {
    const prompt = currentPromptParts
      .join(' ')
      .replace(/^\d+\s*[.)]\s*/, '')
      .trim();
    if (!prompt && currentOptions.length === 0) return;
    if (!prompt || currentOptions.length < 2) {
      errors.push(
        `Soal #${blockIndex}: Membutuhkan teks pertanyaan dan minimal 2 pilihan jawaban.`
      );
      return;
    }

    const validIds = currentOptions.map((o) => o.id);
    const cleanedKeys = [...new Set(currentKeys)].filter((k) => validIds.includes(k));
    const isComplex = cleanedKeys.length > 1;

    if (isComplex) {
      questions.push({
        id: `q-imp-${Date.now()}-${questions.length}`,
        packageId,
        type: 'multiple_choice',
        prompt,
        options: currentOptions,
        correctOptionIds: cleanedKeys,
        points: currentPoints,
        explanation: currentExplanation || 'Semua pilihan benar harus dipilih.',
      });
    } else {
      questions.push({
        id: `q-imp-${Date.now()}-${questions.length}`,
        packageId,
        type: 'single_choice',
        prompt,
        options: currentOptions,
        correctOptionId: cleanedKeys[0] || validIds[0],
        points: currentPoints,
        explanation: currentExplanation || 'Kunci jawaban sesuai materi pelajaran.',
      });
    }
  };

  const resetCurrent = () => {
    currentPromptParts = [];
    currentOptions = [];
    currentKeys = [];
    currentExplanation = '';
    currentPoints = 10;
  };

  for (const line of lines) {
    const optMatch = line.match(optionLineRegex);
    if (optMatch) {
      const letter = optMatch[1].toUpperCase();
      const text = optMatch[2].trim();
      // If we already saw this option letter (e.g. a new "A." starting), flush previous question
      if (currentOptions.some((o) => o.id === letter)) {
        flushCurrent(questions.length + 1);
        resetCurrent();
      }
      if (text) {
        currentOptions.push({ id: letter, text });
      }
      continue;
    }

    const keyMatch = line.match(keyLineRegex);
    if (keyMatch) {
      const letters = keyMatch[1].toUpperCase().match(/[A-E]/g) || [];
      currentKeys = letters;
      continue;
    }

    const explMatch = line.match(explLineRegex);
    if (explMatch) {
      currentExplanation = explMatch[1].trim();
      continue;
    }

    const ptsMatch = line.match(pointsLineRegex);
    if (ptsMatch) {
      const val = Number(ptsMatch[1].replace(',', '.'));
      if (Number.isFinite(val) && val > 0) {
        currentPoints = Number(val.toFixed(2));
      }
      continue;
    }

    // If options were already collected for the current question, a new plain/numbered line starts the next question
    if (currentOptions.length > 0) {
      flushCurrent(questions.length + 1);
      resetCurrent();
    }
    currentPromptParts.push(line);
  }

  flushCurrent(questions.length + 1);
  return { questions, errors };
}

export function parseQuestionsBulkText(
  rawText: string,
  packageId: string
): { questions: Question[]; errors: string[] } {
  const cleanedRaw = stripBom(rawText).trim();
  if (!cleanedRaw) {
    return { questions: [], errors: [] };
  }

  const lines = cleanedRaw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // Check if input looks like tabular format (PG / PGK / BS / header) vs natural Word/text blocks (1. ... A. B. C. D. E.)
  const firstLineLower = lines[0]?.toLowerCase() || '';
  const looksTabular =
    (firstLineLower.startsWith('tipe') && firstLineLower.includes('pertanyaan')) ||
    lines.some((l) => /^(pg|pgk|single|kompleks|bs|tf)\s*[|;\t,]/i.test(l));

  if (!looksTabular) {
    const natural = parseNaturalBlockQuestions(cleanedRaw, packageId);
    if (natural) return natural;
  }

  const questions: Question[] = [];
  const errors: string[] = [];

  let headerDelimiter: string | undefined;
  let hasExplicitOptionEColumn = false;

  lines.forEach((line, idx) => {
    const delimiter = detectRowDelimiter(line, headerDelimiter);
    const cols = splitDelimitedRow(line, delimiter);

    if (
      idx === 0 &&
      cols[0]?.toLowerCase().startsWith('tipe') &&
      line.toLowerCase().includes('pertanyaan')
    ) {
      headerDelimiter = delimiter;
      const normalizedHeaders = cols.map((c) => c.toLowerCase().replace(/\s+/g, ''));
      hasExplicitOptionEColumn = normalizedHeaders.some(
        (h) => h === 'opsie' || h === 'pilihane' || h === 'e' || h === 'optione'
      );
      return;
    }

    const typeCode = (cols[0] || '').toUpperCase();

    if (typeCode === 'PG' || typeCode === 'SINGLE' || typeCode === 'PGK' || typeCode === 'KOMPLEKS') {
      const isComplex = typeCode === 'PGK' || typeCode === 'KOMPLEKS';
      if (cols.length < 5) {
        errors.push(
          `Baris ${idx + 1}: Format ${typeCode} membutuhkan minimal pertanyaan, pilihan jawaban, dan kunci.`
        );
        return;
      }

      const prompt = cols[1] || '';
      if (!prompt) {
        errors.push(`Baris ${idx + 1}: Teks pertanyaan kosong.`);
        return;
      }

      // Dynamically determine whether column 6 (index 6) is Option E or Answer Key!
      // Supports:
      // - Header with OpsiE: [Tipe, Pertanyaan, A, B, C, D, E (optional blank), Kunci, Pembahasan?, Bobot?]
      // - 9+ cols without header: [Tipe, Pertanyaan, A, B, C, D, E, Kunci, Pembahasan, Bobot?]
      // - 8 cols without header:
      //     if cols[7] is a valid key (e.g. "E" or "A,E") and cols[6] is option text -> 5 options (A-E) without Pembahasan!
      //     otherwise -> 4 options (A-D) with Kunci at cols[6] and Pembahasan at cols[7]
      // - 7 cols without header: [Tipe, Pertanyaan, A, B, C, D, Kunci]
      // - 5-6 cols without header: supports 2-3 options (A-B / A-C) cleanly if needed
      let optionTexts: string[] = [];
      let keyCol = '';
      let explanationCol = '';
      let pointsCol = '';

      const keyCheck = isComplex ? isMultiKeyToken : isSingleKeyToken;

      if (hasExplicitOptionEColumn) {
        optionTexts = [cols[2] || '', cols[3] || '', cols[4] || '', cols[5] || '', cols[6] || ''];
        keyCol = cols[7] || '';
        explanationCol = cols[8] || '';
        pointsCol = cols[9] || '';
      } else if (cols.length >= 9) {
        // Check whether cols[7] is the key (standard 5-option A-E row) or cols[6] is key with extra trailing column
        if (keyCheck(cols[7]) || !keyCheck(cols[6])) {
          optionTexts = [cols[2] || '', cols[3] || '', cols[4] || '', cols[5] || '', cols[6] || ''];
          keyCol = cols[7] || '';
          explanationCol = cols[8] || '';
          pointsCol = cols[9] || '';
        } else {
          optionTexts = [cols[2] || '', cols[3] || '', cols[4] || '', cols[5] || ''];
          keyCol = cols[6] || '';
          explanationCol = cols[7] || '';
          pointsCol = cols[8] || '';
        }
      } else if (cols.length === 8) {
        // Distinguish between:
        // (a) PG | Q | A | B | C | D | E | Kunci  (5 options, no explanation)
        // (b) PG | Q | A | B | C | D | Kunci | Pembahasan (4 options + explanation)
        const col6IsKey = keyCheck(cols[6]);
        const col7IsKey = keyCheck(cols[7]);
        if (col7IsKey && !col6IsKey) {
          optionTexts = [cols[2] || '', cols[3] || '', cols[4] || '', cols[5] || '', cols[6] || ''];
          keyCol = cols[7] || '';
        } else if (col7IsKey && col6IsKey && cols[6].length === 1 && cols[7].length === 1 && cols[5].length <= 2) {
          // Edge case: all options are single letters (e.g. A, B, C, D, E) and cols[7] is the key
          optionTexts = [cols[2] || '', cols[3] || '', cols[4] || '', cols[5] || '', cols[6] || ''];
          keyCol = cols[7] || '';
        } else {
          optionTexts = [cols[2] || '', cols[3] || '', cols[4] || '', cols[5] || ''];
          keyCol = cols[6] || '';
          explanationCol = cols[7] || '';
        }
      } else if (cols.length === 7) {
        optionTexts = [cols[2] || '', cols[3] || '', cols[4] || '', cols[5] || ''];
        keyCol = cols[6] || '';
      } else {
        // 5 or 6 cols (e.g. 2-3 options + key + optional explanation)
        const keyPos = cols.length === 6 && !keyCheck(cols[5]) && keyCheck(cols[4]) ? 4 : cols.length - 1;
        optionTexts = cols.slice(2, keyPos);
        keyCol = cols[keyPos] || '';
        explanationCol = cols[keyPos + 1] || '';
      }

      // Build option list dynamically matching ONLY populated options (e.g. A-E if E filled, A-D if E blank)
      const opts: { id: string; text: string }[] = [];
      optionTexts.forEach((txt, optIdx) => {
        const cleanText = txt.trim();
        if (cleanText && optIdx < OPTION_LETTERS.length) {
          opts.push({ id: OPTION_LETTERS[optIdx], text: cleanText });
        }
      });

      if (opts.length < 2) {
        errors.push(`Baris ${idx + 1}: Minimal harus terdapat 2 opsi jawaban yang terisi.`);
        return;
      }

      const validIds = opts.map((o) => o.id);
      const parsedPts = Number(pointsCol.replace(',', '.'));
      const points = Number.isFinite(parsedPts) && parsedPts > 0 ? Number(parsedPts.toFixed(2)) : 10;

      if (isComplex) {
        const correctOptionIds = extractMultiKeys(keyCol, validIds);
        questions.push({
          id: `q-imp-${Date.now()}-${idx}`,
          packageId,
          type: 'multiple_choice',
          prompt,
          options: opts,
          correctOptionIds,
          points,
          explanation: explanationCol || 'Semua pilihan benar harus dipilih.',
        });
      } else {
        const rawKey = (keyCol.trim().toUpperCase().match(/[A-E]/) || [])[0] || validIds[0];
        const correctOptionId = validIds.includes(rawKey) ? rawKey : validIds[0];
        questions.push({
          id: `q-imp-${Date.now()}-${idx}`,
          packageId,
          type: 'single_choice',
          prompt,
          options: opts,
          correctOptionId,
          points,
          explanation: explanationCol || 'Kunci jawaban sesuai materi pelajaran.',
        });
      }
    } else if (typeCode === 'BS' || typeCode === 'TF') {
      if (cols.length < 3) {
        errors.push(
          `Baris ${idx + 1}: Format BS membutuhkan minimal 3 kolom (BS | Pernyataan | Benar/Salah | Pembahasan).`
        );
        return;
      }
      const prompt = cols[1] || '';
      if (!prompt) {
        errors.push(`Baris ${idx + 1}: Pernyataan BS kosong.`);
        return;
      }
      // Support both compact BS rows (BS | Pernyataan | Benar | Pembahasan)
      // and spreadsheet-aligned rows where Benar/Salah sits in the Kunci column!
      let rawBool = (cols[2] || '').trim().toLowerCase();
      let expl = cols[3] || '';
      if (
        rawBool !== 'benar' &&
        rawBool !== 'salah' &&
        rawBool !== 'true' &&
        rawBool !== 'false' &&
        hasExplicitOptionEColumn &&
        cols[7]
      ) {
        rawBool = cols[7].trim().toLowerCase();
        expl = cols[8] || '';
      }
      const correctBoolean = rawBool === 'benar' || rawBool === 'true' || rawBool === 'b';
      questions.push({
        id: `q-imp-${Date.now()}-${idx}`,
        packageId,
        type: 'true_false',
        prompt,
        correctBoolean,
        points: 10,
        explanation:
          expl || `Pernyataan tersebut bernilai ${correctBoolean ? 'Benar' : 'Salah'}.`,
      });
    } else {
      errors.push(
        `Baris ${idx + 1}: Tipe soal "${cols[0]}" tidak dikenali (gunakan PG, PGK, atau BS).`
      );
    }
  });

  return { questions, errors };
}

export function buildGradesCSV(
  examPackage: ExamPackage,
  attempts: ExamAttempt[]
): string {
  const headers = [
    'NISN',
    'Nama Siswa',
    'Kelas',
    'Paket Ujian',
    'Status Pengerjaan',
    'Nilai',
    'KKM',
    'Keterangan Kelulusan',
    'Jumlah Pelanggaran',
    'Status Kejujuran',
    'Waktu Mulai',
    'Waktu Selesai',
  ];

  const escapeCSV = (val: string | number | undefined) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = attempts.map((a) => {
    const statusLabel =
      a.status === 'completed'
        ? 'Selesai'
        : a.status === 'locked'
        ? 'Terkunci Sistem (Indikasi Kecurangan)'
        : a.status === 'in_progress'
        ? 'Sedang Mengerjakan'
        : 'Belum Mulai';

    const honestyLabel =
      a.status === 'locked'
        ? 'Terkunci Pelanggaran'
        : a.violationCount === 0
        ? 'Jujur (0 Pelanggaran)'
        : `Peringatan (${a.violationCount}x)`;

    const passLabel =
      a.score === undefined
        ? '-'
        : a.score >= examPackage.kkm
        ? 'Lulus KKM'
        : 'Remedial';

    return [
      a.studentNisn,
      a.studentName,
      a.className,
      examPackage.title,
      statusLabel,
      a.score ?? '-',
      examPackage.kkm,
      passLabel,
      a.violationCount,
      honestyLabel,
      a.startedAt ? new Date(a.startedAt).toLocaleString('id-ID') : '-',
      a.submittedAt ? new Date(a.submittedAt).toLocaleString('id-ID') : '-',
    ]
      .map(escapeCSV)
      .join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

export function formatSecondsToClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (hrs > 0) {
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}

export function generateStudentsCSVTemplate(): string {
  return [
    'NISN,Nama,Kelas,Status_Aktif',
    '0081234567,Contoh Nama Siswa 1,X-IPA-1,Aktif',
    '0081234568,Contoh Nama Siswa 2,X-IPA-2,Aktif',
  ].join('\n');
}

export function generateTeachersCSVTemplate(): string {
  return [
    'Username,NIP,Nama,Password,Mapel,Kelas',
    'guru_fisika,198801012015031001,Nama Guru S.Pd.,Guru123!,Fisika;IPA,X-IPA-1;X-IPA-2',
  ].join('\n');
}

export function generateQuestionsCSVTemplate(): string {
  return [
    'Tipe | Pertanyaan | OpsiA | OpsiB | OpsiC | OpsiD | OpsiE | Kunci | Pembahasan',
    'PG | Contoh soal 5 opsi (A-E): Ibu kota Provinsi Riau adalah? | Medan | Pekanbaru | Padang | Jambi | Palembang | B | Ibu kota Provinsi Riau adalah Pekanbaru.',
    'PG | Contoh soal 4 opsi (kosongkan OpsiE jika hanya A-D): Hasil dari 6 × 7 adalah? | 36 | 40 | 42 | 48 |  | C | 6 dikali 7 sama dengan 42.',
    'PGK | Pilih semua bilangan prima berikut! | 2 | 4 | 5 | 9 | 11 | A,C,E | Bilangan prima pada pilihan adalah 2, 5, dan 11.',
    'BS | Air murni mendidih pada suhu 100°C di tekanan 1 atm. | Benar | Pada tekanan standar 1 atm titik didih air adalah 100°C.',
  ].join('\n');
}

export function parseTeachersCSV(csvText: string): {
  teachers: Array<{
    username: string;
    nip: string;
    name: string;
    password: string;
    subjects: string[];
    classes: string[];
    active: boolean;
  }>;
  errors: string[];
} {
  const lines = stripBom(csvText)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const teachers: Array<{
    username: string;
    nip: string;
    name: string;
    password: string;
    subjects: string[];
    classes: string[];
    active: boolean;
  }> = [];
  const errors: string[] = [];

  lines.forEach((line, idx) => {
    if (
      idx === 0 &&
      line.toLowerCase().includes('username') &&
      line.toLowerCase().includes('nama')
    ) {
      return;
    }
    const delimiter = line.includes('\t') ? '\t' : ',';
    const cols = splitDelimitedRow(line, delimiter);
    if (cols.length < 4) {
      errors.push(`Baris ${idx + 1}: Minimal membutuhkan kolom Username, NIP, Nama, Password.`);
      return;
    }
    const [username, nip, name, password, subjectsRaw = 'Umum', classesRaw = ''] = cols;
    if (!username || !name || !password) {
      errors.push(`Baris ${idx + 1}: Username, Nama, atau Password tidak boleh kosong.`);
      return;
    }
    const subjects = subjectsRaw
      .split(/[;|]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const classes = classesRaw
      .split(/[;|]/)
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);

    teachers.push({
      username,
      nip: nip || '-',
      name,
      password,
      subjects: subjects.length > 0 ? subjects : ['Umum'],
      classes,
      active: true,
    });
  });

  return { teachers, errors };
}

export interface CameraBehaviorInput {
  /** Normalized horizontal shift of facial/motion centroid relative to baseline (-1 left .. +1 right) */
  horizontalShift: number;
  /** Ratio of pixels changed in left vs right regions (0..1) indicating rapid head turn */
  lateralMotionScore: number;
  /** Audio RMS loudness (0..1) from microphone analyser */
  audioRms: number;
  /** Consecutive frames where head appears turned away */
  consecutiveTurnFrames: number;
  /** Consecutive frames where sustained voice/talking audio is detected */
  consecutiveSpeechFrames: number;
}

export interface CameraBehaviorEvaluation {
  status: 'focused' | 'looking_away' | 'talking';
  nextTurnFrames: number;
  nextSpeechFrames: number;
  shouldFlagViolation: boolean;
  violationType?: string;
  violationDetail?: string;
}

/**
 * Pure heuristic evaluator for client-side webcam head-turn & microphone talking detection.
 */
export function evaluateCameraBehavior(
  input: CameraBehaviorInput
): CameraBehaviorEvaluation {
  const isLookingSideways =
    Math.abs(input.horizontalShift) >= 0.24 || input.lateralMotionScore >= 0.22;
  const isTalking = input.audioRms >= 0.085;

  const nextTurnFrames = isLookingSideways ? input.consecutiveTurnFrames + 1 : 0;
  const nextSpeechFrames = isTalking ? input.consecutiveSpeechFrames + 1 : 0;

  if (nextSpeechFrames >= 3) {
    return {
      status: 'talking',
      nextTurnFrames: 0,
      nextSpeechFrames: 0,
      shouldFlagViolation: true,
      violationType: 'Deteksi Kamera & Audio: Terindikasi Mengobrol',
      violationDetail:
        'Mikrofon mendeteksi suara percakapan berulang selama ujian berlangsung.',
    };
  }

  if (nextTurnFrames >= 3) {
    const dir = input.horizontalShift < 0 ? 'ke kiri' : 'ke kanan';
    return {
      status: 'looking_away',
      nextTurnFrames: 0,
      nextSpeechFrames: 0,
      shouldFlagViolation: true,
      violationType: 'Deteksi Kamera: Melihat Kanan / Kiri',
      violationDetail: `Kamera pengawas mendeteksi pergerakan kepala menoleh ${dir} atau menjauh dari layar ujian.`,
    };
  }

  return {
    status: isTalking ? 'talking' : isLookingSideways ? 'looking_away' : 'focused',
    nextTurnFrames,
    nextSpeechFrames,
    shouldFlagViolation: false,
  };
}

export function applySelectiveDelete<
  T extends {
    students: unknown[];
    teachers: unknown[];
    classes: unknown[];
    packages: unknown[];
    questions: unknown[];
    attempts: unknown[];
    violations: unknown[];
    auditLogs: unknown[];
  }
>(
  db: T,
  options: {
    students: boolean;
    teachers: boolean;
    classes: boolean;
    packagesAndQuestions: boolean;
    attempts: boolean;
    violations: boolean;
    auditLogs: boolean;
  }
): { nextDb: T; deletedCategories: string[] } {
  const deletedCategories: string[] = [];
  const nextDb = { ...db };

  if (options.students) {
    nextDb.students = [];
    deletedCategories.push('Data Siswa');
  }
  if (options.teachers) {
    nextDb.teachers = [];
    deletedCategories.push('Data Guru');
  }
  if (options.classes) {
    nextDb.classes = [];
    deletedCategories.push('Daftar Kelas');
  }
  if (options.packagesAndQuestions) {
    nextDb.packages = [];
    nextDb.questions = [];
    deletedCategories.push('Paket Ujian & Bank Soal');
  }
  if (options.attempts) {
    nextDb.attempts = [];
    deletedCategories.push('Riwayat Ujian & Nilai');
  }
  if (options.violations) {
    nextDb.violations = [];
    deletedCategories.push('Log Pelanggaran');
  }
  if (options.auditLogs) {
    nextDb.auditLogs = [];
    deletedCategories.push('Audit Log Aktivitas');
  }

  return { nextDb, deletedCategories };
}

export type WeightDistributionMode =
  | { mode: 'equal_target'; targetTotal: number }
  | { mode: 'uniform'; pointsPerQuestion: number }
  | {
      mode: 'by_type';
      weightsByType: Record<Question['type'], number>;
    };

/**
 * Distributes point weights across a list of questions (optionally scoped to targetIds).
 * Guarantees positive weights (minimum 0.1) and exact sum preservation in equal_target mode.
 */
export function distributeQuestionWeights(
  questions: Question[],
  config: WeightDistributionMode,
  targetIds?: string[]
): Question[] {
  const idSet = targetIds && targetIds.length > 0 ? new Set(targetIds) : null;
  const matchedIndices: number[] = [];

  questions.forEach((q, idx) => {
    if (!idSet || idSet.has(q.id)) {
      matchedIndices.push(idx);
    }
  });

  if (matchedIndices.length === 0) return questions;

  if (config.mode === 'equal_target') {
    const safeTarget = Math.max(1, Number(config.targetTotal) || 100);
    const count = matchedIndices.length;
    const rawEach = safeTarget / count;
    const baseEach = Math.floor(rawEach * 100) / 100;
    const remainder = Number((safeTarget - baseEach * count).toFixed(2));

    const updated = [...questions];
    matchedIndices.forEach((qIdx, pos) => {
      const pts =
        pos === count - 1
          ? Number((baseEach + remainder).toFixed(2))
          : Number(baseEach.toFixed(2));
      updated[qIdx] = { ...updated[qIdx], points: Math.max(0.1, pts) };
    });
    return updated;
  }

  if (config.mode === 'uniform') {
    const safePoints = Math.max(0.1, Number(config.pointsPerQuestion) || 1);
    const rounded = Number(safePoints.toFixed(2));
    return questions.map((q, idx) =>
      matchedIndices.includes(idx) ? { ...q, points: rounded } : q
    );
  }

  // by_type
  return questions.map((q, idx) => {
    if (!matchedIndices.includes(idx)) return q;
    const raw = Number(config.weightsByType[q.type]);
    const safePoints = Number.isFinite(raw) && raw > 0 ? Number(raw.toFixed(2)) : q.points;
    return { ...q, points: safePoints };
  });
}

export interface CollectiveQuestionPatch {
  id: string;
  prompt?: string;
  points?: number;
  explanation?: string;
  correctOptionId?: string;
  correctOptionIds?: string[];
  correctBoolean?: boolean;
  options?: Question['options'];
  packageId?: string;
}

export function applyCollectiveQuestionEdits(
  allQuestions: Question[],
  patches: CollectiveQuestionPatch[]
): Question[] {
  if (patches.length === 0) return allQuestions;
  const patchMap = new Map(patches.map((p) => [p.id, p]));
  return allQuestions.map((q) => {
    const patch = patchMap.get(q.id);
    if (!patch) return q;
    const nextPoints =
      patch.points !== undefined && Number.isFinite(patch.points) && patch.points > 0
        ? Number(patch.points.toFixed(2))
        : q.points;
    return {
      ...q,
      prompt: patch.prompt !== undefined ? patch.prompt.trim() || q.prompt : q.prompt,
      points: nextPoints,
      explanation:
        patch.explanation !== undefined ? patch.explanation.trim() : q.explanation,
      correctOptionId:
        q.type === 'single_choice' && patch.correctOptionId !== undefined
          ? patch.correctOptionId
          : q.correctOptionId,
      correctOptionIds:
        q.type === 'multiple_choice' && patch.correctOptionIds !== undefined
          ? patch.correctOptionIds.length > 0
            ? patch.correctOptionIds
            : q.correctOptionIds
          : q.correctOptionIds,
      correctBoolean:
        q.type === 'true_false' && patch.correctBoolean !== undefined
          ? patch.correctBoolean
          : q.correctBoolean,
      options:
        (q.type === 'single_choice' || q.type === 'multiple_choice') &&
        patch.options !== undefined
          ? patch.options
          : q.options,
      packageId: patch.packageId || q.packageId,
    };
  });
}

export function validateAppsScriptUrl(url: string): {
  ok: boolean;
  normalizedUrl: string;
  error?: string;
} {
  const trimmed = url.trim();
  if (!trimmed) {
    return {
      ok: false,
      normalizedUrl: '',
      error: 'URL Web App Google Apps Script wajib diisi.',
    };
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') {
      return {
        ok: false,
        normalizedUrl: trimmed,
        error: 'URL Google Apps Script harus menggunakan protokol HTTPS.',
      };
    }
    if (parsed.username || parsed.password || parsed.port) {
      return {
        ok: false,
        normalizedUrl: trimmed,
        error: 'URL Google Apps Script tidak boleh mengandung kredensial atau port khusus.',
      };
    }
    const host = parsed.hostname.toLowerCase();
    const allowedHost =
      host === 'script.google.com' ||
      host === 'script.googleusercontent.com';
    if (!allowedHost) {
      return {
        ok: false,
        normalizedUrl: trimmed,
        error:
          'Domain harus berasal dari Google Apps Script (https://script.google.com/macros/s/.../exec).',
      };
    }
    if (host === 'script.google.com') {
      if (/\/macros\/u\/\d+\/s\//.test(parsed.pathname)) {
        parsed.pathname = parsed.pathname.replace(/\/macros\/u\/\d+\/s\//, '/macros/s/');
      }
      const isMacrosPath =
        parsed.pathname.startsWith('/macros/s/') ||
        parsed.pathname.startsWith('/a/macros/');
      if (!isMacrosPath) {
        return {
          ok: false,
          normalizedUrl: trimmed,
          error:
            'Gunakan URL Deployment Web App yang berakhiran /exec dari menu Terapkan > Deployment baru > Aplikasi Web.',
        };
      }
      if (parsed.pathname.endsWith('/dev')) {
        return {
          ok: false,
          normalizedUrl: trimmed,
          error:
            'URL berakhiran /dev adalah tautan uji internal. Gunakan URL Deployment produksi yang berakhiran /exec.',
        };
      }
      if (!parsed.pathname.endsWith('/exec')) {
        return {
          ok: false,
          normalizedUrl: trimmed,
          error:
            'URL Web App Google Apps Script harus berakhiran /exec. Salin ulang dari menu Terapkan > Kelola Deployment.',
        };
      }
    }
    return { ok: true, normalizedUrl: parsed.toString() };
  } catch {
    return {
      ok: false,
      normalizedUrl: trimmed,
      error: 'Format URL Web App Google Apps Script tidak valid.',
    };
  }
}

export function generateGoogleAppsScriptCode(params: {
  syncSecret?: string;
  schoolName?: string;
}): string {
  const escapedSecret = (params.syncSecret || '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'");
  const schoolLabel = (params.schoolName || 'CerdasExam CBT').replace(/'/g, "\\'");

  return `/**
 * CerdasExam CBT — Google Spreadsheet & Apps Script Auto-Sync Connector
 * Sekolah: ${schoolLabel}
 *
 * Cara Pemasangan:
 * 1. Buka Google Spreadsheet baru -> menu Ekstensi -> Apps Script.
 * 2. Hapus seluruh kode bawaan, tempel kode ini, lalu simpan (Ctrl+S).
 * 3. Klik "Terapkan" (Deploy) -> "Deployment baru" -> Jenis: "Aplikasi Web".
 * 4. Jalankan sebagai: "Saya" | Yang memiliki akses: "Siapa saja" -> Klik "Terapkan".
 * 5. Salin URL Aplikasi Web (/exec) dan tempel ke menu Audit & Backup -> Penyimpanan Spreadsheet.
 */

var SYNC_SECRET = '${escapedSecret}';
var MASTER_SHEET = 'CBT_Master_JSON';
var CHUNK_SIZE = 45000;

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function isAuthorized(secret) {
  if (!SYNC_SECRET) return true;
  return String(secret || '') === String(SYNC_SECRET);
}

function getOrCreateSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

function readMasterDatabase(ss) {
  var sheet = ss.getSheetByName(MASTER_SHEET);
  if (!sheet || sheet.getLastRow() < 2) {
    return { database: null, updatedAt: null };
  }
  var updatedAt = sheet.getRange(2, 1).getValue() || null;
  var lastRow = sheet.getLastRow();
  var chunks = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
  var raw = '';
  for (var i = 0; i < chunks.length; i++) {
    raw += String(chunks[i][0] || '');
  }
  if (!raw) return { database: null, updatedAt: updatedAt };
  return { database: JSON.parse(raw), updatedAt: String(updatedAt || '') };
}

function writeMasterDatabase(ss, dbObj, updatedAt) {
  var sheet = getOrCreateSheet(ss, MASTER_SHEET);
  sheet.clearContents();
  sheet.getRange(1, 1, 1, 2).setValues([['UpdatedAt', 'JSON_Chunk']]);
  var raw = JSON.stringify(dbObj);
  var rows = [];
  for (var i = 0; i < raw.length; i += CHUNK_SIZE) {
    rows.push([i === 0 ? updatedAt : '', raw.slice(i, i + CHUNK_SIZE)]);
  }
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, 2).setValues(rows);
  }
}

function safeSheetCell(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'number' || typeof val === 'boolean') return val;
  var str = String(val);
  if (/^[=+\\-@]/.test(str)) {
    return "'" + str;
  }
  return str;
}

function writeTableSheet(ss, name, headers, rows) {
  var sheet = getOrCreateSheet(ss, name);
  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  if (rows.length > 0) {
    var safeRows = rows.map(function (r) {
      return r.map(safeSheetCell);
    });
    sheet.getRange(2, 1, safeRows.length, headers.length).setValues(safeRows);
  }
}

function mirrorReadableSheets(ss, db) {
  var students = Array.isArray(db.students) ? db.students : [];
  writeTableSheet(
    ss,
    'Siswa',
    ['NISN', 'Nama Lengkap', 'Kelas', 'Status Aktif', 'Keterangan'],
    students.map(function (s) {
      return [s.nisn || '', s.name || '', s.className || '', s.active ? 'Aktif' : 'Diblokir', s.blockReason || ''];
    })
  );

  var teachers = Array.isArray(db.teachers) ? db.teachers : [];
  writeTableSheet(
    ss,
    'Guru',
    ['Username', 'NIP', 'Nama Guru', 'Mata Pelajaran', 'Kelas Ampuan', 'Status'],
    teachers.map(function (t) {
      return [
        t.username || '',
        t.nip || '',
        t.name || '',
        (t.subjects || []).join(', '),
        (t.classes || []).join(', '),
        t.active ? 'Aktif' : 'Nonaktif'
      ];
    })
  );

  var packages = Array.isArray(db.packages) ? db.packages : [];
  var pkgMap = {};
  packages.forEach(function (p) { pkgMap[p.id] = p.title || p.id; });
  writeTableSheet(
    ss,
    'Paket_Ujian',
    ['Token', 'Judul Paket', 'Mata Pelajaran', 'Kategori', 'Durasi (Menit)', 'KKM', 'Kelas Target', 'Publikasi'],
    packages.map(function (p) {
      return [
        p.token || '',
        p.title || '',
        p.subject || '',
        p.category || '',
        p.durationMinutes || 0,
        p.kkm || 0,
        (p.targetClasses || []).join(', '),
        p.isPublished ? 'Aktif' : 'Draf'
      ];
    })
  );

  var questions = Array.isArray(db.questions) ? db.questions : [];
  writeTableSheet(
    ss,
    'Bank_Soal',
    ['Paket Ujian', 'Jenis Soal', 'Bobot Poin', 'Pertanyaan', 'Kunci Jawaban', 'Pembahasan'],
    questions.map(function (q) {
      var key = q.type === 'single_choice'
        ? (q.correctOptionId || '')
        : q.type === 'multiple_choice'
          ? (q.correctOptionIds || []).join(', ')
          : q.type === 'true_false'
            ? (q.correctBoolean ? 'BENAR' : 'SALAH')
            : (q.matchingPairs || []).map(function (m) { return m.left + ' = ' + m.right; }).join(' | ');
      return [pkgMap[q.packageId] || q.packageId || '', q.type || '', q.points || 0, q.prompt || '', key, q.explanation || ''];
    })
  );

  var attempts = Array.isArray(db.attempts) ? db.attempts : [];
  writeTableSheet(
    ss,
    'Rekap_Nilai',
    ['Waktu Selesai', 'NISN', 'Nama Siswa', 'Kelas', 'Paket Ujian', 'Status', 'Nilai', 'Benar', 'Total Soal', 'Pelanggaran'],
    attempts.map(function (a) {
      return [
        a.submittedAt || a.startedAt || '',
        a.studentNisn || '',
        a.studentName || '',
        a.className || '',
        pkgMap[a.packageId] || a.packageId || '',
        a.status || '',
        a.score !== undefined ? a.score : '',
        a.correctCount !== undefined ? a.correctCount : '',
        a.totalQuestions !== undefined ? a.totalQuestions : '',
        a.violationCount || 0
      ];
    })
  );

  var violations = Array.isArray(db.violations) ? db.violations : [];
  writeTableSheet(
    ss,
    'Pelanggaran',
    ['Waktu', 'NISN', 'Nama Siswa', 'Kelas', 'Paket Ujian', 'Jenis', 'Detail'],
    violations.map(function (v) {
      return [v.timestamp || '', v.studentNisn || '', v.studentName || '', v.className || '', v.packageTitle || '', v.type || '', v.detail || ''];
    })
  );
}

function doGet(e) {
  try {
    var params = (e && e.parameter) ? e.parameter : {};
    if (!isAuthorized(params.secret)) {
      return jsonResponse({ ok: false, error: 'Kunci rahasia (syncSecret) tidak cocok.' });
    }
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var action = params.action || 'ping';
    if (action === 'ping') {
      var existing = readMasterDatabase(ss);
      return jsonResponse({
        ok: true,
        spreadsheetName: ss.getName(),
        spreadsheetUrl: ss.getUrl(),
        hasData: !!existing.database,
        updatedAt: existing.updatedAt
      });
    }
    if (action === 'pull') {
      var res = readMasterDatabase(ss);
      return jsonResponse({
        ok: true,
        spreadsheetName: ss.getName(),
        database: res.database,
        updatedAt: res.updatedAt
      });
    }
    return jsonResponse({ ok: false, error: 'Aksi tidak dikenal: ' + action });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  try {
    var rawBody = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    var payload = JSON.parse(rawBody);
    if (!isAuthorized(payload.secret)) {
      return jsonResponse({ ok: false, error: 'Kunci rahasia (syncSecret) tidak cocok.' });
    }
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var action = payload.action || 'push';
    if (action === 'push') {
      if (!payload.database || typeof payload.database !== 'object') {
        return jsonResponse({ ok: false, error: 'Data database tidak ditemukan dalam payload.' });
      }
      var updatedAt = new Date().toISOString();
      writeMasterDatabase(ss, payload.database, updatedAt);
      try {
        mirrorReadableSheets(ss, payload.database);
      } catch (mirrorErr) {
        // Master JSON already saved safely; ignore non-fatal readable tab mirror errors
      }
      return jsonResponse({
        ok: true,
        spreadsheetName: ss.getName(),
        spreadsheetUrl: ss.getUrl(),
        updatedAt: updatedAt
      });
    }
    return jsonResponse({ ok: false, error: 'Aksi POST tidak dikenal: ' + action });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}
`;
}

export interface RemotePullGuardParams {
  isManual: boolean;
  hasPendingLocalChanges: boolean;
  pullStartedMutationVersion: number;
  currentMutationVersion: number;
  localLastSyncedAt?: string | null;
  remoteUpdatedAt?: string | null;
  localHasData: boolean;
  remoteHasData: boolean;
}

/**
 * Prevents automatic background Spreadsheet pulls from clobbering freshly imported
 * or unpushed local data (students, questions, packages, attempts).
 */
export function shouldApplyRemotePull(params: RemotePullGuardParams): {
  apply: boolean;
  reason: string;
} {
  if (!params.remoteHasData) {
    return { apply: false, reason: 'remote_empty' };
  }
  if (params.isManual) {
    return { apply: true, reason: 'manual_pull' };
  }
  if (params.hasPendingLocalChanges) {
    return { apply: false, reason: 'pending_local_changes' };
  }
  if (params.currentMutationVersion !== params.pullStartedMutationVersion) {
    return { apply: false, reason: 'stale_pull_during_mutation' };
  }
  if (params.localHasData && params.localLastSyncedAt && params.remoteUpdatedAt) {
    const localTs = Date.parse(params.localLastSyncedAt);
    const remoteTs = Date.parse(params.remoteUpdatedAt);
    if (Number.isFinite(localTs) && Number.isFinite(remoteTs) && remoteTs <= localTs) {
      return { apply: false, reason: 'remote_not_newer' };
    }
  }
  return { apply: true, reason: 'newer_remote_data' };
}

export function applyBulkUserStatus<
  T extends { id: string; active: boolean; blockReason?: string }
>(
  items: T[],
  targetIds: string[],
  active: boolean,
  blockReason?: string
): { nextItems: T[]; affectedCount: number } {
  const idSet = new Set(targetIds);
  if (idSet.size === 0) {
    return { nextItems: items, affectedCount: 0 };
  }
  let affectedCount = 0;
  const nextItems = items.map((item) => {
    if (!idSet.has(item.id)) return item;
    affectedCount += 1;
    if ('blockReason' in item || !active) {
      return {
        ...item,
        active,
        blockReason: active ? undefined : blockReason || 'Diblokir massal oleh Administrator',
      };
    }
    return {
      ...item,
      active,
    };
  });
  return { nextItems, affectedCount };
}

export function applyBulkDeleteById<T extends { id: string }>(
  items: T[],
  targetIds: string[]
): { nextItems: T[]; removedCount: number } {
  const idSet = new Set(targetIds);
  if (idSet.size === 0) {
    return { nextItems: items, removedCount: 0 };
  }
  const nextItems = items.filter((item) => !idSet.has(item.id));
  return {
    nextItems,
    removedCount: items.length - nextItems.length,
  };
}

export interface AssignedExamProgressItem {
  examPackage: ExamPackage;
  attempt?: ExamAttempt;
  status: StudentAttemptStatus;
  totalQuestions: number;
  answeredCount: number;
  itemCompletionPercent: number;
}

export interface StudentExamProgressSummary {
  totalAssigned: number;
  completedCount: number;
  inProgressCount: number;
  notStartedCount: number;
  lockedCount: number;
  passedCount: number;
  completionPercent: number;
  averageScore: number | null;
  items: AssignedExamProgressItem[];
}

/**
 * Computes completion progress across all exams assigned to a student's class
 * (plus any exam the student already has an attempt record for).
 */
export function computeStudentExamProgress(params: {
  student: StudentRecord;
  packages: ExamPackage[];
  questions: Question[];
  attempts: ExamAttempt[];
}): StudentExamProgressSummary {
  const { student, packages, questions, attempts } = params;

  const studentAttemptsByPkg = new Map<string, ExamAttempt>();
  for (const attempt of attempts) {
    if (attempt.studentId === student.id || attempt.studentNisn === student.nisn) {
      studentAttemptsByPkg.set(attempt.packageId, attempt);
    }
  }

  const assignedPackages = packages.filter((pkg) => {
    const matchesClass =
      pkg.isPublished &&
      (pkg.targetClasses.length === 0 || pkg.targetClasses.includes(student.className));
    return matchesClass || studentAttemptsByPkg.has(pkg.id);
  });

  const questionsByPkg = new Map<string, Question[]>();
  for (const q of questions) {
    const list = questionsByPkg.get(q.packageId);
    if (list) {
      list.push(q);
    } else {
      questionsByPkg.set(q.packageId, [q]);
    }
  }

  const items: AssignedExamProgressItem[] = assignedPackages.map((examPackage) => {
    const attempt = studentAttemptsByPkg.get(examPackage.id);
    const pkgQuestions = questionsByPkg.get(examPackage.id) || [];
    const totalQuestions = pkgQuestions.length;

    let answeredCount = 0;
    if (attempt) {
      for (const q of pkgQuestions) {
        if (isQuestionAnswered(q, attempt.answers[q.id])) {
          answeredCount += 1;
        }
      }
    }

    const status: StudentAttemptStatus = attempt ? attempt.status : 'not_started';
    const isFinished = status === 'completed' || status === 'locked';
    const itemCompletionPercent = isFinished
      ? 100
      : totalQuestions > 0
        ? Math.min(100, Math.round((answeredCount / totalQuestions) * 100))
        : 0;

    return {
      examPackage,
      attempt,
      status,
      totalQuestions,
      answeredCount,
      itemCompletionPercent,
    };
  });

  const statusRank: Record<StudentAttemptStatus, number> = {
    in_progress: 0,
    not_started: 1,
    completed: 2,
    locked: 3,
  };
  items.sort((a, b) => {
    const rankDiff = statusRank[a.status] - statusRank[b.status];
    if (rankDiff !== 0) return rankDiff;
    return a.examPackage.title.localeCompare(b.examPackage.title, 'id');
  });

  const totalAssigned = items.length;
  let completedCount = 0;
  let inProgressCount = 0;
  let notStartedCount = 0;
  let lockedCount = 0;
  let passedCount = 0;
  const scores: number[] = [];

  for (const item of items) {
    if (item.status === 'completed') {
      completedCount += 1;
      if (item.attempt?.passed) passedCount += 1;
      if (typeof item.attempt?.score === 'number') scores.push(item.attempt.score);
    } else if (item.status === 'locked') {
      completedCount += 1;
      lockedCount += 1;
      if (typeof item.attempt?.score === 'number') scores.push(item.attempt.score);
    } else if (item.status === 'in_progress') {
      inProgressCount += 1;
    } else {
      notStartedCount += 1;
    }
  }

  const completionPercent =
    totalAssigned > 0 ? Math.round((completedCount / totalAssigned) * 100) : 0;
  const averageScore =
    scores.length > 0
      ? Math.round((scores.reduce((sum, s) => sum + s, 0) / scores.length) * 10) / 10
      : null;

  return {
    totalAssigned,
    completedCount,
    inProgressCount,
    notStartedCount,
    lockedCount,
    passedCount,
    completionPercent,
    averageScore,
    items,
  };
}




