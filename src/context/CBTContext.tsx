import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createInitialSeedDatabase } from '../data/seedData';
import type {
  ActiveSession,
  AuditLogEntry,
  CBTDatabase,
  EssayGradeResult,
  ExamAttempt,
  ExamPackage,
  GlobalSecurityConfig,
  Question,
  Role,
  SchoolIdentity,
  SelectiveDeleteOptions,
  SessionScheduleConfig,
  SpreadsheetSyncConfig,
  SpreadsheetSyncRuntime,
  StudentAnswerValue,
  StudentRecord,
  SuperAdminAccount,
  TeacherAccount,
  ThemeConfig,
  ViolationLog,
} from '../types/cbt';
import {
  applyBulkDeleteById,
  applyBulkUserStatus,
  applyCollectiveQuestionEdits,
  applySelectiveDelete,
  autoDistributePackagePoints,
  calculateExamScore,
  computeUnlockExtraMinutes,
  distributeQuestionWeights,
  evaluateViolationEscalation,
  findStudentPackageAttempt,
  isAttemptViolationLocked,
  mergeExamAttempts,
  resolveEffectiveAttemptStatus,
  seededShuffle,
  shouldApplyRemotePull,
  validateAppsScriptUrl,
  validateStudentLogin,
  type CollectiveQuestionPatch,
  type WeightDistributionMode,
} from '../utils/cbtLogic';
import type { ParsedExamScheduleRow } from '../utils/examScheduleImport';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { firebaseAuth } from '../lib/firebase';
import {
  mergeSpreadsheetSyncWithDefaults,
  resolveAutoSyncDefaults,
  type ServerAutoSyncStatus,
} from '../config/autoSyncConfig';
import {
  loadStudentsFromFirestoreSnapshot,
  saveCbtSnapshotToFirestore,
  subscribeToPublicSchoolPortal,
  subscribeToUserSnapshot,
  type CloudSnapshotSummary,
} from '../services/firestoreSyncService';
import type {
  TransitionLoaderKind,
  TransitionOverlayState,
} from '../components/TransitionLoader';

const DB_STORAGE_KEY = 'cerdasexam_cbt_db_v2';
const SESSION_STORAGE_KEY = 'cerdasexam_cbt_session_v2';
const UNPUSHED_STORAGE_KEY = 'cerdasexam_cbt_unpushed_v2';

function readUnpushedFlag(): boolean {
  try {
    return localStorage.getItem(UNPUSHED_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeUnpushedFlag(val: boolean): void {
  try {
    if (val) {
      localStorage.setItem(UNPUSHED_STORAGE_KEY, '1');
    } else {
      localStorage.removeItem(UNPUSHED_STORAGE_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

function persistDbToLocalStorage(next: CBTDatabase): boolean {
  try {
    localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(next));
    return true;
  } catch {
    // Retry with trimmed auditLogs in case localStorage quota is tight
    try {
      const compact: CBTDatabase = {
        ...next,
        auditLogs: next.auditLogs.slice(0, 25),
      };
      localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(compact));
      return true;
    } catch {
      return false;
    }
  }
}

interface CBTContextValue {
  db: CBTDatabase;
  session: ActiveSession | null;
  transitionOverlay: TransitionOverlayState | null;
  // Auth
  loginAdmin: (username: string, password: string) => { ok: boolean; error?: string };
  loginTeacher: (usernameOrNip: string, password: string) => { ok: boolean; error?: string };
  loginStudent: (payload: {
    nisn: string;
    token: string;
    name?: string;
    className?: string;
  }) => { ok: boolean; error?: string };
  logout: () => void;
  // Admin: Account, Theme, School, Security, Schedule
  updateAdminAccount: (
    currentPassword: string,
    nextAccount: SuperAdminAccount
  ) => { ok: boolean; error?: string };
  updateThemeConfig: (theme: ThemeConfig) => void;
  updateSchoolIdentity: (school: SchoolIdentity) => void;
  updateSecurityConfig: (security: GlobalSecurityConfig) => void;
  updateScheduleConfig: (schedule: SessionScheduleConfig) => void;
  forceFinishAllExams: () => number;
  // Admin: Users & Classes
  upsertTeacher: (teacher: Omit<TeacherAccount, 'id'> & { id?: string }) => void;
  importTeachersBatch: (teachers: Omit<TeacherAccount, 'id'>[]) => { added: number; updated: number };
  toggleTeacherActive: (teacherId: string) => void;
  bulkSetTeachersActive: (teacherIds: string[], active: boolean) => number;
  deleteTeacher: (teacherId: string) => void;
  bulkDeleteTeachers: (teacherIds: string[]) => number;
  upsertStudent: (student: Omit<StudentRecord, 'id'> & { id?: string }) => { ok: boolean; error?: string };
  importStudentsBatch: (students: Omit<StudentRecord, 'id'>[]) => { added: number; updated: number };
  toggleStudentActive: (studentId: string, blockReason?: string) => void;
  bulkSetStudentsActive: (studentIds: string[], active: boolean, blockReason?: string) => number;
  deleteStudent: (studentId: string) => void;
  bulkDeleteStudents: (studentIds: string[]) => number;
  addClassRoom: (className: string) => { ok: boolean; error?: string };
  deleteClassRoom: (className: string) => void;
  bulkDeleteClassRooms: (classNames: string[]) => number;
  // Admin: Backup, Restore, Reset, Selective Delete & Google Spreadsheet Sync
  exportDatabaseJSON: () => string;
  importDatabaseJSON: (jsonStr: string) => { ok: boolean; error?: string };
  resetAllData: () => void;
  deleteSelectedData: (options: SelectiveDeleteOptions) => { deletedCategories: string[] };
  deleteViolationLogs: (options: { ids?: string[]; keepLatest?: number; clearAll?: boolean }) => number;
  deleteAuditLogs: (options: { ids?: string[]; keepLatest?: number; clearAll?: boolean }) => number;
  syncRuntime: SpreadsheetSyncRuntime;
  serverAutoSyncStatus: ServerAutoSyncStatus;
  firestoreAutoSync: {
    connected: boolean;
    mode: 'admin' | 'shared' | 'offline';
    status: 'idle' | 'syncing' | 'synced' | 'error';
    lastSyncedAt: string | null;
    email: string | null;
    portalSummary: CloudSnapshotSummary | null;
  };
  updateSpreadsheetSyncConfig: (config: SpreadsheetSyncConfig) => void;
  testSpreadsheetConnection: (
    configOverride?: SpreadsheetSyncConfig
  ) => Promise<{ ok: boolean; message: string; spreadsheetName?: string; spreadsheetUrl?: string }>;
  pushDatabaseToSpreadsheet: (
    configOverride?: SpreadsheetSyncConfig
  ) => Promise<{ ok: boolean; message: string }>;
  pullDatabaseFromSpreadsheet: (
    configOverride?: SpreadsheetSyncConfig,
    options?: { manual?: boolean }
  ) => Promise<{ ok: boolean; message: string }>;
  // Teacher & Admin: Packages, Schedules & Questions
  upsertExamPackage: (pkg: Omit<ExamPackage, 'id' | 'createdAt'> & { id?: string }) => string;
  importExamSchedulesBatch: (
    rows: ParsedExamScheduleRow[]
  ) => { added: number; updated: number; newClassesAdded: number };
  togglePackagePublished: (packageId: string) => void;
  deleteExamPackage: (packageId: string) => void;
  upsertQuestion: (
    q: Omit<Question, 'id'> & { id?: string },
    options?: { autoBalancePoints?: boolean }
  ) => void;
  deleteQuestion: (
    questionId: string,
    options?: { autoBalancePoints?: boolean }
  ) => void;
  autoBalancePackagePoints: (packageId: string, targetTotal?: number) => void;
  bulkAddQuestions: (questions: Question[]) => void;
  bulkUpdateQuestions: (patches: CollectiveQuestionPatch[]) => number;
  applyQuestionWeightDistribution: (
    packageId: string,
    config: WeightDistributionMode,
    targetIds?: string[]
  ) => number;
  bulkDeleteQuestions: (questionIds: string[]) => number;
  copyOrMoveQuestionsToPackage: (
    questionIds: string[],
    targetPackageId: string,
    mode: 'copy' | 'move'
  ) => number;
  // Teacher: Proctoring Actions
  unlockOrResetAttempt: (
    attemptId: string,
    mode: 'unlock' | 'reset'
  ) => Promise<{ ok: boolean; synced: boolean; message: string }>;
  addExtraTimeToAttempt: (attemptId: string, minutes: number) => void;
  // Student: Attempt Lifecycle
  startOrResumeAttempt: (studentId: string, packageId: string) => ExamAttempt | null;
  saveStudentAnswer: (attemptId: string, questionId: string, answer: StudentAnswerValue) => void;
  toggleFlagQuestion: (attemptId: string, questionId: string) => void;
  updateCurrentQuestionIndex: (attemptId: string, index: number) => void;
  recordStudentViolation: (
    attemptId: string,
    type: string,
    detail: string
  ) => { nextCount: number; locked: boolean; remainingBeforeLock: number };
  submitStudentExam: (attemptId: string, lockReason?: string) => ExamAttempt | null;
}

const CBTContext = createContext<CBTContextValue | null>(null);

function normalizeDB(parsed: Partial<CBTDatabase>): CBTDatabase {
  const seed = createInitialSeedDatabase();
  return {
    ...seed,
    ...parsed,
    adminAccount: parsed.adminAccount?.username
      ? parsed.adminAccount
      : seed.adminAccount,
    theme: parsed.theme?.accent ? parsed.theme : seed.theme,
    school: { ...seed.school, ...(parsed.school || {}) },
    security: { ...seed.security, ...(parsed.security || {}) },
    schedule: { ...seed.schedule, ...(parsed.schedule || {}) },
    spreadsheetSync: {
      ...seed.spreadsheetSync,
      ...(parsed.spreadsheetSync || {}),
    },
    classes: Array.isArray(parsed.classes) ? parsed.classes : [],
    teachers: Array.isArray(parsed.teachers) ? parsed.teachers : [],
    students: Array.isArray(parsed.students) ? parsed.students : [],
    packages: Array.isArray(parsed.packages) ? parsed.packages : [],
    questions: Array.isArray(parsed.questions) ? parsed.questions : [],
    attempts: Array.isArray(parsed.attempts)
      ? parsed.attempts.map((a) => ({
          ...a,
          status: resolveEffectiveAttemptStatus(
            a,
            parsed.security?.maxViolationTolerance ?? seed.security.maxViolationTolerance
          ),
        }))
      : [],
    violations: Array.isArray(parsed.violations) ? parsed.violations : [],
    auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : [],
  };
}

function loadInitialDB(): CBTDatabase {
  const envDefaults = resolveAutoSyncDefaults();
  try {
    const raw = localStorage.getItem(DB_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<CBTDatabase>;
      if (parsed && typeof parsed === 'object' && parsed.school) {
        const normalized = normalizeDB(parsed);
        return {
          ...normalized,
          spreadsheetSync: mergeSpreadsheetSyncWithDefaults(
            normalized.spreadsheetSync,
            envDefaults
          ),
        };
      }
    }
  } catch {
    // fallback to clean seed
  }
  const seed = createInitialSeedDatabase();
  const hydratedSeed: CBTDatabase = {
    ...seed,
    spreadsheetSync: mergeSpreadsheetSyncWithDefaults(
      seed.spreadsheetSync,
      envDefaults
    ),
  };
  try {
    localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(hydratedSeed));
  } catch {
    // ignore storage quota
  }
  return hydratedSeed;
}

function loadInitialSession(): ActiveSession | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as ActiveSession;
  } catch {
    // ignore
  }
  return null;
}

function makeAudit(
  actorRole: Role,
  actorName: string,
  action: string,
  category: AuditLogEntry['category'],
  detail: string
): AuditLogEntry {
  return {
    id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    actorRole,
    actorName,
    action,
    category,
    detail,
  };
}

export function CBTProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<CBTDatabase>(loadInitialDB);
  const [session, setSession] = useState<ActiveSession | null>(loadInitialSession);
  const [transitionOverlay, setTransitionOverlay] =
    useState<TransitionOverlayState | null>(null);
  const [syncRuntime, setSyncRuntime] = useState<SpreadsheetSyncRuntime>({
    status: 'idle',
  });
  const [serverAutoSyncStatus, setServerAutoSyncStatus] = useState<ServerAutoSyncStatus>({
    serverConfigured: false,
    hasWebAppUrl: false,
    hasSecret: false,
    spreadsheetUrl: '',
    spreadsheetId: '',
  });
  const [firestoreAutoSync, setFirestoreAutoSync] = useState<{
    connected: boolean;
    mode: 'admin' | 'shared' | 'offline';
    status: 'idle' | 'syncing' | 'synced' | 'error';
    lastSyncedAt: string | null;
    email: string | null;
    portalSummary: CloudSnapshotSummary | null;
  }>({
    connected: false,
    mode: 'offline',
    status: 'idle',
    lastSyncedAt: null,
    email: null,
    portalSummary: null,
  });
  const [mutationVersion, setMutationVersion] = useState(0);
  const dbRef = useRef<CBTDatabase>(db);
  const serverAutoSyncRef = useRef<ServerAutoSyncStatus>(serverAutoSyncStatus);
  const firebaseUserRef = useRef<User | null>(null);
  const firestoreHydratedRef = useRef(false);
  const portalInitialPullDoneRef = useRef(false);
  const firestorePushInFlightRef = useRef(false);
  const syncInFlightRef = useRef(false);
  const mutationVersionRef = useRef(0);
  const hasUnpushedChangesRef = useRef<boolean>(readUnpushedFlag());
  const pendingPushRef = useRef(false);
  const transitionTimerRef = useRef<number | null>(null);
  const transitionSeqRef = useRef(0);

  useEffect(() => {
    dbRef.current = db;
  }, [db]);

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current !== null) {
        window.clearTimeout(transitionTimerRef.current);
      }
    };
  }, []);

  const showTransitionLoader = useCallback(
    (
      kind: TransitionLoaderKind,
      title: string,
      subtitle: string,
      durationMs = 700
    ) => {
      if (transitionTimerRef.current !== null) {
        window.clearTimeout(transitionTimerRef.current);
      }
      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const effectiveMs = prefersReducedMotion ? Math.min(durationMs, 320) : durationMs;

      transitionSeqRef.current += 1;
      setTransitionOverlay({
        id: transitionSeqRef.current,
        kind,
        title,
        subtitle,
      });

      transitionTimerRef.current = window.setTimeout(() => {
        setTransitionOverlay(null);
        transitionTimerRef.current = null;
      }, effectiveMs);
    },
    []
  );

  // Sync global theme accent and light/dark mode onto <html>
  useEffect(() => {
    const root = document.documentElement;
    if (db.theme.accent === 'indigo') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', db.theme.accent);
    }
    if (db.theme.mode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [db.theme.accent, db.theme.mode]);

  const commitDb = useCallback(
    (
      updater: (prev: CBTDatabase) => CBTDatabase,
      options?: { triggerAutoSync?: boolean }
    ) => {
      const prev = dbRef.current;
      const next = updater(prev);
      if (next === prev) return;

      dbRef.current = next;
      persistDbToLocalStorage(next);
      setDb(next);

      if (options?.triggerAutoSync !== false) {
        mutationVersionRef.current += 1;
        hasUnpushedChangesRef.current = true;
        writeUnpushedFlag(true);
        setMutationVersion(mutationVersionRef.current);
      }
    },
    []
  );

  const commitSession = useCallback((nextSession: ActiveSession | null) => {
    setSession(nextSession);
    try {
      if (nextSession) {
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextSession));
      } else {
        localStorage.removeItem(SESSION_STORAGE_KEY);
      }
    } catch {
      // ignore
    }
  }, []);

  // Cross-tab localStorage sync
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === DB_STORAGE_KEY && e.newValue) {
        try {
          const parsed = normalizeDB(JSON.parse(e.newValue) as Partial<CBTDatabase>);
          dbRef.current = parsed;
          setDb(parsed);
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const loginAdmin = useCallback(
    (username: string, password: string) => {
      const u = username.trim();
      const p = password;
      if (!u || !p) {
        return { ok: false, error: 'Username dan password administrator wajib diisi.' };
      }
      const adminAcc = dbRef.current.adminAccount;
      if (u === adminAcc.username && p === adminAcc.password) {
        const nextSess: ActiveSession = {
          role: 'admin',
          userId: 'super-admin',
          name: adminAcc.displayName || 'Super Admin',
        };
        showTransitionLoader(
          'login',
          'Membuka Konsol Super Admin...',
          `Selamat datang, ${nextSess.name}. Menyiapkan ruang kendali pusat.`,
          720
        );
        commitSession(nextSess);
        commitDb((prev) => ({
          ...prev,
          auditLogs: [
            makeAudit(
              'admin',
              nextSess.name,
              'Login Portal Super Admin',
              'auth',
              `Administrator (${u}) masuk ke konsol kontrol pusat.`
            ),
            ...prev.auditLogs,
          ].slice(0, 200),
        }));
        return { ok: true };
      }
      return { ok: false, error: 'Username atau password Super Admin tidak valid.' };
    },
    [commitDb, commitSession, showTransitionLoader]
  );

  const loginTeacher = useCallback(
    (usernameOrNip: string, password: string) => {
      const key = usernameOrNip.trim();
      const pass = password.trim();
      if (!key || !pass) {
        return { ok: false, error: 'Username/NIP dan password wajib diisi.' };
      }
      const teacher = dbRef.current.teachers.find(
        (t) =>
          (t.username.toLowerCase() === key.toLowerCase() || t.nip === key) &&
          t.password === pass
      );
      if (!teacher) {
        return { ok: false, error: 'Username/NIP atau password guru tidak cocok.' };
      }
      if (!teacher.active) {
        return { ok: false, error: 'Akun guru ini sedang dinonaktifkan oleh Administrator.' };
      }
      showTransitionLoader(
        'login',
        'Membuka Portal Guru...',
        `Selamat datang, ${teacher.name}. Menyiapkan paket ujian & bank soal.`,
        720
      );
      commitSession({
        role: 'teacher',
        userId: teacher.id,
        name: teacher.name,
      });
      commitDb((prev) => ({
        ...prev,
        auditLogs: [
          makeAudit('teacher', teacher.name, 'Login Portal Guru', 'auth', `Guru (${teacher.username}) masuk ke dashboard akademik.`),
          ...prev.auditLogs,
        ].slice(0, 200),
      }));
      return { ok: true };
    },
    [commitDb, commitSession, showTransitionLoader]
  );

  const loginStudent = useCallback(
    (payload: { nisn: string; token: string; name?: string; className?: string }) => {
      const latest = dbRef.current;
      const validation = validateStudentLogin({
        ...payload,
        students: latest.students,
        packages: latest.packages,
        schedule: latest.schedule,
      });
      if (!validation.ok || !validation.student || !validation.examPackage) {
        return { ok: false, error: validation.error || 'Gagal memverifikasi peserta ujian.' };
      }

      const stu = validation.student;
      const pkg = validation.examPackage;

      showTransitionLoader(
        'login',
        'Memverifikasi Peserta Ujian...',
        `${stu.name} (${stu.className}) · Membuka "${pkg.title}".`,
        750
      );

      commitSession({
        role: 'student',
        userId: stu.id,
        name: stu.name,
        nisn: stu.nisn,
        className: stu.className,
        packageId: pkg.id,
      });

      commitDb((prev) => ({
        ...prev,
        auditLogs: [
          makeAudit(
            'student',
            stu.name,
            'Verifikasi Portal Siswa',
            'auth',
            `NISN ${stu.nisn} (${stu.className}) terverifikasi untuk paket "${pkg.title}".`
          ),
          ...prev.auditLogs,
        ].slice(0, 200),
      }));

      return { ok: true };
    },
    [commitDb, commitSession, showTransitionLoader]
  );

  const logout = useCallback(() => {
    showTransitionLoader(
      'logout',
      'Mengakhiri Sesi...',
      'Menyimpan status sesi dan keluar dengan aman.',
      650
    );
    if (session) {
      commitDb((prev) => ({
        ...prev,
        auditLogs: [
          makeAudit(session.role, session.name, 'Logout Sesi', 'auth', `${session.name} keluar dari portal ${session.role}.`),
          ...prev.auditLogs,
        ].slice(0, 200),
      }));
    }
    commitSession(null);
  }, [commitDb, commitSession, session, showTransitionLoader]);

  const updateAdminAccount = useCallback(
    (currentPassword: string, nextAccount: SuperAdminAccount) => {
      if (currentPassword !== db.adminAccount.password) {
        return { ok: false, error: 'Password saat ini tidak sesuai.' };
      }
      if (!nextAccount.username.trim() || nextAccount.username.trim().length < 4) {
        return { ok: false, error: 'Username Super Admin minimal 4 karakter.' };
      }
      if (!nextAccount.password || nextAccount.password.length < 6) {
        return { ok: false, error: 'Password baru minimal 6 karakter.' };
      }
      const cleaned: SuperAdminAccount = {
        username: nextAccount.username.trim(),
        password: nextAccount.password,
        displayName: nextAccount.displayName.trim() || 'Super Admin',
      };
      commitDb((prev) => ({
        ...prev,
        adminAccount: cleaned,
        auditLogs: [
          makeAudit(
            'admin',
            cleaned.displayName,
            'Perbarui Akun Super Admin',
            'security',
            `Kredensial Super Admin diperbarui (Username: ${cleaned.username}).`
          ),
          ...prev.auditLogs,
        ].slice(0, 200),
      }));
      if (session?.role === 'admin') {
        commitSession({ ...session, name: cleaned.displayName });
      }
      return { ok: true };
    },
    [commitDb, commitSession, db.adminAccount.password, session]
  );

  const updateThemeConfig = useCallback(
    (theme: ThemeConfig) => {
      commitDb((prev) => ({
        ...prev,
        theme,
        auditLogs: [
          makeAudit(
            'admin',
            session?.name || 'Super Admin',
            'Ubah Tema Aplikasi',
            'system',
            `Mode: ${theme.mode === 'dark' ? 'Gelap' : 'Terang'}, Warna Aksen: ${theme.accent}.`
          ),
          ...prev.auditLogs,
        ].slice(0, 200),
      }));
    },
    [commitDb, session]
  );

  const updateSchoolIdentity = useCallback(
    (school: SchoolIdentity) => {
      commitDb((prev) => ({
        ...prev,
        school,
        auditLogs: [
          makeAudit(
            'admin',
            session?.name || 'Super Admin',
            'Perbarui Identitas & Pengumuman Sekolah',
            'system',
            `Sekolah: ${school.schoolName} (${school.academicYear}).`
          ),
          ...prev.auditLogs,
        ].slice(0, 200),
      }));
    },
    [commitDb, session]
  );

  const updateSecurityConfig = useCallback(
    (security: GlobalSecurityConfig) => {
      commitDb((prev) => ({
        ...prev,
        security,
        auditLogs: [
          makeAudit(
            'admin',
            session?.name || 'Super Admin',
            'Ubah Pengaturan Keamanan Global',
            'security',
            `Fullscreen: ${security.requireFullscreen ? 'ON' : 'OFF'}, Kamera: ${
              security.requireCameraMonitoring ? 'ON' : 'OFF'
            }, Tab/Split: ${
              security.detectTabSwitchAndSplitScreen ? 'ON' : 'OFF'
            }, Watermark: ${security.enableDynamicWatermark ? 'ON' : 'OFF'}, Toleransi: ${
              security.maxViolationTolerance
            }x.`
          ),
          ...prev.auditLogs,
        ].slice(0, 200),
      }));
    },
    [commitDb, session]
  );

  const updateScheduleConfig = useCallback(
    (schedule: SessionScheduleConfig) => {
      commitDb((prev) => ({
        ...prev,
        schedule,
        auditLogs: [
          makeAudit(
            'admin',
            session?.name || 'Super Admin',
            'Perbarui Jadwal & Rilis Token',
            'security',
            `Mode: ${schedule.tokenReleaseMode}, Rilis: ${
              schedule.tokensReleased ? 'Aktif' : 'Ditahan'
            }, Jam Akses: ${
              schedule.enforceTimeWindow
                ? `${schedule.accessStartTime}-${schedule.accessEndTime}`
                : 'Bebas'
            }.`
          ),
          ...prev.auditLogs,
        ].slice(0, 200),
      }));
    },
    [commitDb, session]
  );

  const forceFinishAllExams = useCallback(() => {
    let affectedCount = 0;
    commitDb((prev) => {
      const now = new Date().toISOString();
      const updatedAttempts = prev.attempts.map((att) => {
        if (att.status !== 'in_progress') return att;
        affectedCount += 1;
        const pkg = prev.packages.find((p) => p.id === att.packageId);
        const qs = prev.questions.filter((q) => q.packageId === att.packageId);
        const summary = calculateExamScore(qs, att.answers, pkg?.kkm ?? 75);
        return {
          ...att,
          status: 'completed' as const,
          submittedAt: now,
          score: summary.score,
          correctCount: summary.correctCount,
          totalQuestions: summary.totalQuestions,
          passed: summary.passed,
          essayGrades: summary.essayGrades,
        };
      });

      return {
        ...prev,
        attempts: updatedAttempts,
        schedule: {
          ...prev.schedule,
          tokensReleased: false,
          emergencyForceFinishedAt: now,
        },
        auditLogs: [
          makeAudit(
            'admin',
            session?.name || 'Super Admin',
            'DARURAT: Force Finish All',
            'security',
            `Menghentikan seluruh ujian aktif secara serentak (${affectedCount} peserta diselesaikan paksa) dan mengunci rilis token.`
          ),
          ...prev.auditLogs,
        ].slice(0, 200),
      };
    });
    return affectedCount;
  }, [commitDb, session]);

  const upsertTeacher = useCallback(
    (teacher: Omit<TeacherAccount, 'id'> & { id?: string }) => {
      commitDb((prev) => {
        const exists = teacher.id ? prev.teachers.some((t) => t.id === teacher.id) : false;
        const id = teacher.id || `teacher-${Date.now()}`;
        const nextTeacher: TeacherAccount = { ...teacher, id };
        const teachers = exists
          ? prev.teachers.map((t) => (t.id === id ? nextTeacher : t))
          : [...prev.teachers, nextTeacher];
        return {
          ...prev,
          teachers,
          auditLogs: [
            makeAudit(
              'admin',
              session?.name || 'Super Admin',
              exists ? 'Perbarui Data Guru' : 'Tambah Akun Guru',
              'users',
              `Guru: ${teacher.name} (${teacher.username}) — Mapel: ${teacher.subjects.join(', ')}.`
            ),
            ...prev.auditLogs,
          ].slice(0, 200),
        };
      });
    },
    [commitDb, session]
  );

  const importTeachersBatch = useCallback(
    (incoming: Omit<TeacherAccount, 'id'>[]) => {
      let added = 0;
      let updated = 0;
      commitDb((prev) => {
        const byUser = new Map<string, TeacherAccount>(
          prev.teachers.map((t) => [t.username.toLowerCase(), t])
        );
        const classSet = new Set(prev.classes);

        incoming.forEach((row, idx) => {
          const key = row.username.toLowerCase();
          row.classes.forEach((c) => classSet.add(c));
          const existing = byUser.get(key);
          if (existing) {
            updated += 1;
            byUser.set(key, { ...existing, ...row });
          } else {
            added += 1;
            byUser.set(key, {
              ...row,
              id: `teacher-csv-${Date.now()}-${idx}`,
            });
          }
        });

        return {
          ...prev,
          teachers: Array.from(byUser.values()),
          classes: Array.from(classSet),
          auditLogs: [
            makeAudit(
              'admin',
              session?.name || 'Super Admin',
              'Import Massal Guru CSV',
              'users',
              `Berhasil mengimpor ${added} guru baru dan memperbarui ${updated} akun guru.`
            ),
            ...prev.auditLogs,
          ].slice(0, 200),
        };
      });
      return { added, updated };
    },
    [commitDb, session]
  );

  const toggleTeacherActive = useCallback(
    (teacherId: string) => {
      commitDb((prev) => {
        const target = prev.teachers.find((t) => t.id === teacherId);
        if (!target) return prev;
        const nextActive = !target.active;
        return {
          ...prev,
          teachers: prev.teachers.map((t) =>
            t.id === teacherId ? { ...t, active: nextActive } : t
          ),
          auditLogs: [
            makeAudit(
              'admin',
              session?.name || 'Super Admin',
              nextActive ? 'Aktifkan Akun Guru' : 'Blokir Akun Guru',
              'users',
              `Akun guru "${target.name}" (${target.username}) ${
                nextActive ? 'diaktifkan kembali' : 'diblokir sementara'
              }.`
            ),
            ...prev.auditLogs,
          ].slice(0, 200),
        };
      });
    },
    [commitDb, session]
  );

  const bulkSetTeachersActive = useCallback(
    (teacherIds: string[], active: boolean) => {
      if (teacherIds.length === 0) return 0;
      let affected = 0;
      commitDb((prev) => {
        const idSet = new Set(teacherIds);
        const nextTeachers = prev.teachers.map((t) => {
          if (!idSet.has(t.id)) return t;
          affected += 1;
          return { ...t, active };
        });
        if (affected === 0) return prev;
        return {
          ...prev,
          teachers: nextTeachers,
          auditLogs: [
            makeAudit(
              'admin',
              session?.name || 'Super Admin',
              active ? 'Aktifkan Massal Akun Guru' : 'Blokir Massal Akun Guru',
              'users',
              `${affected} akun guru ${active ? 'diaktifkan kembali' : 'diblokir secara kolektif'}.`
            ),
            ...prev.auditLogs,
          ].slice(0, 200),
        };
      });
      return affected;
    },
    [commitDb, session]
  );

  const deleteTeacher = useCallback(
    (teacherId: string) => {
      commitDb((prev) => {
        const target = prev.teachers.find((t) => t.id === teacherId);
        return {
          ...prev,
          teachers: prev.teachers.filter((t) => t.id !== teacherId),
          auditLogs: [
            makeAudit(
              'admin',
              session?.name || 'Super Admin',
              'Hapus Akun Guru',
              'users',
              `Akun guru "${target?.name || teacherId}" dihapus.`
            ),
            ...prev.auditLogs,
          ].slice(0, 200),
        };
      });
    },
    [commitDb, session]
  );

  const bulkDeleteTeachers = useCallback(
    (teacherIds: string[]) => {
      if (teacherIds.length === 0) return 0;
      let removed = 0;
      commitDb((prev) => {
        const res = applyBulkDeleteById(prev.teachers, teacherIds);
        removed = res.removedCount;
        if (removed === 0) return prev;
        return {
          ...prev,
          teachers: res.nextItems,
          auditLogs: [
            makeAudit(
              'admin',
              session?.name || 'Super Admin',
              'Hapus Massal Akun Guru',
              'users',
              `Menghapus ${removed} akun guru terpilih dari database.`
            ),
            ...prev.auditLogs,
          ].slice(0, 200),
        };
      });
      return removed;
    },
    [commitDb, session]
  );

  const upsertStudent = useCallback(
    (student: Omit<StudentRecord, 'id'> & { id?: string }) => {
      const cleanNisn = student.nisn.trim();
      const duplicate = db.students.find(
        (s) => s.nisn === cleanNisn && s.id !== student.id
      );
      if (duplicate) {
        return { ok: false, error: `NISN ${cleanNisn} sudah terdaftar untuk ${duplicate.name}.` };
      }
      commitDb((prev) => {
        const exists = student.id ? prev.students.some((s) => s.id === student.id) : false;
        const id = student.id || `stu-${Date.now()}`;
        const record: StudentRecord = { ...student, id, nisn: cleanNisn };
        const students = exists
          ? prev.students.map((s) => (s.id === id ? record : s))
          : [...prev.students, record];
        const classes = prev.classes.includes(record.className)
          ? prev.classes
          : [...prev.classes, record.className];
        return {
          ...prev,
          students,
          classes,
          auditLogs: [
            makeAudit(
              'admin',
              session?.name || 'Super Admin',
              exists ? 'Perbarui Data Siswa' : 'Tambah Data Siswa',
              'users',
              `${record.name} (NISN: ${record.nisn}, Kelas: ${record.className}).`
            ),
            ...prev.auditLogs,
          ].slice(0, 200),
        };
      });
      return { ok: true };
    },
    [commitDb, db.students, session]
  );

  const importStudentsBatch = useCallback(
    (incoming: Omit<StudentRecord, 'id'>[]) => {
      let added = 0;
      let updated = 0;
      commitDb((prev) => {
        const byNisn = new Map<string, StudentRecord>(
          prev.students.map((s) => [s.nisn, s])
        );
        const classSet = new Set(prev.classes);

        incoming.forEach((row, idx) => {
          const existing = byNisn.get(row.nisn);
          classSet.add(row.className);
          if (existing) {
            updated += 1;
            byNisn.set(row.nisn, { ...existing, ...row });
          } else {
            added += 1;
            byNisn.set(row.nisn, {
              ...row,
              id: `stu-csv-${Date.now()}-${idx}`,
            });
          }
        });

        return {
          ...prev,
          students: Array.from(byNisn.values()),
          classes: Array.from(classSet),
          auditLogs: [
            makeAudit(
              'admin',
              session?.name || 'Super Admin',
              'Import Massal Siswa CSV',
              'users',
              `Berhasil mengimpor ${added} siswa baru dan memperbarui ${updated} siswa.`
            ),
            ...prev.auditLogs,
          ].slice(0, 200),
        };
      });
      return { added, updated };
    },
    [commitDb, session]
  );

  const toggleStudentActive = useCallback(
    (studentId: string, blockReason?: string) => {
      commitDb((prev) => {
        const target = prev.students.find((s) => s.id === studentId);
        if (!target) return prev;
        const nextActive = !target.active;
        return {
          ...prev,
          students: prev.students.map((s) =>
            s.id === studentId
              ? {
                  ...s,
                  active: nextActive,
                  blockReason: nextActive ? undefined : blockReason || 'Diblokir oleh Administrator',
                }
              : s
          ),
          auditLogs: [
            makeAudit(
              'admin',
              session?.name || 'Super Admin',
              nextActive ? 'Aktifkan Akses Siswa' : 'Blokir Akses Siswa',
              'users',
              `Siswa ${target.name} (${target.nisn}) ${
                nextActive ? 'diaktifkan kembali' : `dinonaktifkan (${blockReason || 'Administrasi'})`
              }.`
            ),
            ...prev.auditLogs,
          ].slice(0, 200),
        };
      });
    },
    [commitDb, session]
  );

  const bulkSetStudentsActive = useCallback(
    (studentIds: string[], active: boolean, blockReason?: string) => {
      if (studentIds.length === 0) return 0;
      let affected = 0;
      commitDb((prev) => {
        const res = applyBulkUserStatus(
          prev.students,
          studentIds,
          active,
          blockReason || 'Diblokir massal oleh Administrator'
        );
        affected = res.affectedCount;
        if (affected === 0) return prev;
        return {
          ...prev,
          students: res.nextItems,
          auditLogs: [
            makeAudit(
              'admin',
              session?.name || 'Super Admin',
              active ? 'Aktifkan Massal Akses Siswa' : 'Blokir Massal Akses Siswa',
              'users',
              `${affected} siswa ${
                active ? 'diaktifkan kembali' : `diblokir massal (${blockReason || 'Administrasi'})`
              }.`
            ),
            ...prev.auditLogs,
          ].slice(0, 200),
        };
      });
      return affected;
    },
    [commitDb, session]
  );

  const deleteStudent = useCallback(
    (studentId: string) => {
      commitDb((prev) => {
        const target = prev.students.find((s) => s.id === studentId);
        return {
          ...prev,
          students: prev.students.filter((s) => s.id !== studentId),
          auditLogs: [
            makeAudit(
              'admin',
              session?.name || 'Super Admin',
              'Hapus Data Siswa',
              'users',
              `Siswa ${target?.name || studentId} dihapus dari database.`
            ),
            ...prev.auditLogs,
          ].slice(0, 200),
        };
      });
    },
    [commitDb, session]
  );

  const bulkDeleteStudents = useCallback(
    (studentIds: string[]) => {
      if (studentIds.length === 0) return 0;
      let removed = 0;
      commitDb((prev) => {
        const res = applyBulkDeleteById(prev.students, studentIds);
        removed = res.removedCount;
        if (removed === 0) return prev;
        return {
          ...prev,
          students: res.nextItems,
          auditLogs: [
            makeAudit(
              'admin',
              session?.name || 'Super Admin',
              'Hapus Massal Data Siswa',
              'users',
              `Menghapus ${removed} data siswa terpilih dari database.`
            ),
            ...prev.auditLogs,
          ].slice(0, 200),
        };
      });
      return removed;
    },
    [commitDb, session]
  );

  const addClassRoom = useCallback(
    (className: string) => {
      const clean = className.trim().toUpperCase();
      if (!clean) return { ok: false, error: 'Nama kelas tidak boleh kosong.' };
      if (db.classes.includes(clean)) {
        return { ok: false, error: `Kelas "${clean}" sudah ada.` };
      }
      commitDb((prev) => ({
        ...prev,
        classes: [...prev.classes, clean],
        auditLogs: [
          makeAudit('admin', session?.name || 'Super Admin', 'Tambah Kelas', 'users', `Kelas ${clean} ditambahkan.`),
          ...prev.auditLogs,
        ].slice(0, 200),
      }));
      return { ok: true };
    },
    [commitDb, db.classes, session]
  );

  const deleteClassRoom = useCallback(
    (className: string) => {
      commitDb((prev) => ({
        ...prev,
        classes: prev.classes.filter((c) => c !== className),
        auditLogs: [
          makeAudit('admin', session?.name || 'Super Admin', 'Hapus Kelas', 'users', `Kelas ${className} dihapus.`),
          ...prev.auditLogs,
        ].slice(0, 200),
      }));
    },
    [commitDb, session]
  );

  const bulkDeleteClassRooms = useCallback(
    (classNames: string[]) => {
      if (classNames.length === 0) return 0;
      const nameSet = new Set(classNames);
      let removed = 0;
      commitDb((prev) => {
        const nextClasses = prev.classes.filter((c) => !nameSet.has(c));
        removed = prev.classes.length - nextClasses.length;
        if (removed === 0) return prev;
        return {
          ...prev,
          classes: nextClasses,
          auditLogs: [
            makeAudit(
              'admin',
              session?.name || 'Super Admin',
              'Hapus Massal Daftar Kelas',
              'users',
              `Menghapus ${removed} kelas terpilih (${classNames.join(', ')}).`
            ),
            ...prev.auditLogs,
          ].slice(0, 200),
        };
      });
      return removed;
    },
    [commitDb, session]
  );

  const exportDatabaseJSON = useCallback(() => {
    return JSON.stringify(db, null, 2);
  }, [db]);

  const importDatabaseJSON = useCallback(
    (jsonStr: string) => {
      try {
        const parsed = JSON.parse(jsonStr) as Partial<CBTDatabase>;
        if (!parsed || typeof parsed !== 'object' || !parsed.school) {
          return { ok: false, error: 'Struktur file JSON backup tidak valid.' };
        }
        const normalized = normalizeDB(parsed);
        commitDb(() => ({
          ...normalized,
          auditLogs: [
            makeAudit(
              'admin',
              session?.name || 'Super Admin',
              'Restore Database JSON',
              'system',
              `Berhasil memulihkan database (${normalized.students.length} siswa, ${normalized.packages.length} paket, ${normalized.questions.length} soal).`
            ),
            ...normalized.auditLogs,
          ].slice(0, 200),
        }));
        return { ok: true };
      } catch {
        return { ok: false, error: 'File JSON tidak dapat dibaca. Pastikan format JSON valid.' };
      }
    },
    [commitDb, session]
  );

  const resetAllData = useCallback(() => {
    const fresh = createInitialSeedDatabase();
    commitDb(() => fresh);
  }, [commitDb]);

  const deleteSelectedData = useCallback(
    (options: SelectiveDeleteOptions) => {
      let deletedCategories: string[] = [];
      commitDb((prev) => {
        const res = applySelectiveDelete(prev, options);
        deletedCategories = res.deletedCategories;
        if (deletedCategories.length === 0) return prev;
        return {
          ...res.nextDb,
          auditLogs: options.auditLogs
            ? []
            : [
                makeAudit(
                  'admin',
                  session?.name || 'Super Admin',
                  'Hapus Data Terpilih',
                  'system',
                  `Menghapus kategori: ${deletedCategories.join(', ')}.`
                ),
                ...res.nextDb.auditLogs,
              ].slice(0, 200),
        };
      });
      return { deletedCategories };
    },
    [commitDb, session]
  );

  const deleteViolationLogs = useCallback(
    (options: { ids?: string[]; keepLatest?: number; clearAll?: boolean }) => {
      let removed = 0;
      commitDb((prev) => {
        let nextViolations = prev.violations;
        if (options.clearAll) {
          nextViolations = [];
        } else if (typeof options.keepLatest === 'number' && options.keepLatest >= 0) {
          nextViolations = [...prev.violations]
            .sort((a, b) => (Date.parse(b.timestamp) || 0) - (Date.parse(a.timestamp) || 0))
            .slice(0, options.keepLatest);
        } else if (options.ids && options.ids.length > 0) {
          const idSet = new Set(options.ids);
          nextViolations = prev.violations.filter((v) => !idSet.has(v.id));
        }
        removed = prev.violations.length - nextViolations.length;
        if (removed <= 0) return prev;
        return {
          ...prev,
          violations: nextViolations,
          auditLogs: [
            makeAudit(
              'admin',
              session?.name || 'Super Admin',
              'Hapus Log Pelanggaran',
              'violation',
              options.clearAll
                ? `Menghapus seluruh ${removed} catatan pelanggaran.`
                : typeof options.keepLatest === 'number'
                  ? `Memangkas ${removed} log pelanggaran lama (menyisakan ${nextViolations.length} terbaru).`
                  : `Menghapus ${removed} catatan pelanggaran terpilih.`
            ),
            ...prev.auditLogs,
          ].slice(0, 200),
        };
      });
      return removed;
    },
    [commitDb, session]
  );

  const deleteAuditLogs = useCallback(
    (options: { ids?: string[]; keepLatest?: number; clearAll?: boolean }) => {
      let removed = 0;
      commitDb((prev) => {
        let nextLogs = prev.auditLogs;
        if (options.clearAll) {
          nextLogs = [];
        } else if (typeof options.keepLatest === 'number' && options.keepLatest >= 0) {
          nextLogs = [...prev.auditLogs]
            .sort((a, b) => (Date.parse(b.timestamp) || 0) - (Date.parse(a.timestamp) || 0))
            .slice(0, options.keepLatest);
        } else if (options.ids && options.ids.length > 0) {
          const idSet = new Set(options.ids);
          nextLogs = prev.auditLogs.filter((l) => !idSet.has(l.id));
        }
        removed = prev.auditLogs.length - nextLogs.length;
        if (removed <= 0) return prev;
        return {
          ...prev,
          auditLogs: nextLogs,
        };
      });
      return removed;
    },
    [commitDb]
  );

  const upsertExamPackage = useCallback(
    (pkg: Omit<ExamPackage, 'id' | 'createdAt'> & { id?: string }) => {
      const id = pkg.id || `pkg-${Date.now()}`;
      commitDb((prev) => {
        const exists = prev.packages.some((p) => p.id === id);
        const existing = prev.packages.find((p) => p.id === id);
        const now = new Date().toISOString();
        const nextPkg: ExamPackage = {
          ...pkg,
          id,
          token: pkg.token.trim().toUpperCase(),
          allowIndependentAccess:
            pkg.allowIndependentAccess !== undefined
              ? pkg.allowIndependentAccess
              : existing?.allowIndependentAccess ?? pkg.isPublished,
          teacherActivatedAt: pkg.isPublished
            ? existing?.teacherActivatedAt || now
            : existing?.teacherActivatedAt,
          createdAt: existing?.createdAt || now,
        };
        const packages = exists
          ? prev.packages.map((p) => (p.id === id ? nextPkg : p))
          : [nextPkg, ...prev.packages];
        return {
          ...prev,
          packages,
          auditLogs: [
            makeAudit(
              'teacher',
              session?.name || 'Guru',
              exists ? 'Perbarui Paket Ujian' : 'Buat Paket Ujian Baru',
              'exam',
              `Paket "${nextPkg.title}" (${nextPkg.subject}, ${nextPkg.category}, Token: ${nextPkg.token}, Status: ${nextPkg.isPublished ? 'Aktif' : 'Nonaktif'}).`
            ),
            ...prev.auditLogs,
          ].slice(0, 200),
        };
      });
      return id;
    },
    [commitDb, session]
  );

  const importExamSchedulesBatch = useCallback(
    (rows: ParsedExamScheduleRow[]) => {
      let added = 0;
      let updated = 0;
      let newClassesAdded = 0;
      if (rows.length === 0) return { added, updated, newClassesAdded };

      commitDb((prev) => {
        const now = new Date().toISOString();
        const packagesByToken = new Map<string, ExamPackage>(
          prev.packages.map((p) => [p.token.trim().toUpperCase(), p])
        );
        const nextPackages = [...prev.packages];
        const classSet = new Set(prev.classes.map((c) => c.trim().toUpperCase()));
        const nextClasses = [...prev.classes];

        rows.forEach((row, idx) => {
          const normalizedToken = row.token.trim().toUpperCase();
          row.targetClasses.forEach((cls) => {
            const upper = cls.trim().toUpperCase();
            if (upper && !classSet.has(upper)) {
              classSet.add(upper);
              nextClasses.push(upper);
              newClassesAdded += 1;
            }
          });

          const existing = packagesByToken.get(normalizedToken);
          if (existing) {
            updated += 1;
            const updatedPkg: ExamPackage = {
              ...existing,
              title: row.title,
              subject: row.subject,
              category: row.category,
              targetClasses:
                row.targetClasses.length > 0
                  ? row.targetClasses
                  : existing.targetClasses,
              teacherId: row.teacherId || existing.teacherId,
              durationMinutes: row.durationMinutes,
              minSubmitMinutes: row.minSubmitMinutes,
              kkm: row.kkm,
              isPublished: row.isPublished,
              allowIndependentAccess: row.isPublished
                ? true
                : existing.allowIndependentAccess,
              scheduledDate: row.scheduledDate || existing.scheduledDate,
              scheduledStartTime:
                row.scheduledStartTime || existing.scheduledStartTime,
              scheduledEndTime:
                row.scheduledEndTime || existing.scheduledEndTime,
              sessionName: row.sessionName || existing.sessionName,
            };
            const existingIdx = nextPackages.findIndex((p) => p.id === existing.id);
            if (existingIdx >= 0) {
              nextPackages[existingIdx] = updatedPkg;
            }
            packagesByToken.set(normalizedToken, updatedPkg);
          } else {
            added += 1;
            const createdPkg: ExamPackage = {
              id: `pkg-sched-${Date.now()}-${idx}`,
              teacherId: row.teacherId,
              title: row.title,
              subject: row.subject,
              targetClasses: row.targetClasses,
              category: row.category,
              durationMinutes: row.durationMinutes,
              minSubmitMinutes: row.minSubmitMinutes,
              kkm: row.kkm,
              token: normalizedToken,
              shuffleQuestions: true,
              shuffleOptions: true,
              isPublished: row.isPublished,
              allowIndependentAccess: row.isPublished,
              teacherActivatedAt: row.isPublished ? now : undefined,
              scheduledDate: row.scheduledDate || undefined,
              scheduledStartTime: row.scheduledStartTime || undefined,
              scheduledEndTime: row.scheduledEndTime || undefined,
              sessionName: row.sessionName || undefined,
              createdAt: now,
            };
            nextPackages.unshift(createdPkg);
            packagesByToken.set(normalizedToken, createdPkg);
          }
        });

        return {
          ...prev,
          classes: nextClasses,
          packages: nextPackages,
          auditLogs: [
            makeAudit(
              'admin',
              session?.name || 'Super Admin',
              'Impor Jadwal Ujian Massal',
              'exam',
              `Berhasil mengimpor ${rows.length} jadwal ujian (${added} sesi baru, ${updated} diperbarui${newClassesAdded > 0 ? `, ${newClassesAdded} kelas baru` : ''}).`
            ),
            ...prev.auditLogs,
          ].slice(0, 200),
        };
      });

      return { added, updated, newClassesAdded };
    },
    [commitDb, session]
  );

  const togglePackagePublished = useCallback(
    (packageId: string) => {
      commitDb((prev) => {
        const target = prev.packages.find((p) => p.id === packageId);
        if (!target) return prev;
        const nextPublished = !target.isPublished;
        const now = new Date().toISOString();
        return {
          ...prev,
          packages: prev.packages.map((p) =>
            p.id === packageId
              ? {
                  ...p,
                  isPublished: nextPublished,
                  allowIndependentAccess: nextPublished
                    ? true
                    : p.allowIndependentAccess,
                  teacherActivatedAt: nextPublished ? now : p.teacherActivatedAt,
                }
              : p
          ),
          auditLogs: [
            makeAudit(
              session?.role === 'admin' ? 'admin' : 'teacher',
              session?.name || (session?.role === 'admin' ? 'Super Admin' : 'Guru'),
              nextPublished ? 'Aktifkan Paket Soal' : 'Nonaktifkan Paket Soal',
              'exam',
              `${session?.role === 'admin' ? 'Super Admin' : 'Guru'} ${nextPublished ? 'mengaktifkan' : 'menonaktifkan'} paket "${target.title}" (${target.category}, Token: ${target.token}).`
            ),
            ...prev.auditLogs,
          ].slice(0, 200),
        };
      });
    },
    [commitDb, session]
  );

  const deleteExamPackage = useCallback(
    (packageId: string) => {
      commitDb((prev) => {
        const target = prev.packages.find((p) => p.id === packageId);
        return {
          ...prev,
          packages: prev.packages.filter((p) => p.id !== packageId),
          questions: prev.questions.filter((q) => q.packageId !== packageId),
          auditLogs: [
            makeAudit(
              'teacher',
              session?.name || 'Guru',
              'Hapus Paket Ujian',
              'exam',
              `Paket "${target?.title || packageId}" beserta butir soalnya dihapus.`
            ),
            ...prev.auditLogs,
          ].slice(0, 200),
        };
      });
    },
    [commitDb, session]
  );

  const upsertQuestion = useCallback(
    (
      q: Omit<Question, 'id'> & { id?: string },
      options?: { autoBalancePoints?: boolean }
    ) => {
      commitDb((prev) => {
        const id = q.id || `q-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
        const exists = prev.questions.some((item) => item.id === id);
        const nextQ: Question = { ...q, id };
        let questions = exists
          ? prev.questions.map((item) => (item.id === id ? nextQ : item))
          : [...prev.questions, nextQ];
        if (options?.autoBalancePoints) {
          questions = autoDistributePackagePoints(questions, nextQ.packageId, 100);
        }
        return {
          ...prev,
          questions,
        };
      });
    },
    [commitDb]
  );

  const deleteQuestion = useCallback(
    (questionId: string, options?: { autoBalancePoints?: boolean }) => {
      commitDb((prev) => {
        const removed = prev.questions.find((q) => q.id === questionId);
        let questions = prev.questions.filter((q) => q.id !== questionId);
        if (options?.autoBalancePoints && removed) {
          questions = autoDistributePackagePoints(questions, removed.packageId, 100);
        }
        return {
          ...prev,
          questions,
        };
      });
    },
    [commitDb]
  );

  const autoBalancePackagePoints = useCallback(
    (packageId: string, targetTotal = 100) => {
      commitDb((prev) => {
        const nextQuestions = autoDistributePackagePoints(
          prev.questions,
          packageId,
          targetTotal
        );
        return {
          ...prev,
          questions: nextQuestions,
          auditLogs: [
            makeAudit(
              'teacher',
              session?.name || 'Guru',
              'Bagi Poin Soal Otomatis',
              'exam',
              `Membagi bobot poin seluruh soal pada paket secara otomatis ke total ${targetTotal} poin.`
            ),
            ...prev.auditLogs,
          ].slice(0, 200),
        };
      });
    },
    [commitDb, session]
  );

  const updateSpreadsheetSyncConfig = useCallback(
    (config: SpreadsheetSyncConfig) => {
      commitDb(
        (prev) => ({
          ...prev,
          spreadsheetSync: {
            ...prev.spreadsheetSync,
            ...config,
            webAppUrl: config.webAppUrl.trim(),
            spreadsheetUrl: config.spreadsheetUrl.trim(),
            syncSecret: config.syncSecret.trim(),
          },
          auditLogs: [
            makeAudit(
              'admin',
              session?.name || 'Super Admin',
              'Perbarui Pengaturan Database Spreadsheet',
              'system',
              `Sinkronisasi otomatis: ${config.enabled ? 'Aktif' : 'Nonaktif'} · Auto-Push: ${
                config.autoPushOnChange ? 'ON' : 'OFF'
              } · Auto-Pull: ${config.autoPullOnLoad ? 'ON' : 'OFF'}.`
            ),
            ...prev.auditLogs,
          ].slice(0, 200),
        }),
        { triggerAutoSync: false }
      );
      const activeUser = firebaseUserRef.current;
      if (activeUser && activeUser.emailVerified) {
        void saveCbtSnapshotToFirestore(activeUser, dbRef.current).catch(() => {
          // Structured error logged in firestoreSyncService
        });
      }
    },
    [commitDb, session]
  );

  const callAppsScriptApi = useCallback(
    async <T extends { ok?: boolean; error?: string }>(params: {
      webAppUrl: string;
      action: 'ping' | 'pull' | 'push';
      secret: string;
      database?: CBTDatabase;
    }): Promise<T> => {
      // Primary path: same-origin server proxy (/api/spreadsheet-sync).
      // Eliminates browser/iframe CORS errors and handles Google Apps Script 302 redirects cleanly.
      try {
        const proxyResp = await fetch('/api/spreadsheet-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            webAppUrl: params.webAppUrl,
            action: params.action,
            secret: params.secret,
            database: params.database,
          }),
        });

        const contentType = proxyResp.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = (await proxyResp.json()) as T;
          if (!data.ok) {
            // If proxy hit Netlify 502/504 gateway or timeout and client has webAppUrl, fall back to direct fetch
            const isTransientGateway =
              proxyResp.status >= 500 && Boolean(params.webAppUrl);
            if (!isTransientGateway) {
              throw new Error(data.error || `HTTP ${proxyResp.status}`);
            }
          } else {
            return data;
          }
        } else {
          // On Netlify or static hosting, non-JSON 404/405/5xx responses (e.g. function cold-start/timeout HTML)
          // should gracefully fall through to direct browser fetch when webAppUrl is known.
          const canFallback =
            Boolean(params.webAppUrl) &&
            (proxyResp.status === 404 ||
              proxyResp.status === 405 ||
              proxyResp.status >= 500);
          if (!canFallback) {
            throw new Error(`HTTP ${proxyResp.status}`);
          }
        }
      } catch (proxyErr) {
        // Re-throw explicit config/auth errors (400/403); fall back to direct fetch on network/timeout errors
        const msg = proxyErr instanceof Error ? proxyErr.message : '';
        const isNetworkOrGateway =
          !msg ||
          msg.includes('Failed to fetch') ||
          msg.includes('NetworkError') ||
          msg.includes('Load failed') ||
          msg.includes('melebihi batas waktu') ||
          /^HTTP 5\d\d/.test(msg);
        if (!isNetworkOrGateway || !params.webAppUrl) {
          throw proxyErr;
        }
      }

      // Static-hosting fallback: direct request to Google Apps Script
      if (!params.webAppUrl) {
        throw new Error(
          'Endpoint /api/spreadsheet-sync tidak tersedia pada hosting statis tanpa URL Web App klien.'
        );
      }
      if (params.action === 'push') {
        const resp = await fetch(params.webAppUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'push',
            secret: params.secret,
            database: params.database,
          }),
          redirect: 'follow',
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = (await resp.json()) as T;
        if (!data.ok) throw new Error(data.error || 'Apps Script gagal menyimpan data.');
        return data;
      }

      const url = new URL(params.webAppUrl);
      url.searchParams.set('action', params.action);
      if (params.secret) {
        url.searchParams.set('secret', params.secret);
      }
      const resp = await fetch(url.toString(), {
        method: 'GET',
        redirect: 'follow',
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = (await resp.json()) as T;
      if (!data.ok) throw new Error(data.error || 'Respons Apps Script menolak koneksi.');
      return data;
    },
    []
  );

  const resolveEffectiveAppsScriptTarget = useCallback((cfg: SpreadsheetSyncConfig) => {
    const trimmedUrl = cfg.webAppUrl.trim();
    if (trimmedUrl) {
      const check = validateAppsScriptUrl(trimmedUrl);
      return {
        ok: check.ok,
        webAppUrl: check.ok ? check.normalizedUrl : '',
        usingServerEnv: false,
        error: check.error,
      };
    }
    if (serverAutoSyncRef.current.serverConfigured) {
      return {
        ok: true,
        webAppUrl: '',
        usingServerEnv: true,
        error: undefined,
      };
    }
    return {
      ok: false,
      webAppUrl: '',
      usingServerEnv: false,
      error: 'URL Web App Google Apps Script belum diisi atau dikonfigurasi di server.',
    };
  }, []);

  const testSpreadsheetConnection = useCallback(
    async (configOverride?: SpreadsheetSyncConfig) => {
      const cfg = configOverride || dbRef.current.spreadsheetSync;
      const target = resolveEffectiveAppsScriptTarget(cfg);
      if (!target.ok) {
        const msg = target.error || 'URL Web App Google Apps Script tidak valid.';
        setSyncRuntime({ status: 'error', message: msg });
        return { ok: false, message: msg };
      }

      setSyncRuntime({ status: 'syncing', message: 'Menguji koneksi Google Apps Script...' });
      try {
        const data = await callAppsScriptApi<{
          ok?: boolean;
          error?: string;
          spreadsheetName?: string;
          spreadsheetUrl?: string;
        }>({
          webAppUrl: target.webAppUrl,
          action: 'ping',
          secret: cfg.syncSecret.trim(),
        });

        const now = new Date().toISOString();
        commitDb(
          (prev) => ({
            ...prev,
            spreadsheetSync: {
              ...prev.spreadsheetSync,
              ...cfg,
              webAppUrl: target.webAppUrl || prev.spreadsheetSync.webAppUrl,
              spreadsheetUrl:
                cfg.spreadsheetUrl.trim() || data.spreadsheetUrl || prev.spreadsheetSync.spreadsheetUrl,
              lastSyncedAt: now,
              lastSyncDirection: 'test',
            },
          }),
          { triggerAutoSync: false }
        );

        const message = data.spreadsheetName
          ? `Terhubung ke Google Spreadsheet "${data.spreadsheetName}".`
          : 'Koneksi ke Google Apps Script berhasil diverifikasi.';
        setSyncRuntime({ status: 'synced', message });
        return {
          ok: true,
          message,
          spreadsheetName: data.spreadsheetName,
          spreadsheetUrl: data.spreadsheetUrl,
        };
      } catch (err) {
        const errMsg =
          err instanceof Error
            ? err.message
            : 'Gagal terhubung ke Google Apps Script.';
        setSyncRuntime({ status: 'error', message: errMsg });
        return { ok: false, message: errMsg };
      }
    },
    [callAppsScriptApi, commitDb, resolveEffectiveAppsScriptTarget]
  );

  const pushDatabaseToSpreadsheet = useCallback(
    async (configOverride?: SpreadsheetSyncConfig) => {
      const cfg = configOverride || dbRef.current.spreadsheetSync;
      const target = resolveEffectiveAppsScriptTarget(cfg);
      if (!target.ok) {
        const msg = target.error || 'URL Web App Google Apps Script tidak valid.';
        setSyncRuntime({ status: 'error', message: msg });
        return { ok: false, message: msg };
      }
      if (syncInFlightRef.current) {
        // Queue push so local changes (e.g. imported students/questions) are never dropped
        pendingPushRef.current = true;
        return { ok: false, message: 'Sinkronisasi lain sedang berlangsung; penyimpanan otomatis dijadwalkan ulang.' };
      }

      syncInFlightRef.current = true;
      pendingPushRef.current = false;
      const pushStartVersion = mutationVersionRef.current;
      setSyncRuntime({ status: 'syncing', message: 'Menyimpan database ke Google Spreadsheet...' });
      try {
        const snapshot: CBTDatabase = {
          ...dbRef.current,
          spreadsheetSync: {
            ...dbRef.current.spreadsheetSync,
            ...cfg,
            webAppUrl: target.webAppUrl || dbRef.current.spreadsheetSync.webAppUrl,
          },
        };
        const data = await callAppsScriptApi<{
          ok?: boolean;
          error?: string;
          spreadsheetName?: string;
          spreadsheetUrl?: string;
          updatedAt?: string;
        }>({
          webAppUrl: target.webAppUrl,
          action: 'push',
          secret: cfg.syncSecret.trim(),
          database: snapshot,
        });

        const syncedAt = data.updatedAt || new Date().toISOString();
        commitDb(
          (prev) => ({
            ...prev,
            spreadsheetSync: {
              ...prev.spreadsheetSync,
              ...cfg,
              webAppUrl: target.webAppUrl || prev.spreadsheetSync.webAppUrl,
              spreadsheetUrl:
                cfg.spreadsheetUrl.trim() || data.spreadsheetUrl || prev.spreadsheetSync.spreadsheetUrl,
              lastSyncedAt: syncedAt,
              lastSyncDirection: 'push',
            },
          }),
          { triggerAutoSync: false }
        );

        if (mutationVersionRef.current === pushStartVersion) {
          hasUnpushedChangesRef.current = false;
          writeUnpushedFlag(false);
        } else {
          // More local edits arrived while this push was in flight; queue follow-up push
          pendingPushRef.current = true;
        }

        const msg = data.spreadsheetName
          ? `Database tersimpan otomatis ke Spreadsheet "${data.spreadsheetName}".`
          : 'Database berhasil disimpan ke Google Spreadsheet.';
        setSyncRuntime({ status: 'synced', message: msg });
        return { ok: true, message: msg };
      } catch (err) {
        // Keep unpushed dirty flag true so background pull never overwrites unsaved local imports
        hasUnpushedChangesRef.current = true;
        writeUnpushedFlag(true);
        const errMsg =
          err instanceof Error
            ? `Gagal menyimpan ke Spreadsheet: ${err.message}`
            : 'Gagal menyimpan ke Google Spreadsheet.';
        setSyncRuntime({ status: 'error', message: errMsg });
        return { ok: false, message: errMsg };
      } finally {
        syncInFlightRef.current = false;
        if (pendingPushRef.current) {
          const liveCfg = dbRef.current.spreadsheetSync;
          if (
            liveCfg.enabled &&
            liveCfg.autoPushOnChange &&
            resolveEffectiveAppsScriptTarget(liveCfg).ok
          ) {
            window.setTimeout(() => {
              void pushDatabaseToSpreadsheet();
            }, 300);
          }
        }
      }
    },
    [callAppsScriptApi, commitDb, resolveEffectiveAppsScriptTarget]
  );

  const pullDatabaseFromSpreadsheet = useCallback(
    async (
      configOverride?: SpreadsheetSyncConfig,
      options?: { manual?: boolean }
    ) => {
      const isManual = options?.manual === true;
      const cfg = configOverride || dbRef.current.spreadsheetSync;
      const target = resolveEffectiveAppsScriptTarget(cfg);
      if (!target.ok) {
        const msg = target.error || 'URL Web App Google Apps Script tidak valid.';
        setSyncRuntime({ status: 'error', message: msg });
        return { ok: false, message: msg };
      }
      if (syncInFlightRef.current) {
        return { ok: false, message: 'Sinkronisasi lain sedang berlangsung.' };
      }
      if (!isManual && (hasUnpushedChangesRef.current || pendingPushRef.current)) {
        // Protect unpushed local data from being overwritten by a background pull
        if (cfg.enabled && cfg.autoPushOnChange) {
          void pushDatabaseToSpreadsheet(cfg);
        }
        return {
          ok: true,
          message: 'Menunda muat otomatis karena terdapat perubahan lokal yang belum tersinkron.',
        };
      }

      syncInFlightRef.current = true;
      const pullStartVersion = mutationVersionRef.current;
      setSyncRuntime({ status: 'syncing', message: 'Memuat database dari Google Spreadsheet...' });
      try {
        const data = await callAppsScriptApi<{
          ok?: boolean;
          error?: string;
          database?: Partial<CBTDatabase> | null;
          spreadsheetName?: string;
          updatedAt?: string;
        }>({
          webAppUrl: target.webAppUrl,
          action: 'pull',
          secret: cfg.syncSecret.trim(),
        });

        const remoteHasData = Boolean(
          data.database && typeof data.database === 'object' && data.database.school
        );
        if (!remoteHasData || !data.database) {
          const emptyMsg =
            'Spreadsheet terhubung, namun belum ada data database tersimpan di sheet CBT_Master_JSON.';
          setSyncRuntime({ status: 'synced', message: emptyMsg });
          return { ok: true, message: emptyMsg };
        }

        const currentLocal = dbRef.current;
        const localHasData =
          currentLocal.students.length > 0 ||
          currentLocal.questions.length > 0 ||
          currentLocal.packages.length > 0 ||
          currentLocal.teachers.length > 0;

        const guard = shouldApplyRemotePull({
          isManual,
          hasPendingLocalChanges: hasUnpushedChangesRef.current || pendingPushRef.current,
          pullStartedMutationVersion: pullStartVersion,
          currentMutationVersion: mutationVersionRef.current,
          localLastSyncedAt: currentLocal.spreadsheetSync.lastSyncedAt,
          remoteUpdatedAt: data.updatedAt,
          localHasData,
          remoteHasData,
        });

        if (!guard.apply) {
          if (
            guard.reason === 'stale_pull_during_mutation' ||
            guard.reason === 'pending_local_changes'
          ) {
            pendingPushRef.current = true;
          }
          const skipMsg =
            guard.reason === 'remote_not_newer'
              ? 'Data lokal sudah merupakan versi terbaru.'
              : 'Perubahan lokal terbaru dipertahankan agar data yang baru diimpor tidak tertimpa.';
          setSyncRuntime({ status: 'synced', message: skipMsg });
          return { ok: true, message: skipMsg };
        }

        const syncedAt = data.updatedAt || new Date().toISOString();
        const normalized = normalizeDB(data.database);
        commitDb(
          (prev) => ({
            ...normalized,
            attempts: isManual
              ? normalized.attempts
              : mergeExamAttempts(
                  prev.attempts,
                  normalized.attempts,
                  normalized.security.maxViolationTolerance
                ),
            spreadsheetSync: {
              ...normalized.spreadsheetSync,
              ...cfg,
              webAppUrl: target.webAppUrl || normalized.spreadsheetSync.webAppUrl,
              lastSyncedAt: syncedAt,
              lastSyncDirection: 'pull',
            },
          }),
          { triggerAutoSync: false }
        );
        hasUnpushedChangesRef.current = false;
        writeUnpushedFlag(false);

        const msg = `Database berhasil dimuat dari Spreadsheet (${normalized.students.length} siswa, ${normalized.packages.length} paket, ${normalized.questions.length} soal).`;
        setSyncRuntime({ status: 'synced', message: msg });
        return { ok: true, message: msg };
      } catch (err) {
        const errMsg =
          err instanceof Error
            ? `Gagal memuat dari Spreadsheet: ${err.message}`
            : 'Gagal memuat data dari Google Spreadsheet.';
        setSyncRuntime({ status: 'error', message: errMsg });
        return { ok: false, message: errMsg };
      } finally {
        syncInFlightRef.current = false;
        if (pendingPushRef.current) {
          const liveCfg = dbRef.current.spreadsheetSync;
          if (
            liveCfg.enabled &&
            liveCfg.autoPushOnChange &&
            resolveEffectiveAppsScriptTarget(liveCfg).ok
          ) {
            window.setTimeout(() => {
              void pushDatabaseToSpreadsheet();
            }, 300);
          }
        }
      }
    },
    [callAppsScriptApi, commitDb, pushDatabaseToSpreadsheet, resolveEffectiveAppsScriptTarget]
  );

  // Automatic Detection of Netlify / Server Environment Auto-Sync Config + Initial Pull/Push
  const startupPullDoneRef = useRef(false);
  useEffect(() => {
    if (startupPullDoneRef.current) return;
    startupPullDoneRef.current = true;

    let cancelled = false;
    const bootstrapAutoSync = async () => {
      let detectedServerStatus: ServerAutoSyncStatus | null = null;
      try {
        const resp = await fetch('/api/auto-sync-status', {
          method: 'GET',
          headers: { Accept: 'application/json' },
        });
        const contentType = resp.headers.get('content-type') || '';
        if (resp.ok && contentType.includes('application/json')) {
          const json = (await resp.json()) as Partial<ServerAutoSyncStatus> & { ok?: boolean };
          if (json.ok) {
            detectedServerStatus = {
              serverConfigured: Boolean(json.serverConfigured),
              hasWebAppUrl: Boolean(json.hasWebAppUrl),
              hasSecret: Boolean(json.hasSecret),
              spreadsheetUrl: String(json.spreadsheetUrl || ''),
              spreadsheetId: String(json.spreadsheetId || ''),
            };
          }
        }
      } catch {
        // Pure static hosting without function endpoint; continue with client env / local config
      }

      if (cancelled) return;

      if (detectedServerStatus) {
        serverAutoSyncRef.current = detectedServerStatus;
        setServerAutoSyncStatus(detectedServerStatus);

        if (detectedServerStatus.serverConfigured) {
          const envDefaults = resolveAutoSyncDefaults();
          const merged = mergeSpreadsheetSyncWithDefaults(
            dbRef.current.spreadsheetSync,
            envDefaults,
            detectedServerStatus
          );
          commitDb(
            (prev) => ({
              ...prev,
              spreadsheetSync: {
                ...prev.spreadsheetSync,
                ...merged,
              },
            }),
            { triggerAutoSync: false }
          );
        }
      }

      const cfg = dbRef.current.spreadsheetSync;
      const target = resolveEffectiveAppsScriptTarget(cfg);
      if (!cfg.enabled || !target.ok) return;

      if (hasUnpushedChangesRef.current && cfg.autoPushOnChange) {
        void pushDatabaseToSpreadsheet(cfg);
      } else if (cfg.autoPullOnLoad) {
        void pullDatabaseFromSpreadsheet(cfg, { manual: false });
      }
    };

    void bootstrapAutoSync();
    return () => {
      cancelled = true;
    };
  }, [
    commitDb,
    pullDatabaseFromSpreadsheet,
    pushDatabaseToSpreadsheet,
    resolveEffectiveAppsScriptTarget,
  ]);

  // Automatic Debounced Push to Google Apps Script / Spreadsheet whenever local database changes
  useEffect(() => {
    if (mutationVersion === 0) return;
    const cfg = dbRef.current.spreadsheetSync;
    if (!cfg.enabled || !cfg.autoPushOnChange || !resolveEffectiveAppsScriptTarget(cfg).ok) {
      return;
    }
    const timer = window.setTimeout(() => {
      void pushDatabaseToSpreadsheet();
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [mutationVersion, pushDatabaseToSpreadsheet, resolveEffectiveAppsScriptTarget]);

  // Optional Periodic Background Pull:
  // - Admin/Teacher: runs on configured interval (>= 30s)
  // - Student: skipped during active exam, EXCEPT when student's attempt is locked so teacher unlocks arrive automatically!
  const hasLockedStudentAttempt =
    session?.role === 'student' &&
    db.attempts.some(
      (a) =>
        (a.studentId === session.userId ||
          (session.nisn && a.studentNisn === session.nisn)) &&
        isAttemptViolationLocked(a, db.security.maxViolationTolerance)
    );

  useEffect(() => {
    const cfg = db.spreadsheetSync;
    const targetOk = resolveEffectiveAppsScriptTarget(cfg).ok;
    if (!cfg.enabled || !targetOk) return;

    if (session?.role === 'student' && !hasLockedStudentAttempt) {
      return;
    }

    const intervalSeconds = hasLockedStudentAttempt
      ? 12
      : cfg.autoPullIntervalSeconds;
    if (intervalSeconds < 10) {
      return;
    }

    const interval = window.setInterval(() => {
      if (
        !syncInFlightRef.current &&
        !hasUnpushedChangesRef.current &&
        !pendingPushRef.current
      ) {
        void pullDatabaseFromSpreadsheet(undefined, { manual: false });
      }
    }, intervalSeconds * 1000);
    return () => window.clearInterval(interval);
  }, [
    db.spreadsheetSync.enabled,
    db.spreadsheetSync.autoPullIntervalSeconds,
    db.spreadsheetSync.webAppUrl,
    serverAutoSyncStatus.serverConfigured,
    pullDatabaseFromSpreadsheet,
    resolveEffectiveAppsScriptTarget,
    session?.role,
    hasLockedStudentAttempt,
  ]);

  // Automatic Zero-Sign-In Shared Device Connection via Public School Portal (`/school_portal/sman1kabun_live`)
  useEffect(() => {
    const unsubPortal = subscribeToPublicSchoolPortal(
      (portal) => {
        if (!portal) return;

        setFirestoreAutoSync((prev) => ({
          ...prev,
          connected: true,
          mode: firebaseUserRef.current ? 'admin' : 'shared',
          status: prev.status === 'syncing' ? 'syncing' : 'synced',
          lastSyncedAt: portal.updatedAtLabel || prev.lastSyncedAt || new Date().toLocaleString('id-ID'),
          portalSummary: portal,
        }));

        // Hydrate shared school identity, classes, and Apps Script / Spreadsheet URLs without requiring sign-in
        const local = dbRef.current;
        const remoteAppsScript = portal.appsScriptWebAppUrl.trim();
        const remoteSheetUrl = portal.spreadsheetUrl.trim();
        const validRemoteAppsScript = validateAppsScriptUrl(remoteAppsScript).ok;
        const localWebAppUrl = local.spreadsheetSync.webAppUrl.trim();
        const needsUrlHydration =
          (validRemoteAppsScript &&
            (!localWebAppUrl ||
              !local.spreadsheetSync.enabled ||
              (!hasUnpushedChangesRef.current && localWebAppUrl !== remoteAppsScript))) ||
          (Boolean(remoteSheetUrl) &&
            (!local.spreadsheetSync.spreadsheetUrl.trim() ||
              (!hasUnpushedChangesRef.current &&
                local.spreadsheetSync.spreadsheetUrl.trim() !== remoteSheetUrl)));
        const needsSchoolHydration =
          !hasUnpushedChangesRef.current &&
          local.students.length === 0 &&
          (Boolean(portal.schoolName) || (portal.classes && portal.classes.length > 0));

        const nextSyncCfg: SpreadsheetSyncConfig = {
          ...local.spreadsheetSync,
          enabled: local.spreadsheetSync.enabled || validRemoteAppsScript,
          autoPushOnChange: validRemoteAppsScript ? true : local.spreadsheetSync.autoPushOnChange,
          autoPullOnLoad: validRemoteAppsScript ? true : local.spreadsheetSync.autoPullOnLoad,
          webAppUrl:
            validRemoteAppsScript &&
            (!localWebAppUrl || !hasUnpushedChangesRef.current)
              ? remoteAppsScript
              : localWebAppUrl,
          spreadsheetUrl:
            remoteSheetUrl &&
            (!local.spreadsheetSync.spreadsheetUrl.trim() || !hasUnpushedChangesRef.current)
              ? remoteSheetUrl
              : local.spreadsheetSync.spreadsheetUrl.trim(),
        };

        if (needsUrlHydration || needsSchoolHydration) {
          commitDb(
            (prev) => {
              const mergedClasses = new Set(prev.classes);
              (portal.classes || []).forEach((c) => mergedClasses.add(c));
              return {
                ...prev,
                school: needsSchoolHydration
                  ? {
                      ...prev.school,
                      schoolName: portal.schoolName || prev.school.schoolName,
                      academicYear: portal.academicYear || prev.school.academicYear,
                      announcementTitle: portal.announcementTitle ?? prev.school.announcementTitle,
                      announcementText: portal.announcementText ?? prev.school.announcementText,
                      announcementActive:
                        typeof portal.announcementActive === 'boolean'
                          ? portal.announcementActive
                          : prev.school.announcementActive,
                    }
                  : prev.school,
                theme:
                  needsSchoolHydration && portal.themeMode && portal.themeAccent
                    ? { mode: portal.themeMode, accent: portal.themeAccent }
                    : prev.theme,
                classes: Array.from(mergedClasses),
                spreadsheetSync: nextSyncCfg,
              };
            },
            { triggerAutoSync: false }
          );
        }

        // Automatically pull full database on Netlify boot once portal URL is available (no Google login needed)
        const shouldAutoPullFromPortal =
          !portalInitialPullDoneRef.current &&
          nextSyncCfg.enabled &&
          nextSyncCfg.autoPullOnLoad &&
          validRemoteAppsScript &&
          !hasUnpushedChangesRef.current &&
          !syncInFlightRef.current;

        if (shouldAutoPullFromPortal) {
          portalInitialPullDoneRef.current = true;
          void pullDatabaseFromSpreadsheet(nextSyncCfg, { manual: false });
        }
      },
      () => {
        // Keep silent if portal doc hasn't been published yet
      }
    );
    return unsubPortal;
  }, [commitDb, pullDatabaseFromSpreadsheet]);

  // Automatic Firebase Firestore Connection, Cross-Device Config Hydration & Auto-Push (Authenticated Admin)
  useEffect(() => {
    let unsubSnapshot: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(firebaseAuth, (user) => {
      if (unsubSnapshot) {
        unsubSnapshot();
        unsubSnapshot = null;
      }

      if (!user || !user.emailVerified) {
        firebaseUserRef.current = null;
        firestoreHydratedRef.current = false;
        setFirestoreAutoSync((prev) => ({
          ...prev,
          connected: Boolean(prev.portalSummary),
          mode: prev.portalSummary ? 'shared' : 'offline',
          status: prev.portalSummary ? 'synced' : 'idle',
          email: null,
        }));
        return;
      }

      firebaseUserRef.current = user;
      setFirestoreAutoSync((prev) => ({
        ...prev,
        connected: true,
        mode: 'admin',
        status: 'syncing',
        email: user.email || user.displayName || null,
      }));

      unsubSnapshot = subscribeToUserSnapshot(
        user,
        (summary) => {
          setFirestoreAutoSync((prev) => ({
            ...prev,
            connected: true,
            mode: 'admin',
            status: 'synced',
            lastSyncedAt: summary?.updatedAtLabel || prev.lastSyncedAt || new Date().toLocaleString('id-ID'),
            email: user.email || user.displayName || null,
            portalSummary: summary || prev.portalSummary,
          }));

          if (!summary) return;

          // Auto-hydrate Google Apps Script & Spreadsheet URLs from Firestore if local config is empty
          const localSync = dbRef.current.spreadsheetSync;
          const remoteAppsScript = summary.appsScriptWebAppUrl.trim();
          const remoteSheetUrl = summary.spreadsheetUrl.trim();
          const needsUrlHydration =
            (!localSync.webAppUrl.trim() && validateAppsScriptUrl(remoteAppsScript).ok) ||
            (!localSync.spreadsheetUrl.trim() && Boolean(remoteSheetUrl));

          if (needsUrlHydration) {
            const nextCfg: SpreadsheetSyncConfig = {
              ...localSync,
              enabled:
                localSync.enabled || validateAppsScriptUrl(remoteAppsScript).ok,
              webAppUrl: localSync.webAppUrl.trim() || remoteAppsScript,
              spreadsheetUrl: localSync.spreadsheetUrl.trim() || remoteSheetUrl,
            };
            commitDb(
              (prev) => ({
                ...prev,
                spreadsheetSync: nextCfg,
              }),
              { triggerAutoSync: false }
            );
            if (nextCfg.enabled && nextCfg.autoPullOnLoad && !hasUnpushedChangesRef.current) {
              void pullDatabaseFromSpreadsheet(nextCfg, { manual: false });
            }
          }

          // Auto-hydrate empty local device from Firestore snapshot once per session
          if (
            !firestoreHydratedRef.current &&
            dbRef.current.students.length === 0 &&
            summary.studentCount > 0
          ) {
            firestoreHydratedRef.current = true;
            void loadStudentsFromFirestoreSnapshot(user)
              .then((res) => {
                if (!res.snapshotFound) return;
                commitDb(
                  (prev) => {
                    const existingClasses = new Set(prev.classes);
                    res.classes.forEach((c) => existingClasses.add(c));
                    const existingNisns = new Set(prev.students.map((s) => s.nisn));
                    const newStudents: StudentRecord[] = res.students
                      .filter((s) => s.nisn && !existingNisns.has(s.nisn))
                      .map((s, idx) => ({
                        ...s,
                        id: `stu-fs-${Date.now()}-${idx}`,
                      }));
                    return {
                      ...prev,
                      classes: Array.from(existingClasses),
                      students: [...prev.students, ...newStudents],
                    };
                  },
                  { triggerAutoSync: false }
                );
              })
              .catch(() => {
                // Handled by structured logger in firestoreSyncService
              });
          } else {
            firestoreHydratedRef.current = true;
          }
        },
        () => {
          setFirestoreAutoSync((prev) => ({
            ...prev,
            connected: true,
            mode: 'admin',
            status: 'error',
          }));
        }
      );
    });

    return () => {
      if (unsubSnapshot) unsubSnapshot();
      unsubAuth();
    };
  }, [commitDb, pullDatabaseFromSpreadsheet]);

  // Automatic Debounced Push to Firebase Firestore whenever local database mutates while signed in
  useEffect(() => {
    if (mutationVersion === 0) return;
    const user = firebaseUserRef.current;
    if (!user || !user.emailVerified || firestorePushInFlightRef.current) return;

    const timer = window.setTimeout(() => {
      const activeUser = firebaseUserRef.current;
      if (!activeUser || !activeUser.emailVerified || firestorePushInFlightRef.current) return;
      firestorePushInFlightRef.current = true;
      setFirestoreAutoSync((prev) => ({ ...prev, status: 'syncing' }));
      void saveCbtSnapshotToFirestore(activeUser, dbRef.current)
        .then(() => {
          setFirestoreAutoSync((prev) => ({
            ...prev,
            connected: true,
            mode: 'admin',
            status: 'synced',
            lastSyncedAt: new Date().toLocaleString('id-ID'),
            email: activeUser.email || activeUser.displayName || null,
          }));
        })
        .catch(() => {
          setFirestoreAutoSync((prev) => ({ ...prev, status: 'error' }));
        })
        .finally(() => {
          firestorePushInFlightRef.current = false;
        });
    }, 2200);

    return () => window.clearTimeout(timer);
  }, [mutationVersion]);

  const bulkAddQuestions = useCallback(
    (questions: Question[]) => {
      commitDb((prev) => ({
        ...prev,
        questions: [...prev.questions, ...questions],
        auditLogs: [
          makeAudit(
            'teacher',
            session?.name || 'Guru',
            'Import Soal Massal',
            'exam',
            `Menambahkan ${questions.length} butir soal ke bank soal.`
          ),
          ...prev.auditLogs,
        ].slice(0, 200),
      }));
    },
    [commitDb, session]
  );

  const bulkUpdateQuestions = useCallback(
    (patches: CollectiveQuestionPatch[]) => {
      if (patches.length === 0) return 0;
      commitDb((prev) => ({
        ...prev,
        questions: applyCollectiveQuestionEdits(prev.questions, patches),
        auditLogs: [
          makeAudit(
            'teacher',
            session?.name || 'Guru',
            'Edit Soal Secara Kolektif',
            'exam',
            `Memperbarui ${patches.length} butir soal secara kolektif.`
          ),
          ...prev.auditLogs,
        ].slice(0, 200),
      }));
      return patches.length;
    },
    [commitDb, session]
  );

  const applyQuestionWeightDistribution = useCallback(
    (packageId: string, config: WeightDistributionMode, targetIds?: string[]) => {
      let affected = 0;
      commitDb((prev) => {
        const pkgQs = prev.questions.filter((q) => q.packageId === packageId);
        const targetSet =
          targetIds && targetIds.length > 0 ? new Set(targetIds) : null;
        affected = targetSet
          ? pkgQs.filter((q) => targetSet.has(q.id)).length
          : pkgQs.length;
        if (affected === 0) return prev;

        const redistributed = distributeQuestionWeights(pkgQs, config, targetIds);
        const updatedMap = new Map(redistributed.map((q) => [q.id, q]));
        const nextQuestions = prev.questions.map((q) => updatedMap.get(q.id) || q);

        const modeDesc =
          config.mode === 'equal_target'
            ? `Bagi rata ke target ${config.targetTotal} poin`
            : config.mode === 'uniform'
              ? `Seragam ${config.pointsPerQuestion} poin/soal`
              : 'Berdasarkan jenis soal';

        return {
          ...prev,
          questions: nextQuestions,
          auditLogs: [
            makeAudit(
              'teacher',
              session?.name || 'Guru',
              'Atur Bobot Poin Soal Kolektif',
              'exam',
              `Mengatur bobot ${affected} butir soal (${modeDesc}).`
            ),
            ...prev.auditLogs,
          ].slice(0, 200),
        };
      });
      return affected;
    },
    [commitDb, session]
  );

  const bulkDeleteQuestions = useCallback(
    (questionIds: string[]) => {
      if (questionIds.length === 0) return 0;
      const idSet = new Set(questionIds);
      commitDb((prev) => ({
        ...prev,
        questions: prev.questions.filter((q) => !idSet.has(q.id)),
        auditLogs: [
          makeAudit(
            'teacher',
            session?.name || 'Guru',
            'Hapus Soal Kolektif',
            'exam',
            `Menghapus ${questionIds.length} butir soal terpilih dari bank soal.`
          ),
          ...prev.auditLogs,
        ].slice(0, 200),
      }));
      return questionIds.length;
    },
    [commitDb, session]
  );

  const copyOrMoveQuestionsToPackage = useCallback(
    (questionIds: string[], targetPackageId: string, mode: 'copy' | 'move') => {
      if (questionIds.length === 0 || !targetPackageId) return 0;
      const idSet = new Set(questionIds);
      let count = 0;
      commitDb((prev) => {
        const targetPkg = prev.packages.find((p) => p.id === targetPackageId);
        if (!targetPkg) return prev;
        const selected = prev.questions.filter((q) => idSet.has(q.id));
        count = selected.length;
        if (count === 0) return prev;

        let nextQuestions: Question[];
        if (mode === 'move') {
          nextQuestions = prev.questions.map((q) =>
            idSet.has(q.id) ? { ...q, packageId: targetPackageId } : q
          );
        } else {
          const clones: Question[] = selected.map((q, idx) => ({
            ...q,
            id: `q-copy-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
            packageId: targetPackageId,
          }));
          nextQuestions = [...prev.questions, ...clones];
        }

        return {
          ...prev,
          questions: nextQuestions,
          auditLogs: [
            makeAudit(
              'teacher',
              session?.name || 'Guru',
              mode === 'move' ? 'Pindahkan Soal Kolektif' : 'Salin Soal Kolektif',
              'exam',
              `${mode === 'move' ? 'Memindahkan' : 'Menyalin'} ${count} soal ke paket "${targetPkg.title}".`
            ),
            ...prev.auditLogs,
          ].slice(0, 200),
        };
      });
      return count;
    },
    [commitDb, session]
  );

  const unlockOrResetAttempt = useCallback(
    async (
      attemptId: string,
      mode: 'unlock' | 'reset'
    ): Promise<{ ok: boolean; synced: boolean; message: string }> => {
      const nowIso = new Date().toISOString();
      const nowMs = Date.now();
      let targetName = '';
      let found = false;

      commitDb((prev) => {
        const target = prev.attempts.find((a) => a.id === attemptId);
        if (!target) return prev;
        found = true;
        targetName = target.studentName;

        if (mode === 'reset') {
          return {
            ...prev,
            attempts: prev.attempts.filter((a) => a.id !== attemptId),
            auditLogs: [
              makeAudit(
                session?.role || 'teacher',
                session?.name || 'Guru',
                'Reset Ujian Siswa',
                'exam',
                `Riwayat ujian ${target.studentName} (${target.studentNisn}) direset agar dapat mengulang.`
              ),
              ...prev.auditLogs,
            ].slice(0, 200),
          };
        }

        const pkg = prev.packages.find((p) => p.id === target.packageId);
        const safeExtraMinutes = computeUnlockExtraMinutes(
          target,
          pkg?.durationMinutes ?? 60,
          nowMs,
          10
        );

        return {
          ...prev,
          attempts: prev.attempts.map((a) =>
            a.id === attemptId
              ? {
                  ...a,
                  status: 'in_progress' as const,
                  lockReason: undefined,
                  submittedAt: undefined,
                  score: undefined,
                  correctCount: undefined,
                  passed: undefined,
                  violationCount: 0,
                  extraMinutes: safeExtraMinutes,
                  unlockedAt: nowIso,
                  updatedAt: nowIso,
                }
              : a
          ),
          auditLogs: [
            makeAudit(
              session?.role || 'teacher',
              session?.name || 'Guru',
              'Buka Kunci Ujian Siswa',
              'exam',
              `Kunci pelanggaran untuk ${target.studentName} (${target.studentNisn}) dibuka kembali.`
            ),
            ...prev.auditLogs,
          ].slice(0, 200),
        };
      });

      if (!found) {
        return {
          ok: false,
          synced: false,
          message: 'Data pengerjaan siswa tidak ditemukan.',
        };
      }

      // Immediately push unlock/reset to Spreadsheet / Apps Script so student devices receive it right away
      const liveCfg = dbRef.current.spreadsheetSync;
      let synced = false;
      if (liveCfg.enabled && resolveEffectiveAppsScriptTarget(liveCfg).ok) {
        const pushRes = await pushDatabaseToSpreadsheet(liveCfg);
        synced = pushRes.ok;
      }

      const baseMsg =
        mode === 'reset'
          ? `Riwayat ujian ${targetName} berhasil direset.`
          : `Kunci ujian ${targetName} berhasil dibuka.`;
      return {
        ok: true,
        synced,
        message: synced
          ? `${baseMsg} Perubahan sudah disinkronkan ke server sehingga perangkat siswa otomatis terbuka.`
          : `${baseMsg} Tersimpan lokal dan akan segera disinkronkan ke server.`,
      };
    },
    [commitDb, pushDatabaseToSpreadsheet, resolveEffectiveAppsScriptTarget, session]
  );

  const addExtraTimeToAttempt = useCallback(
    (attemptId: string, minutes: number) => {
      const nowIso = new Date().toISOString();
      commitDb((prev) => {
        const target = prev.attempts.find((a) => a.id === attemptId);
        if (!target) return prev;
        return {
          ...prev,
          attempts: prev.attempts.map((a) =>
            a.id === attemptId
              ? { ...a, extraMinutes: a.extraMinutes + minutes, updatedAt: nowIso }
              : a
          ),
          auditLogs: [
            makeAudit(
              session?.role || 'teacher',
              session?.name || 'Guru',
              `Tambah Waktu +${minutes} Menit`,
              'exam',
              `Menambahkan waktu ${minutes} menit untuk ${target.studentName} (${target.studentNisn}).`
            ),
            ...prev.auditLogs,
          ].slice(0, 200),
        };
      });
    },
    [commitDb, session]
  );

  const startOrResumeAttempt = useCallback(
    (studentId: string, packageId: string): ExamAttempt | null => {
      const latest = dbRef.current;
      const student = latest.students.find((s) => s.id === studentId);
      const pkg = latest.packages.find((p) => p.id === packageId);
      if (!student || !pkg) return null;

      const existing = findStudentPackageAttempt(
        latest.attempts,
        student,
        packageId,
        latest.security.maxViolationTolerance
      );
      if (existing) return existing;

      const pkgQuestions = latest.questions.filter((q) => q.packageId === packageId);
      const seed = `${student.nisn}-${pkg.id}`;
      const orderedQuestions = pkg.shuffleQuestions
        ? seededShuffle(pkgQuestions, seed)
        : pkgQuestions;

      const optionOrders: Record<string, string[]> = {};
      orderedQuestions.forEach((q) => {
        if (q.options && q.options.length > 0) {
          const ids = q.options.map((o) => o.id);
          optionOrders[q.id] = pkg.shuffleOptions
            ? seededShuffle(ids, `${seed}-${q.id}`)
            : ids;
        }
      });

      const newAttempt: ExamAttempt = {
        id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        packageId: pkg.id,
        studentId: student.id,
        studentNisn: student.nisn,
        studentName: student.name,
        className: student.className,
        status: 'in_progress',
        startedAt: new Date().toISOString(),
        extraMinutes: 0,
        currentQuestionIndex: 0,
        questionOrder: orderedQuestions.map((q) => q.id),
        optionOrders,
        answers: {},
        flaggedQuestionIds: [],
        violationCount: 0,
      };

      commitDb((prev) => {
        if (
          prev.attempts.some(
            (a) => a.studentId === studentId && a.packageId === packageId
          )
        ) {
          return prev;
        }
        return {
          ...prev,
          attempts: [newAttempt, ...prev.attempts],
          auditLogs: [
            makeAudit(
              'student',
              student.name,
              'Mulai Mengerjakan Ujian',
              'exam',
              `${student.name} (${student.nisn}) memulai "${pkg.title}".`
            ),
            ...prev.auditLogs,
          ].slice(0, 200),
        };
      });

      return newAttempt;
    },
    [commitDb]
  );

  const saveStudentAnswer = useCallback(
    (attemptId: string, questionId: string, answer: StudentAnswerValue) => {
      commitDb((prev) => ({
        ...prev,
        attempts: prev.attempts.map((a) =>
          a.id === attemptId && a.status === 'in_progress'
            ? { ...a, answers: { ...a.answers, [questionId]: answer } }
            : a
        ),
      }));
    },
    [commitDb]
  );

  const toggleFlagQuestion = useCallback(
    (attemptId: string, questionId: string) => {
      commitDb((prev) => ({
        ...prev,
        attempts: prev.attempts.map((a) => {
          if (a.id !== attemptId) return a;
          const exists = a.flaggedQuestionIds.includes(questionId);
          return {
            ...a,
            flaggedQuestionIds: exists
              ? a.flaggedQuestionIds.filter((id) => id !== questionId)
              : [...a.flaggedQuestionIds, questionId],
          };
        }),
      }));
    },
    [commitDb]
  );

  const updateCurrentQuestionIndex = useCallback(
    (attemptId: string, index: number) => {
      commitDb((prev) => ({
        ...prev,
        attempts: prev.attempts.map((a) =>
          a.id === attemptId ? { ...a, currentQuestionIndex: index } : a
        ),
      }));
    },
    [commitDb]
  );

  const upgradeAttemptEssayGradesWithAI = useCallback(
    async (
      attemptId: string,
      packageQuestions: Question[],
      answers: Record<string, StudentAnswerValue>,
      kkm: number
    ) => {
      const essayItems = packageQuestions
        .filter((q) => q.type === 'essay')
        .map((q) => ({
          questionId: q.id,
          prompt: q.prompt,
          answerKey: q.essayAnswerKey || '',
          keywords: q.essayKeywords || [],
          studentAnswer: typeof answers[q.id] === 'string' ? (answers[q.id] as string) : '',
          maxPoints: q.points,
        }))
        .filter((item) => item.studentAnswer.trim().length > 0 && item.answerKey.trim().length > 0);

      if (essayItems.length === 0) return;

      try {
        const resp = await fetch('/api/grade-essay', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: essayItems }),
        });
        if (!resp.ok) return;
        const data = (await resp.json()) as {
          ok?: boolean;
          grades?: Record<string, EssayGradeResult>;
        };
        if (!data.ok || !data.grades || Object.keys(data.grades).length === 0) return;

        const aiGrades = data.grades;
        commitDb((prev) => {
          const target = prev.attempts.find((a) => a.id === attemptId);
          if (!target) return prev;
          const liveQs = prev.questions.filter((q) => q.packageId === target.packageId);
          const mergedGrades: Record<string, EssayGradeResult> = {
            ...(target.essayGrades || {}),
            ...aiGrades,
          };
          const recomputed = calculateExamScore(
            liveQs,
            target.answers,
            kkm,
            mergedGrades
          );
          return {
            ...prev,
            attempts: prev.attempts.map((a) =>
              a.id === attemptId
                ? {
                    ...a,
                    score: recomputed.score,
                    correctCount: recomputed.correctCount,
                    totalQuestions: recomputed.totalQuestions,
                    passed: recomputed.passed,
                    essayGrades: recomputed.essayGrades,
                    updatedAt: new Date().toISOString(),
                  }
                : a
            ),
          };
        });
      } catch {
        // Fallback semantic essay score is already stored synchronously.
      }
    },
    [commitDb]
  );

  const recordStudentViolation = useCallback(
    (attemptId: string, type: string, detail: string) => {
      const latest = dbRef.current;
      const target = latest.attempts.find((a) => a.id === attemptId);
      if (!target || target.status !== 'in_progress') {
        return {
          nextCount: target?.violationCount ?? 0,
          locked: target?.status === 'locked',
          remainingBeforeLock: 0,
        };
      }

      const evaluation = evaluateViolationEscalation(
        target.violationCount,
        latest.security
      );
      const pkg = latest.packages.find((p) => p.id === target.packageId);
      const now = new Date().toISOString();

      const newViolation: ViolationLog = {
        id: `vio-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        attemptId: target.id,
        studentNisn: target.studentNisn,
        studentName: target.studentName,
        className: target.className,
        packageId: target.packageId,
        packageTitle: pkg?.title || 'Paket Ujian',
        type,
        detail,
        timestamp: now,
      };

      commitDb((prev) => {
        const currentAttempt = prev.attempts.find((a) => a.id === attemptId);
        if (!currentAttempt || currentAttempt.status !== 'in_progress') {
          return prev;
        }
        const liveEval = evaluateViolationEscalation(
          currentAttempt.violationCount,
          prev.security
        );
        const livePkg = prev.packages.find((p) => p.id === currentAttempt.packageId);
        const liveQs = prev.questions.filter(
          (q) => q.packageId === currentAttempt.packageId
        );

        const updatedAttempts = prev.attempts.map((a) => {
          if (a.id !== attemptId) return a;
          if (liveEval.shouldAutoLock) {
            const summary = calculateExamScore(
              liveQs,
              a.answers,
              livePkg?.kkm ?? 75
            );
            return {
              ...a,
              violationCount: liveEval.nextCount,
              status: 'locked' as const,
              submittedAt: now,
              updatedAt: now,
              lockReason: 'Terkunci Sistem (Indikasi Kecurangan)',
              score: summary.score,
              correctCount: summary.correctCount,
              totalQuestions: summary.totalQuestions,
              passed: summary.passed,
              essayGrades: summary.essayGrades,
            };
          }
          return {
            ...a,
            violationCount: liveEval.nextCount,
            updatedAt: now,
          };
        });

        return {
          ...prev,
          attempts: updatedAttempts,
          violations: [newViolation, ...prev.violations].slice(0, 300),
          auditLogs: [
            makeAudit(
              'student',
              currentAttempt.studentName,
              liveEval.shouldAutoLock
                ? 'Auto-Lock Pelanggaran Ujian'
                : `Peringatan Pelanggaran #${liveEval.nextCount}`,
              'violation',
              `${currentAttempt.studentName} (${currentAttempt.studentNisn}): ${type} — ${detail}`
            ),
            ...prev.auditLogs,
          ].slice(0, 200),
        };
      });

      if (evaluation.shouldAutoLock) {
        showTransitionLoader(
          'submitting_exam',
          'Mengunci & Mengumpulkan Ujian...',
          'Batas toleransi pelanggaran terlampaui. Jawaban Anda disimpan otomatis.',
          880
        );
        const lockedAttempt = dbRef.current.attempts.find((a) => a.id === attemptId);
        if (lockedAttempt) {
          const lockedQs = dbRef.current.questions.filter(
            (q) => q.packageId === lockedAttempt.packageId
          );
          if (lockedQs.some((q) => q.type === 'essay')) {
            void upgradeAttemptEssayGradesWithAI(
              attemptId,
              lockedQs,
              lockedAttempt.answers,
              pkg?.kkm ?? 75
            );
          }
        }
        const liveCfg = dbRef.current.spreadsheetSync;
        if (liveCfg.enabled && resolveEffectiveAppsScriptTarget(liveCfg).ok) {
          void pushDatabaseToSpreadsheet(liveCfg);
        }
      }

      return {
        nextCount: evaluation.nextCount,
        locked: evaluation.shouldAutoLock,
        remainingBeforeLock: evaluation.remainingBeforeLock,
      };
    },
    [
      commitDb,
      pushDatabaseToSpreadsheet,
      resolveEffectiveAppsScriptTarget,
      showTransitionLoader,
      upgradeAttemptEssayGradesWithAI,
    ]
  );

  const submitStudentExam = useCallback(
    (attemptId: string, lockReason?: string): ExamAttempt | null => {
      const latest = dbRef.current;
      const target = latest.attempts.find((a) => a.id === attemptId);
      if (!target) return null;

      const pkg = latest.packages.find((p) => p.id === target.packageId);
      const isPractice = pkg?.category === 'Latihan Mandiri';

      showTransitionLoader(
        'submitting_exam',
        lockReason
          ? 'Mengunci & Mengumpulkan Jawaban...'
          : isPractice
            ? 'Menyelesaikan Latihan...'
            : 'Mengumpulkan Jawaban Ujian...',
        lockReason
          ? 'Menyimpan seluruh jawaban akhir Anda ke sistem.'
          : isPractice
            ? 'Menghitung nilai latihan dan menyiapkan pembahasan soal...'
            : 'Menghitung nilai otomatis dan menyimpan hasil ulangan Anda...',
        880
      );

      const qs = latest.questions.filter((q) => q.packageId === target.packageId);
      const initialSummary = calculateExamScore(qs, target.answers, pkg?.kkm ?? 75);
      const now = new Date().toISOString();

      let finalCompleted: ExamAttempt = {
        ...target,
        status: lockReason ? 'locked' : 'completed',
        submittedAt: now,
        lockReason,
        score: initialSummary.score,
        correctCount: initialSummary.correctCount,
        totalQuestions: initialSummary.totalQuestions,
        passed: initialSummary.passed,
        essayGrades: initialSummary.essayGrades,
      };

      commitDb((prev) => {
        const liveTarget = prev.attempts.find((a) => a.id === attemptId);
        if (!liveTarget) return prev;
        const livePkg = prev.packages.find((p) => p.id === liveTarget.packageId);
        const liveQs = prev.questions.filter(
          (q) => q.packageId === liveTarget.packageId
        );
        const liveSummary = calculateExamScore(
          liveQs,
          liveTarget.answers,
          livePkg?.kkm ?? 75
        );
        finalCompleted = {
          ...liveTarget,
          status: lockReason ? 'locked' : 'completed',
          submittedAt: now,
          updatedAt: now,
          lockReason,
          score: liveSummary.score,
          correctCount: liveSummary.correctCount,
          totalQuestions: liveSummary.totalQuestions,
          passed: liveSummary.passed,
          essayGrades: liveSummary.essayGrades,
        };
        return {
          ...prev,
          attempts: prev.attempts.map((a) =>
            a.id === attemptId ? finalCompleted : a
          ),
          auditLogs: [
            makeAudit(
              'student',
              liveTarget.studentName,
              lockReason ? 'Ujian Dikunci Sistem' : 'Selesai Mengerjakan Ujian',
              lockReason ? 'violation' : 'exam',
              `${liveTarget.studentName} (${liveTarget.studentNisn}) menyelesaikan "${
                livePkg?.title || ''
              }" dengan nilai ${liveSummary.score}.`
            ),
            ...prev.auditLogs,
          ].slice(0, 200),
        };
      });

      if (qs.some((q) => q.type === 'essay')) {
        void upgradeAttemptEssayGradesWithAI(
          attemptId,
          qs,
          finalCompleted.answers,
          pkg?.kkm ?? 75
        );
      }

      const liveCfg = dbRef.current.spreadsheetSync;
      if (liveCfg.enabled && resolveEffectiveAppsScriptTarget(liveCfg).ok) {
        void pushDatabaseToSpreadsheet(liveCfg);
      }

      return finalCompleted;
    },
    [
      commitDb,
      pushDatabaseToSpreadsheet,
      resolveEffectiveAppsScriptTarget,
      showTransitionLoader,
      upgradeAttemptEssayGradesWithAI,
    ]
  );

  return (
    <CBTContext.Provider
      value={{
        db,
        session,
        transitionOverlay,
        loginAdmin,
        loginTeacher,
        loginStudent,
        logout,
        updateAdminAccount,
        updateThemeConfig,
        updateSchoolIdentity,
        updateSecurityConfig,
        updateScheduleConfig,
        forceFinishAllExams,
        upsertTeacher,
        importTeachersBatch,
        toggleTeacherActive,
        bulkSetTeachersActive,
        deleteTeacher,
        bulkDeleteTeachers,
        upsertStudent,
        importStudentsBatch,
        toggleStudentActive,
        bulkSetStudentsActive,
        deleteStudent,
        bulkDeleteStudents,
        addClassRoom,
        deleteClassRoom,
        bulkDeleteClassRooms,
        exportDatabaseJSON,
        importDatabaseJSON,
        resetAllData,
        deleteSelectedData,
        deleteViolationLogs,
        deleteAuditLogs,
        syncRuntime,
        serverAutoSyncStatus,
        firestoreAutoSync,
        updateSpreadsheetSyncConfig,
        testSpreadsheetConnection,
        pushDatabaseToSpreadsheet,
        pullDatabaseFromSpreadsheet,
        upsertExamPackage,
        importExamSchedulesBatch,
        togglePackagePublished,
        deleteExamPackage,
        upsertQuestion,
        deleteQuestion,
        autoBalancePackagePoints,
        bulkAddQuestions,
        bulkUpdateQuestions,
        applyQuestionWeightDistribution,
        bulkDeleteQuestions,
        copyOrMoveQuestionsToPackage,
        unlockOrResetAttempt,
        addExtraTimeToAttempt,
        startOrResumeAttempt,
        saveStudentAnswer,
        toggleFlagQuestion,
        updateCurrentQuestionIndex,
        recordStudentViolation,
        submitStudentExam,
      }}
    >
      {children}
    </CBTContext.Provider>
  );
}

export function useCBT() {
  const ctx = useContext(CBTContext);
  if (!ctx) throw new Error('useCBT must be used inside CBTProvider');
  return ctx;
}
