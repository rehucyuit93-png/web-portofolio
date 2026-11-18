import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
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
} from '../types/portfolio';
import { PWAInstallButton } from './PWAInstallButton';
import { DashboardOverviewSection } from './sections/DashboardOverviewSection';
import { ProfileSection } from './sections/ProfileSection';
import { DocumentsSection } from './sections/DocumentsSection';
import { CertificatesSection } from './sections/CertificatesSection';
import { AchievementsSection, ActivitiesSection } from './sections/AchievementsActivitiesSection';
import { GallerySection } from './sections/GallerySection';
import { CVGeneratorSection } from './sections/CVGeneratorSection';
import { ActivityLogsSection } from './sections/ActivityLogsSection';
import { SettingsSection } from './sections/SettingsSection';
import { AdminDashboardSection } from './sections/AdminDashboardSection';

interface DashboardShellProps {
  account: UserAccount;
  profile: UserProfile;
  settings: UserSettings;
  documents: PortfolioDocument[];
  certificates: Certificate[];
  achievements: Achievement[];
  activities: Activity[];
  galleries: GalleryItem[];
  logs: AuditLog[];
  activeSection: DashboardSection;
  onSelectSection: (section: DashboardSection) => void;
  onSaveProfile: (data: Omit<UserProfile, 'uid' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onCreateDocument: (data: Omit<PortfolioDocument, 'id' | 'uid' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onUpdateDocument: (id: string, data: Partial<PortfolioDocument>) => Promise<void>;
  onDeleteDocument: (item: PortfolioDocument) => Promise<void>;
  onCreateCertificate: (data: Omit<Certificate, 'id' | 'uid' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onUpdateCertificate: (id: string, data: Partial<Certificate>) => Promise<void>;
  onDeleteCertificate: (item: Certificate) => Promise<void>;
  onCreateAchievement: (data: Omit<Achievement, 'id' | 'uid' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onUpdateAchievement: (id: string, data: Partial<Achievement>) => Promise<void>;
  onDeleteAchievement: (item: Achievement) => Promise<void>;
  onCreateActivity: (data: Omit<Activity, 'id' | 'uid' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onUpdateActivity: (id: string, data: Partial<Activity>) => Promise<void>;
  onDeleteActivity: (item: Activity) => Promise<void>;
  onCreateGallery: (data: Omit<GalleryItem, 'id' | 'uid' | 'createdAt'>) => Promise<void>;
  onDeleteGallery: (item: GalleryItem) => Promise<void>;
  onUpdateSettings: (patch: Partial<Omit<UserSettings, 'uid' | 'updatedAt'>>) => Promise<void>;
  onOpenPublicPortfolio: () => void;
  onSeedSampleData: () => Promise<void>;
  onLogout: () => Promise<void>;
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
  emailVerified?: boolean;
  onSendVerificationEmail?: () => Promise<{
    sent: boolean;
    alreadyVerified?: boolean;
    usedFallbackDomain?: boolean;
    rateLimited?: boolean;
    error?: string;
  }>;
  onRefreshVerification?: () => Promise<{ verified: boolean; error?: string }>;
  onApplyVerificationLink?: (linkOrCode: string) => Promise<{ verified: boolean; error?: string }>;
}

const MENU_ITEMS: Array<{ id: DashboardSection; label: string; icon: string }> = [
  { id: 'dashboard', label: 'Dashboard', icon: 'fa-solid fa-grid-2' },
  { id: 'profile', label: 'Profil Saya', icon: 'fa-solid fa-user' },
  { id: 'documents', label: 'Dokumen Portofolio', icon: 'fa-solid fa-folder-open' },
  { id: 'certificates', label: 'Sertifikat', icon: 'fa-solid fa-certificate' },
  { id: 'achievements', label: 'Prestasi', icon: 'fa-solid fa-trophy' },
  { id: 'activities', label: 'Kegiatan', icon: 'fa-solid fa-calendar-check' },
  { id: 'gallery', label: 'Galeri Foto', icon: 'fa-solid fa-images' },
  { id: 'cv', label: 'CV Otomatis', icon: 'fa-solid fa-file-invoice' },
  { id: 'logs', label: 'Riwayat Aktivitas', icon: 'fa-solid fa-clock-rotate-left' },
  { id: 'settings', label: 'Pengaturan', icon: 'fa-solid fa-gear' },
];

export const DashboardShell: React.FC<DashboardShellProps> = (props) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dismissedVerifyBanner, setDismissedVerifyBanner] = useState<boolean>(
    () => localStorage.getItem(`verify_banner_dismissed_${props.account.uid}`) === '1'
  );
  const [sendingVerify, setSendingVerify] = useState(false);
  const [checkingVerify, setCheckingVerify] = useState(false);
  const [verifyCooldown, setVerifyCooldown] = useState<number>(() => {
    const untilRaw = localStorage.getItem(`verify_cooldown_until_${props.account.uid}`);
    if (untilRaw) {
      const remaining = Math.ceil((Number(untilRaw) - Date.now()) / 1000);
      return remaining > 0 ? remaining : 0;
    }
    const sentRaw = localStorage.getItem(`verify_sent_${props.account.uid}`);
    if (!sentRaw) return 0;
    const elapsed = Math.floor((Date.now() - Number(sentRaw)) / 1000);
    return elapsed >= 0 && elapsed < 90 ? 90 - elapsed : 0;
  });
  const [verifyFeedback, setVerifyFeedback] = useState<{
    tone: 'success' | 'info' | 'error';
    text: string;
  } | null>(() => {
    const raw = localStorage.getItem(`verify_sent_${props.account.uid}`);
    if (!raw) return null;
    return {
      tone: 'info',
      text: `Email aktivasi sudah dikirim ke ${props.account.email}. Periksa Kotak Masuk, folder Spam, atau Promosi dari noreply@gen-lang-client-0131469651.firebaseapp.com.`,
    };
  });
  const [showManualLinkBox, setShowManualLinkBox] = useState(false);
  const [manualActivationInput, setManualActivationInput] = useState('');
  const [applyingManualLink, setApplyingManualLink] = useState(false);

  useEffect(() => {
    if (verifyCooldown <= 0) return;
    const timer = setInterval(() => {
      const untilRaw = localStorage.getItem(`verify_cooldown_until_${props.account.uid}`);
      if (untilRaw) {
        const remaining = Math.ceil((Number(untilRaw) - Date.now()) / 1000);
        setVerifyCooldown(remaining > 0 ? remaining : 0);
      } else {
        setVerifyCooldown((c) => (c > 0 ? c - 1 : 0));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [verifyCooldown, props.account.uid]);

  const handleSendVerification = async () => {
    if (!props.onSendVerificationEmail || sendingVerify || verifyCooldown > 0) return;
    setSendingVerify(true);
    try {
      const res = await props.onSendVerificationEmail();
      if (res?.alreadyVerified) {
        setVerifyFeedback({
          tone: 'success',
          text: 'Email Anda ternyata sudah terverifikasi!',
        });
      } else if (res?.sent) {
        const until = Date.now() + 90_000;
        localStorage.setItem(`verify_cooldown_until_${props.account.uid}`, String(until));
        setVerifyCooldown(90);
        setVerifyFeedback({
          tone: 'success',
          text: `Email verifikasi berhasil dikirim ke ${props.account.email}. Cek Kotak Masuk, folder Spam, atau tab Promosi, lalu klik tautannya. Status akan otomatis diperbarui.`,
        });
      } else if (res?.rateLimited) {
        const until = Date.now() + 120_000;
        localStorage.setItem(`verify_cooldown_until_${props.account.uid}`, String(until));
        setVerifyCooldown(120);
        setVerifyFeedback({
          tone: 'error',
          text:
            res.error ||
            'Terlalu banyak permintaan pengiriman email dalam waktu singkat. Tunggu hitungan mundur selesai (2 menit) sebelum meminta ulang, dan cek folder Spam/Promosi untuk email sebelumnya.',
        });
      } else if (res?.error) {
        setVerifyFeedback({
          tone: 'error',
          text: res.error,
        });
      }
    } finally {
      setSendingVerify(false);
    }
  };

  const handleCheckVerification = async () => {
    if (!props.onRefreshVerification || checkingVerify) return;
    setCheckingVerify(true);
    try {
      const res = await props.onRefreshVerification();
      if (res && !res.verified) {
        setVerifyFeedback({
          tone: res.error ? 'error' : 'info',
          text:
            res.error ||
            'Status masih belum terverifikasi. Pastikan Anda sudah mengeklik tautan aktivasi di email (cek juga folder Spam/Promosi), lalu klik Cek Status lagi.',
        });
      }
    } finally {
      setCheckingVerify(false);
    }
  };

  const handleApplyVerification = async (rawInput: string) => {
    if (!props.onApplyVerificationLink) return { verified: false };
    setApplyingManualLink(true);
    try {
      const res = await props.onApplyVerificationLink(rawInput);
      if (res?.error) {
        setVerifyFeedback({ tone: 'error', text: res.error });
      } else if (res?.verified) {
        setManualActivationInput('');
        setShowManualLinkBox(false);
      }
      return res;
    } finally {
      setApplyingManualLink(false);
    }
  };

  const activeLabel =
    props.activeSection === 'admin'
      ? 'Dashboard Admin'
      : MENU_ITEMS.find((m) => m.id === props.activeSection)?.label || 'Dashboard';

  const handleNav = (section: DashboardSection) => {
    props.onSelectSection(section);
    setSidebarOpen(false);
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          className="no-print fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-xs lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`no-print fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:static lg:translate-x-0 dark:border-slate-800 dark:bg-slate-900 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 text-white">
              <i className="fa-solid fa-layer-group text-xs" aria-hidden="true" />
            </div>
            <span className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
              KaryaLoka
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 lg:hidden dark:hover:bg-slate-800"
            aria-label="Tutup menu"
          >
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {MENU_ITEMS.map((item) => {
            const active = props.activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-xs font-semibold transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                }`}
              >
                <i
                  className={`${item.icon === 'fa-solid fa-grid-2' ? 'fa-solid fa-table-columns' : item.icon} w-4 text-center`}
                  aria-hidden="true"
                />
                <span>{item.label}</span>
              </button>
            );
          })}

          {props.account.role === 'admin' && (
            <div className="pt-3 mt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => handleNav('admin')}
                className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-xs font-semibold transition-colors whitespace-nowrap ${
                  props.activeSection === 'admin'
                    ? 'bg-violet-600 text-white'
                    : 'text-violet-700 hover:bg-violet-50 dark:text-violet-300 dark:hover:bg-violet-950/50'
                }`}
              >
                <i className="fa-solid fa-shield-halved w-4 text-center" aria-hidden="true" />
                <span>Dashboard Admin</span>
              </button>
            </div>
          )}
        </nav>

        <div className="border-t border-slate-200 p-3 space-y-2 dark:border-slate-800">
          <button
            type="button"
            onClick={props.onOpenPublicPortfolio}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <i className="fa-solid fa-globe" aria-hidden="true" />
            <span>Portofolio Publik</span>
          </button>
          <button
            type="button"
            onClick={props.onLogout}
            className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
          >
            <i className="fa-solid fa-right-from-bracket" aria-hidden="true" />
            <span>Keluar</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Header */}
        <header className="no-print glass-surface sticky top-0 z-30 border-b border-slate-200/80 dark:border-slate-800/80">
          <div className="flex items-center justify-between gap-2 px-3 py-2.5 sm:gap-4 sm:px-6 sm:py-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 lg:hidden dark:border-slate-700 dark:text-slate-300 shrink-0"
                aria-label="Buka menu navigasi"
              >
                <i className="fa-solid fa-bars" aria-hidden="true" />
              </button>
              <div className="flex items-center gap-2 text-sm min-w-0">
                <span className="hidden text-slate-400 sm:inline">KaryaLoka</span>
                <span className="hidden text-slate-300 sm:inline dark:text-slate-600">/</span>
                <h2 className="truncate font-bold text-slate-900 dark:text-white">{activeLabel}</h2>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <PWAInstallButton compact />

              <button
                type="button"
                onClick={() =>
                  props.onUpdateSettings({
                    theme: props.settings.theme === 'dark' ? 'light' : 'dark',
                  })
                }
                title={props.settings.theme === 'dark' ? 'Ganti ke Mode Terang' : 'Ganti ke Mode Gelap'}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                aria-label="Ganti tema"
              >
                <i
                  className={props.settings.theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon'}
                  aria-hidden="true"
                />
              </button>

              <button
                type="button"
                onClick={() => handleNav('profile')}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white py-1 pr-2.5 pl-1 text-xs font-semibold text-slate-800 hover:bg-slate-50 sm:pr-3 sm:pl-1.5 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                aria-label="Buka profil saya"
              >
                <img
                  src={
                    props.profile.photoURL ||
                    props.account.photoURL ||
                    '/src/assets/images/avatar_educator_default_1794813989923.jpg'
                  }
                  alt={props.profile.fullName}
                  referrerPolicy="no-referrer"
                  className="h-8 w-8 rounded-lg bg-slate-100 object-contain p-0.5 dark:bg-slate-900"
                />
                <span className="hidden max-w-[130px] truncate sm:inline">
                  {props.profile.fullName}
                </span>
              </button>
            </div>
          </div>
        </header>

        {/* Viewport */}
        <main className="mx-auto w-full max-w-7xl flex-1 p-3.5 pb-24 sm:p-6 lg:pb-8">
          {props.emailVerified === false && !dismissedVerifyBanner && (
            <div className="no-print mb-5 rounded-2xl border border-amber-200 bg-amber-50/90 p-3.5 text-xs text-amber-900 sm:px-4 sm:py-3 dark:border-amber-900/60 dark:bg-amber-950/50 dark:text-amber-200">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div className="flex items-start gap-2.5 min-w-0">
                  <i className="fa-solid fa-envelope-open-text mt-0.5 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="break-words leading-relaxed">
                      Akun Anda sudah aktif untuk seluruh fitur portofolio. Untuk verifikasi alamat email{' '}
                      <strong className="break-all">{props.account.email}</strong> (opsional), kirim tautan verifikasi lalu klik tautan dari{' '}
                      <span className="font-mono-tabular break-all font-semibold">noreply@gen-lang-client-0131469651.firebaseapp.com</span>.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {props.onSendVerificationEmail && (
                    <button
                      type="button"
                      disabled={sendingVerify || verifyCooldown > 0}
                      onClick={handleSendVerification}
                      className="rounded-lg bg-amber-600 px-3 py-1.5 font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
                    >
                      {sendingVerify
                        ? 'Mengirim...'
                        : verifyCooldown > 0
                          ? `Tunggu ${verifyCooldown}d`
                          : 'Kirim Email Verifikasi'}
                    </button>
                  )}
                  {props.onRefreshVerification && (
                    <button
                      type="button"
                      disabled={checkingVerify}
                      onClick={handleCheckVerification}
                      className="rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-60 dark:border-amber-800 dark:bg-slate-900 dark:text-amber-100"
                    >
                      {checkingVerify ? 'Memeriksa...' : 'Cek Status'}
                    </button>
                  )}
                  {props.onApplyVerificationLink && (
                    <button
                      type="button"
                      onClick={() => setShowManualLinkBox((v) => !v)}
                      className="rounded-lg border border-amber-300/80 px-2.5 py-1.5 font-semibold text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:text-amber-200 dark:hover:bg-amber-900/40"
                    >
                      {showManualLinkBox ? 'Sembunyikan' : 'Tempel Tautan'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.setItem(`verify_banner_dismissed_${props.account.uid}`, '1');
                      setDismissedVerifyBanner(true);
                      props.onNotify(
                        'info',
                        'Pemberitahuan verifikasi disembunyikan. Opsi verifikasi tetap tersedia di menu Pengaturan.'
                      );
                    }}
                    className="rounded-lg px-2 py-1.5 font-medium text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/50"
                    aria-label="Tutup pemberitahuan"
                  >
                    Tutup
                  </button>
                </div>
              </div>

              {verifyFeedback && (
                <p
                  className={`mt-2.5 rounded-xl px-3 py-2 text-[11px] leading-relaxed ${
                    verifyFeedback.tone === 'error'
                      ? 'bg-rose-100 text-rose-900 dark:bg-rose-950/70 dark:text-rose-200'
                      : verifyFeedback.tone === 'success'
                        ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/70 dark:text-emerald-200'
                        : 'bg-amber-100/80 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100'
                  }`}
                >
                  {verifyFeedback.text}
                </p>
              )}

              {showManualLinkBox && props.onApplyVerificationLink && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await handleApplyVerification(manualActivationInput);
                  }}
                  className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-amber-200/80 pt-2.5 dark:border-amber-800/60"
                >
                  <input
                    type="text"
                    value={manualActivationInput}
                    onChange={(e) => setManualActivationInput(e.target.value)}
                    placeholder="Tempel tautan verifikasi dari email (yang berisi ?mode=verifyEmail&oobCode=...)"
                    className="min-w-[240px] flex-1 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-600 dark:border-amber-800 dark:bg-slate-900 dark:text-slate-100"
                  />
                  <button
                    type="submit"
                    disabled={applyingManualLink || !manualActivationInput.trim()}
                    className="rounded-lg bg-blue-600 px-3 py-1.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    {applyingManualLink ? 'Mengaktifkan...' : 'Aktifkan Sekarang'}
                  </button>
                </form>
              )}
            </div>
          )}
          <motion.div
            key={props.activeSection}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          >
            {props.activeSection === 'dashboard' && (
              <DashboardOverviewSection
                account={props.account}
                profile={props.profile}
                documents={props.documents}
                certificates={props.certificates}
                achievements={props.achievements}
                activities={props.activities}
                galleries={props.galleries}
                logs={props.logs}
                onNavigate={handleNav}
                onOpenPublicPortfolio={props.onOpenPublicPortfolio}
                onSeedSampleData={props.onSeedSampleData}
                onNotify={props.onNotify}
              />
            )}

            {props.activeSection === 'profile' && (
              <ProfileSection
                uid={props.account.uid}
                profile={props.profile}
                onSaveProfile={props.onSaveProfile}
                onNotify={props.onNotify}
              />
            )}

            {props.activeSection === 'documents' && (
              <DocumentsSection
                uid={props.account.uid}
                documents={props.documents}
                onCreate={props.onCreateDocument}
                onUpdate={props.onUpdateDocument}
                onDelete={props.onDeleteDocument}
                onNotify={props.onNotify}
              />
            )}

            {props.activeSection === 'certificates' && (
              <CertificatesSection
                uid={props.account.uid}
                certificates={props.certificates}
                onCreate={props.onCreateCertificate}
                onUpdate={props.onUpdateCertificate}
                onDelete={props.onDeleteCertificate}
                onNotify={props.onNotify}
              />
            )}

            {props.activeSection === 'achievements' && (
              <AchievementsSection
                uid={props.account.uid}
                achievements={props.achievements}
                onCreate={props.onCreateAchievement}
                onUpdate={props.onUpdateAchievement}
                onDelete={props.onDeleteAchievement}
                onNotify={props.onNotify}
              />
            )}

            {props.activeSection === 'activities' && (
              <ActivitiesSection
                uid={props.account.uid}
                activities={props.activities}
                onCreate={props.onCreateActivity}
                onUpdate={props.onUpdateActivity}
                onDelete={props.onDeleteActivity}
                onNotify={props.onNotify}
              />
            )}

            {props.activeSection === 'gallery' && (
              <GallerySection
                uid={props.account.uid}
                galleries={props.galleries}
                onCreate={props.onCreateGallery}
                onDelete={props.onDeleteGallery}
                onNotify={props.onNotify}
              />
            )}

            {props.activeSection === 'cv' && (
              <CVGeneratorSection
                profile={props.profile}
                documents={props.documents}
                certificates={props.certificates}
                achievements={props.achievements}
                activities={props.activities}
                defaultTemplate={props.settings.cvTemplate}
                onSaveTemplatePreference={(cvTemplate) =>
                  props.onUpdateSettings({ cvTemplate })
                }
                onNotify={props.onNotify}
              />
            )}

            {props.activeSection === 'logs' && <ActivityLogsSection logs={props.logs} />}

            {props.activeSection === 'settings' && (
              <SettingsSection
                settings={props.settings}
                profile={props.profile}
                documents={props.documents}
                certificates={props.certificates}
                achievements={props.achievements}
                activities={props.activities}
                galleries={props.galleries}
                logs={props.logs}
                accountEmail={props.account.email}
                emailVerified={props.emailVerified}
                sendingVerify={sendingVerify}
                checkingVerify={checkingVerify}
                applyingManualLink={applyingManualLink}
                verifyCooldown={verifyCooldown}
                verifyFeedback={verifyFeedback}
                onSendVerification={props.onSendVerificationEmail ? handleSendVerification : undefined}
                onCheckVerification={props.onRefreshVerification ? handleCheckVerification : undefined}
                onApplyVerification={props.onApplyVerificationLink ? handleApplyVerification : undefined}
                onUpdateSettings={props.onUpdateSettings}
                onNotify={props.onNotify}
              />
            )}

            {props.activeSection === 'admin' && props.account.role === 'admin' && (
              <AdminDashboardSection
                adminAccount={props.account}
                onNotify={props.onNotify}
              />
            )}
          </motion.div>
        </main>

        {/* Mobile Bottom Thumb Navigation Bar */}
        <nav
          aria-label="Navigasi cepat mobile"
          className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/90 bg-white/95 pb-safe backdrop-blur-md lg:hidden dark:border-slate-800 dark:bg-slate-900/95"
        >
          <div className="grid h-14 grid-cols-5 items-center">
            {[
              { id: 'dashboard' as const, label: 'Beranda', icon: 'fa-solid fa-table-columns' },
              { id: 'certificates' as const, label: 'Sertifikat', icon: 'fa-solid fa-certificate' },
              { id: 'documents' as const, label: 'Dokumen', icon: 'fa-solid fa-folder-open' },
              { id: 'profile' as const, label: 'Profil', icon: 'fa-solid fa-user' },
            ].map((tab) => {
              const isActive = props.activeSection === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleNav(tab.id)}
                  className={`flex h-full flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors ${
                    isActive
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  <i className={`${tab.icon} text-base`} aria-hidden="true" />
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="flex h-full flex-col items-center justify-center gap-0.5 text-[10px] font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            >
              <i className="fa-solid fa-bars text-base" aria-hidden="true" />
              <span>Menu</span>
            </button>
          </div>
        </nav>
      </div>
    </div>
  );
};
