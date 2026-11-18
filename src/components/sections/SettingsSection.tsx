import React, { useState } from 'react';
import { updatePassword } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { exportBackupJSON, exportPortfolioToExcel } from '../../lib/exportUtils';
import type {
  Achievement,
  Activity,
  AuditLog,
  Certificate,
  GalleryItem,
  PortfolioDocument,
  UserProfile,
  UserSettings,
} from '../../types/portfolio';

interface SettingsSectionProps {
  settings: UserSettings;
  profile: UserProfile | null;
  documents: PortfolioDocument[];
  certificates: Certificate[];
  achievements: Achievement[];
  activities: Activity[];
  galleries: GalleryItem[];
  logs: AuditLog[];
  accountEmail?: string;
  emailVerified?: boolean;
  sendingVerify?: boolean;
  checkingVerify?: boolean;
  applyingManualLink?: boolean;
  verifyCooldown?: number;
  verifyFeedback?: { tone: 'success' | 'info' | 'error'; text: string } | null;
  onSendVerification?: () => Promise<void>;
  onCheckVerification?: () => Promise<void>;
  onApplyVerification?: (rawInput: string) => Promise<{ verified?: boolean; error?: string }>;
  onUpdateSettings: (patch: Partial<Omit<UserSettings, 'uid' | 'updatedAt'>>) => Promise<void>;
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({
  settings,
  profile,
  documents,
  certificates,
  achievements,
  activities,
  galleries,
  logs,
  accountEmail,
  emailVerified,
  sendingVerify = false,
  checkingVerify = false,
  applyingManualLink = false,
  verifyCooldown = 0,
  verifyFeedback = null,
  onSendVerification,
  onCheckVerification,
  onApplyVerification,
  onUpdateSettings,
  onNotify,
}) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updatingPwd, setUpdatingPwd] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [showManualBox, setShowManualBox] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      onNotify('error', 'Kata sandi baru minimal 6 karakter.');
      return;
    }
    if (newPassword !== confirmPassword) {
      onNotify('error', 'Konfirmasi kata sandi tidak cocok.');
      return;
    }
    const user = auth.currentUser;
    if (!user) return;
    setUpdatingPwd(true);
    try {
      await updatePassword(user, newPassword);
      setNewPassword('');
      setConfirmPassword('');
      onNotify('success', 'Kata sandi akun berhasil diperbarui.');
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/requires-recent-login') {
        onNotify(
          'info',
          'Untuk keamanan, silakan keluar lalu masuk kembali sebelum mengganti kata sandi.'
        );
      } else {
        onNotify('error', err instanceof Error ? err.message : 'Gagal mengubah kata sandi.');
      }
    } finally {
      setUpdatingPwd(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Left column: Appearance Preferences + Account Email Verification */}
      <div className="space-y-6">
        <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Tampilan & Notifikasi
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Sesuaikan tema antarmuka dan preferensi pemberitahuan portofolio Anda.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  Tema Aplikasi
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Pilih Mode Terang atau Mode Gelap yang nyaman di mata
                </p>
              </div>
              <div className="inline-flex rounded-xl bg-slate-100 p-1 shrink-0 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ theme: 'light' })}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                    settings.theme === 'light'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  Terang
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ theme: 'dark' })}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                    settings.theme === 'dark'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  Gelap
                </button>
              </div>
            </div>

            <label className="flex items-center justify-between rounded-xl border border-slate-200 p-4 cursor-pointer dark:border-slate-800">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  Notifikasi Email
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Terima ringkasan pembaruan akun dan keamanan
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.emailNotifications}
                onChange={(e) => onUpdateSettings({ emailNotifications: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-blue-600"
              />
            </label>

            <label className="flex items-center justify-between rounded-xl border border-slate-200 p-4 cursor-pointer dark:border-slate-800">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  Notifikasi Aktivitas
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Catat dan tampilkan umpan balik setiap unggahan berkas
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.activityAlerts}
                onChange={(e) => onUpdateSettings({ activityAlerts: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-blue-600"
              />
            </label>
          </div>
        </div>

        {/* Account Status & Optional Email Verification */}
        {accountEmail && (
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Status Akun & Verifikasi Email
                </h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 break-all">
                  Alamat email terdaftar: <strong className="text-slate-700 dark:text-slate-200">{accountEmail}</strong>
                </p>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
                  emailVerified
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                    : 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                }`}
              >
                <i
                  className={emailVerified ? 'fa-solid fa-circle-check' : 'fa-solid fa-circle-info'}
                  aria-hidden="true"
                />
                <span>{emailVerified ? 'Email Terverifikasi' : 'Opsional — Belum Terverifikasi'}</span>
              </span>
            </div>

            {emailVerified ? (
              <p className="rounded-xl bg-emerald-50/70 px-3.5 py-2.5 text-xs text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                Akun dan alamat email Anda sudah terverifikasi penuh. Seluruh fitur portofolio dapat digunakan tanpa batas.
              </p>
            ) : (
              <>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  Akun Anda <strong>sudah aktif</strong> untuk seluruh fitur portofolio. Verifikasi email bersifat opsional sebagai keamanan tambahan.
                  Jika memicu batas pengiriman Firebase (<code className="text-[11px]">too-many-requests</code>), tunggu hitungan mundur 2 menit sebelum mengirim ulang.
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  {onSendVerification && (
                    <button
                      type="button"
                      disabled={sendingVerify || verifyCooldown > 0}
                      onClick={onSendVerification}
                      className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                      {sendingVerify
                        ? 'Mengirim...'
                        : verifyCooldown > 0
                          ? `Tunggu ${verifyCooldown}d`
                          : 'Kirim Email Verifikasi'}
                    </button>
                  )}
                  {onCheckVerification && (
                    <button
                      type="button"
                      disabled={checkingVerify}
                      onClick={onCheckVerification}
                      className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      {checkingVerify ? 'Memeriksa...' : 'Cek Status'}
                    </button>
                  )}
                  {onApplyVerification && (
                    <button
                      type="button"
                      onClick={() => setShowManualBox((v) => !v)}
                      className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      {showManualBox ? 'Sembunyikan' : 'Tempel Tautan'}
                    </button>
                  )}
                </div>

                {verifyFeedback && (
                  <p
                    className={`rounded-xl px-3.5 py-2.5 text-xs leading-relaxed ${
                      verifyFeedback.tone === 'error'
                        ? 'bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200'
                        : verifyFeedback.tone === 'success'
                          ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                    }`}
                  >
                    {verifyFeedback.text}
                  </p>
                )}

                {showManualBox && onApplyVerification && (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const res = await onApplyVerification(manualInput);
                      if (res?.verified) {
                        setManualInput('');
                        setShowManualBox(false);
                      }
                    }}
                    className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3 dark:border-slate-800"
                  >
                    <input
                      type="text"
                      value={manualInput}
                      onChange={(e) => setManualInput(e.target.value)}
                      placeholder="Tempel tautan verifikasi (?mode=verifyEmail&oobCode=...)"
                      className="min-w-[220px] flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    />
                    <button
                      type="submit"
                      disabled={applyingManualLink || !manualInput.trim()}
                      className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-blue-600 dark:hover:bg-blue-700"
                    >
                      {applyingManualLink ? 'Mengaktifkan...' : 'Aktifkan'}
                    </button>
                  </form>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Password & Data Backup */}
      <div className="space-y-6">
        <form
          onSubmit={handlePasswordChange}
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 dark:border-slate-800 dark:bg-slate-900"
        >
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Ubah Kata Sandi</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Berlaku untuk akun yang masuk menggunakan Email & Kata Sandi.
            </p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Kata Sandi Baru
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Konfirmasi Kata Sandi Baru
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>
          <button
            type="submit"
            disabled={updatingPwd}
            className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {updatingPwd ? 'Memperbarui...' : 'Perbarui Kata Sandi'}
          </button>
        </form>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Backup Data Portofolio</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Unduh salinan lengkap seluruh profil, dokumen, sertifikat, prestasi, kegiatan, dan galeri Anda.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                exportBackupJSON(
                  {
                    exportedAt: new Date().toISOString(),
                    profile,
                    documents,
                    certificates,
                    achievements,
                    activities,
                    galleries,
                    logs,
                  },
                  profile?.username || 'portofolio'
                );
                onNotify('success', 'Backup JSON berhasil diunduh.');
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700"
            >
              <i className="fa-solid fa-database" aria-hidden="true" />
              <span>Unduh Backup JSON</span>
            </button>
            <button
              type="button"
              onClick={() => {
                exportPortfolioToExcel({
                  profile,
                  documents,
                  certificates,
                  achievements,
                  activities,
                  galleries,
                  logs,
                });
                onNotify('success', 'Export Excel (.xlsx) berhasil diunduh.');
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <i className="fa-solid fa-file-excel text-emerald-600" aria-hidden="true" />
              <span>Export Excel</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
