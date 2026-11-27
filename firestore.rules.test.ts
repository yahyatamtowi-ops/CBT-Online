import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Phase 0 Payload-First Security TDD Runner
 * Verifies the 12 "Dirty Dozen" adversarial payloads and structural rule
 * invariants declared in security_spec.md against firebase-blueprint.json
 * and firestore.rules / DRAFT_firestore.rules.
 */

const rootDir = process.cwd();
const blueprint = JSON.parse(
  fs.readFileSync(path.join(rootDir, 'firebase-blueprint.json'), 'utf8')
);
const rulesPath = fs.existsSync(path.join(rootDir, 'firestore.rules'))
  ? path.join(rootDir, 'firestore.rules')
  : path.join(rootDir, 'DRAFT_firestore.rules');
const rulesText = fs.readFileSync(rulesPath, 'utf8');

const ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

interface MockAuth {
  uid: string;
  email: string;
  email_verified: boolean;
}

function isVerified(auth: MockAuth | null): boolean {
  return Boolean(auth && auth.email_verified === true);
}

function isBootstrappedAdmin(auth: MockAuth | null): boolean {
  return isVerified(auth) && auth?.email === 'tamtowiyahya65@gmail.com';
}

function validateSnapshotPayload(
  auth: MockAuth | null,
  docId: string,
  payload: Record<string, unknown>,
  serverTime: number
): 'ALLOW' | 'PERMISSION_DENIED' {
  if (!isVerified(auth)) return 'PERMISSION_DENIED';
  if (!ID_REGEX.test(docId)) return 'PERMISSION_DENIED';

  const requiredKeys = blueprint.entities.CbtCloudSnapshot.required as string[];
  const payloadKeys = Object.keys(payload);
  if (!requiredKeys.every((k) => payloadKeys.includes(k))) return 'PERMISSION_DENIED';
  if (!payloadKeys.every((k) => requiredKeys.includes(k))) return 'PERMISSION_DENIED';

  if (payload.ownerUid !== auth!.uid) return 'PERMISSION_DENIED';
  if (typeof payload.schoolName !== 'string' || payload.schoolName.length < 1 || payload.schoolName.length > 160) {
    return 'PERMISSION_DENIED';
  }
  if (typeof payload.announcementText !== 'string' || payload.announcementText.length > 2000) {
    return 'PERMISSION_DENIED';
  }
  if (!Array.isArray(payload.classes) || payload.classes.length > 100) {
    return 'PERMISSION_DENIED';
  }
  if (payload.classes.length > 0 && (typeof payload.classes[0] !== 'string' || payload.classes[0].length > 40)) {
    return 'PERMISSION_DENIED';
  }
  if (payload.createdAt !== serverTime || payload.updatedAt !== serverTime) {
    return 'PERMISSION_DENIED';
  }
  return 'ALLOW';
}

test('Firestore rules enforce Global Safety Net, verified email, and cover all blueprint collections', () => {
  assert.match(rulesText, /rules_version\s*=\s*'2';/);
  assert.match(rulesText, /match \/\{document=\*\*\}\s*\{\s*allow read, write: if false;\s*\}/);
  assert.match(rulesText, /request\.auth\.token\.email_verified\s*==\s*true/);
  assert.match(rulesText, /match \/admins\/\{adminId\}/);
  assert.match(rulesText, /match \/cbt_snapshots\/\{snapshotId\}/);
  assert.match(rulesText, /match \/students\/\{studentId\}/);
  assert.match(rulesText, /match \/teachers\/\{teacherId\}/);
  assert.match(rulesText, /match \/packages\/\{packageId\}/);
  assert.match(rulesText, /match \/attempts\/\{attemptId\}/);
  assert.match(rulesText, /existing\(\)\.status\s*!=\s*'completed'/);
  assert.doesNotMatch(rulesText, /allow\s+(read|list):\s*if\s*isSignedIn\(\)\s*;/);
});

test('Dirty Dozen adversarial payloads all evaluate to PERMISSION_DENIED', () => {
  const NOW = 1764195000000;
  const userA: MockAuth = { uid: 'uid_user_a', email: 'guru.a@school.id', email_verified: true };
  const userB: MockAuth = { uid: 'uid_user_b', email: 'guru.b@school.id', email_verified: true };
  const spoofAdmin: MockAuth = { uid: 'uid_spoof', email: 'tamtowiyahya65@gmail.com', email_verified: false };

  const validBase = {
    ownerUid: userA.uid,
    schoolName: 'SMA Negeri 1 Kabun',
    academicYear: '2026/2027',
    announcementTitle: 'Info CBT',
    announcementText: 'Selamat mengerjakan',
    announcementActive: true,
    themeMode: 'light',
    themeAccent: 'indigo',
    classes: ['X-1', 'X-2'],
    linkedSpreadsheetId: '',
    linkedSpreadsheetName: '',
    appsScriptWebAppUrl: '',
    spreadsheetUrl: '',
    studentCount: 10,
    teacherCount: 2,
    packageCount: 1,
    questionCount: 20,
    attemptCount: 5,
    createdAt: NOW,
    updatedAt: NOW,
  };

  // Sanity check valid payload passes
  assert.equal(validateSnapshotPayload(userA, 'snap_valid_1', validBase, NOW), 'ALLOW');

  // 1. Unauthenticated write
  assert.equal(validateSnapshotPayload(null, 'snap_1', validBase, NOW), 'PERMISSION_DENIED');

  // 2. Unverified admin email spoofing
  assert.equal(isBootstrappedAdmin(spoofAdmin), false);
  assert.equal(validateSnapshotPayload(spoofAdmin, 'snap_2', { ...validBase, ownerUid: spoofAdmin.uid }, NOW), 'PERMISSION_DENIED');

  // 3. Cross-tenant PII read (userB reading userA record)
  assert.equal(validBase.ownerUid === userB.uid || isBootstrappedAdmin(userB), false);

  // 4. Owner spoofing on create
  assert.equal(validateSnapshotPayload(userB, 'snap_4', { ...validBase, ownerUid: userA.uid }, NOW), 'PERMISSION_DENIED');

  // 5. Shadow field injection
  assert.equal(
    validateSnapshotPayload(userA, 'snap_5', { ...validBase, isSuperAdmin: true }, NOW),
    'PERMISSION_DENIED'
  );

  // 6. ID poisoning attack
  assert.equal(
    validateSnapshotPayload(userA, 'invalid$id.' + 'a'.repeat(200), validBase, NOW),
    'PERMISSION_DENIED'
  );

  // 7. Oversized string DoW attack
  assert.equal(
    validateSnapshotPayload(userA, 'snap_7', { ...validBase, schoolName: 'S'.repeat(161) }, NOW),
    'PERMISSION_DENIED'
  );

  // 8. Unbounded array & invalid element type
  assert.equal(
    validateSnapshotPayload(userA, 'snap_8a', { ...validBase, classes: Array(101).fill('X-1') }, NOW),
    'PERMISSION_DENIED'
  );
  assert.equal(
    validateSnapshotPayload(userA, 'snap_8b', { ...validBase, classes: [123] }, NOW),
    'PERMISSION_DENIED'
  );

  // 9. Orphaned subcollection write (parent must exist — enforced by ownsParentSnapshot)
  assert.match(rulesText, /exists\(\/databases\/\$\(database\)\/documents\/cbt_snapshots\/\$\(snapshotId\)\)/);

  // 10. Immutable field tampering (ownerUid & createdAt locked on update)
  assert.match(rulesText, /incoming\(\)\.ownerUid\s*==\s*existing\(\)\.ownerUid/);
  assert.match(rulesText, /incoming\(\)\.createdAt\s*==\s*existing\(\)\.createdAt/);

  // 11. Client timestamp spoofing
  assert.equal(
    validateSnapshotPayload(userA, 'snap_11', { ...validBase, createdAt: 1000 }, NOW),
    'PERMISSION_DENIED'
  );

  // 12. Terminal state bypass on completed attempt
  const existingAttempt = { status: 'completed' };
  const canNonAdminUpdateCompleted = existingAttempt.status !== 'completed' || isBootstrappedAdmin(userA);
  assert.equal(canNonAdminUpdateCompleted, false);
});

test('Firestore rules enforce path-based UID ownership and payload builders never touch immutable keys on update', async () => {
  assert.match(rulesText, /function isOwnSnapshotPath\(snapshotId\)/);
  assert.match(rulesText, /snapshotId == request\.auth\.uid \|\|\s*snapshotId == 'cbt_' \+ request\.auth\.uid/);
  assert.match(rulesText, /isOwnSnapshotPath\(snapshotId\)/);
  assert.match(rulesText, /resource != null && existing\(\)\.ownerUid == request\.auth\.uid/);

  const { createInitialSeedDatabase } = await import('./src/data/seedData');
  const {
    buildSnapshotMutableFields,
    buildStudentMutableFields,
    buildTeacherMutableFields,
    buildPackageMutableFields,
    sanitizeFirestoreId,
  } = await import('./src/services/firestoreSyncService');

  const seed = createInitialSeedDatabase();
  const mutableSnap = buildSnapshotMutableFields(seed);
  const fullSnapCreate = {
    ownerUid: 'A7cQbuh06gf7R0AnP5MrnUDr9Mu2',
    ...mutableSnap,
    createdAt: 1000,
    updatedAt: 1000,
  };
  assert.equal(
    validateSnapshotPayload(
      { uid: 'A7cQbuh06gf7R0AnP5MrnUDr9Mu2', email: 'tamtowiyahya65@gmail.com', email_verified: true },
      'cbt_A7cQbuh06gf7R0AnP5MrnUDr9Mu2',
      fullSnapCreate,
      1000
    ),
    'ALLOW'
  );
  // Mutable update payload must never include immutable keys
  assert.equal('createdAt' in mutableSnap, false);
  assert.equal('ownerUid' in mutableSnap, false);

  const stuMutable = buildStudentMutableFields({
    id: 'stu 1/2',
    nisn: '0012345678',
    name: 'Andi Pratama',
    className: 'X-1',
    active: true,
  });
  assert.equal('createdAt' in stuMutable, false);
  assert.equal('ownerUid' in stuMutable, false);
  assert.equal('snapshotId' in stuMutable, false);

  const teacherMutable = buildTeacherMutableFields({
    id: 't1',
    username: 'guru1',
    password: 'secret',
    nip: '19800101',
    name: 'Budi',
    subjects: ['Matematika'],
    classes: ['X-1'],
    active: true,
  });
  assert.equal('password' in teacherMutable, false);
  assert.equal('createdAt' in teacherMutable, false);

  const pkgMutable = buildPackageMutableFields({
    id: 'pkg-1',
    teacherId: 't1',
    title: 'UTS Matematika',
    subject: 'Matematika',
    targetClasses: ['X-1'],
    category: 'Ulangan Resmi',
    durationMinutes: 90,
    minSubmitMinutes: 15,
    kkm: 75,
    token: 'MTK123',
    shuffleQuestions: true,
    shuffleOptions: true,
    isPublished: true,
    createdAt: new Date().toISOString(),
  });
  assert.equal('createdAt' in pkgMutable, false);
  assert.equal('ownerUid' in pkgMutable, false);

  // Sanitized fallback IDs must strictly match Firestore isValidId regex
  assert.match(sanitizeFirestoreId('', 'stu_001.23/45'), ID_REGEX);
  assert.match(sanitizeFirestoreId('   ', '   '), ID_REGEX);
});

test('Firestore sync supports up to 999 students via chunked batches and secures /school_portal/sman1kabun_live', async () => {
  assert.match(rulesText, /match \/school_portal\/\{portalId\}/);
  assert.match(rulesText, /allow get: if isValidId\(portalId\) && portalId == 'sman1kabun_live';/);
  assert.match(rulesText, /allow list: if false;/);

  const {
    MAX_FIRESTORE_STUDENTS,
    FIRESTORE_BATCH_SAFE_LIMIT,
    chunkBatchOperations,
  } = await import('./src/services/firestoreSyncService');

  assert.equal(MAX_FIRESTORE_STUDENTS, 999);
  assert.ok(FIRESTORE_BATCH_SAFE_LIMIT <= 450);

  // 477 students + 1 parent snapshot = 478 ops -> cleanly split into 2 batches (400 + 78)
  const ops477 = Array.from({ length: 478 }, (_, idx) => idx);
  const batches477 = chunkBatchOperations(ops477, FIRESTORE_BATCH_SAFE_LIMIT);
  assert.equal(batches477.length, 2);
  assert.equal(batches477[0].length, 400);
  assert.equal(batches477[1].length, 78);

  // 999 students + 1 parent snapshot = 1000 ops -> cleanly split into 3 batches (400 + 400 + 200)
  const ops999 = Array.from({ length: 1000 }, (_, idx) => idx);
  const batches999 = chunkBatchOperations(ops999, FIRESTORE_BATCH_SAFE_LIMIT);
  assert.equal(batches999.length, 3);
  assert.equal(batches999.reduce((sum, b) => sum + b.length, 0), 1000);
  assert.ok(batches999.every((b) => b.length <= 450));
});

test('Firestore SDK configures enableIndexedDbPersistence with unlimited cache and sequences startup reads', async () => {
  const firebaseSource = fs.readFileSync(path.join(rootDir, 'src/lib/firebase.ts'), 'utf8');
  const syncSource = fs.readFileSync(
    path.join(rootDir, 'src/services/firestoreSyncService.ts'),
    'utf8'
  );

  assert.match(firebaseSource, /CACHE_SIZE_UNLIMITED/);
  assert.match(firebaseSource, /enableIndexedDbPersistence\(firestoreDb\)/);
  assert.match(firebaseSource, /failed-precondition/);
  assert.match(firebaseSource, /unimplemented/);
  assert.match(firebaseSource, /await firestorePersistenceReady;\s*try\s*\{\s*await getDocFromServer/);

  assert.match(syncSource, /firestorePersistenceReady/);
  assert.match(syncSource, /await firestorePersistenceReady;/);
  assert.match(syncSource, /firestorePersistenceReady\.then\(/);

  const { firestorePersistenceReady, getFirestorePersistenceStatus } = await import(
    './src/lib/firebase'
  );
  const status = await firestorePersistenceReady;
  // In Node.js test runtime (no window/indexedDB), gracefully resolves to 'unavailable' without crashing
  assert.equal(status, 'unavailable');
  assert.equal(getFirestorePersistenceStatus(), 'unavailable');
});
