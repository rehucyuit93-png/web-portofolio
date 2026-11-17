import { auth, getQuotaUpgradeUrl } from './firebase';

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
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function formatFirestoreErrorForUser(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  let inner = raw;
  let path = '';
  let op = '';

  try {
    const parsed = JSON.parse(raw) as Partial<FirestoreErrorInfo>;
    if (parsed && typeof parsed.error === 'string') {
      inner = parsed.error;
      path = parsed.path || '';
      op = parsed.operationType || '';
    }
  } catch {
    // raw is already plain text
  }

  const lower = inner.toLowerCase();

  if (
    lower.includes('free daily read units per project') ||
    lower.includes('quota exceeded') ||
    lower.includes('resource-exhausted')
  ) {
    return `Kuota harian gratis Firestore telah habis. Kuota akan direset besok, atau buka Firebase Console (${getQuotaUpgradeUrl()}) untuk upgrade paket.`;
  }
  if (
    lower.includes('the client is offline') ||
    lower.includes('unavailable') ||
    lower.includes('could not reach cloud firestore') ||
    lower.includes('deadline-exceeded')
  ) {
    return 'Koneksi ke database Firestore sedang offline atau tidak stabil. Periksa koneksi internet Anda lalu coba lagi.';
  }
  if (lower.includes('missing or insufficient permissions') || lower.includes('permission_denied') || lower.includes('permission-denied')) {
    return `Akses database ditolak oleh aturan keamanan${path ? ` (${op} ${path})` : ''}. Coba muat ulang sesi atau masuk ulang dengan akun Anda.`;
  }
  if (lower.includes('requires an index') || lower.includes('failed_precondition')) {
    return `Kueri database membutuhkan indeks Firestore${path ? ` pada ${path}` : ''}.`;
  }
  return inner || 'Terjadi kesalahan saat mengakses database Firestore.';
}
