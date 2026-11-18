import React, { useMemo, useState } from 'react';
import { formatDateIndo, getTodayISO } from '../../lib/dateFormat';
import { deleteStorageFile, uploadFileToStorage } from '../../lib/storageUpload';
import type { Achievement, AchievementLevel, Activity } from '../../types/portfolio';
import { DateSelector } from '../DateSelector';

const LEVELS: AchievementLevel[] = [
  'Sekolah',
  'Kabupaten/Kota',
  'Provinsi',
  'Nasional',
  'Internasional',
];

export const AchievementsSection: React.FC<{
  uid: string;
  achievements: Achievement[];
  onCreate: (data: Omit<Achievement, 'id' | 'uid' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onUpdate: (id: string, data: Partial<Achievement>) => Promise<void>;
  onDelete: (item: Achievement) => Promise<void>;
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
}> = ({ uid, achievements, onCreate, onUpdate, onDelete, onNotify }) => {
  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Achievement | null>(null);

  const [title, setTitle] = useState('');
  const [level, setLevel] = useState<AchievementLevel>('Nasional');
  const [year, setYear] = useState(new Date().getFullYear());
  const [description, setDescription] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [storagePath, setStoragePath] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const years = useMemo(
    () => Array.from(new Set(achievements.map((a) => a.year))).sort((a, b) => b - a),
    [achievements]
  );

  const filtered = useMemo(() => {
    return achievements
      .filter((a) => {
        const matchSearch =
          a.title.toLowerCase().includes(search.toLowerCase()) ||
          a.level.toLowerCase().includes(search.toLowerCase());
        const matchYear = yearFilter === 'all' || String(a.year) === yearFilter;
        return matchSearch && matchYear;
      })
      .sort((a, b) => b.year - a.year);
  }, [achievements, search, yearFilter]);

  const openCreate = () => {
    setEditing(null);
    setTitle('');
    setLevel('Nasional');
    setYear(new Date().getFullYear());
    setDescription('');
    setPhotoUrl('');
    setStoragePath('');
    setIsPublic(true);
    setShowModal(true);
  };

  const openEdit = (item: Achievement) => {
    setEditing(item);
    setTitle(item.title);
    setLevel(item.level);
    setYear(item.year);
    setDescription(item.description);
    setPhotoUrl(item.photoUrl || '');
    setStoragePath(item.storagePath || '');
    setIsPublic(item.isPublic);
    setShowModal(true);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadFileToStorage('achievements', uid, file);
      setPhotoUrl(res.downloadUrl);
      setStoragePath(res.storagePath);
      onNotify('success', 'Bukti foto prestasi berhasil dimuat.');
    } catch (err: unknown) {
      onNotify('error', err instanceof Error ? err.message : 'Gagal mengunggah bukti foto.');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        level,
        year: Number(year),
        description: description.trim(),
        photoUrl: photoUrl.trim(),
        storagePath,
        isPublic,
      };
      if (editing) {
        await onUpdate(editing.id, payload);
        onNotify('success', 'Data prestasi diperbarui.');
      } else {
        await onCreate(payload);
        onNotify('success', 'Prestasi baru ditambahkan.');
      }
      setShowModal(false);
    } catch (err: unknown) {
      onNotify('error', err instanceof Error ? err.message : 'Gagal menyimpan prestasi.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-auto sm:flex-1 sm:min-w-[200px]">
            <i className="fa-solid fa-magnifying-glass absolute top-1/2 left-3.5 -translate-y-1/2 text-xs text-slate-400" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama prestasi atau tingkat..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pr-3 pl-9 text-sm text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>
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

        <button
          type="button"
          onClick={openCreate}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 sm:w-auto sm:py-2 whitespace-nowrap shrink-0"
        >
          <i className="fa-solid fa-plus" aria-hidden="true" />
          <span>Tambah Prestasi</span>
        </button>
      </div>

      {/* Achievement Timeline */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center dark:border-slate-800 dark:bg-slate-900">
          <i className="fa-solid fa-trophy text-3xl text-slate-300 dark:text-slate-600" aria-hidden="true" />
          <h3 className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
            Belum ada catatan prestasi
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Catat pencapaian akademik, lomba, maupun penghargaan profesional Anda.
          </p>
        </div>
      ) : (
        <div className="relative space-y-4 pl-5 before:absolute before:top-2 before:bottom-2 before:left-1.5 before:w-px before:bg-slate-200 sm:pl-6 sm:before:left-2 dark:before:bg-slate-800">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="relative rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-900"
            >
              <span
                aria-hidden="true"
                className="absolute top-6 -left-[19px] h-3 w-3 rounded-full border-2 border-white bg-blue-600 sm:-left-[21px] dark:border-slate-950"
              />
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:gap-4">
                  {item.photoUrl && (
                    <img
                      src={item.photoUrl}
                      alt={item.title}
                      referrerPolicy="no-referrer"
                      className="h-40 w-full rounded-xl bg-slate-100 object-contain p-1 shrink-0 sm:h-20 sm:w-28 dark:bg-slate-800"
                    />
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-semibold text-violet-600 dark:text-violet-400">
                        Tingkat {item.level}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-tabular">{item.year}</span>
                    </div>
                    <h3 className="mt-1 text-base font-bold text-slate-900 dark:text-white">
                      {item.title}
                    </h3>
                    {item.description && (
                      <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                        {item.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEdit(item)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-xs text-slate-500 hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800"
                    title="Edit"
                  >
                    <i className="fa-solid fa-pen" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await onDelete(item);
                      if (item.storagePath) await deleteStorageFile(item.storagePath);
                    }}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-xs text-slate-500 hover:bg-slate-100 hover:text-rose-600 dark:hover:bg-slate-800"
                    title="Hapus"
                  >
                    <i className="fa-solid fa-trash" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-4">
          <form
            onSubmit={handleSubmit}
            className="max-h-[92dvh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-xl sm:p-6 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editing ? 'Edit Prestasi' : 'Tambah Prestasi'}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <i className="fa-solid fa-xmark" aria-hidden="true" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Nama Prestasi
              </label>
              <input
                type="text"
                required
                maxLength={200}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Tingkat
                </label>
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value as AchievementLevel)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                >
                  {LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {l}
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
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono-tabular text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Bukti Foto
              </label>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handlePhotoUpload}
                className="mt-1.5 w-full rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-xs dark:border-slate-700 dark:bg-slate-950"
              />
              {uploading && <p className="mt-1 text-xs text-blue-600">Mengunggah...</p>}
              {photoUrl.startsWith('data:') ? (
                <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200">
                  <span className="font-medium">
                    <i className="fa-solid fa-circle-check mr-1.5" aria-hidden="true" />
                    Bukti foto terunggah & siap disimpan
                  </span>
                  <button
                    type="button"
                    onClick={() => setPhotoUrl('')}
                    className="font-semibold underline shrink-0"
                  >
                    Hapus
                  </button>
                </div>
              ) : (
                <input
                  type="text"
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                  placeholder="Atau tempel URL gambar (opsional)"
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
                maxLength={1500}
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
    </div>
  );
};

export const ActivitiesSection: React.FC<{
  uid: string;
  activities: Activity[];
  onCreate: (data: Omit<Activity, 'id' | 'uid' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onUpdate: (id: string, data: Partial<Activity>) => Promise<void>;
  onDelete: (item: Activity) => Promise<void>;
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
}> = ({ uid, activities, onCreate, onUpdate, onDelete, onNotify }) => {
  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);

  const [title, setTitle] = useState('');
  const [date, setDate] = useState(getTodayISO());
  const [description, setDescription] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [storagePath, setStoragePath] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const years = useMemo(
    () => Array.from(new Set(activities.map((a) => a.year))).sort((a, b) => b - a),
    [activities]
  );

  const filtered = useMemo(() => {
    return activities
      .filter((a) => {
        const matchSearch =
          a.title.toLowerCase().includes(search.toLowerCase()) ||
          a.description.toLowerCase().includes(search.toLowerCase());
        const matchYear = yearFilter === 'all' || String(a.year) === yearFilter;
        return matchSearch && matchYear;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [activities, search, yearFilter]);

  const openCreate = () => {
    setEditing(null);
    setTitle('');
    setDate(getTodayISO());
    setDescription('');
    setPhotoUrl('');
    setStoragePath('');
    setIsPublic(true);
    setShowModal(true);
  };

  const openEdit = (item: Activity) => {
    setEditing(item);
    setTitle(item.title);
    setDate(item.date);
    setDescription(item.description);
    setPhotoUrl(item.photoUrl || '');
    setStoragePath(item.storagePath || '');
    setIsPublic(item.isPublic);
    setShowModal(true);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadFileToStorage('activities', uid, file);
      setPhotoUrl(res.downloadUrl);
      setStoragePath(res.storagePath);
      onNotify('success', 'Dokumentasi foto kegiatan berhasil dimuat.');
    } catch (err: unknown) {
      onNotify('error', err instanceof Error ? err.message : 'Gagal mengunggah foto.');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const parsedYear = Number(date.slice(0, 4)) || new Date().getFullYear();
      const payload = {
        title: title.trim(),
        date,
        year: parsedYear,
        description: description.trim(),
        photoUrl: photoUrl.trim(),
        storagePath,
        isPublic,
      };
      if (editing) {
        await onUpdate(editing.id, payload);
        onNotify('success', 'Kegiatan berhasil diperbarui.');
      } else {
        await onCreate(payload);
        onNotify('success', 'Kegiatan baru berhasil ditambahkan.');
      }
      setShowModal(false);
    } catch (err: unknown) {
      onNotify('error', err instanceof Error ? err.message : 'Gagal menyimpan kegiatan.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-auto sm:flex-1 sm:min-w-[200px]">
            <i className="fa-solid fa-magnifying-glass absolute top-1/2 left-3.5 -translate-y-1/2 text-xs text-slate-400" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari kegiatan..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pr-3 pl-9 text-sm text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>
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

        <button
          type="button"
          onClick={openCreate}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 sm:w-auto sm:py-2 whitespace-nowrap shrink-0"
        >
          <i className="fa-solid fa-plus" aria-hidden="true" />
          <span>Tambah Kegiatan</span>
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center dark:border-slate-800 dark:bg-slate-900">
          <i className="fa-solid fa-calendar-days text-3xl text-slate-300 dark:text-slate-600" aria-hidden="true" />
          <h3 className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
            Belum ada dokumentasi kegiatan
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Dokumentasikan workshop, proyek kelas, atau kegiatan komunitas Anda.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <article
              key={item.id}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
            >
              <img
                src={item.photoUrl || '/src/assets/images/gallery_seminar_event_1794813993737.jpg'}
                alt={item.title}
                referrerPolicy="no-referrer"
                className="aspect-video w-full bg-slate-100 object-contain dark:bg-slate-800"
              />
              <div className="p-4 sm:p-5">
                <p className="font-mono-tabular text-xs text-slate-500 dark:text-slate-400">
                  {formatDateIndo(item.date)}
                </p>
                <h3 className="mt-1 text-base font-bold text-slate-900 dark:text-white">
                  {item.title}
                </h3>
                {item.description && (
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400 line-clamp-3">
                    {item.description}
                  </p>
                )}
                <div className="mt-4 flex justify-end gap-1 border-t border-slate-200 pt-3 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => openEdit(item)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-xs text-slate-500 hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800"
                  >
                    <i className="fa-solid fa-pen" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await onDelete(item);
                      if (item.storagePath) await deleteStorageFile(item.storagePath);
                    }}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-xs text-slate-500 hover:bg-slate-100 hover:text-rose-600 dark:hover:bg-slate-800"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-4">
          <form
            onSubmit={handleSubmit}
            className="max-h-[92dvh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-xl sm:p-6 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editing ? 'Edit Kegiatan' : 'Tambah Kegiatan'}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
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
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Tanggal Kegiatan
              </label>
              <DateSelector
                required
                value={date}
                onChange={setDate}
                minYear={1980}
                maxYear={new Date().getFullYear() + 2}
                className="mt-1.5"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Dokumentasi Foto
              </label>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handlePhotoUpload}
                className="mt-1.5 w-full rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-xs dark:border-slate-700 dark:bg-slate-950"
              />
              {uploading && <p className="mt-1 text-xs text-blue-600">Mengunggah...</p>}
              {photoUrl.startsWith('data:') ? (
                <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200">
                  <span className="font-medium">
                    <i className="fa-solid fa-circle-check mr-1.5" aria-hidden="true" />
                    Dokumentasi foto terunggah & siap disimpan
                  </span>
                  <button
                    type="button"
                    onClick={() => setPhotoUrl('')}
                    className="font-semibold underline shrink-0"
                  >
                    Hapus
                  </button>
                </div>
              ) : (
                <input
                  type="text"
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                  placeholder="Atau tempel URL foto dokumentasi"
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
                maxLength={1500}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>

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
    </div>
  );
};
