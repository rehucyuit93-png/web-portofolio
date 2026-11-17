import React, { useState } from 'react';
import {
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import {
  auth,
  formatAuthErrorMessage,
  getAuthProvidersUrl,
  getAuthorizedDomainsUrl,
  googleProvider,
  sendPasswordResetSafe,
  sendVerificationEmailSafe,
} from '../lib/firebase';
import { PWAInstallButton } from './PWAInstallButton';

interface AuthViewProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onOpenSamplePortfolio: (username: string) => void;
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
}

interface AuthErrorState {
  message: string;
  isUnauthorizedDomain?: boolean;
  isProviderDisabled?: boolean;
  domain?: string;
}

export const AuthView: React.FC<AuthViewProps> = ({
  theme,
  onToggleTheme,
  onOpenSamplePortfolio,
  onNotify,
}) => {
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'guru' | 'siswa'>('guru');
  const [nipNisn, setNipNisn] = useState('');
  const [jabatanKelas, setJabatanKelas] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<AuthErrorState | null>(null);
  const [publicSlugLookup, setPublicSlugLookup] = useState('');

  const handleCopyDomain = async (domain: string) => {
    try {
      await navigator.clipboard.writeText(domain);
      onNotify('success', `Domain "${domain}" disalin ke clipboard.`);
    } catch {
      onNotify('info', `Salin manual domain ini: ${domain}`);
    }
  };

  const renderAuthErrorBox = (errState: AuthErrorState) => (
    <div
      role="alert"
      className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs leading-relaxed text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/50 dark:text-rose-200"
    >
      <p>{errState.message}</p>
      {errState.isUnauthorizedDomain && (
        <div className="mt-2.5 space-y-2">
          <p className="text-[11px] text-rose-700 dark:text-rose-300">
            Catatan: Login & Daftar menggunakan <strong>Email & Kata Sandi</strong> di atas tetap dapat langsung digunakan tanpa perlu menunggu pengaturan domain.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {errState.domain && (
              <button
                type="button"
                onClick={() => handleCopyDomain(errState.domain!)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-2.5 py-1 font-mono-tabular font-semibold text-rose-900 hover:bg-rose-100 dark:border-rose-800 dark:bg-slate-900 dark:text-rose-100"
              >
                <i className="fa-solid fa-copy text-[10px]" aria-hidden="true" />
                <span>Salin: {errState.domain}</span>
              </button>
            )}
            <a
              href={getAuthorizedDomainsUrl()}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 font-semibold underline hover:text-rose-950 dark:hover:text-white"
            >
              <span>Buka Firebase Console → Authorized domains</span>
              <i className="fa-solid fa-arrow-up-right-from-square text-[10px]" aria-hidden="true" />
            </a>
          </div>
        </div>
      )}
      {errState.isProviderDisabled && (
        <a
          href={getAuthProvidersUrl()}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1.5 font-semibold underline hover:text-rose-950 dark:hover:text-white"
        >
          <span>Buka Firebase Console → Sign-in method</span>
          <i className="fa-solid fa-arrow-up-right-from-square text-[10px]" aria-hidden="true" />
        </a>
      )}
    </div>
  );

  const handleGoogleLogin = async () => {
    setAuthError(null);
    setLoading(true);
    try {
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      await signInWithPopup(auth, googleProvider);
      onNotify('success', 'Berhasil masuk dengan akun Google.');
    } catch (err: unknown) {
      const formatted = formatAuthErrorMessage(err);
      setAuthError(formatted);
      onNotify('error', formatted.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setLoading(true);

    try {
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);

      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email.trim(), password);
        onNotify('success', 'Selamat datang kembali di KaryaLoka.');
      } else if (mode === 'register') {
        if (!fullName.trim()) {
          throw new Error('Nama lengkap wajib diisi.');
        }
        const pendingReg = JSON.stringify({
          fullName: fullName.trim(),
          role,
          nipNisn: nipNisn.trim(),
          jabatanKelas: jabatanKelas.trim(),
        });
        const normalizedEmail = email.trim().toLowerCase();
        localStorage.setItem(`pending_reg_email_${normalizedEmail}`, pendingReg);
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        localStorage.setItem(`pending_reg_${cred.user.uid}`, pendingReg);
        await updateProfile(cred.user, { displayName: fullName.trim() });
        // Send verification email in background without blocking dashboard access
        sendVerificationEmailSafe(cred.user)
          .then((res) => {
            if (!res.alreadyVerified) {
              localStorage.setItem(`verify_sent_${cred.user.uid}`, String(Date.now()));
            }
          })
          .catch(() => undefined);
        onNotify('success', 'Akun berhasil dibuat! Membuka dashboard portofolio Anda...');
      } else if (mode === 'reset') {
        await sendPasswordResetSafe(email.trim());
        onNotify('success', 'Tautan reset password telah dikirim ke alamat email Anda.');
        setMode('login');
      }
    } catch (err: unknown) {
      const formatted = formatAuthErrorMessage(err);
      setAuthError(formatted);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* 3-Zone Top Bar Contract */}
      <header className="glass-surface sticky top-0 z-30 border-b border-slate-200/80 dark:border-slate-800/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-4 py-3.5 sm:px-6 lg:px-8">
          <a
            href="/"
            className="text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0"
          >
            KaryaLoka
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
            <a href="#fitur" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors whitespace-nowrap shrink-0">
              Fitur Utama
            </a>
            <a href="#cv-otomatis" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors whitespace-nowrap shrink-0">
              CV Otomatis
            </a>
            <a href="#portofolio-publik" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors whitespace-nowrap shrink-0">
              Portofolio Publik
            </a>
            <button
              type="button"
              onClick={onToggleTheme}
              className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors whitespace-nowrap shrink-0"
            >
              {theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}
            </button>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <PWAInstallButton compact />
            <a
              href="#akses-akun"
              className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700 whitespace-nowrap shrink-0"
            >
              Masuk Dashboard
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        {/* Hero Split */}
        <div className="grid grid-cols-1 items-stretch gap-8 lg:grid-cols-12">
          {/* Left editorial column */}
          <div className="flex flex-col justify-between gap-8 lg:col-span-7">
            <div>
              <p className="text-xs font-semibold tracking-wide text-blue-600 dark:text-blue-400">
                Portofolio Digital Modern · Guru, Siswa & Profesional
              </p>
              <h1
                className="mt-3 max-w-2xl text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl dark:text-white"
                style={{ textWrap: 'balance' }}
              >
                Arsip karya, sertifikat, prestasi, dan CV profesional dalam satu ruang terpadu.
              </h1>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600 dark:text-slate-300">
                Simpan dokumen pengajaran, bukti prestasi, galeri kegiatan, hasilkan CV otomatis siap cetak
                (Modern & ATS), serta bagikan halaman portofolio publik lengkap dengan QR Code.
              </p>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <img
                src="/src/assets/images/hero_portfolio_workspace_1794813989980.jpg"
                alt="Ruang kerja portofolio digital modern"
                referrerPolicy="no-referrer"
                className="aspect-video w-full object-cover"
              />
            </div>
          </div>

          {/* Right auth card */}
          <div id="akses-akun" className="lg:col-span-5 flex flex-col">
            <div className="glass-panel flex-1 rounded-2xl border border-slate-200 p-6 shadow-sm sm:p-8 dark:border-slate-800">
              <>
                  <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-4 dark:border-slate-800">
                    <div>
                      <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                        {mode === 'login'
                          ? 'Masuk ke Portofolio'
                          : mode === 'register'
                            ? 'Daftar Akun Baru'
                            : 'Reset Kata Sandi'}
                      </h2>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {mode === 'login'
                          ? 'Akses dashboard Guru, Siswa, atau Admin'
                          : mode === 'register'
                            ? 'Buat portofolio digital terverifikasi'
                            : 'Kami akan mengirim tautan pemulihan ke email Anda'}
                      </p>
                    </div>
                  </div>

                  {/* Mode segmented switcher */}
                  <div className="mt-5 grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setMode('login');
                        setAuthError(null);
                      }}
                      className={`rounded-lg py-2 text-xs font-semibold transition-colors ${
                        mode === 'login'
                          ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
                          : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                      }`}
                    >
                      Masuk
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('register');
                        setAuthError(null);
                      }}
                      className={`rounded-lg py-2 text-xs font-semibold transition-colors ${
                        mode === 'register'
                          ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
                          : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                      }`}
                    >
                      Daftar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('reset');
                        setAuthError(null);
                      }}
                      className={`rounded-lg py-2 text-xs font-semibold transition-colors ${
                        mode === 'reset'
                          ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
                          : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                      }`}
                    >
                      Reset
                    </button>
                  </div>

                  {authError && renderAuthErrorBox(authError)}

                  <form onSubmit={handleEmailAuth} className="mt-5 space-y-4">
                    {mode === 'register' && (
                      <>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                            Nama Lengkap
                          </label>
                          <input
                            type="text"
                            required
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="Contoh: Dr. Budi Santoso, M.Pd."
                            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                              Peran Akun
                            </label>
                            <select
                              value={role}
                              onChange={(e) => setRole(e.target.value as 'guru' | 'siswa')}
                              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                            >
                              <option value="guru">Guru / Tendik / Pro</option>
                              <option value="siswa">Siswa / Mahasiswa</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                              NIP / NISN
                            </label>
                            <input
                              type="text"
                              value={nipNisn}
                              onChange={(e) => setNipNisn(e.target.value)}
                              placeholder="19850101..."
                              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                            Jabatan / Kelas
                          </label>
                          <input
                            type="text"
                            value={jabatanKelas}
                            onChange={(e) => setJabatanKelas(e.target.value)}
                            placeholder="Guru Matematika / XII IPA 1"
                            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                          />
                        </div>
                      </>
                    )}

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Alamat Email
                      </label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="nama@instansi.sch.id"
                        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                      />
                    </div>

                    {mode !== 'reset' && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Kata Sandi
                        </label>
                        <input
                          type="password"
                          required
                          minLength={6}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Minimal 6 karakter"
                          className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                        />
                      </div>
                    )}

                    {mode === 'login' && (
                      <div className="flex items-center justify-between text-xs">
                        <label className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={rememberMe}
                            onChange={(e) => setRememberMe(e.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span>Ingat Saya (Remember Me)</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setMode('reset')}
                          className="font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
                        >
                          Lupa kata sandi?
                        </button>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
                    >
                      {loading
                        ? 'Memproses...'
                        : mode === 'login'
                          ? 'Masuk dengan Email'
                          : mode === 'register'
                            ? 'Buat Akun Sekarang'
                            : 'Kirim Tautan Reset Password'}
                    </button>
                  </form>

                  <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
                    <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                    <span>atau lanjutkan dengan</span>
                    <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                  </div>

                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleGoogleLogin}
                    className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800"
                  >
                    <i className="fa-brands fa-google text-blue-600 dark:text-blue-400" aria-hidden="true" />
                    <span>Login dengan Google</span>
                  </button>
                </>
            </div>
          </div>
        </div>

        {/* Full-width capability strip below hero split */}
        <section id="fitur" className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <i className="fa-solid fa-folder-open text-lg text-blue-600 dark:text-blue-400" aria-hidden="true" />
            <h3 className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
              Repositori Dokumen Cloud
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              Unggah PDF, DOCX, PPT, XLSX, JPG, dan PNG dengan pratinjau instan dan filter tahun.
            </p>
          </div>
          <div id="cv-otomatis" className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <i className="fa-solid fa-file-pdf text-lg text-violet-600 dark:text-violet-400" aria-hidden="true" />
            <h3 className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
              Generator CV Otomatis
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              Susun CV Modern atau ATS-Friendly otomatis dari profil, prestasi, dan sertifikat Anda.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <i className="fa-solid fa-qrcode text-lg text-blue-600 dark:text-blue-400" aria-hidden="true" />
            <h3 className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
              QR Code & Portofolio Publik
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              Tautan khusus /portfolio/username siap dibagikan ke WhatsApp, Telegram, dan QR cetak.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <i className="fa-solid fa-shield-halved text-lg text-violet-600 dark:text-violet-400" aria-hidden="true" />
            <h3 className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
              Mode Offline & PWA
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              Dapat diinstal di laptop maupun ponsel dengan cache offline untuk akses cepat.
            </p>
          </div>
        </section>

        {/* Public portfolio lookup */}
        <section
          id="portofolio-publik"
          className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Cari Portofolio Publik Pengguna
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Masukkan username portofolio publik untuk membuka halaman /portfolio/username secara langsung.
              </p>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (publicSlugLookup.trim()) {
                  onOpenSamplePortfolio(publicSlugLookup.trim().toLowerCase());
                }
              }}
              className="flex w-full max-w-md items-center gap-2"
            >
              <input
                type="text"
                value={publicSlugLookup}
                onChange={(e) => setPublicSlugLookup(e.target.value)}
                placeholder="Contoh: budi-santoso-a1b2c3"
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
              <button
                type="submit"
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700 whitespace-nowrap shrink-0"
              >
                Buka Portofolio
              </button>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
};
