import React, { useMemo, useState } from 'react';
import { deleteStorageFile, openOrDownloadFile, uploadFileToStorage } from '../../lib/storageUpload';
import type { GalleryItem } from '../../types/portfolio';

interface GallerySectionProps {
  uid: string;
  galleries: GalleryItem[];
  onCreate: (data: Omit<GalleryItem, 'id' | 'uid' | 'createdAt'>) => Promise<void>;
  onDelete: (item: GalleryItem) => Promise<void>;
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
}

const DEFAULT_ALBUMS = ['Kegiatan Sekolah', 'Seminar & Pelatihan', 'Karya Siswa', 'Penghargaan', 'Lainnya'];

export const GallerySection: React.FC<GallerySectionProps> = ({
  uid,
  galleries,
  onCreate,
  onDelete,
  onNotify,
}) => {
  const [search, setSearch] = useState('');
  const [albumFilter, setAlbumFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [showUpload, setShowUpload] = useState(false);
  const [lightbox, setLightbox] = useState<GalleryItem | null>(null);

  const [album, setAlbum] = useState(DEFAULT_ALBUMS[0]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [caption, setCaption] = useState('');
  const [manualUrl, setManualUrl] = useState('');
  const [manualTitle, setManualTitle] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');

  const albums = useMemo(() => {
    const set = new Set([...DEFAULT_ALBUMS, ...galleries.map((g) => g.album)]);
    return Array.from(set);
  }, [galleries]);

  const years = useMemo(
    () => Array.from(new Set(galleries.map((g) => g.year))).sort((a, b) => b - a),
    [galleries]
  );

  const filtered = useMemo(() => {
    return galleries.filter((g) => {
      const matchSearch =
        g.title.toLowerCase().includes(search.toLowerCase()) ||
        g.album.toLowerCase().includes(search.toLowerCase()) ||
        (g.caption || '').toLowerCase().includes(search.toLowerCase());
      const matchAlbum = albumFilter === 'all' || g.album === albumFilter;
      const matchYear = yearFilter === 'all' || String(g.year) === yearFilter;
      return matchSearch && matchAlbum && matchYear;
    });
  }, [galleries, search, albumFilter, yearFilter]);

  const handleMultiUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;
    setUploading(true);
    let successCount = 0;
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProgressMsg(`Mengunggah ${i + 1} dari ${files.length} foto...`);
        const res = await uploadFileToStorage('gallery', uid, file);
        await onCreate({
          title: file.name.replace(/\.[^/.]+$/, ''),
          album,
          year: Number(year),
          caption: caption.trim(),
          imageUrl: res.downloadUrl,
          storagePath: res.storagePath,
          isPublic,
        });
        successCount += 1;
      }
      onNotify('success', `${successCount} foto berhasil diunggah ke galeri.`);
      setShowUpload(false);
      setCaption('');
    } catch (err: unknown) {
      onNotify('error', err instanceof Error ? err.message : 'Gagal mengunggah gambar galeri.');
    } finally {
      setUploading(false);
      setProgressMsg('');
    }
  };

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualUrl.trim()) return;
    setUploading(true);
    try {
      await onCreate({
        title: manualTitle.trim() || 'Foto Dokumentasi',
        album,
        year: Number(year),
        caption: caption.trim(),
        imageUrl: manualUrl.trim(),
        storagePath: '',
        isPublic,
      });
      onNotify('success', 'Foto berhasil ditambahkan ke galeri.');
      setShowUpload(false);
      setManualUrl('');
      setManualTitle('');
      setCaption('');
    } catch (err: unknown) {
      onNotify('error', err instanceof Error ? err.message : 'Gagal menambah foto.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-auto sm:flex-1 sm:min-w-[180px]">
            <i className="fa-solid fa-magnifying-glass absolute top-1/2 left-3.5 -translate-y-1/2 text-xs text-slate-400" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari foto atau keterangan..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pr-3 pl-9 text-sm text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
            <select
              value={albumFilter}
              onChange={(e) => setAlbumFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 sm:w-auto dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            >
              <option value="all">Semua Album</option>
              {albums.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono-tabular text-xs font-medium text-slate-700 sm:w-auto dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
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
          onClick={() => setShowUpload(true)}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 sm:w-auto sm:py-2 whitespace-nowrap shrink-0"
        >
          <i className="fa-solid fa-images" aria-hidden="true" />
          <span>Unggah Foto</span>
        </button>
      </div>

      {/* Masonry Gallery */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center dark:border-slate-800 dark:bg-slate-900">
          <i className="fa-solid fa-photo-film text-3xl text-slate-300 dark:text-slate-600" aria-hidden="true" />
          <h3 className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
            Galeri foto masih kosong
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Unggah banyak foto sekaligus berdasarkan kategori album untuk ditampilkan dalam tata letak masonry.
          </p>
        </div>
      ) : (
        <div className="columns-1 gap-4 space-y-4 sm:columns-2 lg:columns-3">
          {filtered.map((item) => (
            <article
              key={item.id}
              className="group break-inside-avoid overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
            >
              <button
                type="button"
                onClick={() => setLightbox(item)}
                className="block w-full overflow-hidden bg-slate-100 text-left dark:bg-slate-950"
              >
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  referrerPolicy="no-referrer"
                  className="max-h-80 w-full object-contain transition-transform duration-300 group-hover:scale-[1.02]"
                />
              </button>
              <div className="p-4">
                <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span>{item.album}</span>
                  <span className="font-mono-tabular">{item.year}</span>
                </div>
                <h3 className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
                  {item.title}
                </h3>
                {item.caption && (
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{item.caption}</p>
                )}
                <div className="mt-3 flex items-center justify-end gap-2 border-t border-slate-200 pt-2.5 text-xs dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setLightbox(item)}
                    className="rounded-lg px-2 py-1 text-slate-600 hover:bg-slate-100 hover:text-blue-600 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <i className="fa-solid fa-expand mr-1" aria-hidden="true" />
                    Preview
                  </button>
                  <button
                    type="button"
                    onClick={() => openOrDownloadFile(item.imageUrl, `${item.title || 'foto'}.jpg`, 'download')}
                    className="rounded-lg px-2 py-1 text-slate-600 hover:bg-slate-100 hover:text-emerald-600 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <i className="fa-solid fa-download mr-1" aria-hidden="true" />
                    Unduh
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await onDelete(item);
                      if (item.storagePath) await deleteStorageFile(item.storagePath);
                    }}
                    className="rounded-lg px-2 py-1 text-slate-600 hover:bg-slate-100 hover:text-rose-600 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <i className="fa-solid fa-trash" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-4">
          <div className="max-h-[92dvh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-xl sm:p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Unggah Foto ke Galeri
              </h3>
              <button
                type="button"
                onClick={() => setShowUpload(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <i className="fa-solid fa-xmark" aria-hidden="true" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Kategori Album
                </label>
                <select
                  value={album}
                  onChange={(e) => setAlbum(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                >
                  {DEFAULT_ALBUMS.map((a) => (
                    <option key={a} value={a}>
                      {a}
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
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono-tabular text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Keterangan Umum (Opsional)
              </label>
              <input
                type="text"
                maxLength={600}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Dokumentasi kegiatan semester ganjil..."
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Pilih Banyak Gambar Sekaligus
              </label>
              <input
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp"
                disabled={uploading}
                onChange={handleMultiUpload}
                className="mt-1.5 w-full rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-xs dark:border-slate-700 dark:bg-slate-950"
              />
              {progressMsg && <p className="mt-1 text-xs font-medium text-blue-600">{progressMsg}</p>}
            </div>

            <form onSubmit={handleManualAdd} className="space-y-2 border-t border-slate-200 pt-3 dark:border-slate-800">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Atau tambahkan melalui URL gambar
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input
                  type="text"
                  placeholder="Judul foto"
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
                <input
                  type="url"
                  placeholder="https://..."
                  value={manualUrl}
                  onChange={(e) => setManualUrl(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>
              <div className="flex flex-col items-start gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
                <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600"
                  />
                  <span>Tampilkan di Portofolio Publik</span>
                </label>
                <button
                  type="submit"
                  disabled={uploading || !manualUrl.trim()}
                  className="w-full rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 sm:w-auto dark:bg-blue-600"
                >
                  Tambah URL
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-2.5 backdrop-blur-sm sm:p-4"
          onClick={() => setLightbox(null)}
        >
          <div
            className="relative flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLightbox(null)}
              className="absolute top-3 right-3 z-10 rounded-full bg-slate-900/80 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-900"
            >
              ✕ Tutup
            </button>
            <img
              src={lightbox.imageUrl}
              alt={lightbox.title}
              referrerPolicy="no-referrer"
              className="max-h-[70dvh] w-full bg-slate-950 object-contain"
            />
            <div className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center sm:gap-4">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white break-words">{lightbox.title}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {lightbox.album} · {lightbox.year}
                  {lightbox.caption ? ` — ${lightbox.caption}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => openOrDownloadFile(lightbox.imageUrl, `${lightbox.title || 'foto'}.jpg`, 'download')}
                className="w-full rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 sm:w-auto shrink-0"
              >
                Unduh
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
