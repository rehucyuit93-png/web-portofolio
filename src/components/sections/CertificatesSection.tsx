import React, { useEffect, useMemo, useState } from 'react';
import {
  deleteStorageFile,
  openOrDownloadFile,
  resolveStoredFileUrl,
  syncBlobVisibility,
  uploadFileToStorage,
} from '../../lib/storageUpload';
import type { Certificate } from '../../types/portfolio';

interface CertificatesSectionProps {
  uid: string;
  certificates: Certificate[];
  onCreate: (data: Omit<Certificate, 'id' | 'uid' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onUpdate: (id: string, data: Partial<Certificate>) => Promise<void>;
  onDelete: (item: Certificate) => Promise<void>;
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const CertificatesSection: React.FC<CertificatesSectionProps> = ({
  uid,
  certificates,
  onCreate,
  onUpdate,
  onDelete,
  onNotify,
}) => {
  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Certificate | null>(null);

  const [eventName, setEventName] = useState('');
  const [organizer, setOrganizer] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [description, setDescription] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [storagePath, setStoragePath] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [previewCert, setPreviewCert] = useState<Certificate | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    if (!previewCert) {
      setPreviewBlobUrl('');
      setLoadingPreview(false);
      return;
    }
    let active = true;
    let revokeUrl = '';
    setLoadingPreview(true);
    resolveStoredFileUrl(previewCert.fileUrl)
      .then(({ resolvedUrl, isObjectUrl }) => {
        if (!active) {
          if (isObjectUrl && resolvedUrl) URL.revokeObjectURL(resolvedUrl);
          return;
        }
        if (isObjectUrl) revokeUrl = resolvedUrl;
        setPreviewBlobUrl(resolvedUrl);
      })
      .catch((err: unknown) => {
        if (active) {
          onNotify('error', err instanceof Error ? err.message : 'Gagal memuat pratinjau sertifikat.');
        }
      })
      .finally(() => {
        if (active) setLoadingPreview(false);
      });

    return () => {
      active = false;
      if (revokeUrl) URL.revokeObjectURL(revokeUrl);
    };
  }, [previewCert, onNotify]);

  const years = useMemo(
    () => Array.from(new Set(certificates.map((c) => c.year))).sort((a, b) => b - a),
    [certificates]
  );

  const filtered = useMemo(() => {
    return certificates
      .filter((c) => {
        const matchSearch =
          c.eventName.toLowerCase().includes(search.toLowerCase()) ||
          c.organizer.toLowerCase().includes(search.toLowerCase());
        const matchYear = yearFilter === 'all' || String(c.year) === yearFilter;
        return matchSearch && matchYear;
      })
      .sort((a, b) => b.year - a.year);
  }, [certificates, search, yearFilter]);

  const openCreate = () => {
    setEditing(null);
    setEventName('');
    setOrganizer('');
    setYear(new Date().getFullYear());
    setDescription('');
    setFileName('');
    setFileUrl('');
    setStoragePath('');
    setIsPublic(true);
    setShowModal(true);
  };

  const openEdit = (cert: Certificate) => {
    setEditing(cert);
    setEventName(cert.eventName);
    setOrganizer(cert.organizer);
    setYear(cert.year);
    setDescription(cert.description);
    setFileName(cert.fileName || '');
    setFileUrl(cert.fileUrl);
    setStoragePath(cert.storagePath || '');
    setIsPublic(cert.isPublic);
    setShowModal(true);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setUploadPct(0);
    try {
      const res = await uploadFileToStorage('certificates', uid, file, setUploadPct);
      setFileUrl(res.downloadUrl);
      setFileName(res.fileName);
      setStoragePath(res.storagePath);
      onNotify('success', 'Berkas sertifikat berhasil dimuat.');
    } catch (err: unknown) {
      onNotify('error', err instanceof Error ? err.message : 'Gagal mengunggah sertifikat.');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileUrl.trim()) {
      onNotify('error', 'Unggah file sertifikat atau masukkan URL sertifikat.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        eventName: eventName.trim(),
        organizer: organizer.trim(),
        year: Number(year),
        description: description.trim(),
        fileName: fileName.trim() || `${eventName.trim()}.pdf`,
        fileUrl: fileUrl.trim(),
        storagePath,
        isPublic,
      };
      await syncBlobVisibility(payload.fileUrl, payload.isPublic);
      if (editing) {
        await onUpdate(editing.id, payload);
        onNotify('success', 'Sertifikat berhasil diperbarui.');
      } else {
        await onCreate(payload);
        onNotify('success', 'Sertifikat berhasil ditambahkan.');
      }
      setShowModal(false);
    } catch (err: unknown) {
      onNotify('error', err instanceof Error ? err.message : 'Gagal menyimpan sertifikat.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <i className="fa-solid fa-magnifying-glass absolute top-1/2 left-3.5 -translate-y-1/2 text-xs text-slate-400" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama kegiatan atau penyelenggara..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pr-3 pl-9 text-sm text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono-tabular text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
          >
            <option value="all">Semua Tahun</option>
            {years.map((y) => (
              <option key={y} value={String(y)}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 whitespace-nowrap shrink-0"
        >
          <i className="fa-solid fa-plus" aria-hidden="true" />
          <span>Tambah Sertifikat</span>
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center dark:border-slate-800 dark:bg-slate-900">
          <i className="fa-solid fa-certificate text-3xl text-slate-300 dark:text-slate-600" aria-hidden="true" />
          <h3 className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
            Belum ada sertifikat tersimpan
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Tambahkan sertifikat diklat, seminar, atau uji kompetensi Anda.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((cert) => (
            <article
              key={cert.id}
              className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 transition-colors hover:border-blue-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-700"
            >
              <div>
                <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="truncate">{cert.organizer}</span>
                  <span className="font-mono-tabular shrink-0">{cert.year}</span>
                </div>
                <h3 className="mt-1.5 text-base font-bold text-slate-900 dark:text-white">
                  {cert.eventName}
                </h3>
                {cert.description && (
                  <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400 line-clamp-3">
                    {cert.description}
                  </p>
                )}
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-slate-200 pt-3.5 text-xs dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setPreviewCert(cert)}
                    className="inline-flex items-center gap-1.5 font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
                  >
                    <i className="fa-solid fa-eye" aria-hidden="true" />
                    <span>Pratinjau</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      openOrDownloadFile(cert.fileUrl, cert.fileName || `${cert.eventName}.pdf`, 'download').catch(
                        (err: unknown) =>
                          onNotify('error', err instanceof Error ? err.message : 'Gagal mengunduh sertifikat.')
                      )
                    }
                    className="inline-flex items-center gap-1.5 font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                  >
                    <i className="fa-solid fa-file-arrow-down" aria-hidden="true" />
                    <span>Unduh</span>
                  </button>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEdit(cert)}
                    className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800"
                    title="Edit"
                  >
                    <i className="fa-solid fa-pen" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await onDelete(cert);
                      if (cert.storagePath) await deleteStorageFile(cert.storagePath);
                    }}
                    className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-rose-600 dark:hover:bg-slate-800"
                    title="Hapus"
                  >
                    <i className="fa-solid fa-trash" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-lg space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editing ? 'Edit Sertifikat' : 'Tambah Sertifikat'}
              </h3>
              <button type="button" onClick={() => setShowModal(false)} className="text-slate-400">
                <i className="fa-solid fa-xmark" aria-hidden="true" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Nama Kegiatan
              </label>
              <input
                type="text"
                required
                maxLength={200}
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Penyelenggara
                </label>
                <input
                  type="text"
                  required
                  maxLength={160}
                  value={organizer}
                  onChange={(e) => setOrganizer(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Tahun
                </label>
                <input
                  type="number"
                  min={1970}
                  max={2100}
                  required
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono-tabular text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                File Sertifikat (PDF / Gambar)
              </label>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleUpload}
                className="mt-1.5 w-full rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-xs dark:border-slate-700 dark:bg-slate-950"
              />
              {uploading && (
                <p className="mt-1 text-xs font-medium text-blue-600">
                  Mengunggah... {uploadPct > 0 ? `${uploadPct}%` : ''}
                </p>
              )}
              {fileUrl.startsWith('data:') || fileUrl.startsWith('firestore-blob://') ? (
                <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200">
                  <span className="truncate font-medium">
                    <i className="fa-solid fa-circle-check mr-1.5" aria-hidden="true" />
                    Berkas terlampir: {fileName || 'Sertifikat'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setFileUrl('');
                      setFileName('');
                      setStoragePath('');
                    }}
                    className="font-semibold underline shrink-0"
                  >
                    Ganti URL
                  </button>
                </div>
              ) : (
                <input
                  type="text"
                  required
                  value={fileUrl}
                  onChange={(e) => setFileUrl(e.target.value)}
                  placeholder="Atau URL berkas sertifikat (HTTPS)"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Deskripsi
              </label>
              <textarea
                rows={3}
                maxLength={1200}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>

            <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600"
              />
              <span>Tampilkan di Portofolio Publik</span>
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting || uploading}
                className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {submitting ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </form>
        </div>
      )}

      {previewCert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">{previewCert.eventName}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {previewCert.organizer} · {previewCert.year}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    openOrDownloadFile(
                      previewCert.fileUrl,
                      previewCert.fileName || `${previewCert.eventName}.pdf`,
                      'download'
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  <i className="fa-solid fa-download" aria-hidden="true" />
                  <span>Unduh</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewCert(null)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  aria-label="Tutup pratinjau"
                >
                  <i className="fa-solid fa-xmark" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-5">
              {loadingPreview ? (
                <div className="flex h-[55vh] flex-col items-center justify-center gap-3 text-xs text-slate-500">
                  <div className="h-8 w-8 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" />
                  <span>Memuat berkas sertifikat...</span>
                </div>
              ) : /\.(png|jpe?g|webp|gif)$/i.test(previewCert.fileName || '') ||
                previewCert.fileUrl.startsWith('data:image/') ? (
                <img
                  src={previewBlobUrl || previewCert.fileUrl}
                  alt={previewCert.eventName}
                  referrerPolicy="no-referrer"
                  className="mx-auto max-h-[60vh] rounded-xl object-contain"
                />
              ) : (
                <iframe
                  title={previewCert.eventName}
                  src={previewBlobUrl || previewCert.fileUrl}
                  className="h-[60vh] w-full rounded-xl border border-slate-200 dark:border-slate-800"
                />
              )}
              {previewCert.description && (
                <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {previewCert.description}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
