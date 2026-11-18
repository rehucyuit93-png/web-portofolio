import React, { useEffect, useState } from 'react';
import { formatDateIndo } from '../../lib/dateFormat';
import { uploadFileToStorage } from '../../lib/storageUpload';
import { sanitizeUsername } from '../../lib/portfolioService';
import type { UserProfile } from '../../types/portfolio';
import { DateSelector } from '../DateSelector';

interface ProfileSectionProps {
  uid: string;
  profile: UserProfile;
  onSaveProfile: (data: Omit<UserProfile, 'uid' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const ProfileSection: React.FC<ProfileSectionProps> = ({
  uid,
  profile,
  onSaveProfile,
  onNotify,
}) => {
  const [form, setForm] = useState({
    username: profile.username || '',
    fullName: profile.fullName || '',
    nipNisn: profile.nipNisn || '',
    jabatanKelas: profile.jabatanKelas || '',
    birthPlace: profile.birthPlace || '',
    birthDate: profile.birthDate || '',
    address: profile.address || '',
    phone: profile.phone || '',
    email: profile.email || '',
    education: profile.education || '',
    expertise: profile.expertise || '',
    bio: profile.bio || '',
    photoURL: profile.photoURL || '',
    isPublished: profile.isPublished ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [zoomPhoto, setZoomPhoto] = useState(false);

  useEffect(() => {
    setForm({
      username: profile.username || '',
      fullName: profile.fullName || '',
      nipNisn: profile.nipNisn || '',
      jabatanKelas: profile.jabatanKelas || '',
      birthPlace: profile.birthPlace || '',
      birthDate: profile.birthDate || '',
      address: profile.address || '',
      phone: profile.phone || '',
      email: profile.email || '',
      education: profile.education || '',
      expertise: profile.expertise || '',
      bio: profile.bio || '',
      photoURL: profile.photoURL || '',
      isPublished: profile.isPublished ?? true,
    });
  }, [profile]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingPhoto(true);
    setUploadPct(0);
    try {
      const res = await uploadFileToStorage('profile-photo', uid, file, setUploadPct);
      const nextForm = {
        ...form,
        photoURL: res.downloadUrl,
        username: sanitizeUsername(form.username || form.fullName),
      };
      setForm(nextForm);
      await onSaveProfile(nextForm);
      onNotify('success', 'Foto profil berhasil diunggah dan disimpan.');
    } catch (err: unknown) {
      onNotify(
        'error',
        err instanceof Error ? err.message : 'Gagal mengunggah foto profil.'
      );
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSaveProfile({
        ...form,
        username: sanitizeUsername(form.username || form.fullName),
      });
      onNotify('success', 'Profil dan halaman portofolio publik berhasil diperbarui.');
    } catch (err: unknown) {
      onNotify('error', err instanceof Error ? err.message : 'Gagal menyimpan profil.');
    } finally {
      setSaving(false);
    }
  };

  const isInlinePhoto = form.photoURL.startsWith('data:');

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      {/* Form Column */}
      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 xl:col-span-7 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="border-b border-slate-200 pb-4 dark:border-slate-800">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Profil Saya</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Perubahan langsung ditampilkan pada pratinjau portofolio secara realtime.
          </p>
        </div>

        {/* Photo upload */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => setZoomPhoto(true)}
            title="Klik untuk melihat foto profil ukuran penuh"
            className="group relative h-28 w-28 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 p-1 sm:h-32 sm:w-32 dark:border-slate-700 dark:bg-slate-800"
          >
            <img
              src={form.photoURL || '/src/assets/images/avatar_educator_default_1794813989923.jpg'}
              alt="Foto Profil"
              referrerPolicy="no-referrer"
              className="h-full w-full rounded-xl object-contain"
            />
            <span className="absolute right-1.5 bottom-1.5 flex h-6 w-6 items-center justify-center rounded-lg bg-slate-900/70 text-[10px] text-white opacity-90 transition-opacity group-hover:opacity-100">
              <i className="fa-solid fa-expand" aria-hidden="true" />
            </span>
          </button>
          <div className="min-w-0 flex-1 space-y-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
              <i className="fa-solid fa-camera" aria-hidden="true" />
              <span>{uploadingPhoto ? `Mengunggah ${uploadPct}%...` : 'Unggah Foto Profil'}</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                disabled={uploadingPhoto}
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </label>
            {isInlinePhoto ? (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200">
                <span className="truncate font-medium">
                  <i className="fa-solid fa-circle-check mr-1.5" aria-hidden="true" />
                  Foto profil terunggah & aktif
                </span>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, photoURL: '' })}
                  className="font-semibold underline hover:text-emerald-950 dark:hover:text-white shrink-0"
                >
                  Hapus / Ganti URL
                </button>
              </div>
            ) : (
              <input
                type="text"
                value={form.photoURL}
                onChange={(e) => setForm({ ...form, photoURL: e.target.value })}
                placeholder="Atau tempel URL foto profil (HTTPS)"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Nama Lengkap
            </label>
            <input
              type="text"
              required
              maxLength={120}
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Username URL Publik
            </label>
            <input
              type="text"
              required
              maxLength={48}
              value={form.username}
              onChange={(e) => setForm({ ...form, username: sanitizeUsername(e.target.value) })}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 font-mono-tabular text-sm text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              NIP / NISN
            </label>
            <input
              type="text"
              maxLength={40}
              value={form.nipNisn}
              onChange={(e) => setForm({ ...form, nipNisn: e.target.value })}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 font-mono-tabular text-sm text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Jabatan / Kelas
            </label>
            <input
              type="text"
              maxLength={100}
              value={form.jabatanKelas}
              onChange={(e) => setForm({ ...form, jabatanKelas: e.target.value })}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Tempat Lahir
            </label>
            <input
              type="text"
              maxLength={100}
              value={form.birthPlace}
              onChange={(e) => setForm({ ...form, birthPlace: e.target.value })}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Tanggal Lahir
            </label>
            <DateSelector
              value={form.birthDate}
              onChange={(val) => setForm({ ...form, birthDate: val })}
              allowEmpty
              minYear={1940}
              maxYear={new Date().getFullYear()}
              className="mt-1.5"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Nomor HP / WhatsApp
            </label>
            <input
              type="tel"
              maxLength={30}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 font-mono-tabular text-sm text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Email
            </label>
            <input
              type="email"
              required
              maxLength={200}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Pendidikan Terakhir
            </label>
            <input
              type="text"
              maxLength={150}
              value={form.education}
              onChange={(e) => setForm({ ...form, education: e.target.value })}
              placeholder="S2 Pendidikan Matematika / SMA"
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Bidang Keahlian
            </label>
            <input
              type="text"
              maxLength={250}
              value={form.expertise}
              onChange={(e) => setForm({ ...form, expertise: e.target.value })}
              placeholder="Kurikulum Merdeka, Literasi Digital, STEM"
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Alamat Lengkap
          </label>
          <input
            type="text"
            maxLength={300}
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Bio Singkat
          </label>
          <textarea
            rows={4}
            maxLength={1500}
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            placeholder="Ceritakan pengalaman mengajar, minat riset, atau tujuan pembelajaran Anda..."
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />
        </div>

        <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs cursor-pointer dark:border-slate-800 dark:bg-slate-950">
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">
              Publikasikan Halaman Portofolio
            </p>
            <p className="text-slate-500 dark:text-slate-400">
              Izinkan pengunjung membuka /portfolio/{form.username || 'username'}
            </p>
          </div>
          <input
            type="checkbox"
            checked={form.isPublished}
            onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
            className="h-4 w-4 rounded border-slate-300 text-blue-600"
          />
        </label>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? 'Menyimpan...' : 'Simpan Profil'}
          </button>
        </div>
      </form>

      {/* Realtime Preview Column */}
      <aside className="xl:col-span-5">
        <div className="glass-panel rounded-2xl border border-slate-200 p-4 sm:p-6 xl:sticky xl:top-24 dark:border-slate-800">
          <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
            Pratinjau Realtime Portofolio
          </p>

          <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => setZoomPhoto(true)}
              title="Lihat foto penuh"
              className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 p-1 sm:h-28 sm:w-28 dark:border-slate-700 dark:bg-slate-800"
            >
              <img
                src={form.photoURL || '/src/assets/images/avatar_educator_default_1794813989923.jpg'}
                alt={form.fullName || 'Preview'}
                referrerPolicy="no-referrer"
                className="h-full w-full rounded-xl object-contain"
              />
            </button>
            <div className="min-w-0">
              <h3 className="break-words text-lg font-bold text-slate-900 dark:text-white">
                {form.fullName || 'Nama Lengkap Anda'}
              </h3>
              <p className="break-words text-sm font-medium text-blue-600 dark:text-blue-400">
                {form.jabatanKelas || 'Jabatan / Kelas'}
              </p>
              <p className="mt-0.5 font-mono-tabular text-xs text-slate-500 dark:text-slate-400">
                {form.nipNisn ? `ID ${form.nipNisn}` : 'NIP / NISN belum diisi'}
              </p>
            </div>
          </div>

          <p className="mt-5 break-words text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {form.bio || 'Bio singkat Anda akan muncul di sini saat Anda mengetik.'}
          </p>

          <div className="mt-6 space-y-3 border-t border-slate-200 pt-5 text-xs dark:border-slate-800">
            <div className="flex justify-between gap-4">
              <span className="shrink-0 text-slate-500 dark:text-slate-400">URL Publik</span>
              <span className="min-w-0 break-all text-right font-mono-tabular font-semibold text-slate-900 dark:text-white">
                /portfolio/{form.username || 'username'}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="shrink-0 text-slate-500 dark:text-slate-400">Pendidikan</span>
              <span className="min-w-0 break-words text-right font-medium text-slate-900 dark:text-white">
                {form.education || '—'}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="shrink-0 text-slate-500 dark:text-slate-400">Keahlian</span>
              <span className="min-w-0 break-words text-right font-medium text-slate-900 dark:text-white">
                {form.expertise || '—'}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="shrink-0 text-slate-500 dark:text-slate-400">TTL</span>
              <span className="min-w-0 break-words text-right font-medium text-slate-900 dark:text-white">
                {form.birthPlace || form.birthDate
                  ? `${form.birthPlace || ''}${form.birthPlace && form.birthDate ? ', ' : ''}${form.birthDate ? formatDateIndo(form.birthDate) : ''}`
                  : '—'}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="shrink-0 text-slate-500 dark:text-slate-400">Kontak</span>
              <span className="min-w-0 break-all text-right font-medium text-slate-900 dark:text-white">
                {form.phone || form.email || '—'}
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* Full-size Photo Lightbox */}
      {zoomPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm"
          onClick={() => setZoomPhoto(false)}
        >
          <div
            className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setZoomPhoto(false)}
              className="absolute top-3 right-3 rounded-full bg-slate-900/80 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-900"
            >
              ✕ Tutup
            </button>
            <img
              src={form.photoURL || '/src/assets/images/avatar_educator_default_1794813989923.jpg'}
              alt={form.fullName || 'Foto Profil'}
              referrerPolicy="no-referrer"
              className="max-h-[75dvh] w-full bg-slate-950 object-contain"
            />
            <div className="p-4 text-center">
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {form.fullName || 'Foto Profil'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
