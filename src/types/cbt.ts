export type Role = 'admin' | 'teacher' | 'student';

export type QuestionType =
  | 'single_choice'
  | 'multiple_choice'
  | 'matching'
  | 'true_false'
  | 'essay';

export type ExamCategory = 'Ulangan Resmi' | 'UTS / PTS' | 'Latihan Mandiri';

export type StudentAttemptStatus =
  | 'not_started'
  | 'in_progress'
  | 'locked'
  | 'completed';

export type ThemeAccent = 'indigo' | 'blue' | 'emerald' | 'amber' | 'rose' | 'teal';
export type ThemeMode = 'light' | 'dark';

export interface ThemeConfig {
  mode: ThemeMode;
  accent: ThemeAccent;
}

export interface SuperAdminAccount {
  username: string;
  password: string;
  displayName: string;
}

export interface SchoolIdentity {
  schoolName: string;
  academicYear: string;
  logoUrl: string;
  announcementTitle: string;
  announcementText: string;
  announcementActive: boolean;
}

export interface GlobalSecurityConfig {
  requireFullscreen: boolean;
  detectTabSwitchAndSplitScreen: boolean;
  blockRightClickAndCopyPaste: boolean;
  enableDynamicWatermark: boolean;
  requireCameraMonitoring: boolean;
  showScoreAndExplanationAuto: boolean;
  detectNotificationBarAndScreenshot?: boolean;
  maxViolationTolerance: number; // 1 to 5
}

export interface SessionScheduleConfig {
  tokenReleaseMode: 'manual' | 'auto';
  tokensReleased: boolean;
  enforceTimeWindow: boolean;
  accessStartTime: string; // HH:mm e.g. "07:30"
  accessEndTime: string; // HH:mm e.g. "23:59"
  autoReleaseDateTime: string; // ISO string or HH:mm
  emergencyForceFinishedAt: string | null;
}

export interface TeacherAccount {
  id: string;
  username: string;
  nip: string;
  name: string;
  password: string;
  subjects: string[];
  classes: string[];
  active: boolean;
}

export interface StudentRecord {
  id: string;
  nisn: string;
  name: string;
  className: string;
  active: boolean;
  blockReason?: string;
}

export interface MatchingPair {
  id: string;
  left: string;
  right: string;
}

export interface QuestionOption {
  id: string; // 'A' | 'B' | 'C' | 'D' | 'E'
  text: string;
}

export interface Question {
  id: string;
  packageId: string;
  type: QuestionType;
  prompt: string;
  imageUrl?: string;
  options?: QuestionOption[]; // for single_choice & multiple_choice
  correctOptionId?: string; // for single_choice
  correctOptionIds?: string[]; // for multiple_choice
  matchingPairs?: MatchingPair[]; // for matching
  correctBoolean?: boolean; // for true_false
  essayAnswerKey?: string; // for essay (kunci jawaban acuan makna)
  essayKeywords?: string[]; // for essay (kata/konsep kunci opsional)
  essayMinWords?: number; // for essay
  points: number;
  explanation: string;
}

export interface EssayGradeResult {
  scoreRatio: number; // 0..1
  earnedPoints: number;
  maxPoints: number;
  matchPercent: number; // 0..100
  feedback: string;
  gradedBy: 'semantic_local' | 'ai_semantic';
}

export interface ExamPackage {
  id: string;
  teacherId: string;
  title: string;
  subject: string;
  targetClasses: string[];
  category: ExamCategory;
  durationMinutes: number;
  minSubmitMinutes: number;
  kkm: number;
  token: string;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  isPublished: boolean;
  /** When enabled by subject teacher, allows students to access this package whenever the teacher activates it */
  allowIndependentAccess?: boolean;
  teacherActivatedAt?: string;
  createdAt: string;
}

export type StudentAnswerValue =
  | string // single_choice optionId OR essay text answer
  | string[] // multiple_choice optionIds
  | Record<string, string> // matching: pairId -> selected right text
  | boolean; // true_false

export interface ViolationLog {
  id: string;
  attemptId: string;
  studentNisn: string;
  studentName: string;
  className: string;
  packageId: string;
  packageTitle: string;
  type: string;
  detail: string;
  timestamp: string;
}

export interface ExamAttempt {
  id: string;
  packageId: string;
  studentId: string;
  studentNisn: string;
  studentName: string;
  className: string;
  status: StudentAttemptStatus;
  startedAt: string;
  submittedAt?: string;
  extraMinutes: number;
  currentQuestionIndex: number;
  questionOrder: string[];
  optionOrders: Record<string, string[]>; // questionId -> optionIds order
  answers: Record<string, StudentAnswerValue>;
  essayGrades?: Record<string, EssayGradeResult>;
  flaggedQuestionIds: string[];
  violationCount: number;
  lockReason?: string;
  unlockedAt?: string;
  updatedAt?: string;
  score?: number;
  correctCount?: number;
  totalQuestions?: number;
  passed?: boolean;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorRole: Role;
  actorName: string;
  action: string;
  category: 'auth' | 'security' | 'users' | 'exam' | 'violation' | 'system';
  detail: string;
}

export interface SelectiveDeleteOptions {
  students: boolean;
  teachers: boolean;
  classes: boolean;
  packagesAndQuestions: boolean;
  attempts: boolean;
  violations: boolean;
  auditLogs: boolean;
}

export interface SpreadsheetSyncConfig {
  enabled: boolean;
  webAppUrl: string;
  spreadsheetUrl: string;
  syncSecret: string;
  autoPushOnChange: boolean;
  autoPullOnLoad: boolean;
  autoPullIntervalSeconds: number;
  lastSyncedAt: string | null;
  lastSyncDirection: 'push' | 'pull' | 'test' | null;
}

export interface SpreadsheetSyncRuntime {
  status: 'idle' | 'syncing' | 'synced' | 'error';
  message?: string;
}

export interface CBTDatabase {
  version: number;
  adminAccount: SuperAdminAccount;
  theme: ThemeConfig;
  school: SchoolIdentity;
  security: GlobalSecurityConfig;
  schedule: SessionScheduleConfig;
  spreadsheetSync: SpreadsheetSyncConfig;
  classes: string[];
  teachers: TeacherAccount[];
  students: StudentRecord[];
  packages: ExamPackage[];
  questions: Question[];
  attempts: ExamAttempt[];
  violations: ViolationLog[];
  auditLogs: AuditLogEntry[];
}

export interface ActiveSession {
  role: Role;
  userId: string;
  name: string;
  nisn?: string;
  className?: string;
  packageId?: string;
}
