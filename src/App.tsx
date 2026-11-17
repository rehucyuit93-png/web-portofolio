import { useCallback, useEffect, useRef, useState } from 'react';
import { applyActionCode, onAuthStateChanged, signOut, type User } from 'firebase/auth';
import {
  auth,
  ensureFirestoreNetworkOnline,
  formatAuthErrorMessage,
  getQuotaUpgradeUrl,
  sendVerificationEmailSafe,
  testFirestoreConnection,
  type FirestoreConnectionStatus,
} from './lib/firebase';
import { formatFirestoreErrorForUser } from './lib/firestoreError';
import {
  createCollectionItem,
  deleteCollectionItem,
  ensureUserInitialized,
  loadOfflineCache,
  saveProfile,
  subscribeUserCollection,
  subscribeUserLogs,
  syncPublicPortfolio,
  updateCollectionItem,
  updateSettingsDoc,
  writeAuditLog,
} from './lib/portfolioService';
import type {
  Achievement,
  Activity,
  AuditLog,
  Certificate,
  DashboardSection,
  GalleryItem,
  PortfolioDocument,
  UserAccount,
  UserProfile,
  UserSettings,
} from './types/portfolio';
import { AuthView } from './components/AuthView';
import { DashboardShell } from './components/DashboardShell';
import { PublicPortfolioView } from './components/PublicPortfolioView';
import { OfflineIndicator } from './components/OfflineIndicator';
import { ToastContainer, type ToastItem } from './components/Toast';

function parsePublicPortfolioSlug(pathname: string): string | null {
  const match = pathname.match(/^\/portfolio\/([a-zA-Z0-9-]+)\/?$/);
  return match ? match[1].toLowerCase() : null;
}

export default function App() {
  const [publicSlug, setPublicSlug] = useState<string | null>(() =>
    parsePublicPortfolioSlug(window.location.pathname)
  );
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('karyaloka_theme');
    return saved === 'dark' ? 'dark' : 'light';
  });

  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [emailVerified, setEmailVerified] = useState(false);

  const [dbStatus, setDbStatus] = useState<FirestoreConnectionStatus | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [retryingSession, setRetryingSession] = useState(false);

  const [account, setAccount] = useState<UserAccount | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);

  const [documents, setDocuments] = useState<PortfolioDocument[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [galleries, setGalleries] = useState<GalleryItem[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const loggedUidRef = useRef<string | null>(null);
  const listenerNotifiedRef = useRef<boolean>(false);
  const actionVerifiedRef = useRef<boolean>(false);
  const returnedFromVerifyRef = useRef<boolean>(false);
  const lastAutoCheckRef = useRef<number>(0);

  const [activeSection, setActiveSection] = useState<DashboardSection>('dashboard');
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const notify = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  // Sync Tailwind dark class on <html>
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('karyaloka_theme', theme);
  }, [theme]);

  // Listen to browser history navigation
  useEffect(() => {
    const handlePop = () => {
      setPublicSlug(parsePublicPortfolioSlug(window.location.pathname));
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  const checkDbConnection = useCallback(async () => {
    const status = await testFirestoreConnection();
    setDbStatus(status);
    return status;
  }, []);

  // Boot Firestore server check
  useEffect(() => {
    checkDbConnection();
  }, [checkDbConnection]);

  const hydrateUserSession = useCallback(async (user: User) => {
    setSessionError(null);
    const pendingKeyByUid = `pending_reg_${user.uid}`;
    const pendingKeyByEmail = user.email ? `pending_reg_email_${user.email.toLowerCase()}` : '';
    const pendingRaw =
      localStorage.getItem(pendingKeyByUid) ||
      (pendingKeyByEmail ? localStorage.getItem(pendingKeyByEmail) : null);
    let pending: {
      fullName?: string;
      role?: 'guru' | 'siswa';
      nipNisn?: string;
      jabatanKelas?: string;
    } = {};
    if (pendingRaw) {
      try {
        pending = JSON.parse(pendingRaw);
      } catch {
        pending = {};
      }
      localStorage.removeItem(pendingKeyByUid);
      if (pendingKeyByEmail) localStorage.removeItem(pendingKeyByEmail);
    }

    try {
      await user.getIdToken().catch(() => undefined);
      const init = await ensureUserInitialized({
        uid: user.uid,
        email: user.email || '',
        emailVerified: user.emailVerified,
        displayName: pending.fullName || user.displayName || user.email?.split('@')[0] || 'Pengguna',
        photoURL: user.photoURL || '',
        preferredRole: pending.role,
        nipNisn: pending.nipNisn,
        jabatanKelas: pending.jabatanKelas,
      });

      setDbStatus({ ok: true });
      setAccount(init.account);
      setProfile(init.profile);
      setSettings(init.settings);
      setTheme(init.settings.theme);

      if (loggedUidRef.current !== user.uid) {
        loggedUidRef.current = user.uid;
        writeAuditLog({
          uid: user.uid,
          userEmail: init.account.email,
          userName: init.account.displayName,
          action: 'LOGIN',
          module: 'Autentikasi',
          detail: 'Masuk ke dashboard KaryaLoka',
        }).catch(() => undefined);
      }
    } catch (err: unknown) {
      const friendly = formatFirestoreErrorForUser(err);
      const isOffline =
        !navigator.onLine ||
        friendly.toLowerCase().includes('offline') ||
        friendly.toLowerCase().includes('tidak stabil');

      // Fallback to localStorage offline cache when offline
      if (isOffline) {
        const cachedSession = loadOfflineCache<{
          account: UserAccount;
          profile: UserProfile;
          settings: UserSettings;
        }>(user.uid, 'session');

        if (cachedSession?.account && cachedSession?.profile && cachedSession?.settings) {
          setAccount(cachedSession.account);
          setProfile(cachedSession.profile);
          setSettings(cachedSession.settings);
          setTheme(cachedSession.settings.theme);
          setDocuments(loadOfflineCache<PortfolioDocument[]>(user.uid, 'documents') || []);
          setCertificates(loadOfflineCache<Certificate[]>(user.uid, 'certificates') || []);
          setAchievements(loadOfflineCache<Achievement[]>(user.uid, 'achievements') || []);
          setActivities(loadOfflineCache<Activity[]>(user.uid, 'activities') || []);
          setGalleries(loadOfflineCache<GalleryItem[]>(user.uid, 'galleries') || []);
          setLogs(loadOfflineCache<AuditLog[]>(user.uid, 'logs') || []);
          notify('info', 'Menampilkan salinan cache offline karena koneksi Firestore sedang terputus.');
          return;
        }
      }

      setSessionError(friendly);
      throw new Error(friendly);
    }
  }, [notify]);

  const syncVerifiedUserState = useCallback(
    async (user: User, showSuccessToast = true) => {
      await user.getIdToken(true).catch(() => undefined);
      setFirebaseUser(auth.currentUser || user);
      setEmailVerified(true);
      localStorage.removeItem(`verify_sent_${user.uid}`);
      localStorage.removeItem(`verify_cooldown_until_${user.uid}`);
      localStorage.removeItem(`verify_banner_dismissed_${user.uid}`);
      await hydrateUserSession(auth.currentUser || user);
      if (showSuccessToast) {
        notify('success', 'Email Anda berhasil diverifikasi dan diaktifkan!');
      }
    },
    [hydrateUserSession, notify]
  );

  // Handle Firebase email verification links (?mode=verifyEmail&oobCode=... or ?verified=1)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    const oobCode = params.get('oobCode');

    if (mode === 'verifyEmail' && oobCode) {
      window.history.replaceState({}, '', window.location.pathname);
      applyActionCode(auth, oobCode)
        .then(async () => {
          actionVerifiedRef.current = true;
          if (auth.currentUser) {
            await auth.currentUser.reload();
            if (auth.currentUser.emailVerified) {
              actionVerifiedRef.current = false;
              await syncVerifiedUserState(auth.currentUser, true);
              return;
            }
          }
          notify('success', 'Email berhasil diverifikasi! Memperbarui status akun Anda...');
        })
        .catch((err: unknown) => {
          notify(
            'error',
            err instanceof Error
              ? err.message
              : 'Tautan verifikasi email tidak valid atau sudah kedaluwarsa.'
          );
        });
    } else if (params.get('verified') === '1') {
      returnedFromVerifyRef.current = true;
      window.history.replaceState({}, '', window.location.pathname);
      if (auth.currentUser) {
        auth.currentUser
          .reload()
          .then(async () => {
            if (auth.currentUser?.emailVerified) {
              returnedFromVerifyRef.current = false;
              await syncVerifiedUserState(auth.currentUser, true);
            }
          })
          .catch(() => undefined);
      }
    }
  }, [notify, syncVerifiedUserState]);

  // Firebase Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        loggedUidRef.current = null;
        listenerNotifiedRef.current = false;
        setFirebaseUser(null);
        setEmailVerified(false);
        setSessionError(null);
        setAccount(null);
        setProfile(null);
        setSettings(null);
        setDocuments([]);
        setCertificates([]);
        setAchievements([]);
        setActivities([]);
        setGalleries([]);
        setLogs([]);
        setAuthReady(true);
        return;
      }

      if (!user.emailVerified && navigator.onLine) {
        await user.reload().catch(() => undefined);
      }
      const activeUser = auth.currentUser || user;
      if (activeUser.emailVerified) {
        await activeUser.getIdToken(true).catch(() => undefined);
        localStorage.removeItem(`verify_sent_${activeUser.uid}`);
      }

      setFirebaseUser(activeUser);
      setEmailVerified(activeUser.emailVerified);

      if ((returnedFromVerifyRef.current || actionVerifiedRef.current) && activeUser.emailVerified) {
        returnedFromVerifyRef.current = false;
        actionVerifiedRef.current = false;
        notify('success', 'Email Anda berhasil diverifikasi dan diaktifkan!');
      }

      try {
        await hydrateUserSession(activeUser);
      } catch (err: unknown) {
        notify('error', err instanceof Error ? err.message : 'Gagal memuat profil pengguna dari database.');
      } finally {
        setAuthReady(true);
      }
    });

    return () => unsub();
  }, [hydrateUserSession, notify]);

  // Auto-check email verification when user switches back from email client tab or verifies on another device
  useEffect(() => {
    if (!firebaseUser || emailVerified) return;

    const runVerificationCheck = async () => {
      if (!auth.currentUser || !navigator.onLine) return;
      if (document.visibilityState === 'hidden') return;
      const now = Date.now();
      if (now - lastAutoCheckRef.current < 4000) return;
      lastAutoCheckRef.current = now;

      try {
        await auth.currentUser.reload();
        if (auth.currentUser.emailVerified) {
          await syncVerifiedUserState(auth.currentUser, true);
        }
      } catch {
        // Ignore transient focus/poll check failures
      }
    };

    const pollInterval = window.setInterval(() => {
      const sentAtRaw = localStorage.getItem(`verify_sent_${firebaseUser.uid}`);
      if (!sentAtRaw) return;
      const ageMs = Date.now() - Number(sentAtRaw);
      if (ageMs >= 0 && ageMs <= 10 * 60 * 1000) {
        void runVerificationCheck();
      }
    }, 20000);

    window.addEventListener('focus', runVerificationCheck);
    document.addEventListener('visibilitychange', runVerificationCheck);
    return () => {
      window.clearInterval(pollInterval);
      window.removeEventListener('focus', runVerificationCheck);
      document.removeEventListener('visibilitychange', runVerificationCheck);
    };
  }, [firebaseUser, emailVerified, syncVerifiedUserState]);

  // Attach Firestore real-time listeners once authenticated & verified & hydrated
  useEffect(() => {
    if (!authReady || !firebaseUser || !account) return;
    const uid = firebaseUser.uid;
    listenerNotifiedRef.current = false;

    const handleListenerError = (err: Error) => {
      if (listenerNotifiedRef.current) return;
      listenerNotifiedRef.current = true;
      notify('error', formatFirestoreErrorForUser(err));
    };

    const unsubDocs = subscribeUserCollection<PortfolioDocument>('documents', uid, setDocuments, handleListenerError);
    const unsubCerts = subscribeUserCollection<Certificate>('certificates', uid, setCertificates, handleListenerError);
    const unsubAchs = subscribeUserCollection<Achievement>('achievements', uid, setAchievements, handleListenerError);
    const unsubActs = subscribeUserCollection<Activity>('activities', uid, setActivities, handleListenerError);
    const unsubGals = subscribeUserCollection<GalleryItem>('galleries', uid, setGalleries, handleListenerError);
    const unsubLogs = subscribeUserLogs(uid, setLogs, handleListenerError);

    return () => {
      unsubDocs();
      unsubCerts();
      unsubAchs();
      unsubActs();
      unsubGals();
      unsubLogs();
    };
  }, [authReady, firebaseUser, account, notify]);

  const navigatePublicPortfolio = (username: string) => {
    const path = `/portfolio/${encodeURIComponent(username)}`;
    window.history.pushState({}, '', path);
    setPublicSlug(username);
  };

  const navigateBackHome = () => {
    window.history.pushState({}, '', '/');
    setPublicSlug(null);
  };

  // Sync helper after content CRUD
  const resyncPublic = async (
    nextDocs = documents,
    nextCerts = certificates,
    nextAchs = achievements,
    nextGals = galleries
  ) => {
    if (!profile || !account) return;
    await syncPublicPortfolio(profile, account.role, nextDocs, nextCerts, nextAchs, nextGals);
  };

  if (publicSlug) {
    return (
      <>
        <PublicPortfolioView
          username={publicSlug}
          onBackHome={navigateBackHome}
          onNotify={notify}
        />
        <OfflineIndicator />
        <ToastContainer
          toasts={toasts}
          onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
        />
      </>
    );
  }

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Menyiapkan ruang portofolio KaryaLoka...
          </p>
        </div>
      </div>
    );
  }

  // Signed-in user encountered a Firestore initialization/database error: show clear recovery UI instead of bouncing back to Login
  if (firebaseUser && (!account || !profile || !settings)) {
    return (
      <>
        <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
          <div className="w-full max-w-lg rounded-2xl border border-rose-200 bg-white p-6 shadow-lg dark:border-rose-900/60 dark:bg-slate-900">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400">
                <i className="fa-solid fa-database text-lg" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-lg font-bold text-slate-900 dark:text-white">
                  Koneksi Database Terkendala
                </h1>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Masuk sebagai <span className="font-semibold">{firebaseUser.email}</span>
                </p>
                <p className="mt-3 rounded-xl bg-rose-50 p-3 text-xs leading-relaxed text-rose-800 dark:bg-rose-950/50 dark:text-rose-200">
                  {sessionError ||
                    dbStatus?.message ||
                    'Tidak dapat memuat data profil Anda dari database Firestore.'}
                </p>
                {(sessionError?.toLowerCase().includes('kuota') || dbStatus?.reason === 'quota') && (
                  <a
                    href={getQuotaUpgradeUrl()}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 underline dark:text-blue-400"
                  >
                    <span>Periksa Kuota Firestore di Firebase Console</span>
                    <i className="fa-solid fa-arrow-up-right-from-square text-[10px]" aria-hidden="true" />
                  </a>
                )}
                <div className="mt-5 flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    disabled={retryingSession}
                    onClick={async () => {
                      setRetryingSession(true);
                      try {
                        await ensureFirestoreNetworkOnline();
                        await firebaseUser.reload().catch(() => undefined);
                        try {
                          await firebaseUser.getIdToken(true);
                        } catch (tokenErr: unknown) {
                          const code = (tokenErr as { code?: string })?.code || '';
                          if (code === 'auth/user-token-expired' || code === 'auth/user-not-found') {
                            await signOut(auth);
                            setSessionError(null);
                            notify('info', 'Sesi login berakhir. Silakan masuk kembali.');
                            return;
                          }
                        }
                        await checkDbConnection();
                        await hydrateUserSession(auth.currentUser || firebaseUser);
                        notify('success', 'Berhasil terhubung ke database Firestore.');
                      } catch (err: unknown) {
                        notify('error', err instanceof Error ? err.message : 'Masih gagal terhubung ke database.');
                      } finally {
                        setRetryingSession(false);
                      }
                    }}
                    className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    {retryingSession ? 'Menghubungkan...' : 'Coba Hubungkan Ulang'}
                  </button>
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Muat Ulang Halaman
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await signOut(auth);
                      setSessionError(null);
                    }}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Keluar Akun
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <OfflineIndicator />
        <ToastContainer
          toasts={toasts}
          onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
        />
      </>
    );
  }

  if (!firebaseUser || !account || !profile || !settings) {
    return (
      <>
        {dbStatus && !dbStatus.ok && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/60 dark:text-amber-200">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
                <span>{dbStatus.message}</span>
                {dbStatus.upgradeUrl && (
                  <a
                    href={dbStatus.upgradeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold underline"
                  >
                    Buka Firebase Console
                  </a>
                )}
              </div>
              <button
                type="button"
                onClick={checkDbConnection}
                className="rounded-lg border border-amber-300 px-2.5 py-1 font-semibold hover:bg-amber-100 dark:border-amber-800 dark:hover:bg-amber-900/50"
              >
                Uji Koneksi
              </button>
            </div>
          </div>
        )}
        <AuthView
          theme={theme}
          onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          onOpenSamplePortfolio={(slug) => navigatePublicPortfolio(slug)}
          onNotify={notify}
        />
        <OfflineIndicator />
        <ToastContainer
          toasts={toasts}
          onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
        />
      </>
    );
  }

  return (
    <>
      <DashboardShell
        account={account}
        profile={profile}
        settings={settings}
        emailVerified={emailVerified}
        onSendVerificationEmail={async () => {
          if (!auth.currentUser) {
            return { sent: false, error: 'Sesi pengguna tidak ditemukan. Silakan masuk ulang.' };
          }
          const uid = auth.currentUser.uid;
          try {
            const res = await sendVerificationEmailSafe(auth.currentUser);
            if (res.alreadyVerified) {
              await syncVerifiedUserState(auth.currentUser, true);
              return { sent: false, alreadyVerified: true };
            }
            const now = Date.now();
            localStorage.setItem(`verify_sent_${uid}`, String(now));
            localStorage.setItem(`verify_cooldown_until_${uid}`, String(now + 90_000));
            notify(
              'success',
              `Email aktivasi dikirim ke ${auth.currentUser.email}. Periksa Kotak Masuk atau folder Spam.`
            );
            return { sent: true, usedFallbackDomain: res.usedFallbackDomain };
          } catch (err: unknown) {
            const formatted = formatAuthErrorMessage(err);
            if (formatted.isRateLimited) {
              localStorage.setItem(`verify_cooldown_until_${uid}`, String(Date.now() + 120_000));
            }
            notify('error', formatted.message);
            return {
              sent: false,
              rateLimited: formatted.isRateLimited,
              error: formatted.message,
            };
          }
        }}
        onRefreshVerification={async () => {
          if (!auth.currentUser) {
            return { verified: false, error: 'Sesi pengguna tidak ditemukan.' };
          }
          try {
            await auth.currentUser.reload();
            if (auth.currentUser.emailVerified) {
              await syncVerifiedUserState(auth.currentUser, true);
              return { verified: true };
            }
            notify(
              'info',
              'Email belum terverifikasi. Klik tautan pada email dari noreply@gen-lang-client-0131469651.firebaseapp.com lalu coba lagi.'
            );
            return { verified: false };
          } catch (err: unknown) {
            const msg = formatAuthErrorMessage(err).message;
            notify('error', msg);
            return { verified: false, error: msg };
          }
        }}
        onApplyVerificationLink={async (rawLinkOrCode: string) => {
          const trimmed = rawLinkOrCode.trim();
          if (!trimmed) {
            return { verified: false, error: 'Tempel tautan atau kode aktivasi dari email terlebih dahulu.' };
          }
          let oobCode = trimmed;
          try {
            if (trimmed.includes('oobCode=')) {
              const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://dummy.local/?${trimmed}`);
              oobCode = parsed.searchParams.get('oobCode') || trimmed;
            }
          } catch {
            // Fall back to regex extraction
            const match = trimmed.match(/oobCode=([^&\s]+)/);
            if (match) oobCode = decodeURIComponent(match[1]);
          }

          try {
            await applyActionCode(auth, oobCode);
            if (auth.currentUser) {
              await auth.currentUser.reload();
              if (auth.currentUser.emailVerified) {
                await syncVerifiedUserState(auth.currentUser, true);
                return { verified: true };
              }
            }
            notify('success', 'Kode aktivasi berhasil diterapkan!');
            return { verified: true };
          } catch (err: unknown) {
            const msg =
              err instanceof Error && err.message.includes('invalid-action-code')
                ? 'Tautan atau kode aktivasi tidak valid atau sudah kedaluwarsa. Kirim ulang email verifikasi.'
                : formatAuthErrorMessage(err).message;
            notify('error', msg);
            return { verified: false, error: msg };
          }
        }}
        documents={documents}
        certificates={certificates}
        achievements={achievements}
        activities={activities}
        galleries={galleries}
        logs={logs}
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        onSaveProfile={async (data) => {
          const updated = await saveProfile(
            account.uid,
            profile.username,
            data,
            account.role,
            documents,
            certificates,
            achievements,
            galleries
          );
          setProfile(updated);
          setAccount((prev) =>
            prev
              ? {
                  ...prev,
                  username: updated.username,
                  displayName: updated.fullName,
                  nipNisn: updated.nipNisn,
                  jabatanKelas: updated.jabatanKelas,
                  photoURL: updated.photoURL,
                }
              : prev
          );
          await writeAuditLog({
            uid: account.uid,
            userEmail: account.email,
            userName: updated.fullName,
            action: 'EDIT_DATA',
            module: 'Profil Saya',
            detail: `Memperbarui profil & tautan publik /portfolio/${updated.username}`,
          });
        }}
        onCreateDocument={async (data) => {
          const id = await createCollectionItem('documents', { ...data, uid: account.uid });
          await writeAuditLog({
            uid: account.uid,
            userEmail: account.email,
            userName: profile.fullName,
            action: 'UPLOAD_FILE',
            module: 'Dokumen Portofolio',
            detail: `Mengunggah dokumen "${data.title}" (${data.fileType})`,
          });
          await resyncPublic([{ id, uid: account.uid, ...data }, ...documents]);
        }}
        onUpdateDocument={async (id, data) => {
          await updateCollectionItem('documents', id, data);
          await writeAuditLog({
            uid: account.uid,
            userEmail: account.email,
            userName: profile.fullName,
            action: 'EDIT_DATA',
            module: 'Dokumen Portofolio',
            detail: `Memperbarui dokumen "${data.title || id}"`,
          });
          const next = documents.map((d) => (d.id === id ? { ...d, ...data } : d));
          await resyncPublic(next);
        }}
        onDeleteDocument={async (item) => {
          await deleteCollectionItem('documents', item.id);
          await writeAuditLog({
            uid: account.uid,
            userEmail: account.email,
            userName: profile.fullName,
            action: 'DELETE_DATA',
            module: 'Dokumen Portofolio',
            detail: `Menghapus dokumen "${item.title}"`,
          });
          notify('success', 'Dokumen berhasil dihapus.');
          await resyncPublic(documents.filter((d) => d.id !== item.id));
        }}
        onCreateCertificate={async (data) => {
          const id = await createCollectionItem('certificates', { ...data, uid: account.uid });
          await writeAuditLog({
            uid: account.uid,
            userEmail: account.email,
            userName: profile.fullName,
            action: 'UPLOAD_FILE',
            module: 'Sertifikat',
            detail: `Menambahkan sertifikat "${data.eventName}"`,
          });
          await resyncPublic(documents, [{ id, uid: account.uid, ...data }, ...certificates]);
        }}
        onUpdateCertificate={async (id, data) => {
          await updateCollectionItem('certificates', id, data);
          await writeAuditLog({
            uid: account.uid,
            userEmail: account.email,
            userName: profile.fullName,
            action: 'EDIT_DATA',
            module: 'Sertifikat',
            detail: `Memperbarui sertifikat "${data.eventName || id}"`,
          });
          const next = certificates.map((c) => (c.id === id ? { ...c, ...data } : c));
          await resyncPublic(documents, next);
        }}
        onDeleteCertificate={async (item) => {
          await deleteCollectionItem('certificates', item.id);
          await writeAuditLog({
            uid: account.uid,
            userEmail: account.email,
            userName: profile.fullName,
            action: 'DELETE_DATA',
            module: 'Sertifikat',
            detail: `Menghapus sertifikat "${item.eventName}"`,
          });
          notify('success', 'Sertifikat berhasil dihapus.');
          await resyncPublic(
            documents,
            certificates.filter((c) => c.id !== item.id)
          );
        }}
        onCreateAchievement={async (data) => {
          const id = await createCollectionItem('achievements', { ...data, uid: account.uid });
          await writeAuditLog({
            uid: account.uid,
            userEmail: account.email,
            userName: profile.fullName,
            action: 'UPLOAD_FILE',
            module: 'Prestasi',
            detail: `Menambahkan prestasi "${data.title}" (${data.level})`,
          });
          await resyncPublic(
            documents,
            certificates,
            [{ id, uid: account.uid, ...data }, ...achievements]
          );
        }}
        onUpdateAchievement={async (id, data) => {
          await updateCollectionItem('achievements', id, data);
          await writeAuditLog({
            uid: account.uid,
            userEmail: account.email,
            userName: profile.fullName,
            action: 'EDIT_DATA',
            module: 'Prestasi',
            detail: `Memperbarui prestasi "${data.title || id}"`,
          });
          const next = achievements.map((a) => (a.id === id ? { ...a, ...data } : a));
          await resyncPublic(documents, certificates, next);
        }}
        onDeleteAchievement={async (item) => {
          await deleteCollectionItem('achievements', item.id);
          await writeAuditLog({
            uid: account.uid,
            userEmail: account.email,
            userName: profile.fullName,
            action: 'DELETE_DATA',
            module: 'Prestasi',
            detail: `Menghapus prestasi "${item.title}"`,
          });
          notify('success', 'Prestasi berhasil dihapus.');
          await resyncPublic(
            documents,
            certificates,
            achievements.filter((a) => a.id !== item.id)
          );
        }}
        onCreateActivity={async (data) => {
          await createCollectionItem('activities', { ...data, uid: account.uid });
          await writeAuditLog({
            uid: account.uid,
            userEmail: account.email,
            userName: profile.fullName,
            action: 'UPLOAD_FILE',
            module: 'Kegiatan',
            detail: `Menambahkan kegiatan "${data.title}"`,
          });
        }}
        onUpdateActivity={async (id, data) => {
          await updateCollectionItem('activities', id, data);
          await writeAuditLog({
            uid: account.uid,
            userEmail: account.email,
            userName: profile.fullName,
            action: 'EDIT_DATA',
            module: 'Kegiatan',
            detail: `Memperbarui kegiatan "${data.title || id}"`,
          });
        }}
        onDeleteActivity={async (item) => {
          await deleteCollectionItem('activities', item.id);
          await writeAuditLog({
            uid: account.uid,
            userEmail: account.email,
            userName: profile.fullName,
            action: 'DELETE_DATA',
            module: 'Kegiatan',
            detail: `Menghapus kegiatan "${item.title}"`,
          });
          notify('success', 'Kegiatan berhasil dihapus.');
        }}
        onCreateGallery={async (data) => {
          const id = await createCollectionItem('galleries', { ...data, uid: account.uid }, false);
          await writeAuditLog({
            uid: account.uid,
            userEmail: account.email,
            userName: profile.fullName,
            action: 'UPLOAD_FILE',
            module: 'Galeri Foto',
            detail: `Menambahkan foto "${data.title}" ke album ${data.album}`,
          });
          await resyncPublic(
            documents,
            certificates,
            achievements,
            [{ id, uid: account.uid, ...data }, ...galleries]
          );
        }}
        onDeleteGallery={async (item) => {
          await deleteCollectionItem('galleries', item.id);
          await writeAuditLog({
            uid: account.uid,
            userEmail: account.email,
            userName: profile.fullName,
            action: 'DELETE_DATA',
            module: 'Galeri Foto',
            detail: `Menghapus foto "${item.title}"`,
          });
          notify('success', 'Foto galeri berhasil dihapus.');
          await resyncPublic(
            documents,
            certificates,
            achievements,
            galleries.filter((g) => g.id !== item.id)
          );
        }}
        onUpdateSettings={async (patch) => {
          const nextSettings = { ...settings, ...patch };
          setSettings(nextSettings);
          if (patch.theme) {
            setTheme(patch.theme);
          }
          await updateSettingsDoc(account.uid, patch);
          notify('success', 'Pengaturan berhasil disimpan.');
        }}
        onOpenPublicPortfolio={() => navigatePublicPortfolio(profile.username)}
        onSeedSampleData={async () => {
          const yearNow = new Date().getFullYear();
          const docId = await createCollectionItem('documents', {
            uid: account.uid,
            title: 'Modul Ajar Pembelajaran Berbasis Proyek (PjBL)',
            category: 'RPP / Modul Ajar',
            year: yearNow,
            description: 'Perangkat ajar terstruktur dengan asesmen formatif dan rubrik penilaian proyek.',
            fileName: 'modul-ajar-pjbl.pdf',
            fileType: 'PDF',
            fileSize: 420000,
            fileUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
            storagePath: '',
            isPublic: true,
          });
          const certId = await createCollectionItem('certificates', {
            uid: account.uid,
            eventName: 'Seminar Nasional Transformasi Pendidikan Digital',
            organizer: 'Kemendikbudristek & Komunitas Penggerak',
            year: yearNow,
            description: 'Peserta aktif pelatihan integrasi portofolio digital dan asesmen autentik.',
            fileName: 'sertifikat-seminar.jpg',
            fileUrl: '/src/assets/images/gallery_seminar_event_1794813993737.jpg',
            storagePath: '',
            isPublic: true,
          });
          const achId = await createCollectionItem('achievements', {
            uid: account.uid,
            title: 'Penghargaan Inovasi Pembelajaran Digital Terbaik',
            level: 'Nasional',
            year: yearNow,
            description: 'Meraih apresiasi tingkat nasional atas pengembangan media belajar interaktif.',
            photoUrl: '/src/assets/images/gallery_award_ceremony_1794813992181.jpg',
            storagePath: '',
            isPublic: true,
          });
          await createCollectionItem('activities', {
            uid: account.uid,
            title: 'Pameran Karya Proyek STEM & Robotika Sekolah',
            date: `${yearNow}-10-14`,
            year: yearNow,
            description: 'Pendampingan tim siswa mempresentasikan prototipe otomasi berbasis sensor.',
            photoUrl: '/src/assets/images/gallery_student_project_1794813993139.jpg',
            storagePath: '',
            isPublic: true,
          });
          const galId1 = await createCollectionItem(
            'galleries',
            {
              uid: account.uid,
              title: 'Seminar Pendidikan Nasional',
              album: 'Seminar & Pelatihan',
              year: yearNow,
              caption: 'Sesi pemaparan praktik baik transformasi digital.',
              imageUrl: '/src/assets/images/gallery_seminar_event_1794813993737.jpg',
              storagePath: '',
              isPublic: true,
            },
            false
          );
          const galId2 = await createCollectionItem(
            'galleries',
            {
              uid: account.uid,
              title: 'Showcase Inovasi STEM',
              album: 'Karya Siswa',
              year: yearNow,
              caption: 'Demonstrasi prototipe robotik di laboratorium sekolah.',
              imageUrl: '/src/assets/images/gallery_student_project_1794813993139.jpg',
              storagePath: '',
              isPublic: true,
            },
            false
          );

          await syncPublicPortfolio(
            profile,
            account.role,
            [
              {
                id: docId,
                uid: account.uid,
                title: 'Modul Ajar Pembelajaran Berbasis Proyek (PjBL)',
                category: 'RPP / Modul Ajar',
                year: yearNow,
                description: 'Perangkat ajar terstruktur dengan asesmen formatif dan rubrik penilaian proyek.',
                fileName: 'modul-ajar-pjbl.pdf',
                fileType: 'PDF',
                fileSize: 420000,
                fileUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
                isPublic: true,
              },
            ],
            [
              {
                id: certId,
                uid: account.uid,
                eventName: 'Seminar Nasional Transformasi Pendidikan Digital',
                organizer: 'Kemendikbudristek & Komunitas Penggerak',
                year: yearNow,
                description: 'Peserta aktif pelatihan integrasi portofolio digital dan asesmen autentik.',
                fileUrl: '/src/assets/images/gallery_seminar_event_1794813993737.jpg',
                isPublic: true,
              },
            ],
            [
              {
                id: achId,
                uid: account.uid,
                title: 'Penghargaan Inovasi Pembelajaran Digital Terbaik',
                level: 'Nasional',
                year: yearNow,
                description: 'Meraih apresiasi tingkat nasional atas pengembangan media belajar interaktif.',
                photoUrl: '/src/assets/images/gallery_award_ceremony_1794813992181.jpg',
                isPublic: true,
              },
            ],
            [
              {
                id: galId1,
                uid: account.uid,
                title: 'Seminar Pendidikan Nasional',
                album: 'Seminar & Pelatihan',
                year: yearNow,
                caption: 'Sesi pemaparan praktik baik transformasi digital.',
                imageUrl: '/src/assets/images/gallery_seminar_event_1794813993737.jpg',
                isPublic: true,
              },
              {
                id: galId2,
                uid: account.uid,
                title: 'Showcase Inovasi STEM',
                album: 'Karya Siswa',
                year: yearNow,
                caption: 'Demonstrasi prototipe robotik di laboratorium sekolah.',
                imageUrl: '/src/assets/images/gallery_student_project_1794813993139.jpg',
                isPublic: true,
              },
            ]
          );

          await writeAuditLog({
            uid: account.uid,
            userEmail: account.email,
            userName: profile.fullName,
            action: 'UPLOAD_FILE',
            module: 'Portofolio',
            detail: 'Mengisi contoh portofolio awal untuk dokumen, sertifikat, prestasi, dan galeri',
          });
          notify('success', 'Contoh data portofolio berhasil ditambahkan.');
        }}
        onLogout={async () => {
          await signOut(auth);
          notify('info', 'Anda telah keluar dari akun.');
        }}
        onNotify={notify}
      />
      <OfflineIndicator />
      <ToastContainer
        toasts={toasts}
        onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
      />
    </>
  );
}
