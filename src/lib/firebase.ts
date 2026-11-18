import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  type User,
} from 'firebase/auth';
import {
  doc,
  enableNetwork,
  getDocFromServer,
  getFirestore,
  initializeFirestore,
  type Firestore,
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

export const BOOTSTRAP_ADMIN_EMAIL = 'rehu.cyuit93@gmail.com';

const app = initializeApp(firebaseConfig);

function createFirestoreDb(): Firestore {
  try {
    return initializeFirestore(
      app,
      {
        experimentalAutoDetectLongPolling: true,
        ignoreUndefinedProperties: true,
      },
      firebaseConfig.firestoreDatabaseId
    );
  } catch {
    return getFirestore(app, firebaseConfig.firestoreDatabaseId);
  }
}

export const db = createFirestoreDb();
export const auth = getAuth(app);
auth.languageCode = 'id';
export const storage = getStorage(app);
storage.maxUploadRetryTime = 5000;
storage.maxOperationRetryTime = 5000;
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export interface FirestoreConnectionStatus {
  ok: boolean;
  reason?: 'offline' | 'quota' | 'not-found' | 'unknown';
  message?: string;
  upgradeUrl?: string;
}

export function getQuotaUpgradeUrl(): string {
  return `https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/databases/${firebaseConfig.firestoreDatabaseId}/data?openUpgradeDialog=true`;
}

export function getAuthorizedDomainsUrl(): string {
  return `https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/settings`;
}

export function getAuthProvidersUrl(): string {
  return `https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/providers`;
}

function isContinueUriOrDomainError(err: unknown): boolean {
  const code = ((err as { code?: string })?.code || '').toLowerCase();
  const raw = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    code === 'auth/unauthorized-continue-uri' ||
    code === 'auth/unauthorized-domain' ||
    code === 'auth/invalid-continue-uri' ||
    code === 'auth/missing-continue-uri' ||
    raw.includes('unauthorized-continue-uri') ||
    raw.includes('unauthorized-domain') ||
    raw.includes('invalid-continue-uri') ||
    raw.includes('domain not allowlisted') ||
    raw.includes('unauthorized_domain')
  );
}

export async function sendVerificationEmailSafe(
  user: User
): Promise<{ usedFallbackDomain: boolean; alreadyVerified: boolean }> {
  await user.reload().catch(() => undefined);
  if (user.emailVerified) {
    await user.getIdToken(true).catch(() => undefined);
    return { usedFallbackDomain: false, alreadyVerified: true };
  }

  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  const cacheKey = host ? `continue_uri_blocked_${host}` : '';
  const skipCustomContinueUrl =
    typeof window !== 'undefined' && cacheKey
      ? sessionStorage.getItem(cacheKey) === '1'
      : false;

  if (skipCustomContinueUrl) {
    await sendEmailVerification(user);
    return { usedFallbackDomain: true, alreadyVerified: false };
  }

  try {
    await sendEmailVerification(user, {
      url: `${window.location.origin}/?verified=1`,
      handleCodeInApp: false,
    });
    return { usedFallbackDomain: false, alreadyVerified: false };
  } catch (err: unknown) {
    if (isContinueUriOrDomainError(err)) {
      if (typeof window !== 'undefined' && cacheKey) {
        sessionStorage.setItem(cacheKey, '1');
      }
      // Fallback to Firebase's default authDomain handler when current domain isn't allowlisted yet
      await sendEmailVerification(user);
      return { usedFallbackDomain: true, alreadyVerified: false };
    }
    throw err;
  }
}

export async function sendPasswordResetSafe(email: string): Promise<void> {
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  const cacheKey = host ? `continue_uri_blocked_${host}` : '';
  const skipCustomContinueUrl =
    typeof window !== 'undefined' && cacheKey
      ? sessionStorage.getItem(cacheKey) === '1'
      : false;

  if (skipCustomContinueUrl) {
    await sendPasswordResetEmail(auth, email);
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email, {
      url: window.location.origin,
      handleCodeInApp: false,
    });
  } catch (err: unknown) {
    if (isContinueUriOrDomainError(err)) {
      if (typeof window !== 'undefined' && cacheKey) {
        sessionStorage.setItem(cacheKey, '1');
      }
      await sendPasswordResetEmail(auth, email);
      return;
    }
    throw err;
  }
}

export function formatAuthErrorMessage(err: unknown): {
  message: string;
  isUnauthorizedDomain?: boolean;
  isProviderDisabled?: boolean;
  isRateLimited?: boolean;
  domain?: string;
} {
  const code = ((err as { code?: string })?.code || '').toLowerCase();
  const raw = err instanceof Error ? err.message : String(err);
  const rawLower = raw.toLowerCase();
  const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';

  if (
    code === 'auth/unauthorized-domain' ||
    code === 'auth/unauthorized-continue-uri' ||
    rawLower.includes('auth/unauthorized-domain') ||
    rawLower.includes('auth/unauthorized-continue-uri')
  ) {
    return {
      message: `Domain "${currentHost}" belum diizinkan di Firebase Authentication. Tambahkan domain ini pada Firebase Console -> Authentication -> Settings -> Authorized domains.`,
      isUnauthorizedDomain: true,
      domain: currentHost,
    };
  }
  if (code === 'auth/operation-not-allowed') {
    return {
      message:
        'Provider Email/Password belum diaktifkan di Firebase Console. Aktifkan di Authentication -> Sign-in method -> Email/Password, atau gunakan tombol Login dengan Google.',
      isProviderDisabled: true,
    };
  }
  if (code === 'auth/too-many-requests' || rawLower.includes('too-many-requests')) {
    return {
      message:
        'Terlalu banyak permintaan pengiriman email dalam waktu singkat. Tunggu 2 menit sebelum mencoba lagi, dan cek Kotak Masuk/Spam/Promosi untuk email yang sudah terkirim sebelumnya.',
      isRateLimited: true,
    };
  }
  if (code === 'auth/user-token-expired') {
    return {
      message: 'Sesi login telah kedaluwarsa. Silakan keluar lalu masuk kembali.',
    };
  }
  if (code === 'auth/network-request-failed') {
    return {
      message: 'Koneksi internet terputus saat menghubungi server autentikasi. Silakan coba lagi.',
    };
  }
  if (code === 'auth/popup-closed-by-user') {
    return {
      message: 'Jendela login Google ditutup sebelum proses selesai. Silakan coba lagi.',
    };
  }
  if (code === 'auth/popup-blocked') {
    return {
      message: 'Popup login diblokir oleh browser. Izinkan popup untuk situs ini lalu coba lagi.',
    };
  }
  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found'
  ) {
    return { message: 'Email atau kata sandi tidak sesuai.' };
  }
  if (code === 'auth/email-already-in-use') {
    return {
      message: 'Email sudah terdaftar. Silakan masuk atau gunakan fitur Reset Kata Sandi.',
    };
  }
  if (code === 'auth/weak-password') {
    return { message: 'Kata sandi terlalu lemah. Gunakan minimal 6 karakter.' };
  }
  return { message: raw || 'Terjadi kesalahan autentikasi.' };
}

export async function ensureFirestoreNetworkOnline(): Promise<void> {
  try {
    await enableNetwork(db);
  } catch {
    // Ignore transient enableNetwork errors
  }
}

export async function testFirestoreConnection(): Promise<FirestoreConnectionStatus> {
  const attempt = async (): Promise<FirestoreConnectionStatus> => {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return { ok: true };
  };

  for (let i = 0; i < 2; i++) {
    try {
      return await attempt();
    } catch (error) {
      const rawMsg = error instanceof Error ? error.message : String(error);
      const lower = rawMsg.toLowerCase();
      const code = (error as { code?: string })?.code || '';

      if (
        rawMsg.includes('Free daily read units per project') ||
        rawMsg.includes('Quota exceeded') ||
        code === 'resource-exhausted'
      ) {
        console.error('Firestore quota exceeded:', rawMsg);
        return {
          ok: false,
          reason: 'quota',
          message:
            'Kuota harian gratis Firestore telah terlampaui. Kuota akan direset keesokan hari atau Anda dapat meningkatkan paket Firebase.',
          upgradeUrl: getQuotaUpgradeUrl(),
        };
      }

      if (
        code === 'permission-denied' ||
        code === 'unauthenticated' ||
        rawMsg.includes('Missing or insufficient permissions') ||
        rawMsg.includes('PERMISSION_DENIED')
      ) {
        // Permission denied from default-deny proves server connection succeeded.
        return { ok: true };
      }

      const isTransientOffline =
        lower.includes('the client is offline') ||
        lower.includes('could not reach cloud firestore') ||
        code === 'unavailable' ||
        code === 'aborted' ||
        code === 'deadline-exceeded';

      if (isTransientOffline) {
        if (i === 0 && navigator.onLine) {
          await ensureFirestoreNetworkOnline();
          await new Promise((r) => setTimeout(r, 500));
          continue;
        }
        console.error('Please check your Firebase configuration (client is offline):', rawMsg);
        return {
          ok: false,
          reason: 'offline',
          message:
            'Tidak dapat terhubung ke server Firestore (offline atau koneksi terblokir). Periksa koneksi internet Anda.',
        };
      }

      if (code === 'not-found' || lower.includes('does not exist')) {
        console.error('Firestore database not found:', rawMsg);
        return {
          ok: false,
          reason: 'not-found',
          message: `Database Firestore (${firebaseConfig.firestoreDatabaseId}) belum ditemukan pada proyek ${firebaseConfig.projectId}.`,
        };
      }

      console.warn('Firestore connection check warning:', rawMsg);
      return { ok: true };
    }
  }

  return { ok: true };
}

export { firebaseConfig };
