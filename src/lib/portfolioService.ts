import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { BOOTSTRAP_ADMIN_EMAIL, db, ensureFirestoreNetworkOnline } from './firebase';
import { handleFirestoreError, OperationType } from './firestoreError';
import type {
  Achievement,
  Activity,
  AuditLog,
  Certificate,
  GalleryItem,
  LogAction,
  PortfolioDocument,
  PublicPortfolioDoc,
  UserAccount,
  UserProfile,
  UserRole,
  UserSettings,
} from '../types/portfolio';

const OFFLINE_CACHE_PREFIX = 'karyaloka_cache_v1';

export function saveOfflineCache<T>(uid: string, key: string, data: T): void {
  try {
    localStorage.setItem(`${OFFLINE_CACHE_PREFIX}_${uid}_${key}`, JSON.stringify(data));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadOfflineCache<T>(uid: string, key: string): T | null {
  try {
    const raw = localStorage.getItem(`${OFFLINE_CACHE_PREFIX}_${uid}_${key}`);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function sanitizeUsername(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return cleaned.length >= 3 ? cleaned : `user-${cleaned || 'portofolio'}`;
}

export function generateDefaultUsername(displayName: string, uid: string): string {
  const base = sanitizeUsername(displayName || 'pengguna').slice(0, 32);
  const suffix = uid.slice(0, 6).toLowerCase().replace(/[^a-z0-9]/g, 'x');
  return `${base}-${suffix}`;
}

export function clampStr(value: string | undefined, max: number): string {
  return (value ?? '').trim().slice(0, max);
}

function normalizeIntegers<T extends Record<string, unknown>>(obj: T): T {
  const copy: Record<string, unknown> = { ...obj };
  if (typeof copy.year === 'number') {
    copy.year = Math.trunc(Number.isFinite(copy.year) ? copy.year : new Date().getFullYear());
  }
  if (typeof copy.fileSize === 'number') {
    copy.fileSize = Math.max(0, Math.trunc(Number.isFinite(copy.fileSize) ? copy.fileSize : 0));
  }
  return copy as T;
}

export function computeProfileCompleteness(profile: UserProfile | null): number {
  if (!profile) return 0;
  const fields: Array<string | undefined> = [
    profile.photoURL,
    profile.fullName,
    profile.nipNisn,
    profile.jabatanKelas,
    profile.birthPlace,
    profile.birthDate,
    profile.address,
    profile.phone,
    profile.email,
    profile.education,
    profile.expertise,
    profile.bio,
  ];
  const filled = fields.filter((f) => Boolean(f && f.trim().length > 0)).length;
  return Math.round((filled / fields.length) * 100);
}

export async function writeAuditLog(params: {
  uid: string;
  userEmail?: string;
  userName?: string;
  action: LogAction;
  module: string;
  detail: string;
}): Promise<void> {
  const path = 'logs';
  try {
    await addDoc(collection(db, path), {
      uid: params.uid,
      userEmail: clampStr(params.userEmail, 200),
      userName: clampStr(params.userName, 120),
      action: params.action,
      module: clampStr(params.module, 80) || 'Sistem',
      detail: clampStr(params.detail, 500) || 'Aktivitas sistem',
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

const initInFlight = new Map<
  string,
  Promise<{ account: UserAccount; profile: UserProfile; settings: UserSettings }>
>();

function isTransientFirestoreNetworkError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes('the client is offline') ||
    msg.includes('unavailable') ||
    msg.includes('could not reach cloud firestore') ||
    msg.includes('deadline-exceeded')
  );
}

export async function ensureUserInitialized(params: {
  uid: string;
  email: string;
  emailVerified?: boolean;
  displayName: string;
  photoURL?: string;
  preferredRole?: 'guru' | 'siswa';
  nipNisn?: string;
  jabatanKelas?: string;
}): Promise<{ account: UserAccount; profile: UserProfile; settings: UserSettings }> {
  const existingPromise = initInFlight.get(params.uid);
  if (existingPromise) return existingPromise;

  const task = (async () => {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await runEnsureUserInitialized(params);
      } catch (err) {
        lastError = err;
        if (attempt < 2 && navigator.onLine && isTransientFirestoreNetworkError(err)) {
          await ensureFirestoreNetworkOnline();
          await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
          continue;
        }
        throw err;
      }
    }
    throw lastError;
  })().finally(() => {
    initInFlight.delete(params.uid);
  });
  initInFlight.set(params.uid, task);
  return task;
}

async function runEnsureUserInitialized(params: {
  uid: string;
  email: string;
  emailVerified?: boolean;
  displayName: string;
  photoURL?: string;
  preferredRole?: 'guru' | 'siswa';
  nipNisn?: string;
  jabatanKelas?: string;
}): Promise<{ account: UserAccount; profile: UserProfile; settings: UserSettings }> {
  const userRef = doc(db, 'users', params.uid);
  const profileRef = doc(db, 'profiles', params.uid);
  const settingsRef = doc(db, 'settings', params.uid);

  const safeEmail = clampStr(params.email, 200) || `${params.uid}@karyaloka.local`;
  const safeDisplayName =
    clampStr(params.displayName || safeEmail.split('@')[0], 120) || 'Pengguna';

  let accountSnap;
  try {
    accountSnap = await getDoc(userRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `users/${params.uid}`);
  }

  const isBootstrapAdmin =
    Boolean(params.emailVerified) &&
    safeEmail.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();
  const defaultUsername = generateDefaultUsername(safeDisplayName, params.uid);

  let account: UserAccount;
  if (!accountSnap.exists()) {
    const assignedRole: UserRole = isBootstrapAdmin ? 'admin' : params.preferredRole || 'guru';
    const newAccount: UserAccount = {
      uid: params.uid,
      username: defaultUsername,
      email: safeEmail,
      displayName: safeDisplayName,
      role: assignedRole,
      nipNisn: clampStr(params.nipNisn, 40),
      jabatanKelas: clampStr(
        params.jabatanKelas ||
          (assignedRole === 'siswa'
            ? 'Siswa'
            : assignedRole === 'admin'
              ? 'Administrator Sistem'
              : 'Guru'),
        100
      ),
      photoURL: clampStr(params.photoURL, 200000),
      isActive: true,
    };
    try {
      await setDoc(userRef, {
        ...newAccount,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      if (isBootstrapAdmin) {
        const adminMarkerRef = doc(db, 'admins', params.uid);
        const adminMarkerSnap = await getDoc(adminMarkerRef).catch(() => null);
        if (!adminMarkerSnap || !adminMarkerSnap.exists()) {
          await setDoc(adminMarkerRef, {
            uid: params.uid,
            grantedBy: params.uid,
            createdAt: serverTimestamp(),
          }).catch(() => undefined);
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${params.uid}`);
    }
    account = newAccount;
  } else {
    account = accountSnap.data() as UserAccount;
    if (isBootstrapAdmin && account.role !== 'admin') {
      try {
        await updateDoc(userRef, {
          role: 'admin',
          updatedAt: serverTimestamp(),
        });
        const adminMarkerRef = doc(db, 'admins', params.uid);
        const adminMarkerSnap = await getDoc(adminMarkerRef).catch(() => null);
        if (!adminMarkerSnap || !adminMarkerSnap.exists()) {
          await setDoc(adminMarkerRef, {
            uid: params.uid,
            grantedBy: params.uid,
            createdAt: serverTimestamp(),
          }).catch(() => undefined);
        }
        account = { ...account, role: 'admin' };
      } catch (error) {
        console.warn('Non-fatal bootstrap admin upgrade warning:', error);
      }
    }
  }

  let profileSnap;
  try {
    profileSnap = await getDoc(profileRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `profiles/${params.uid}`);
  }

  let profile: UserProfile;
  if (!profileSnap.exists()) {
    const newProfile: UserProfile = {
      uid: params.uid,
      username: sanitizeUsername(account.username || defaultUsername),
      fullName: clampStr(account.displayName, 120) || safeDisplayName,
      nipNisn: account.nipNisn || '',
      jabatanKelas: account.jabatanKelas || '',
      birthPlace: '',
      birthDate: '',
      address: '',
      phone: '',
      email: clampStr(account.email, 200) || safeEmail,
      education: '',
      expertise: '',
      bio: '',
      photoURL: account.photoURL || '',
      isPublished: true,
    };
    try {
      await setDoc(profileRef, {
        ...newProfile,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `profiles/${params.uid}`);
    }
    profile = newProfile;
  } else {
    profile = profileSnap.data() as UserProfile;
  }

  let settingsSnap;
  try {
    settingsSnap = await getDoc(settingsRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `settings/${params.uid}`);
  }

  let settings: UserSettings;
  if (!settingsSnap.exists()) {
    const newSettings: UserSettings = {
      uid: params.uid,
      theme: 'light',
      emailNotifications: true,
      activityAlerts: true,
      publicPortfolioEnabled: true,
      cvTemplate: 'modern',
    };
    try {
      await setDoc(settingsRef, {
        ...newSettings,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `settings/${params.uid}`);
    }
    settings = newSettings;
  } else {
    settings = settingsSnap.data() as UserSettings;
  }

  // Ensure initial public portfolio document exists so public URL works right away (non-blocking on slug collision)
  let safeUsername = sanitizeUsername(profile.username || defaultUsername);
  try {
    let pubRef = doc(db, 'publicPortfolios', safeUsername);
    let pubSnap = await getDoc(pubRef).catch(() => null);

    if (!pubSnap || (pubSnap.exists() && pubSnap.data()?.uid !== params.uid)) {
      const fallbackSlug = sanitizeUsername(`${safeUsername.slice(0, 36)}-${params.uid.slice(0, 6)}`);
      safeUsername = fallbackSlug;
      pubRef = doc(db, 'publicPortfolios', safeUsername);
      pubSnap = await getDoc(pubRef).catch(() => null);
      if (profile.username !== safeUsername) {
        await updateDoc(profileRef, {
          username: safeUsername,
          updatedAt: serverTimestamp(),
        }).catch(() => undefined);
        await updateDoc(userRef, {
          username: safeUsername,
          updatedAt: serverTimestamp(),
        }).catch(() => undefined);
        profile = { ...profile, username: safeUsername };
        account = { ...account, username: safeUsername };
      }
    }

    if (pubSnap && !pubSnap.exists()) {
      await setDoc(pubRef, {
        uid: params.uid,
        username: safeUsername,
        fullName: clampStr(profile.fullName, 120) || safeDisplayName,
        role: account.role || 'guru',
        nipNisn: clampStr(profile.nipNisn, 40),
        jabatanKelas: clampStr(profile.jabatanKelas, 100),
        education: clampStr(profile.education, 150),
        expertise: clampStr(profile.expertise, 250),
        bio: clampStr(profile.bio, 1500),
        photoURL: clampStr(profile.photoURL, 200000),
        isPublished: Boolean(profile.isPublished),
        featuredDocuments: [],
        featuredCertificates: [],
        featuredAchievements: [],
        featuredGalleries: [],
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    console.warn(`Non-fatal publicPortfolios sync warning (${safeUsername}):`, error);
  }

  saveOfflineCache(params.uid, 'session', { account, profile, settings });
  return { account, profile, settings };
}

export async function saveProfile(
  uid: string,
  previousUsername: string,
  data: Omit<UserProfile, 'uid' | 'createdAt' | 'updatedAt'>,
  role: UserRole,
  docs: PortfolioDocument[],
  certs: Certificate[],
  achs: Achievement[],
  gals: GalleryItem[]
): Promise<UserProfile> {
  const cleanUsername = sanitizeUsername(data.username);

  if (previousUsername && previousUsername !== cleanUsername) {
    let targetSnap = null;
    try {
      targetSnap = await getDoc(doc(db, 'publicPortfolios', cleanUsername));
    } catch (err: unknown) {
      const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
      if (msg.includes('permission') || msg.includes('insufficient')) {
        throw new Error('Username URL publik tersebut sudah digunakan pengguna lain. Pilih username lain.');
      }
      handleFirestoreError(err, OperationType.GET, `publicPortfolios/${cleanUsername}`);
    }
    if (targetSnap && targetSnap.exists() && targetSnap.data()?.uid !== uid) {
      throw new Error('Username URL publik tersebut sudah digunakan pengguna lain. Pilih username lain.');
    }
  }

  const payload = {
    username: cleanUsername,
    fullName: clampStr(data.fullName, 120) || 'Pengguna',
    nipNisn: clampStr(data.nipNisn, 40),
    jabatanKelas: clampStr(data.jabatanKelas, 100),
    birthPlace: clampStr(data.birthPlace, 100),
    birthDate: clampStr(data.birthDate, 20),
    address: clampStr(data.address, 300),
    phone: clampStr(data.phone, 30),
    email: clampStr(data.email, 200) || `${uid}@karyaloka.local`,
    education: clampStr(data.education, 150),
    expertise: clampStr(data.expertise, 250),
    bio: clampStr(data.bio, 1500),
    photoURL: clampStr(data.photoURL, 200000),
    isPublished: Boolean(data.isPublished),
  };

  try {
    await updateDoc(doc(db, 'profiles', uid), {
      ...payload,
      updatedAt: serverTimestamp(),
    });
    await updateDoc(doc(db, 'users', uid), {
      username: payload.username,
      displayName: payload.fullName,
      nipNisn: payload.nipNisn,
      jabatanKelas: payload.jabatanKelas,
      photoURL: payload.photoURL,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `profiles/${uid}`);
  }

  if (previousUsername && previousUsername !== cleanUsername) {
    const cleanPrev = sanitizeUsername(previousUsername);
    try {
      const prevRef = doc(db, 'publicPortfolios', cleanPrev);
      const prevSnap = await getDoc(prevRef).catch(() => null);
      if (prevSnap && prevSnap.exists() && prevSnap.data()?.uid === uid) {
        await deleteDoc(prevRef);
      }
    } catch (error) {
      console.warn(`Non-fatal previous publicPortfolio delete warning (${cleanPrev}):`, error);
    }
  }

  const updatedProfile: UserProfile = {
    uid,
    ...payload,
  };

  await syncPublicPortfolio(updatedProfile, role, docs, certs, achs, gals);
  return updatedProfile;
}

function computePublicPayloadSignature(payloadWithoutTs: Record<string, unknown>): string {
  const str = JSON.stringify(payloadWithoutTs);
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  return `${str.length}_${hash >>> 0}`;
}

export async function syncPublicPortfolio(
  profile: UserProfile,
  role: UserRole,
  docs: PortfolioDocument[],
  certs: Certificate[],
  achs: Achievement[],
  gals: GalleryItem[],
  options?: { skipIfUnchanged?: boolean }
): Promise<void> {
  const username = sanitizeUsername(profile.username);
  const path = `publicPortfolios/${username}`;
  const pubRef = doc(db, 'publicPortfolios', username);

  const MAX_PUBLIC_BYTES = 760000;
  let remainingBudget = Math.max(120000, MAX_PUBLIC_BYTES - (profile.photoURL?.length || 0));

  function takeWithinBudget<T extends Record<string, unknown>>(items: T[], sectionMaxBytes: number): T[] {
    const out: T[] = [];
    let used = 0;
    for (const item of items) {
      const size = JSON.stringify(item).length;
      if (used + size <= sectionMaxBytes && remainingBudget - size >= 0) {
        out.push(item);
        used += size;
        remainingBudget -= size;
      }
    }
    return out;
  }

  function takeAllWithMediaBudget<T extends Record<string, unknown>>(
    items: T[],
    mediaKey: keyof T,
    sectionMaxBytes: number
  ): T[] {
    const out: T[] = [];
    let used = 0;
    for (const item of items) {
      const size = JSON.stringify(item).length;
      if (used + size <= sectionMaxBytes && remainingBudget - size >= 0) {
        out.push(item);
        used += size;
        remainingBudget -= size;
      } else {
        const stripped = { ...item, [mediaKey]: '' };
        const strippedSize = JSON.stringify(stripped).length;
        if (remainingBudget - strippedSize >= 0) {
          out.push(stripped);
          used += strippedSize;
          remainingBudget -= strippedSize;
        }
      }
    }
    return out;
  }

  const featuredDocuments = takeAllWithMediaBudget(
    [...docs]
      .filter((d) => d.isPublic)
      .sort((a, b) => b.year - a.year)
      .slice(0, 50)
      .map((d) => ({
        id: d.id,
        title: d.title,
        category: d.category,
        year: d.year,
        fileType: d.fileType,
        fileUrl: d.fileUrl.length > 200000 ? '' : d.fileUrl,
        description: d.description || '',
      })),
    'fileUrl',
    160000
  );

  const featuredCertificates = takeAllWithMediaBudget(
    [...certs]
      .filter((c) => c.isPublic)
      .sort((a, b) => b.year - a.year)
      .slice(0, 50)
      .map((c) => ({
        id: c.id,
        eventName: c.eventName,
        organizer: c.organizer,
        year: c.year,
        fileName: c.fileName || '',
        fileUrl: c.fileUrl.length > 200000 ? '' : c.fileUrl,
        description: c.description || '',
      })),
    'fileUrl',
    180000
  );

  const featuredAchievements = takeAllWithMediaBudget(
    [...achs]
      .filter((a) => a.isPublic)
      .sort((a, b) => b.year - a.year)
      .slice(0, 50)
      .map((a) => ({
        id: a.id,
        title: a.title,
        level: a.level,
        year: a.year,
        photoUrl: (a.photoUrl || '').length > 200000 ? '' : a.photoUrl || '',
        description: a.description || '',
      })),
    'photoUrl',
    240000
  );

  const featuredGalleries = takeWithinBudget(
    gals
      .filter((g) => g.isPublic)
      .slice(0, 24)
      .map((g) => ({
        id: g.id,
        title: g.title,
        album: g.album,
        year: g.year,
        imageUrl: g.imageUrl,
        caption: g.caption || '',
      })),
    remainingBudget
  );

  const corePayload = {
    uid: profile.uid,
    username,
    fullName: clampStr(profile.fullName, 120) || 'Pengguna',
    role: role || 'guru',
    nipNisn: clampStr(profile.nipNisn, 40),
    jabatanKelas: clampStr(profile.jabatanKelas, 100),
    education: clampStr(profile.education, 150),
    expertise: clampStr(profile.expertise, 250),
    bio: clampStr(profile.bio, 1500),
    photoURL: clampStr(profile.photoURL, 200000),
    isPublished: Boolean(profile.isPublished),
    featuredDocuments,
    featuredCertificates,
    featuredAchievements,
    featuredGalleries,
  };

  const sigKey = `karyaloka_pub_sig_v2_${profile.uid}`;
  const sig = computePublicPayloadSignature(corePayload);
  if (options?.skipIfUnchanged) {
    try {
      if (localStorage.getItem(sigKey) === sig) {
        return;
      }
    } catch {
      // ignore localStorage access issues
    }
  }

  const payload = {
    ...corePayload,
    updatedAt: serverTimestamp(),
  };

  try {
    const existingSnap = await getDoc(pubRef);
    if (!existingSnap.exists()) {
      await setDoc(pubRef, payload);
    } else {
      await updateDoc(pubRef, payload);
    }
    try {
      localStorage.setItem(sigKey, sig);
    } catch {
      // ignore
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fetchPublicPortfolio(username: string): Promise<PublicPortfolioDoc | null> {
  const clean = sanitizeUsername(username);
  const path = `publicPortfolios/${clean}`;
  try {
    const snap = await getDoc(doc(db, 'publicPortfolios', clean));
    if (!snap.exists()) return null;
    return snap.data() as PublicPortfolioDoc;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export function subscribeUserCollection<T extends { id: string }>(
  collectionName: string,
  uid: string,
  onData: (items: T[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(collection(db, collectionName), where('uid', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<T, 'id'>),
      })) as T[];
      saveOfflineCache(uid, collectionName, items);
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, collectionName);
      } catch (wrapped) {
        if (onError) {
          onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
        }
      }
    }
  );
}

export function subscribeUserLogs(
  uid: string,
  onData: (logs: AuditLog[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(collection(db, 'logs'), where('uid', '==', uid), limit(100));
  return onSnapshot(
    q,
    (snap) => {
      const logs = snap.docs
        .map((d) => ({
          id: d.id,
          ...(d.data() as Omit<AuditLog, 'id'>),
        }))
        .sort((a, b) => {
          const ta = (a.createdAt as { toMillis?: () => number } | undefined)?.toMillis?.() ?? 0;
          const tb = (b.createdAt as { toMillis?: () => number } | undefined)?.toMillis?.() ?? 0;
          return tb - ta;
        });
      saveOfflineCache(uid, 'logs', logs);
      onData(logs);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'logs');
      } catch (wrapped) {
        if (onError) {
          onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
        }
      }
    }
  );
}

export async function createCollectionItem<T extends Record<string, unknown>>(
  collectionName: string,
  data: T,
  hasUpdatedAt = true
): Promise<string> {
  try {
    const clean = normalizeIntegers(data);
    const payload = hasUpdatedAt
      ? { ...clean, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }
      : { ...clean, createdAt: serverTimestamp() };
    const docRef = await addDoc(collection(db, collectionName), payload);
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, collectionName);
  }
}

export async function updateCollectionItem<T extends Record<string, unknown>>(
  collectionName: string,
  id: string,
  data: T,
  hasUpdatedAt = true
): Promise<void> {
  const path = `${collectionName}/${id}`;
  try {
    const clean = normalizeIntegers(data);
    const payload = hasUpdatedAt ? { ...clean, updatedAt: serverTimestamp() } : clean;
    await updateDoc(doc(db, collectionName, id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteCollectionItem(collectionName: string, id: string): Promise<void> {
  const path = `${collectionName}/${id}`;
  try {
    await deleteDoc(doc(db, collectionName, id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function updateSettingsDoc(
  uid: string,
  patch: Partial<Omit<UserSettings, 'uid' | 'updatedAt'>>
): Promise<void> {
  const path = `settings/${uid}`;
  try {
    await updateDoc(doc(db, 'settings', uid), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// Admin data access
export async function fetchAllAdminCollections(): Promise<{
  users: UserAccount[];
  documents: PortfolioDocument[];
  certificates: Certificate[];
  achievements: Achievement[];
  logs: AuditLog[];
}> {
  const [usersSnap, docsSnap, certsSnap, achsSnap, logsSnap] = await Promise.all([
    getDocs(query(collection(db, 'users'), limit(200))).catch((e) =>
      handleFirestoreError(e, OperationType.LIST, 'users')
    ),
    getDocs(query(collection(db, 'documents'), limit(200))).catch((e) =>
      handleFirestoreError(e, OperationType.LIST, 'documents')
    ),
    getDocs(query(collection(db, 'certificates'), limit(200))).catch((e) =>
      handleFirestoreError(e, OperationType.LIST, 'certificates')
    ),
    getDocs(query(collection(db, 'achievements'), limit(200))).catch((e) =>
      handleFirestoreError(e, OperationType.LIST, 'achievements')
    ),
    getDocs(query(collection(db, 'logs'), limit(200))).catch((e) =>
      handleFirestoreError(e, OperationType.LIST, 'logs')
    ),
  ]);

  const sortedLogs = logsSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<AuditLog, 'id'>) }))
    .sort((a, b) => {
      const ta = (a.createdAt as { toMillis?: () => number } | undefined)?.toMillis?.() ?? 0;
      const tb = (b.createdAt as { toMillis?: () => number } | undefined)?.toMillis?.() ?? 0;
      return tb - ta;
    });

  return {
    users: usersSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<UserAccount, 'id'>) })),
    documents: docsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PortfolioDocument, 'id'>) })),
    certificates: certsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Certificate, 'id'>) })),
    achievements: achsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Achievement, 'id'>) })),
    logs: sortedLogs,
  };
}

export async function adminCreateUserRecord(params: {
  displayName: string;
  email: string;
  role: UserRole;
  nipNisn: string;
  jabatanKelas: string;
  adminUid: string;
}): Promise<string> {
  const newId = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const username = generateDefaultUsername(params.displayName, newId);
  const path = `users/${newId}`;
  try {
    await setDoc(doc(db, 'users', newId), {
      uid: newId,
      username,
      email: clampStr(params.email, 200),
      displayName: clampStr(params.displayName, 120) || 'Pengguna',
      role: params.role,
      nipNisn: clampStr(params.nipNisn, 40),
      jabatanKelas: clampStr(params.jabatanKelas, 100),
      photoURL: '',
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    if (params.role === 'admin') {
      await setDoc(doc(db, 'admins', newId), {
        uid: newId,
        grantedBy: params.adminUid,
        createdAt: serverTimestamp(),
      });
    }
    return newId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function adminUpdateUserRoleOrStatus(
  targetUid: string,
  updates: { role?: UserRole; isActive?: boolean },
  adminUid: string
): Promise<void> {
  const path = `users/${targetUid}`;
  try {
    await updateDoc(doc(db, 'users', targetUid), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
    const adminRef = doc(db, 'admins', targetUid);
    if (updates.role === 'admin') {
      await setDoc(adminRef, {
        uid: targetUid,
        grantedBy: adminUid,
        createdAt: serverTimestamp(),
      });
    } else if (updates.role && (updates.role === 'guru' || updates.role === 'siswa')) {
      const adminSnap = await getDoc(adminRef).catch(() => null);
      if (adminSnap && adminSnap.exists()) {
        await deleteDoc(adminRef).catch(() => undefined);
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminDeleteUserRecord(targetUid: string): Promise<void> {
  const path = `users/${targetUid}`;
  try {
    await deleteDoc(doc(db, 'users', targetUid));
    const profileRef = doc(db, 'profiles', targetUid);
    const profileSnap = await getDoc(profileRef).catch(() => null);
    if (profileSnap && profileSnap.exists()) {
      await deleteDoc(profileRef).catch(() => undefined);
    }
    const adminRef = doc(db, 'admins', targetUid);
    const adminSnap = await getDoc(adminRef).catch(() => null);
    if (adminSnap && adminSnap.exists()) {
      await deleteDoc(adminRef).catch(() => undefined);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
