import React, { useEffect, useMemo, useState } from 'react';
import {
  deleteStorageFile,
  openOrDownloadFile,
  resolveStoredFileUrl,
  syncBlobVisibility,
  uploadFileToStorage,
} from '../../lib/storageUpload';
import type { FileTypeTag, PortfolioDocument } from '../../types/portfolio';

interface DocumentsSectionProps {
  uid: string;
  documents: PortfolioDocument[];
  onCreate: (data: Omit<PortfolioDocument, 'id' | 'uid' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onUpdate: (id: string, data: Partial<PortfolioDocument>) => Promise<void>;
  onDelete: (item: PortfolioDocument) => Promise<void>;
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
}

const CATEGORIES = ['RPP / Modul Ajar', 'Karya Tulis', 'Laporan', 'Presentasi', 'Bahan Ajar', 'Lainnya'];
const FILE_TYPES: FileTypeTag[] = ['PDF', 'DOCX', 'PPT', 'XLSX', 'JPG', 'PNG'];

function inferFileType(fileName: string): FileTypeTag {
  const ext = fileName.split('.').pop()?.toUpperCase();
  if (ext === 'PDF') return 'PDF';
  if (ext === 'DOC' || ext === 'DOCX') return 'DOCX';
  if (ext === 'PPT' || ext === 'PPTX') return 'PPT';
  if (ext === 'XLS' || ext === 'XLSX') return 'XLSX';
  if (ext === 'PNG') return 'PNG';
  return 'JPG';
}

export const DocumentsSection: React.FC<DocumentsSectionProps> = ({
  uid,
  documents,
  onCreate,
  onUpdate,
  onDelete,
  onNotify,
}) => {
  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<PortfolioDocument | null>(null);
  const [previewDoc, setPreviewDoc] = useState<PortfolioDocument | null>(null);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [description, setDescription] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileType, setFileType] = useState<FileTypeTag>('PDF');
  const [fileSize, setFileSize] = useState(0);
  const [storagePath, setStoragePath] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const years = useMemo(() => {
    const set = new Set(documents.map((d) => d.year));
    return Array.from(set).sort((a, b) => b - a);
  }, [documents]);

  const filtered = useMemo(() => {
    return documents
      .filter((d) => {
        const matchSearch =
          d.title.toLowerCase().includes(search.toLowerCase()) ||
          d.description.toLowerCase().includes(search.toLowerCase()) ||
          d.fileName.toLowerCase().includes(search.toLowerCase());
        const matchYear = yearFilter === 'all' || String(d.year) === yearFilter;
        const matchCat = categoryFilter === 'all' || d.category === categoryFilter;
        return matchSearch && matchYear && matchCat;
      })
      .sort((a, b) => b.year - a.year);
  }, [documents, search, yearFilter, categoryFilter]);

  const openCreate = () => {
    setEditing(null);
    setTitle('');
    setCategory(CATEGORIES[0]);
    setYear(new Date().getFullYear());
    setDescription('');
    setFileUrl('');
    setFileName('');
    setFileType('PDF');
    setFileSize(0);
    setStoragePath('');
    setIsPublic(true);
    setShowModal(true);
  };

  const openEdit = (doc: PortfolioDocument) => {
    setEditing(doc);
    setTitle(doc.title);
    setCategory(doc.category);
    setYear(doc.year);
    setDescription(doc.description);
    setFileUrl(doc.fileUrl);
    setFileName(doc.fileName);
    setFileType(doc.fileType);
    setFileSize(doc.fileSize);
    setStoragePath(doc.storagePath || '');
    setIsPublic(doc.isPublic);
    setShowModal(true);
  };

  const [previewBlobUrl, setPreviewBlobUrl] = useState<string>('');
  const [previewMimeType, setPreviewMimeType] = useState<string>('');
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    if (!previewDoc) {
      setPreviewBlobUrl('');
      setPreviewMimeType('');
      setLoadingPreview(false);
      return;
    }
    let active = true;
    let revokeUrl = '';
    setLoadingPreview(true);
    resolveStoredFileUrl(previewDoc.fileUrl)
      .then(({ resolvedUrl, isObjectUrl, mimeType }) => {
        if (!active) {
          if (isObjectUrl && resolvedUrl) URL.revokeObjectURL(resolvedUrl);
          return;
        }
        if (isObjectUrl) revokeUrl = resolvedUrl;
        setPreviewBlobUrl(resolvedUrl);
        setPreviewMimeType(mimeType || '');
      })
      .catch((err: unknown) => {
        if (active) {
          onNotify('error', err instanceof Error ? err.message : 'Gagal memuat pratinjau dokumen.');
        }
      })
      .finally(() => {
        if (active) setLoadingPreview(false);
      });

    return () => {
      active = false;
      if (revokeUrl) URL.revokeObjectURL(revokeUrl);
    };
  }, [previewDoc, onNotify]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setUploadPct(0);
    try {
      const res = await uploadFileToStorage('documents', uid, file, setUploadPct);
      setFileUrl(res.downloadUrl);
      setFileName(res.fileName);
      setFileSize(res.fileSize);
      setStoragePath(res.storagePath);
      setFileType(inferFileType(res.fileName));
      if (!title.trim()) {
        setTitle(res.fileName.replace(/\.[^/.]+$/, ''));
      }
      onNotify('success', 'Dokumen berhasil dimuat dan siap disimpan.');
    } catch (err: unknown) {
      onNotify('error', err instanceof Error ? err.message : 'Gagal mengunggah dokumen.');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileUrl.trim()) {
      onNotify('error', 'Unggah berkas dokumen atau masukkan URL berkas.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        category,
        year: Number(year),
        description: description.trim(),
        fileName: fileName.trim() || `${title.trim()}.${fileType.toLowerCase()}`,
        fileType,
        fileSize: fileSize || 1024,
        fileUrl: fileUrl.trim(),
        storagePath,
        isPublic,
      };
      await syncBlobVisibility(payload.fileUrl, payload.isPublic);
      if (editing) {
        await onUpdate(editing.id, payload);
        onNotify('success', 'Dokumen berhasil diperbarui.');
      } else {
        await onCreate(payload);
        onNotify('success', 'Dokumen baru berhasil ditambahkan.');
      }
      setShowModal(false);
    } catch (err: unknown) {
      onNotify('error', err instanceof Error ? err.message : 'Gagal menyimpan dokumen.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (doc: PortfolioDocument) => {
    await onDelete(doc);
    if (doc.storagePath) {
      await deleteStorageFile(doc.storagePath);
    }
  };

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 sm:flex-row sm:items-center sm:p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-auto sm:flex-1 sm:min-w-[200px]">
            <i className="fa-solid fa-magnifying-glass absolute top-1/2 left-3.5 -translate-y-1/2 text-xs text-slate-400" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari judul atau berkas..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pr-3 pl-9 text-sm text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-medium text-slate-700 sm:w-auto dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            >
              <option value="all">Semua Kategori</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono-tabular text-xs font-medium text-slate-700 sm:w-auto dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            >
              <option value="all">Semua Tahun</option>
              {years.map((y) => (
                <option key={y} value={String(y)}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 whitespace-nowrap sm:w-auto shrink-0"
        >
          <i className="fa-solid fa-cloud-arrow-up" aria-hidden="true" />
          <span>Unggah Dokumen</span>
        </button>
      </div>

      {/* Document Table / List */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {filtered.length === 0 ? (
          <div className="p-10 text-center">
            <i className="fa-solid fa-file-circle-plus text-3xl text-slate-300 dark:text-slate-600" aria-hidden="true" />
            <h3 className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
              Belum ada dokumen ditemukan
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Unggah file PDF, DOCX, PPT, XLSX, JPG, atau PNG untuk melengkapi portofolio Anda.
            </p>
            <button
              type="button"
              onClick={openCreate}
              className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
            >
              Tambah Dokumen Pertama
            </button>
          </div>
        ) : (
          <>
            {/* Mobile Card List */}
            <div className="divide-y divide-slate-200 md:hidden dark:divide-slate-800">
              {filtered.map((item) => (
                <div key={item.id} className="space-y-3 p-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                      <span>{item.category}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-tabular font-semibold text-blue-600 dark:text-blue-400">
                        {item.fileType}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-tabular">{item.year}</span>
                      <span aria-hidden="true">·</span>
                      <span>{item.isPublic ? 'Publik' : 'Privat'}</span>
                    </div>
                    <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
                      {item.title}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                      {item.fileName}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPreviewDoc(item)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                      >
                        <i className="fa-solid fa-eye" aria-hidden="true" />
                        <span>Pratinjau</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          openOrDownloadFile(item.fileUrl, item.fileName, 'download').catch((err: unknown) =>
                            onNotify('error', err instanceof Error ? err.message : 'Gagal mengunduh dokumen.')
                          )
                        }
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                      >
                        <i className="fa-solid fa-download" aria-hidden="true" />
                        <span>Unduh</span>
                      </button>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(item)}
                        title="Edit"
                        className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800"
                      >
                        <i className="fa-solid fa-pen" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemove(item)}
                        title="Hapus"
                        className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-rose-600 dark:hover:bg-slate-800"
                      >
                        <i className="fa-solid fa-trash" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-3.5">Judul Dokumen</th>
                    <th className="px-4 py-3.5">Kategori</th>
                    <th className="px-4 py-3.5">Format</th>
                    <th className="px-4 py-3.5 text-right">Tahun</th>
                    <th className="px-4 py-3.5">Visibilitas</th>
                    <th className="px-5 py-3.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filtered.map((item) => (
                    <tr
                      key={item.id}
                      className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-slate-900 dark:text-white">{item.title}</p>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                          {item.fileName}
                        </p>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-600 dark:text-slate-300">
                        {item.category}
                      </td>
                      <td className="px-4 py-3.5 font-mono-tabular text-xs font-semibold text-blue-600 dark:text-blue-400">
                        {item.fileType}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono-tabular text-xs text-slate-700 dark:text-slate-300">
                        {item.year}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-600 dark:text-slate-300">
                        {item.isPublic ? 'Publik' : 'Privat'}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setPreviewDoc(item)}
                            title="Pratinjau"
                            className="rounded-lg p-2 text-xs text-slate-600 hover:bg-slate-100 hover:text-blue-600 dark:text-slate-300 dark:hover:bg-slate-800"
                          >
                            <i className="fa-solid fa-eye" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openOrDownloadFile(item.fileUrl, item.fileName, 'download')}
                            title="Unduh"
                            className="rounded-lg p-2 text-xs text-slate-600 hover:bg-slate-100 hover:text-emerald-600 dark:text-slate-300 dark:hover:bg-slate-800"
                          >
                            <i className="fa-solid fa-download" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(item)}
                            title="Edit"
                            className="rounded-lg p-2 text-xs text-slate-600 hover:bg-slate-100 hover:text-blue-600 dark:text-slate-300 dark:hover:bg-slate-800"
                          >
                            <i className="fa-solid fa-pen" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemove(item)}
                            title="Hapus"
                            className="rounded-lg p-2 text-xs text-slate-600 hover:bg-slate-100 hover:text-rose-600 dark:text-slate-300 dark:hover:bg-slate-800"
                          >
                            <i className="fa-solid fa-trash" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Upload / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-4 backdrop-blur-sm">
          <form
            onSubmit={handleSave}
            className="max-h-[92dvh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editing ? 'Edit Dokumen Portofolio' : 'Unggah Dokumen Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Tutup modal"
              >
                <i className="fa-solid fa-xmark" aria-hidden="true" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Pilih Berkas (PDF, DOCX, PPT, XLSX, JPG, PNG)
              </label>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png"
                onChange={handleFileChange}
                className="mt-1.5 w-full rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
              />
              {uploading && (
                <p className="mt-1 text-xs font-medium text-blue-600">Mengunggah... {uploadPct}%</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                URL Berkas
              </label>
              {fileUrl.startsWith('data:') || fileUrl.startsWith('firestore-blob://') ? (
                <div className="mt-1.5 flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200">
                  <span className="truncate font-medium">
                    <i className="fa-solid fa-circle-check mr-1.5" aria-hidden="true" />
                    Berkas terlampir: {fileName || 'Dokumen'}
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
                  placeholder="Terisi otomatis saat upload atau tempel URL HTTPS"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Judul Dokumen
              </label>
              <input
                type="text"
                required
                maxLength={180}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Kategori
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Format
                </label>
                <select
                  value={fileType}
                  onChange={(e) => setFileType(e.target.value as FileTypeTag)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                >
                  {FILE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
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
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono-tabular text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Deskripsi
              </label>
              <textarea
                rows={3}
                maxLength={1500}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>

            <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600"
              />
              <span>Tampilkan di halaman Portofolio Publik</span>
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
                {submitting ? 'Menyimpan...' : 'Simpan Dokumen'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Preview Modal */}
      {previewDoc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-2.5 sm:p-4 backdrop-blur-sm"
          onClick={() => setPreviewDoc(null)}
        >
          <div
            className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5 sm:py-4 dark:border-slate-800">
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-bold text-slate-900 dark:text-white">
                  {previewDoc.title}
                </h3>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {previewDoc.category} · {previewDoc.year} · {previewDoc.fileType}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    openOrDownloadFile(previewDoc.fileUrl, previewDoc.fileName, 'open').catch((err: unknown) =>
                      onNotify('error', err instanceof Error ? err.message : 'Gagal membuka dokumen.')
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <i className="fa-solid fa-up-right-from-square" aria-hidden="true" />
                  <span className="hidden sm:inline">Buka Penuh</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    openOrDownloadFile(previewDoc.fileUrl, previewDoc.fileName, 'download').catch((err: unknown) =>
                      onNotify('error', err instanceof Error ? err.message : 'Gagal mengunduh dokumen.')
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  <i className="fa-solid fa-download" aria-hidden="true" />
                  <span>Unduh</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  aria-label="Tutup pratinjau"
                >
                  <i className="fa-solid fa-xmark" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-3.5 sm:p-5">
              {loadingPreview ? (
                <div className="flex h-[45dvh] sm:h-[55vh] flex-col items-center justify-center gap-3 text-xs text-slate-500">
                  <div className="h-8 w-8 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" />
                  <span>Memuat berkas dokumen...</span>
                </div>
              ) : previewMimeType.startsWith('image/') ||
                previewDoc.fileType === 'JPG' ||
                previewDoc.fileType === 'PNG' ? (
                <img
                  src={previewBlobUrl || previewDoc.fileUrl}
                  alt={previewDoc.title}
                  referrerPolicy="no-referrer"
                  className="mx-auto max-h-[58dvh] sm:max-h-[62vh] w-full rounded-xl bg-slate-50 object-contain dark:bg-slate-950"
                />
              ) : previewDoc.fileType === 'PDF' ? (
                <div className="space-y-3">
                  <iframe
                    title={previewDoc.title}
                    src={previewBlobUrl || previewDoc.fileUrl}
                    className="h-[46dvh] sm:h-[58vh] w-full rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs dark:border-slate-800 dark:bg-slate-950">
                    <span className="text-slate-600 dark:text-slate-300">
                      Jika PDF tidak tampil penuh di browser HP, buka atau unduh langsung:
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openOrDownloadFile(previewDoc.fileUrl, previewDoc.fileName, 'open')}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                      >
                        Buka PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => openOrDownloadFile(previewDoc.fileUrl, previewDoc.fileName, 'download')}
                        className="rounded-lg bg-blue-600 px-3 py-1.5 font-semibold text-white hover:bg-blue-700"
                      >
                        Unduh
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 sm:p-8 text-center dark:border-slate-800 dark:bg-slate-950">
                  <i className="fa-solid fa-file-lines text-4xl text-blue-600" aria-hidden="true" />
                  <p className="mt-3 break-words text-sm font-semibold text-slate-900 dark:text-white">
                    {previewDoc.fileName}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Pratinjau langsung tersedia untuk PDF dan gambar. Klik tombol di bawah untuk mengunduh berkas {previewDoc.fileType}.
                  </p>
                  <button
                    type="button"
                    onClick={() => openOrDownloadFile(previewDoc.fileUrl, previewDoc.fileName, 'download')}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                  >
                    <i className="fa-solid fa-download" aria-hidden="true" />
                    <span>Buka / Unduh Berkas</span>
                  </button>
                </div>
              )}
              {previewDoc.description && (
                <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {previewDoc.description}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
