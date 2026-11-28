import type { ExamAttempt, ViolationLog } from '../types/cbt';
import { resolveEffectiveAttemptStatus } from './cbtLogic';

export type ViolationCategoryId =
  | 'face_out_of_frame'
  | 'multiple_faces'
  | 'head_gaze_away'
  | 'tab_switching'
  | 'screenshot_print'
  | 'notification_bar'
  | 'audio_talking'
  | 'other';

export type ViolationSeverity = 'high' | 'medium';

export interface ViolationCategoryMeta {
  id: ViolationCategoryId;
  label: string;
  shortLabel: string;
  englishTag: string;
  severity: ViolationSeverity;
}

export const VIOLATION_CATEGORIES: Record<ViolationCategoryId, ViolationCategoryMeta> = {
  face_out_of_frame: {
    id: 'face_out_of_frame',
    label: 'Wajah Keluar Bingkai',
    shortLabel: 'Wajah Hilang',
    englishTag: 'Face out of frame',
    severity: 'high',
  },
  multiple_faces: {
    id: 'multiple_faces',
    label: 'Lebih dari 1 Wajah Terdeteksi',
    shortLabel: '>1 Wajah',
    englishTag: 'Multiple faces detected',
    severity: 'high',
  },
  tab_switching: {
    id: 'tab_switching',
    label: 'Pindah Tab / Keluar Layar',
    shortLabel: 'Pindah Tab',
    englishTag: 'Tab switching',
    severity: 'high',
  },
  head_gaze_away: {
    id: 'head_gaze_away',
    label: 'Wajah Menoleh Kanan / Kiri',
    shortLabel: 'Menoleh',
    englishTag: 'Looking away',
    severity: 'medium',
  },
  screenshot_print: {
    id: 'screenshot_print',
    label: 'Upaya Screenshot / Cetak',
    shortLabel: 'Screenshot',
    englishTag: 'Screenshot attempt',
    severity: 'high',
  },
  notification_bar: {
    id: 'notification_bar',
    label: 'Membuka Bilah Notifikasi',
    shortLabel: 'Notifikasi',
    englishTag: 'Notification bar',
    severity: 'medium',
  },
  audio_talking: {
    id: 'audio_talking',
    label: 'Terindikasi Mengobrol / Suara',
    shortLabel: 'Suara/Bicara',
    englishTag: 'Talking detected',
    severity: 'medium',
  },
  other: {
    id: 'other',
    label: 'Pelanggaran Lainnya',
    shortLabel: 'Lainnya',
    englishTag: 'Other alert',
    severity: 'medium',
  },
};

export const VIOLATION_CATEGORY_ORDER: ViolationCategoryId[] = [
  'face_out_of_frame',
  'multiple_faces',
  'tab_switching',
  'head_gaze_away',
  'screenshot_print',
  'notification_bar',
  'audio_talking',
  'other',
];

/**
 * Classifies any raw ViolationLog type/detail into a canonical anti-cheat category.
 */
export function classifyViolation(
  type: string,
  detail = ''
): ViolationCategoryMeta {
  const text = `${type} ${detail}`.toLowerCase();

  if (
    text.includes('lebih dari 1 wajah') ||
    text.includes('lebih dari satu wajah') ||
    text.includes('dua wajah') ||
    text.includes('multiple face')
  ) {
    return VIOLATION_CATEGORIES.multiple_faces;
  }

  if (
    text.includes('wajah tidak terdeteksi') ||
    text.includes('wajah hilang') ||
    text.includes('keluar jangkauan kamera') ||
    text.includes('keluar dari jangkauan kamera') ||
    text.includes('face out of frame') ||
    text.includes('out of frame') ||
    text.includes('kamera dinonaktifkan') ||
    text.includes('kamera terputus') ||
    text.includes('kamera ditutup')
  ) {
    return VIOLATION_CATEGORIES.face_out_of_frame;
  }

  if (
    text.includes('screenshot') ||
    text.includes('screenshoot') ||
    text.includes('tangkapan layar') ||
    text.includes('tangkap layar') ||
    text.includes('rekam layar') ||
    text.includes('screen capture') ||
    text.includes('snipping') ||
    text.includes('cetak layar') ||
    text.includes('print screen') ||
    text.includes('printscreen') ||
    text.includes('gestur 3 jari')
  ) {
    return VIOLATION_CATEGORIES.screenshot_print;
  }

  if (
    text.includes('notifikasi') ||
    text.includes('notification') ||
    text.includes('tepi atas') ||
    text.includes('tepi layar')
  ) {
    return VIOLATION_CATEGORIES.notification_bar;
  }

  if (
    text.includes('pindah tab') ||
    text.includes('tab switch') ||
    text.includes('kehilangan fokus') ||
    text.includes('keluar fullscreen') ||
    text.includes('layar penuh') ||
    text.includes('split screen') ||
    text.includes('berpindah aplikasi')
  ) {
    return VIOLATION_CATEGORIES.tab_switching;
  }

  if (
    text.includes('mengobrol') ||
    text.includes('percakapan') ||
    text.includes('talking') ||
    text.includes('suara') ||
    text.includes('mikrofon')
  ) {
    return VIOLATION_CATEGORIES.audio_talking;
  }

  if (
    text.includes('melihat kanan') ||
    text.includes('melihat kiri') ||
    text.includes('menoleh') ||
    text.includes('menunduk') ||
    text.includes('mengalihkan pandangan') ||
    text.includes('looking away')
  ) {
    return VIOLATION_CATEGORIES.head_gaze_away;
  }

  return VIOLATION_CATEGORIES.other;
}

export function formatViolationRelativeTime(
  timestampIso: string,
  nowMs: number = Date.now()
): string {
  const ts = Date.parse(timestampIso);
  if (Number.isNaN(ts)) return '-';
  const diffSec = Math.max(0, Math.floor((nowMs - ts) / 1000));
  if (diffSec < 30) return 'Baru saja';
  if (diffSec < 60) return `${diffSec} dtk lalu`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} mnt lalu`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} jam lalu`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay} hari lalu`;
}

export function formatViolationClock(timestampIso: string): {
  time: string;
  date: string;
} {
  const d = new Date(timestampIso);
  if (Number.isNaN(d.getTime())) {
    return { time: '--:--:--', date: '-' };
  }
  const time = d.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const date = d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  return { time, date };
}

export interface EnrichedViolationItem {
  log: ViolationLog;
  category: ViolationCategoryMeta;
  timestampMs: number;
  relativeTime: string;
  clockTime: string;
  dateLabel: string;
  isRecent5Min: boolean;
}

export interface ViolationCategoryBreakdownRow {
  category: ViolationCategoryMeta;
  count: number;
  sharePercent: number;
}

export interface FlaggedStudentSummary {
  studentNisn: string;
  studentName: string;
  className: string;
  packageId: string;
  packageTitle: string;
  attemptId: string;
  totalCount: number;
  highSeverityCount: number;
  latestViolation: EnrichedViolationItem;
  effectiveStatus: 'not_started' | 'in_progress' | 'locked' | 'completed';
}

export interface ViolationDashboardSummary {
  allScoped: EnrichedViolationItem[];
  filtered: EnrichedViolationItem[];
  categoryBreakdown: ViolationCategoryBreakdownRow[];
  topOffenders: FlaggedStudentSummary[];
  kpis: {
    totalViolations: number;
    last5MinCount: number;
    uniqueStudentsCount: number;
    highSeverityCount: number;
  };
}

export function computeViolationDashboardSummary(params: {
  violations: ViolationLog[];
  attempts: ExamAttempt[];
  teacherPackageIds: string[];
  selectedPackageId?: string;
  categoryFilter?: ViolationCategoryId | 'ALL';
  searchQuery?: string;
  maxViolationTolerance?: number;
  nowMs?: number;
}): ViolationDashboardSummary {
  const nowMs = params.nowMs ?? Date.now();
  const allowedPkgSet = new Set(params.teacherPackageIds);
  const pkgFilter =
    params.selectedPackageId && params.selectedPackageId !== 'ALL'
      ? params.selectedPackageId
      : null;
  const maxTolerance = params.maxViolationTolerance ?? 3;

  // Scope violations strictly to teacher's packages (and optional single-package filter)
  const scopedRaw = params.violations.filter((v) => {
    if (!allowedPkgSet.has(v.packageId)) return false;
    if (pkgFilter && v.packageId !== pkgFilter) return false;
    return true;
  });

  const allScoped: EnrichedViolationItem[] = scopedRaw
    .map((log) => {
      const category = classifyViolation(log.type, log.detail);
      const timestampMs = Date.parse(log.timestamp) || 0;
      const { time, date } = formatViolationClock(log.timestamp);
      const isRecent5Min = nowMs - timestampMs <= 5 * 60 * 1000 && timestampMs <= nowMs + 60_000;
      return {
        log,
        category,
        timestampMs,
        relativeTime: formatViolationRelativeTime(log.timestamp, nowMs),
        clockTime: time,
        dateLabel: date,
        isRecent5Min,
      };
    })
    .sort((a, b) => b.timestampMs - a.timestampMs);

  // Category breakdown (computed on allScoped before category/search filter so bars remain interactive)
  const countsByCat = new Map<ViolationCategoryId, number>();
  for (const id of VIOLATION_CATEGORY_ORDER) countsByCat.set(id, 0);
  for (const item of allScoped) {
    countsByCat.set(item.category.id, (countsByCat.get(item.category.id) ?? 0) + 1);
  }

  const totalViolations = allScoped.length;
  const categoryBreakdown: ViolationCategoryBreakdownRow[] = VIOLATION_CATEGORY_ORDER.map(
    (id) => {
      const count = countsByCat.get(id) ?? 0;
      return {
        category: VIOLATION_CATEGORIES[id],
        count,
        sharePercent:
          totalViolations > 0 ? Math.round((count / totalViolations) * 100) : 0,
      };
    }
  ).sort((a, b) => b.count - a.count);

  // KPIs
  const last5MinCount = allScoped.filter((i) => i.isRecent5Min).length;
  const highSeverityCount = allScoped.filter((i) => i.category.severity === 'high').length;
  const uniqueStudentKeys = new Set(
    allScoped.map((i) => `${i.log.studentNisn.trim() || i.log.studentName}`)
  );

  // Top offenders grouped by student + package
  const offenderMap = new Map<string, FlaggedStudentSummary>();
  for (const item of allScoped) {
    const key = `${item.log.studentNisn.trim() || item.log.studentName}::${item.log.packageId}`;
    const existing = offenderMap.get(key);
    if (!existing) {
      const matchingAttempt = params.attempts.find(
        (a) =>
          a.id === item.log.attemptId ||
          (a.packageId === item.log.packageId &&
            a.studentNisn.trim() === item.log.studentNisn.trim())
      );
      offenderMap.set(key, {
        studentNisn: item.log.studentNisn,
        studentName: item.log.studentName,
        className: item.log.className,
        packageId: item.log.packageId,
        packageTitle: item.log.packageTitle,
        attemptId: matchingAttempt?.id || item.log.attemptId,
        totalCount: 1,
        highSeverityCount: item.category.severity === 'high' ? 1 : 0,
        latestViolation: item,
        effectiveStatus: resolveEffectiveAttemptStatus(matchingAttempt, maxTolerance),
      });
    } else {
      existing.totalCount += 1;
      if (item.category.severity === 'high') existing.highSeverityCount += 1;
    }
  }

  const topOffenders = [...offenderMap.values()].sort(
    (a, b) =>
      b.totalCount - a.totalCount ||
      b.latestViolation.timestampMs - a.latestViolation.timestampMs
  );

  // Filtered feed
  const catFilter = params.categoryFilter && params.categoryFilter !== 'ALL'
    ? params.categoryFilter
    : null;
  const q = (params.searchQuery || '').trim().toLowerCase();

  const filtered = allScoped.filter((item) => {
    if (catFilter && item.category.id !== catFilter) return false;
    if (q) {
      const haystack = `${item.log.studentName} ${item.log.studentNisn} ${item.log.className} ${item.log.packageTitle} ${item.log.type} ${item.log.detail} ${item.category.label} ${item.category.englishTag}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  return {
    allScoped,
    filtered,
    categoryBreakdown,
    topOffenders,
    kpis: {
      totalViolations,
      last5MinCount,
      uniqueStudentsCount: uniqueStudentKeys.size,
      highSeverityCount,
    },
  };
}

export const CRITICAL_VIOLATION_WINDOW_MS = 30_000;
export const CRITICAL_VIOLATION_MIN_HIGH_COUNT = 2;

export interface CriticalViolationAlert {
  id: string;
  studentNisn: string;
  studentName: string;
  className: string;
  packageId: string;
  packageTitle: string;
  attemptId: string;
  countInWindow: number;
  windowSeconds: number;
  categories: ViolationCategoryMeta[];
  latestViolationId: string;
  latestTimestamp: string;
  latestTimestampMs: number;
  clockTime: string;
}

/**
 * Detects students who triggered multiple high-severity anti-cheat violations
 * (e.g., Face out of frame, Multiple faces detected, Tab switching, Screenshot)
 * within a 30-second rolling window.
 */
export function detectCriticalViolationBursts(params: {
  violations: ViolationLog[];
  teacherPackageIds?: string[];
  windowMs?: number;
  minHighSeverityCount?: number;
  activeWithinMs?: number;
  nowMs?: number;
}): CriticalViolationAlert[] {
  const windowMs = params.windowMs ?? CRITICAL_VIOLATION_WINDOW_MS;
  const minCount = params.minHighSeverityCount ?? CRITICAL_VIOLATION_MIN_HIGH_COUNT;
  const nowMs = params.nowMs ?? Date.now();
  const allowedPkgSet = params.teacherPackageIds
    ? new Set(params.teacherPackageIds)
    : null;

  const byStudentPkg = new Map<
    string,
    Array<{ log: ViolationLog; category: ViolationCategoryMeta; ts: number }>
  >();

  for (const log of params.violations) {
    if (allowedPkgSet && !allowedPkgSet.has(log.packageId)) continue;
    const category = classifyViolation(log.type, log.detail);
    if (category.severity !== 'high') continue;
    const ts = Date.parse(log.timestamp);
    if (Number.isNaN(ts)) continue;
    const key = `${log.studentNisn.trim() || log.studentName}::${log.packageId}`;
    const list = byStudentPkg.get(key) || [];
    list.push({ log, category, ts });
    byStudentPkg.set(key, list);
  }

  const alerts: CriticalViolationAlert[] = [];

  for (const [, entries] of byStudentPkg) {
    entries.sort((a, b) => b.ts - a.ts);
    const latest = entries[0];
    if (!latest) continue;

    if (
      params.activeWithinMs !== undefined &&
      nowMs - latest.ts > params.activeWithinMs
    ) {
      continue;
    }

    const inWindow = entries.filter(
      (item) => latest.ts - item.ts <= windowMs && item.ts <= latest.ts
    );

    if (inWindow.length >= minCount) {
      const uniqueCats = new Map<ViolationCategoryId, ViolationCategoryMeta>();
      for (const item of inWindow) {
        if (!uniqueCats.has(item.category.id)) {
          uniqueCats.set(item.category.id, item.category);
        }
      }
      const { time } = formatViolationClock(latest.log.timestamp);
      alerts.push({
        id: `crit-${latest.log.studentNisn || latest.log.studentName}-${latest.log.packageId}-${latest.log.id}`,
        studentNisn: latest.log.studentNisn,
        studentName: latest.log.studentName,
        className: latest.log.className,
        packageId: latest.log.packageId,
        packageTitle: latest.log.packageTitle,
        attemptId: latest.log.attemptId,
        countInWindow: inWindow.length,
        windowSeconds: Math.round(windowMs / 1000),
        categories: [...uniqueCats.values()],
        latestViolationId: latest.log.id,
        latestTimestamp: latest.log.timestamp,
        latestTimestampMs: latest.ts,
        clockTime: time,
      });
    }
  }

  return alerts.sort((a, b) => b.latestTimestampMs - a.latestTimestampMs);
}

/**
 * Evaluates newly arrived live violations against all teacher-scoped violations
 * and returns CriticalViolationAlerts triggered by those new arrivals within 30s.
 */
export function evaluateIncomingCriticalAlerts(params: {
  allTeacherViolations: ViolationLog[];
  newlyArrivedViolations: ViolationLog[];
  windowMs?: number;
  minHighSeverityCount?: number;
}): CriticalViolationAlert[] {
  const incomingHighKeys = new Set<string>();
  const incomingIds = new Set<string>();

  for (const v of params.newlyArrivedViolations) {
    const cat = classifyViolation(v.type, v.detail);
    if (cat.severity === 'high') {
      incomingHighKeys.add(`${v.studentNisn.trim() || v.studentName}::${v.packageId}`);
      incomingIds.add(v.id);
    }
  }

  if (incomingHighKeys.size === 0) return [];

  const allBursts = detectCriticalViolationBursts({
    violations: params.allTeacherViolations,
    windowMs: params.windowMs ?? CRITICAL_VIOLATION_WINDOW_MS,
    minHighSeverityCount:
      params.minHighSeverityCount ?? CRITICAL_VIOLATION_MIN_HIGH_COUNT,
  });

  return allBursts.filter((alert) => {
    const key = `${alert.studentNisn.trim() || alert.studentName}::${alert.packageId}`;
    return incomingHighKeys.has(key) && incomingIds.has(alert.latestViolationId);
  });
}
