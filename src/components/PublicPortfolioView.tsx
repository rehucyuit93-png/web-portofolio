import React, { useEffect, useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { fetchPublicPortfolio } from '../lib/portfolioService';
import { openOrDownloadFile } from '../lib/storageUpload';
import type { PublicPortfolioDoc } from '../types/portfolio';

interface PublicPortfolioViewProps {
  username: string;
  onBackHome: () => void;
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const PublicPortfolioView: React.FC<PublicPortfolioViewProps> = ({
  username,
  onBackHome,
  onNotify,
}) => {
  const [data, setData] = useState<PublicPortfolioDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; title: string; caption?: string } | null>(
    null
  );
  const [showQrModal, setShowQrModal] = useState(false);
  const qrWrapperRef = useRef<HTMLDivElement>(null);

  const shareUrl = `${window.location.origin}/portfolio/${encodeURIComponent(username)}`;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setErrorMsg(null);
    fetchPublicPortfolio(username)
      .then((res) => {
        if (!active) return;
        if (!res) {
          setErrorMsg('Portofolio publik tidak ditemukan atau belum dipublikasikan.');
        } else {
          setData(res);
        }
      })
      .catch(() => {
        if (!active) return;
        setErrorMsg('Portofolio tidak tersedia atau bersifat privat.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [username]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      onNotify('success', 'Tautan portofolio publik disalin ke clipboard.');
    } catch {
      onNotify('error', 'Gagal menyalin tautan.');
    }
  };

  const handleDownloadQR = () => {
    const canvas = qrWrapperRef.current?.querySelector('canvas');
    if (!canvas) return;
    const pngUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = pngUrl;
    a.download = `qr-portofolio-${username}.png`;
    a.click();
  };

  const shareText = encodeURIComponent(
    `Lihat Portofolio Digital ${data?.fullName || username} di KaryaLoka: ${shareUrl}`
  );
  const encodedUrl = encodeURIComponent(shareUrl);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* 3-Zone Public Top Bar */}
      <header className="no-print glass-surface sticky top-0 z-30 border-b border-slate-200/80 dark:border-slate-800/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-4 py-3.5 sm:px-6">
          <button
            type="button"
            onClick={onBackHome}
            className="text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0"
          >
            KaryaLoka
          </button>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
            <a href="#biodata" className="hover:text-blue-600 transition-colors whitespace-nowrap shrink-0">
              Biodata
            </a>
            <a href="#sertifikat" className="hover:text-blue-600 transition-colors whitespace-nowrap shrink-0">
              Sertifikat
            </a>
            <a href="#prestasi" className="hover:text-blue-600 transition-colors whitespace-nowrap shrink-0">
              Prestasi
            </a>
            <a href="#dokumen" className="hover:text-blue-600 transition-colors whitespace-nowrap shrink-0">
              Dokumen
            </a>
            <a href="#galeri" className="hover:text-blue-600 transition-colors whitespace-nowrap shrink-0">
              Galeri
            </a>
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowQrModal(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700 whitespace-nowrap shrink-0"
            >
              <i className="fa-solid fa-qrcode" aria-hidden="true" />
              <span>QR & Bagikan</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
        {loading ? (
          <div className="space-y-6">
            <div className="h-56 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="h-36 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
              <div className="h-36 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
              <div className="h-36 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
            </div>
          </div>
        ) : errorMsg || !data ? (
          <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
            <i className="fa-solid fa-folder-closed text-3xl text-slate-400" aria-hidden="true" />
            <h1 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">
              Portofolio Tidak Ditemukan
            </h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              {errorMsg || 'Portofolio untuk username ini belum tersedia.'}
            </p>
            <button
              type="button"
              onClick={onBackHome}
              className="mt-6 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
            >
              Kembali ke Beranda
            </button>
          </div>
        ) : (
          <div className="space-y-10">
            {/* Hero Profile Card */}
            <section
              id="biodata"
              className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                  <img
                    src={data.photoURL || '/src/assets/images/avatar_educator_default_1794813989923.jpg'}
                    alt={data.fullName}
                    referrerPolicy="no-referrer"
                    className="h-24 w-24 rounded-2xl border border-slate-200 object-cover dark:border-slate-700"
                  />
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="capitalize">{data.role || 'Pendidik'}</span>
                      {data.nipNisn && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-tabular">ID {data.nipNisn}</span>
                        </>
                      )}
                      <span aria-hidden="true">·</span>
                      <span>@{data.username}</span>
                    </div>
                    <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
                      {data.fullName}
                    </h1>
                    {data.jabatanKelas && (
                      <p className="mt-1 text-sm font-medium text-blue-600 dark:text-blue-400">
                        {data.jabatanKelas}
                      </p>
                    )}
                  </div>
                </div>

                <div className="no-print flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <i className="fa-solid fa-print" aria-hidden="true" />
                    <span>Cetak Portofolio</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <i className="fa-solid fa-link" aria-hidden="true" />
                    <span>Salin Tautan</span>
                  </button>
                </div>
              </div>

              {(data.bio || data.education || data.expertise) && (
                <div className="mt-6 grid grid-cols-1 gap-6 border-t border-slate-200 pt-6 md:grid-cols-3 dark:border-slate-800">
                  <div className="md:col-span-2">
                    <h2 className="text-xs font-semibold tracking-wide text-slate-500 dark:text-slate-400">
                      Ringkasan Profil
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                      {data.bio || 'Belum ada ringkasan bio.'}
                    </p>
                  </div>
                  <div className="space-y-3 text-sm">
                    {data.education && (
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Pendidikan Terakhir</p>
                        <p className="font-medium text-slate-900 dark:text-white">{data.education}</p>
                      </div>
                    )}
                    {data.expertise && (
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Bidang Keahlian</p>
                        <p className="font-medium text-slate-900 dark:text-white">{data.expertise}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>

            {/* Certificates */}
            <section id="sertifikat">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Sertifikat</h2>
              {!data.featuredCertificates || data.featuredCertificates.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                  Belum ada sertifikat yang ditampilkan secara publik.
                </p>
              ) : (
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {data.featuredCertificates.map((cert) => (
                    <div
                      key={cert.id}
                      className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span>{cert.organizer}</span>
                        <span className="font-mono-tabular">{cert.year}</span>
                      </div>
                      <h3 className="mt-1.5 text-sm font-semibold text-slate-900 dark:text-white">
                        {cert.eventName}
                      </h3>
                      {cert.description && (
                        <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400 line-clamp-3">
                          {cert.description}
                        </p>
                      )}
                      {cert.fileUrl && (
                        <button
                          type="button"
                          onClick={() =>
                            openOrDownloadFile(cert.fileUrl, cert.eventName, 'open').catch((err: unknown) =>
                              onNotify('error', err instanceof Error ? err.message : 'Gagal membuka berkas.')
                            )
                          }
                          className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
                        >
                          <span>Lihat Berkas</span>
                          <i className="fa-solid fa-arrow-up-right-from-square text-[10px]" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Achievements */}
            <section id="prestasi">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Prestasi</h2>
              {!data.featuredAchievements || data.featuredAchievements.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                  Belum ada prestasi yang ditampilkan secara publik.
                </p>
              ) : (
                <div className="mt-4 space-y-4">
                  {data.featuredAchievements.map((ach) => (
                    <div
                      key={ach.id}
                      className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center dark:border-slate-800 dark:bg-slate-900"
                    >
                      {ach.photoUrl && (
                        <img
                          src={ach.photoUrl}
                          alt={ach.title}
                          referrerPolicy="no-referrer"
                          className="h-20 w-28 rounded-xl object-cover shrink-0"
                        />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <span>Tingkat {ach.level}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-tabular">{ach.year}</span>
                        </div>
                        <h3 className="mt-1 text-base font-semibold text-slate-900 dark:text-white">
                          {ach.title}
                        </h3>
                        {ach.description && (
                          <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                            {ach.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Documents */}
            <section id="dokumen">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Dokumen Terpilih</h2>
              {!data.featuredDocuments || data.featuredDocuments.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                  Belum ada dokumen terpilih yang dipublikasikan.
                </p>
              ) : (
                <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                  <div className="divide-y divide-slate-200 dark:divide-slate-800">
                    {data.featuredDocuments.map((d) => (
                      <div
                        key={d.id}
                        className="flex flex-col justify-between gap-3 px-5 py-4 sm:flex-row sm:items-center"
                      >
                        <div>
                          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <span>{d.category}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono-tabular">{d.year}</span>
                            <span aria-hidden="true">·</span>
                            <span>{d.fileType}</span>
                          </div>
                          <h3 className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                            {d.title}
                          </h3>
                        </div>
                        {d.fileUrl && (
                          <button
                            type="button"
                            onClick={() =>
                              openOrDownloadFile(d.fileUrl, d.title, 'download').catch((err: unknown) =>
                                onNotify('error', err instanceof Error ? err.message : 'Gagal mengunduh berkas.')
                              )
                            }
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 shrink-0"
                          >
                            <i className="fa-solid fa-download" aria-hidden="true" />
                            <span>Unduh / Lihat</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* Gallery */}
            <section id="galeri">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Galeri Foto</h2>
              {!data.featuredGalleries || data.featuredGalleries.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                  Belum ada foto galeri yang dipublikasikan.
                </p>
              ) : (
                <div className="mt-4 columns-1 gap-4 space-y-4 sm:columns-2 lg:columns-3">
                  {data.featuredGalleries.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        setLightboxImage({
                          url: item.imageUrl,
                          title: item.title,
                          caption: `${item.album} · ${item.year}${item.caption ? ` — ${item.caption}` : ''}`,
                        })
                      }
                      className="group block w-full break-inside-avoid overflow-hidden rounded-2xl border border-slate-200 bg-white text-left transition-transform hover:-translate-y-0.5 dark:border-slate-800 dark:bg-slate-900"
                    >
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        referrerPolicy="no-referrer"
                        className="w-full object-cover"
                      />
                      <div className="p-3.5">
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {item.album} · <span className="font-mono-tabular">{item.year}</span>
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                          {item.title}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      {/* QR & Share Modal */}
      {showQrModal && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Bagikan Portofolio & QR Code
              </h3>
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                aria-label="Tutup"
              >
                <i className="fa-solid fa-xmark" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-5 flex flex-col items-center rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950">
              <div ref={qrWrapperRef} className="rounded-xl bg-white p-3 shadow-sm">
                <QRCodeCanvas value={shareUrl} size={180} includeMargin />
              </div>
              <p className="mt-3 break-all text-center font-mono-tabular text-xs text-slate-600 dark:text-slate-400">
                {shareUrl}
              </p>
              <button
                type="button"
                onClick={handleDownloadQR}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
              >
                <i className="fa-solid fa-download" aria-hidden="true" />
                <span>Unduh QR Code PNG</span>
              </button>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2">
              <a
                href={`https://wa.me/?text=${shareText}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <i className="fa-brands fa-whatsapp text-emerald-600" aria-hidden="true" />
                <span>WhatsApp</span>
              </a>
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <i className="fa-brands fa-facebook text-blue-600" aria-hidden="true" />
                <span>Facebook</span>
              </a>
              <a
                href={`https://t.me/share/url?url=${encodedUrl}&text=${shareText}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <i className="fa-brands fa-telegram text-sky-500" aria-hidden="true" />
                <span>Telegram</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxImage && (
        <div
          className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-4xl overflow-hidden rounded-2xl bg-white dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              className="absolute top-3 right-3 rounded-full bg-slate-900/80 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-900"
            >
              ✕ Tutup
            </button>
            <img
              src={lightboxImage.url}
              alt={lightboxImage.title}
              referrerPolicy="no-referrer"
              className="max-h-[75vh] w-full object-contain bg-slate-950"
            />
            <div className="p-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">{lightboxImage.title}</h3>
              {lightboxImage.caption && (
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{lightboxImage.caption}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
