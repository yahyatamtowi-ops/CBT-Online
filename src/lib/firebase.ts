import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  browserLocalPersistence,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  CACHE_SIZE_UNLIMITED,
  doc,
  enableIndexedDbPersistence,
  getDocFromServer,
  getFirestore,
  initializeFirestore,
  type Firestore,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/spreadsheets.readonly',
] as const;

export type FirestorePersistenceStatus =
  | 'pending'
  | 'enabled'
  | 'failed-precondition'
  | 'unimplemented'
  | 'unavailable';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

function createFirestoreInstance(): Firestore {
  try {
    return initializeFirestore(
      app,
      { cacheSizeBytes: CACHE_SIZE_UNLIMITED },
      firebaseConfig.firestoreDatabaseId
    );
  } catch {
    return getFirestore(app, firebaseConfig.firestoreDatabaseId);
  }
}

export const firestoreDb = createFirestoreInstance();

let persistenceStatus: FirestorePersistenceStatus =
  typeof window !== 'undefined' && typeof indexedDB !== 'undefined'
    ? 'pending'
    : 'unavailable';

export function getFirestorePersistenceStatus(): FirestorePersistenceStatus {
  return persistenceStatus;
}

/**
 * Enables Firestore IndexedDB offline persistence before any read/write operation
 * so large student rosters (up to 999+ students) remain cached locally between sessions.
 */
export const firestorePersistenceReady: Promise<FirestorePersistenceStatus> =
  typeof window !== 'undefined' && typeof indexedDB !== 'undefined'
    ? enableIndexedDbPersistence(firestoreDb)
        .then(() => {
          persistenceStatus = 'enabled';
          return persistenceStatus;
        })
        .catch((err: { code?: string } | unknown) => {
          const code =
            err && typeof err === 'object' && 'code' in err
              ? String((err as { code?: unknown }).code)
              : '';
          if (code === 'failed-precondition') {
            // Multiple tabs open; persistence can only be enabled in one tab at a time.
            persistenceStatus = 'failed-precondition';
          } else if (code === 'unimplemented') {
            // Current browser environment does not support IndexedDB persistence.
            persistenceStatus = 'unimplemented';
          } else {
            persistenceStatus = 'unavailable';
          }
          return persistenceStatus;
        })
    : Promise.resolve('unavailable');

export const firebaseAuth = getAuth(app);
if (typeof window !== 'undefined') {
  void setPersistence(firebaseAuth, browserLocalPersistence).catch(() => {
    // Fallback to default memory/session persistence in restricted browser modes
  });
}

export const googleAuthProvider = new GoogleAuthProvider();
WORKSPACE_SCOPES.forEach((scope) => {
  googleAuthProvider.addScope(scope);
});

// Strictly in-memory OAuth access token cache (never persisted in localStorage/sessionStorage)
let isSigningIn = false;
let cachedAccessToken: string | null = null;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const currentUser = firebaseAuth.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid ?? null,
      email: currentUser?.email ?? null,
      emailVerified: currentUser?.emailVerified ?? null,
      isAnonymous: currentUser?.isAnonymous ?? null,
      tenantId: currentUser?.tenantId ?? null,
      providerInfo:
        currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) ?? [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function initGoogleWorkspaceAuth(
  onAuthSuccess?: (user: User, token: string | null) => void,
  onAuthFailure?: () => void
) {
  return onAuthStateChanged(firebaseAuth, (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        onAuthSuccess?.(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // User has a Firebase session (can use Firestore), but OAuth token is in-memory only
        onAuthSuccess?.(user, null);
      }
    } else {
      cachedAccessToken = null;
      onAuthFailure?.();
    }
  });
}

export async function googleSignIn(): Promise<{ user: User; accessToken: string }> {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(firebaseAuth, googleAuthProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Gagal mendapatkan token akses Google Sheets/Drive dari autentikasi Google.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
}

export async function getGoogleAccessToken(): Promise<string | null> {
  return cachedAccessToken;
}

export async function googleSignOut(): Promise<void> {
  cachedAccessToken = null;
  await signOut(firebaseAuth);
}

// Startup Firestore connectivity validation (runs after IndexedDB persistence is initialized)
async function testConnection() {
  if (typeof window === 'undefined') return;
  await firestorePersistenceReady;
  try {
    await getDocFromServer(doc(firestoreDb, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();
