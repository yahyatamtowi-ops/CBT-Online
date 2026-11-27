import type { User } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  writeBatch,
  type DocumentReference,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  firestoreDb,
  firestorePersistenceReady,
  handleFirestoreError,
  OperationType,
} from '../lib/firebase';
import type {
  CBTDatabase,
  ExamPackage,
  StudentRecord,
  TeacherAccount,
  ThemeAccent,
  ThemeMode,
} from '../types/cbt';

export const MAX_FIRESTORE_STUDENTS = 999;
export const MAX_FIRESTORE_TEACHERS = 150;
export const MAX_FIRESTORE_PACKAGES = 150;
export const FIRESTORE_BATCH_SAFE_LIMIT = 400;
export const PUBLIC_SCHOOL_PORTAL_ID = 'sman1kabun_live';

export interface CloudSnapshotSummary {
  snapshotId: string;
  schoolName: string;
  academicYear: string;
  announcementTitle?: string;
  announcementText?: string;
  announcementActive?: boolean;
  themeMode?: ThemeMode;
  themeAccent?: ThemeAccent;
  classes?: string[];
  linkedSpreadsheetId: string;
  linkedSpreadsheetName: string;
  appsScriptWebAppUrl: string;
  spreadsheetUrl: string;
  studentCount: number;
  teacherCount: number;
  packageCount: number;
  questionCount: number;
  attemptCount: number;
  updatedAtLabel: string | null;
}

export function sanitizeFirestoreId(raw: string | undefined | null, fallback = 'doc'): string {
  const cleanedRaw = (raw ?? '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  if (cleanedRaw.length > 0) return cleanedRaw;
  const cleanedFallback = (fallback ?? 'doc').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  return cleanedFallback.length > 0 ? cleanedFallback : 'doc';
}

export function clampText(value: string | undefined | null, maxLen: number, fallback = ''): string {
  const trimmed = (value ?? '').trim();
  const base = trimmed.length > 0 ? trimmed : fallback;
  return base.slice(0, maxLen);
}

export function getUserSnapshotId(uid: string): string {
  return sanitizeFirestoreId(`cbt_${uid}`, 'cbt_default');
}

export function chunkBatchOperations<T>(
  items: T[],
  maxBatchSize = FIRESTORE_BATCH_SAFE_LIMIT
): T[][] {
  const safeLimit = Math.max(1, Math.min(450, Math.floor(maxBatchSize) || FIRESTORE_BATCH_SAFE_LIMIT));
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += safeLimit) {
    chunks.push(items.slice(i, i + safeLimit));
  }
  return chunks;
}

export function buildSnapshotMutableFields(
  cbtDb: CBTDatabase,
  linkedSheet?: { id: string; name: string }
) {
  const boundedClasses = (Array.isArray(cbtDb.classes) ? cbtDb.classes : [])
    .map((c) => clampText(c, 40))
    .filter(Boolean)
    .slice(0, 100);

  return {
    schoolName: clampText(cbtDb.school?.schoolName, 160, 'SMA Negeri 1 Kabun'),
    academicYear: clampText(cbtDb.school?.academicYear, 80, '2026/2027'),
    announcementTitle: clampText(cbtDb.school?.announcementTitle, 200),
    announcementText: clampText(cbtDb.school?.announcementText, 2000),
    announcementActive: Boolean(cbtDb.school?.announcementActive),
    themeMode: (cbtDb.theme?.mode === 'dark' ? 'dark' : 'light') as ThemeMode,
    themeAccent: (['indigo', 'blue', 'emerald', 'amber', 'rose', 'teal'].includes(
      cbtDb.theme?.accent ?? ''
    )
      ? cbtDb.theme.accent
      : 'indigo') as ThemeAccent,
    classes: boundedClasses,
    linkedSpreadsheetId: clampText(linkedSheet?.id ?? '', 200),
    linkedSpreadsheetName: clampText(linkedSheet?.name ?? '', 200),
    appsScriptWebAppUrl: clampText(cbtDb.spreadsheetSync?.webAppUrl, 400),
    spreadsheetUrl: clampText(cbtDb.spreadsheetSync?.spreadsheetUrl, 400),
    studentCount: Math.min(100000, Math.max(0, Number(cbtDb.students?.length) || 0)),
    teacherCount: Math.min(10000, Math.max(0, Number(cbtDb.teachers?.length) || 0)),
    packageCount: Math.min(10000, Math.max(0, Number(cbtDb.packages?.length) || 0)),
    questionCount: Math.min(100000, Math.max(0, Number(cbtDb.questions?.length) || 0)),
    attemptCount: Math.min(500000, Math.max(0, Number(cbtDb.attempts?.length) || 0)),
  };
}

export function buildStudentMutableFields(stu: StudentRecord) {
  return {
    nisn: clampText(stu.nisn, 32, '0000000000'),
    name: clampText(stu.name, 160, 'Siswa'),
    className: clampText(stu.className, 40, 'X-1'),
    active: Boolean(stu.active),
    blockReason: clampText(stu.blockReason || '', 240),
  };
}

export function buildTeacherMutableFields(t: TeacherAccount) {
  return {
    username: clampText(t.username, 80, 'guru'),
    nip: clampText(t.nip || '-', 64),
    name: clampText(t.name, 160, 'Guru'),
    subjects: (Array.isArray(t.subjects) ? t.subjects : [])
      .map((s) => clampText(s, 80))
      .filter(Boolean)
      .slice(0, 30),
    classes: (Array.isArray(t.classes) ? t.classes : [])
      .map((c) => clampText(c, 40))
      .filter(Boolean)
      .slice(0, 50),
    active: Boolean(t.active),
  };
}

export function buildPackageMutableFields(p: ExamPackage) {
  return {
    teacherId: clampText(p.teacherId, 128, 'admin'),
    title: clampText(p.title, 200, 'Paket Ujian'),
    subject: clampText(p.subject, 120, 'Umum'),
    targetClasses: (Array.isArray(p.targetClasses) ? p.targetClasses : [])
      .map((c) => clampText(c, 40))
      .filter(Boolean)
      .slice(0, 50),
    category: p.category === 'Latihan Mandiri' ? 'Latihan Mandiri' : 'Ulangan Resmi',
    durationMinutes: Math.min(600, Math.max(1, Math.round(Number(p.durationMinutes) || 60))),
    minSubmitMinutes: Math.min(600, Math.max(0, Math.round(Number(p.minSubmitMinutes) || 0))),
    kkm: Math.min(100, Math.max(0, Math.round(Number(p.kkm) || 75))),
    token: clampText(p.token, 32, 'TOKEN'),
    shuffleQuestions: Boolean(p.shuffleQuestions),
    shuffleOptions: Boolean(p.shuffleOptions),
    isPublished: Boolean(p.isPublished),
  };
}

interface QueuedBatchOp {
  mode: 'set' | 'update';
  ref: DocumentReference;
  data: Record<string, unknown>;
}

// Serialize concurrent Firestore saves so auto-sync and manual clicks never race on create vs update
let saveQueueTail: Promise<unknown> = Promise.resolve();

async function fetchExistingSubcollectionIds(
  snapshotId: string,
  subcollection: 'students' | 'teachers' | 'packages',
  ownerUid: string
): Promise<Set<string>> {
  const q = query(
    collection(firestoreDb, 'cbt_snapshots', snapshotId, subcollection),
    where('ownerUid', '==', ownerUid)
  );
  const snap = await getDocs(q);
  const ids = new Set<string>();
  snap.docs.forEach((d) => ids.add(d.id));
  return ids;
}

async function readDocExistsServerFirst(ref: DocumentReference): Promise<boolean> {
  try {
    const serverSnap = await getDocFromServer(ref);
    return serverSnap.exists();
  } catch (serverErr) {
    const msg = serverErr instanceof Error ? serverErr.message : String(serverErr);
    if (msg.includes('offline') || msg.includes('Failed to get document because the client is offline')) {
      const localSnap = await getDoc(ref);
      return localSnap.exists();
    }
    throw serverErr;
  }
}

async function publishPublicSchoolPortalBridge(
  user: User,
  mutableSnapshot: ReturnType<typeof buildSnapshotMutableFields>
): Promise<void> {
  const portalRef = doc(firestoreDb, 'school_portal', PUBLIC_SCHOOL_PORTAL_ID);
  try {
    const portalExists = await readDocExistsServerFirst(portalRef);
    const batch = writeBatch(firestoreDb);
    if (portalExists) {
      batch.update(portalRef, {
        updatedByUid: user.uid,
        ...mutableSnapshot,
        updatedAt: serverTimestamp(),
      });
    } else {
      batch.set(portalRef, {
        updatedByUid: user.uid,
        ...mutableSnapshot,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  } catch {
    // Non-admin users cannot update the shared school bridge; ignore gracefully
    // so their personal cbt_snapshots save still succeeds cleanly.
  }
}

async function performSaveCbtSnapshotToFirestore(
  user: User,
  cbtDb: CBTDatabase,
  linkedSheet?: { id: string; name: string }
): Promise<{
  snapshotId: string;
  syncedStudents: number;
  syncedTeachers: number;
  syncedPackages: number;
  batchCount: number;
}> {
  await firestorePersistenceReady;
  const snapshotId = getUserSnapshotId(user.uid);
  const snapshotPath = `cbt_snapshots/${snapshotId}`;
  const snapshotRef = doc(firestoreDb, 'cbt_snapshots', snapshotId);

  let snapshotExists = false;
  try {
    snapshotExists = await readDocExistsServerFirst(snapshotRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, snapshotPath);
  }

  let existingStudentIds = new Set<string>();
  let existingTeacherIds = new Set<string>();
  let existingPackageIds = new Set<string>();

  if (snapshotExists) {
    try {
      [existingStudentIds, existingTeacherIds, existingPackageIds] = await Promise.all([
        fetchExistingSubcollectionIds(snapshotId, 'students', user.uid),
        fetchExistingSubcollectionIds(snapshotId, 'teachers', user.uid),
        fetchExistingSubcollectionIds(snapshotId, 'packages', user.uid),
      ]);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, snapshotPath);
    }
  }

  const mutableSnapshot = buildSnapshotMutableFields(cbtDb, linkedSheet);
  const ops: QueuedBatchOp[] = [];

  // Operation #1 MUST be the parent snapshot so subcollection creates in Batch #1
  // satisfy ownsParentSnapshotAfter(snapshotId) atomically, and subsequent batches
  // satisfy ownsParentSnapshot(snapshotId).
  if (snapshotExists) {
    ops.push({
      mode: 'update',
      ref: snapshotRef,
      data: {
        ...mutableSnapshot,
        updatedAt: serverTimestamp(),
      },
    });
  } else {
    ops.push({
      mode: 'set',
      ref: snapshotRef,
      data: {
        ownerUid: user.uid,
        ...mutableSnapshot,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
    });
  }

  // Support up to 999 students, 150 teachers, and 150 packages via chunked Firestore batches
  const seenStudentIds = new Set<string>();
  const studentsSlice = (cbtDb.students || []).slice(0, MAX_FIRESTORE_STUDENTS);
  for (const stu of studentsSlice) {
    const stuDocId = sanitizeFirestoreId(stu.id, `stu_${stu.nisn}`);
    if (seenStudentIds.has(stuDocId)) continue;
    seenStudentIds.add(stuDocId);
    const stuRef = doc(firestoreDb, 'cbt_snapshots', snapshotId, 'students', stuDocId);
    const mutableStudent = buildStudentMutableFields(stu);
    if (existingStudentIds.has(stuDocId)) {
      ops.push({
        mode: 'update',
        ref: stuRef,
        data: {
          ...mutableStudent,
          updatedAt: serverTimestamp(),
        },
      });
    } else {
      ops.push({
        mode: 'set',
        ref: stuRef,
        data: {
          ownerUid: user.uid,
          snapshotId,
          ...mutableStudent,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
      });
    }
  }

  const seenTeacherIds = new Set<string>();
  const teachersSlice = (cbtDb.teachers || []).slice(0, MAX_FIRESTORE_TEACHERS);
  for (const t of teachersSlice) {
    const tDocId = sanitizeFirestoreId(t.id, `tch_${t.username}`);
    if (seenTeacherIds.has(tDocId)) continue;
    seenTeacherIds.add(tDocId);
    const tRef = doc(firestoreDb, 'cbt_snapshots', snapshotId, 'teachers', tDocId);
    const mutableTeacher = buildTeacherMutableFields(t);
    if (existingTeacherIds.has(tDocId)) {
      ops.push({
        mode: 'update',
        ref: tRef,
        data: {
          ...mutableTeacher,
          updatedAt: serverTimestamp(),
        },
      });
    } else {
      ops.push({
        mode: 'set',
        ref: tRef,
        data: {
          ownerUid: user.uid,
          snapshotId,
          ...mutableTeacher,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
      });
    }
  }

  const seenPackageIds = new Set<string>();
  const packagesSlice = (cbtDb.packages || []).slice(0, MAX_FIRESTORE_PACKAGES);
  for (const p of packagesSlice) {
    const pDocId = sanitizeFirestoreId(p.id, `pkg_${p.token}`);
    if (seenPackageIds.has(pDocId)) continue;
    seenPackageIds.add(pDocId);
    const pRef = doc(firestoreDb, 'cbt_snapshots', snapshotId, 'packages', pDocId);
    const mutablePackage = buildPackageMutableFields(p);
    if (existingPackageIds.has(pDocId)) {
      ops.push({
        mode: 'update',
        ref: pRef,
        data: {
          ...mutablePackage,
          updatedAt: serverTimestamp(),
        },
      });
    } else {
      ops.push({
        mode: 'set',
        ref: pRef,
        data: {
          ownerUid: user.uid,
          snapshotId,
          ...mutablePackage,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
      });
    }
  }

  const batches = chunkBatchOperations(ops, FIRESTORE_BATCH_SAFE_LIMIT);

  try {
    for (const chunk of batches) {
      const batch = writeBatch(firestoreDb);
      for (const op of chunk) {
        if (op.mode === 'update') {
          batch.update(op.ref, op.data);
        } else {
          batch.set(op.ref, op.data);
        }
      }
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, snapshotPath);
  }

  // Publish non-PII school bridge so shared devices auto-connect without Google Sign-In
  await publishPublicSchoolPortalBridge(user, mutableSnapshot);

  return {
    snapshotId,
    syncedStudents: seenStudentIds.size,
    syncedTeachers: seenTeacherIds.size,
    syncedPackages: seenPackageIds.size,
    batchCount: batches.length,
  };
}

export async function saveCbtSnapshotToFirestore(
  user: User,
  cbtDb: CBTDatabase,
  linkedSheet?: { id: string; name: string }
): Promise<{
  snapshotId: string;
  syncedStudents: number;
  syncedTeachers: number;
  syncedPackages: number;
  batchCount: number;
}> {
  const run = saveQueueTail
    .catch(() => undefined)
    .then(() => performSaveCbtSnapshotToFirestore(user, cbtDb, linkedSheet));
  saveQueueTail = run;
  return run;
}

export async function loadStudentsFromFirestoreSnapshot(user: User): Promise<{
  snapshotFound: boolean;
  students: Array<Omit<StudentRecord, 'id'>>;
  classes: string[];
}> {
  await firestorePersistenceReady;
  const snapshotId = getUserSnapshotId(user.uid);
  const snapshotPath = `cbt_snapshots/${snapshotId}`;
  const snapshotRef = doc(firestoreDb, 'cbt_snapshots', snapshotId);

  let classes: string[] = [];
  try {
    const snap = await getDoc(snapshotRef);
    if (!snap.exists()) {
      return { snapshotFound: false, students: [], classes: [] };
    }
    const data = snap.data();
    classes = Array.isArray(data.classes)
      ? data.classes.filter((c): c is string => typeof c === 'string')
      : [];
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, snapshotPath);
  }

  const studentsPath = `${snapshotPath}/students`;
  try {
    const q = query(
      collection(firestoreDb, 'cbt_snapshots', snapshotId, 'students'),
      where('ownerUid', '==', user.uid)
    );
    const docsSnap = await getDocs(q);
    const students: Array<Omit<StudentRecord, 'id'>> = docsSnap.docs.map((d) => {
      const data = d.data();
      return {
        nisn: String(data.nisn || ''),
        name: String(data.name || ''),
        className: String(data.className || 'X-1'),
        active: Boolean(data.active),
        blockReason: data.blockReason ? String(data.blockReason) : undefined,
      };
    });
    return { snapshotFound: true, students, classes };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, studentsPath);
  }
}

function parseSnapshotSummaryDoc(
  snapshotId: string,
  d: Record<string, unknown>
): CloudSnapshotSummary {
  const updatedAtObj = d.updatedAt as { toDate?: () => Date } | null | undefined;
  const updatedTs =
    updatedAtObj && typeof updatedAtObj.toDate === 'function'
      ? updatedAtObj.toDate().toLocaleString('id-ID')
      : null;
  const themeAccentRaw = String(d.themeAccent || 'indigo');
  const themeAccent: ThemeAccent = ['indigo', 'blue', 'emerald', 'amber', 'rose', 'teal'].includes(
    themeAccentRaw
  )
    ? (themeAccentRaw as ThemeAccent)
    : 'indigo';

  return {
    snapshotId,
    schoolName: String(d.schoolName || ''),
    academicYear: String(d.academicYear || ''),
    announcementTitle: String(d.announcementTitle || ''),
    announcementText: String(d.announcementText || ''),
    announcementActive: Boolean(d.announcementActive),
    themeMode: d.themeMode === 'dark' ? 'dark' : 'light',
    themeAccent,
    classes: Array.isArray(d.classes)
      ? d.classes.filter((c): c is string => typeof c === 'string')
      : [],
    linkedSpreadsheetId: String(d.linkedSpreadsheetId || ''),
    linkedSpreadsheetName: String(d.linkedSpreadsheetName || ''),
    appsScriptWebAppUrl: String(d.appsScriptWebAppUrl || ''),
    spreadsheetUrl: String(d.spreadsheetUrl || ''),
    studentCount: Number(d.studentCount || 0),
    teacherCount: Number(d.teacherCount || 0),
    packageCount: Number(d.packageCount || 0),
    questionCount: Number(d.questionCount || 0),
    attemptCount: Number(d.attemptCount || 0),
    updatedAtLabel: updatedTs,
  };
}

export function subscribeToUserSnapshot(
  user: User,
  onData: (summary: CloudSnapshotSummary | null) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const snapshotId = getUserSnapshotId(user.uid);
  const snapshotPath = `cbt_snapshots/${snapshotId}`;
  const snapshotRef = doc(firestoreDb, 'cbt_snapshots', snapshotId);

  let disposed = false;
  let innerUnsub: Unsubscribe | null = null;

  void firestorePersistenceReady.then(() => {
    if (disposed) return;
    innerUnsub = onSnapshot(
      snapshotRef,
      (snap) => {
        if (!snap.exists()) {
          onData(null);
          return;
        }
        onData(parseSnapshotSummaryDoc(snapshotId, snap.data() as Record<string, unknown>));
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.GET, snapshotPath);
        } catch (wrapped) {
          onError?.(wrapped);
        }
      }
    );
  });

  return () => {
    disposed = true;
    innerUnsub?.();
  };
}

/**
 * Subscribes to the non-PII public school portal document (`/school_portal/sman1kabun_live`)
 * so any shared device connects automatically on boot WITHOUT requiring Google Sign-In.
 */
export function subscribeToPublicSchoolPortal(
  onData: (summary: CloudSnapshotSummary | null) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const portalPath = `school_portal/${PUBLIC_SCHOOL_PORTAL_ID}`;
  const portalRef = doc(firestoreDb, 'school_portal', PUBLIC_SCHOOL_PORTAL_ID);

  let disposed = false;
  let innerUnsub: Unsubscribe | null = null;

  void firestorePersistenceReady.then(() => {
    if (disposed) return;
    innerUnsub = onSnapshot(
      portalRef,
      (snap) => {
        if (!snap.exists()) {
          onData(null);
          return;
        }
        onData(
          parseSnapshotSummaryDoc(
            PUBLIC_SCHOOL_PORTAL_ID,
            snap.data() as Record<string, unknown>
          )
        );
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.GET, portalPath);
        } catch (wrapped) {
          onError?.(wrapped);
        }
      }
    );
  });

  return () => {
    disposed = true;
    innerUnsub?.();
  };
}
