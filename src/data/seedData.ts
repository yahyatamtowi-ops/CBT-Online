import type { CBTDatabase } from '../types/cbt';
import { DEFAULT_SCHOOL_SNAPSHOT } from './defaultSchoolSnapshot';

export const DEFAULT_SCHOOL_LOGO = '/assets/aistudio/LOGO_SMANSA_3D_d5e941c9.png';

function cloneDefaultData<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createInitialSeedDatabase(): CBTDatabase {
  return {
    version: 2,
    adminAccount: {
      username: 'smansakabun',
      password: 'Smansakabun123!',
      displayName: 'Super Admin SMA Negeri 1 Kabun',
    },
    theme: {
      mode: 'light',
      accent: 'indigo',
    },
    school: {
      schoolName: 'SMA Negeri 1 Kabun',
      academicYear: '2026/2027 — Semester Ganjil',
      logoUrl: DEFAULT_SCHOOL_LOGO,
      announcementTitle: 'Informasi Pelaksanaan Ujian Berbasis Komputer (CBT)',
      announcementText:
        'Selamat datang di portal ujian resmi SMA Negeri 1 Kabun. Pastikan kamera perangkat aktif, gunakan browser terbaru, dan kerjakan ujian dengan jujur serta tertib.',
      announcementActive: true,
    },
    security: {
      requireFullscreen: true,
      detectTabSwitchAndSplitScreen: true,
      blockRightClickAndCopyPaste: true,
      enableDynamicWatermark: true,
      requireCameraMonitoring: true,
      showScoreAndExplanationAuto: true,
      detectNotificationBarAndScreenshot: true,
      maxViolationTolerance: 3,
    },
    schedule: {
      tokenReleaseMode: 'manual',
      tokensReleased: true,
      enforceTimeWindow: false,
      accessStartTime: '07:30',
      accessEndTime: '15:30',
      autoReleaseDateTime: '07:30',
      emergencyForceFinishedAt: null,
    },
    proctorConfig: {
      enabled: true,
      allowTeacherAccountsAsProctor: true,
      teacherAssignments: {},
    },
    spreadsheetSync: {
      enabled: false,
      webAppUrl: '',
      spreadsheetUrl: '',
      syncSecret: '',
      autoPushOnChange: true,
      autoPullOnLoad: true,
      autoPullIntervalSeconds: 60,
      lastSyncedAt: null,
      lastSyncDirection: null,
    },
    classes: cloneDefaultData(DEFAULT_SCHOOL_SNAPSHOT.classes),
    teachers: cloneDefaultData(DEFAULT_SCHOOL_SNAPSHOT.teachers),
    proctors: [],
    students: cloneDefaultData(DEFAULT_SCHOOL_SNAPSHOT.students),
    packages: cloneDefaultData(DEFAULT_SCHOOL_SNAPSHOT.packages),
    questions: cloneDefaultData(DEFAULT_SCHOOL_SNAPSHOT.questions),
    attempts: [],
    violations: [],
    toiletRequests: [],
    auditLogs: [],
  };
}
