import React, { useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { computeProfileCompleteness } from '../../lib/portfolioService';
import { exportCVToPDF, exportPortfolioToExcel } from '../../lib/exportUtils';
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
} from '../../types/portfolio';

interface DashboardOverviewProps {
  account: UserAccount;
  profile: UserProfile | null;
  documents: PortfolioDocument[];
  certificates: Certificate[];
  achievements: Achievement[];
  activities: Activity[];
  galleries: GalleryItem[];
  logs: AuditLog[];
  onNavigate: (section: DashboardSection) => void;
  onOpenPublicPortfolio: () => void;
  onSeedSampleData: () => Promise<void>;
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const DashboardOverviewSection: React.FC<DashboardOverviewProps> = ({
  account,
  profile,
  documents,
  certificates,
  achievements,
  activities,
  galleries,
  logs,
  onNavigate,
  onOpenPublicPortfolio,
  onSeedSampleData,
  onNotify,
}) => {
  const [seeding, setSeeding] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  const completeness = computeProfileCompleteness(profile);
  const username = profile?.username || account.username;
  const publicUrl = `${window.location.origin}/portfolio/${username}`;

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      onNotify('success', 'Tautan portofolio publik disalin.');
    } catch {
      onNotify('error', 'Gagal menyalin tautan.');
    }
  };

  const handleDownloadQR = () => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `qr-${username}.png`;
    a.click();
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await onSeedSampleData();
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Identity & Completeness Hero Card */}
      <section className="glass-panel rounded-2xl border border-slate-200 p-4 sm:p-6 dark:border-slate-800">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <img
              src={
                profile?.photoURL ||
                account.photoURL ||
                '/src/assets/images/avatar_educator_default_1794813989923.jpg'
              }
              alt={profile?.fullName || account.displayName}
              referrerPolicy="no-referrer"
              className="h-24 w-24 shrink-0 rounded-2xl border border-slate-200 bg-slate-100 object-contain p-1 sm:h-28 sm:w-28 dark:border-slate-700 dark:bg-slate-800"
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="font-semibold text-blue-600 capitalize dark:text-blue-400">
                  {account.role}
                </span>
                {(profile?.nipNisn || account.nipNisn) && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-tabular">
                      NIP/NISN: {profile?.nipNisn || account.nipNisn}
                    </span>
                  </>
                )}
              </div>
              <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-white">
                {profile?.fullName || account.displayName}
              </h1>
              <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
                {profile?.jabatanKelas || account.jabatanKelas || 'Lengkapi jabatan atau kelas pada Profil Saya'}
              </p>
            </div>
          </div>

          {/* Completeness meter & actions */}
          <div className="flex flex-col gap-3 sm:min-w-[280px]">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-600 dark:text-slate-300">
                Kelengkapan Profil
              </span>
              <span className="font-mono-tabular font-bold text-blue-600 dark:text-blue-400">
                {completeness}%
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-600 to-violet-600 transition-all duration-300"
                style={{ width: `${completeness}%` }}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => onNavigate('profile')}
                className="rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
              >
                Lengkapi Profil
              </button>
              <button
                type="button"
                onClick={onOpenPublicPortfolio}
                className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Lihat Portofolio Publik
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 4 Core KPI Stat Cards */}
      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <button
          type="button"
          onClick={() => onNavigate('documents')}
          className="rounded-2xl border border-slate-200 bg-white p-5 text-left transition-colors hover:border-blue-400 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-600"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Dokumen Portofolio
            </span>
            <i className="fa-solid fa-file-lines text-blue-600 dark:text-blue-400" aria-hidden="true" />
          </div>
          <p className="mt-3 font-mono-tabular text-3xl font-bold text-slate-900 dark:text-white">
            {documents.length}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            PDF, DOCX, PPT, XLSX & gambar
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('certificates')}
          className="rounded-2xl border border-slate-200 bg-white p-5 text-left transition-colors hover:border-violet-400 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-violet-600"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Jumlah Sertifikat
            </span>
            <i className="fa-solid fa-certificate text-violet-600 dark:text-violet-400" aria-hidden="true" />
          </div>
          <p className="mt-3 font-mono-tabular text-3xl font-bold text-slate-900 dark:text-white">
            {certificates.length}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Pelatihan, seminar & kompetensi
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('achievements')}
          className="rounded-2xl border border-slate-200 bg-white p-5 text-left transition-colors hover:border-blue-400 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-600"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Jumlah Prestasi
            </span>
            <i className="fa-solid fa-trophy text-blue-600 dark:text-blue-400" aria-hidden="true" />
          </div>
          <p className="mt-3 font-mono-tabular text-3xl font-bold text-slate-900 dark:text-white">
            {achievements.length}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Sekolah hingga Internasional
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('activities')}
          className="rounded-2xl border border-slate-200 bg-white p-5 text-left transition-colors hover:border-violet-400 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-violet-600"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Jumlah Kegiatan
            </span>
            <i className="fa-solid fa-calendar-check text-violet-600 dark:text-violet-400" aria-hidden="true" />
          </div>
          <p className="mt-3 font-mono-tabular text-3xl font-bold text-slate-900 dark:text-white">
            {activities.length}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Dokumentasi program & acara
          </p>
        </button>
      </section>

      {/* Public Share QR + Quick Export & Recent Logs */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* QR & Share Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 lg:col-span-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Portofolio Publik & QR Code
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Bagikan tautan publik Anda ke rekan kerja, sekolah, atau instansi.
          </p>

          <div className="mt-4 flex flex-col items-center rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:gap-4 dark:border-slate-800 dark:bg-slate-950">
            <div ref={qrRef} className="rounded-lg bg-white p-2 shadow-sm shrink-0">
              <QRCodeCanvas value={publicUrl} size={112} includeMargin />
            </div>
            <div className="mt-3 flex-1 text-center sm:mt-0 sm:text-left min-w-0 w-full">
              <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">
                /portfolio/{username}
              </p>
              <p className="mt-1 truncate font-mono-tabular text-[11px] text-slate-500 dark:text-slate-400">
                {publicUrl}
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  Salin URL
                </button>
                <button
                  type="button"
                  onClick={handleDownloadQR}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Unduh QR
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Portofolio Digital ${profile?.fullName || account.displayName}: ${publicUrl}`)}`}
              target="_blank"
              rel="noreferrer"
              className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 rounded-xl border border-slate-200 py-2 text-[11px] sm:text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <i className="fa-brands fa-whatsapp text-emerald-600" aria-hidden="true" />
              <span>WhatsApp</span>
            </a>
            <a
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(publicUrl)}`}
              target="_blank"
              rel="noreferrer"
              className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 rounded-xl border border-slate-200 py-2 text-[11px] sm:text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <i className="fa-brands fa-facebook text-blue-600" aria-hidden="true" />
              <span>Facebook</span>
            </a>
            <a
              href={`https://t.me/share/url?url=${encodeURIComponent(publicUrl)}`}
              target="_blank"
              rel="noreferrer"
              className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 rounded-xl border border-slate-200 py-2 text-[11px] sm:text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <i className="fa-brands fa-telegram text-sky-500" aria-hidden="true" />
              <span>Telegram</span>
            </a>
          </div>
        </div>

        {/* Quick Exports & Activity */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 lg:col-span-7 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Ekspor & Aktivitas Terbaru
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Unduh seluruh portofolio ke PDF, Excel, atau cetak langsung.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (!profile) return;
                  exportCVToPDF({
                    template: 'modern',
                    profile,
                    documents,
                    certificates,
                    achievements,
                    activities,
                  });
                  onNotify('success', 'PDF Portofolio berhasil diunduh.');
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <i className="fa-solid fa-file-pdf text-rose-600" aria-hidden="true" />
                <span>Export PDF</span>
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
                  onNotify('success', 'Workbook Excel berhasil diunduh.');
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <i className="fa-solid fa-file-excel text-emerald-600" aria-hidden="true" />
                <span>Export Excel</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <i className="fa-solid fa-print text-blue-600" aria-hidden="true" />
                <span>Cetak</span>
              </button>
            </div>
          </div>

          {documents.length === 0 && certificates.length === 0 && achievements.length === 0 && (
            <div className="mt-4 flex flex-col justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50/70 p-4 sm:flex-row sm:items-center dark:border-blue-900/60 dark:bg-blue-950/30">
              <div>
                <p className="text-xs font-semibold text-blue-900 dark:text-blue-200">
                  Portofolio Anda masih kosong
                </p>
                <p className="mt-0.5 text-xs text-blue-700 dark:text-blue-300">
                  Isi contoh data portofolio awal (sertifikat, prestasi, kegiatan & galeri) atau mulai unggah berkas Anda sendiri.
                </p>
              </div>
              <button
                type="button"
                disabled={seeding}
                onClick={handleSeed}
                className="rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60 whitespace-nowrap shrink-0"
              >
                {seeding ? 'Mengisi...' : 'Isi Contoh Portofolio'}
              </button>
            </div>
          )}

          <div className="mt-4 divide-y divide-slate-200 dark:divide-slate-800">
            {logs.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                Belum ada catatan aktivitas.
              </p>
            ) : (
              logs.slice(0, 5).map((log) => (
                <div key={log.id} className="flex items-center justify-between gap-3 py-3 text-xs">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                      {log.detail}
                    </p>
                    <p className="mt-0.5 text-slate-500 dark:text-slate-400">
                      {log.module} · {log.action}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigate('logs')}
                    className="text-blue-600 hover:underline dark:text-blue-400 shrink-0"
                  >
                    Detail
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
