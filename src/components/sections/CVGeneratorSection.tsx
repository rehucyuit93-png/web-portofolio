import React, { useState } from 'react';
import { exportCVToPDF } from '../../lib/exportUtils';
import type {
  Achievement,
  Activity,
  Certificate,
  PortfolioDocument,
  UserProfile,
} from '../../types/portfolio';

interface CVGeneratorSectionProps {
  profile: UserProfile;
  documents: PortfolioDocument[];
  certificates: Certificate[];
  achievements: Achievement[];
  activities: Activity[];
  defaultTemplate: 'modern' | 'ats';
  onSaveTemplatePreference: (template: 'modern' | 'ats') => Promise<void>;
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const CVGeneratorSection: React.FC<CVGeneratorSectionProps> = ({
  profile,
  documents,
  certificates,
  achievements,
  activities,
  defaultTemplate,
  onSaveTemplatePreference,
  onNotify,
}) => {
  const [template, setTemplate] = useState<'modern' | 'ats'>(defaultTemplate);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  const handleSelectTemplate = async (next: 'modern' | 'ats') => {
    setTemplate(next);
    await onSaveTemplatePreference(next);
  };

  const handleGenerate = () => {
    setGeneratedAt(new Date().toLocaleTimeString('id-ID'));
    onNotify('success', `CV otomatis diperbarui menggunakan template ${template === 'modern' ? 'Modern' : 'ATS Friendly'}.`);
  };

  const handleDownloadPDF = () => {
    exportCVToPDF({
      template,
      profile,
      documents,
      certificates,
      achievements,
      activities,
    });
    onNotify('success', `CV_${template.toUpperCase()}.pdf berhasil diunduh.`);
  };

  return (
    <div className="space-y-6">
      {/* Control Bar */}
      <div className="no-print flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:p-5 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Generator CV Otomatis
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Data disusun otomatis dari Profil, Sertifikat, Prestasi, Kegiatan, dan Dokumen Anda.
            {generatedAt ? ` Terakhir disusun pukul ${generatedAt}.` : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex flex-wrap rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => handleSelectTemplate('modern')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                template === 'modern'
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              Template Modern
            </button>
            <button
              type="button"
              onClick={() => handleSelectTemplate('ats')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                template === 'ats'
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              Template ATS Friendly
            </button>
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Generate CV
          </button>

          <button
            type="button"
            onClick={handleDownloadPDF}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
          >
            <i className="fa-solid fa-file-pdf" aria-hidden="true" />
            <span>Download PDF</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <i className="fa-solid fa-print" aria-hidden="true" />
            <span>Cetak</span>
          </button>
        </div>
      </div>

      {/* Live CV Preview Paper */}
      <div className="print-area mx-auto max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-sm">
        {template === 'modern' ? (
          <div>
            <div className="bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-6 text-white sm:px-8 sm:py-8">
              <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-5">
                <img
                  src={profile.photoURL || '/src/assets/images/avatar_educator_default_1794813989923.jpg'}
                  alt={profile.fullName}
                  referrerPolicy="no-referrer"
                  className="h-24 w-24 shrink-0 rounded-2xl border-2 border-white/40 bg-white/15 object-contain p-0.5 sm:h-28 sm:w-28"
                />
                <div className="min-w-0">
                  <h1 className="text-xl font-bold tracking-tight sm:text-3xl break-words">
                    {profile.fullName || 'Nama Lengkap'}
                  </h1>
                  <p className="mt-1 text-sm font-medium text-blue-100 break-words">
                    {profile.jabatanKelas || 'Pendidik / Profesional'}
                    {profile.nipNisn ? ` · ID ${profile.nipNisn}` : ''}
                  </p>
                  <p className="mt-2 text-xs text-blue-50 break-words">
                    {[profile.email, profile.phone, profile.address].filter(Boolean).join('  •  ')}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 p-4 sm:gap-8 sm:p-8 md:grid-cols-3">
              {/* Left sidebar info */}
              <div className="space-y-6 md:col-span-1">
                <div>
                  <h2 className="text-xs font-bold tracking-wide text-blue-600">
                    Pendidikan Terakhir
                  </h2>
                  <p className="mt-1.5 text-sm text-slate-800">{profile.education || '—'}</p>
                </div>
                <div>
                  <h2 className="text-xs font-bold tracking-wide text-blue-600">
                    Bidang Keahlian
                  </h2>
                  <p className="mt-1.5 text-sm text-slate-800">{profile.expertise || '—'}</p>
                </div>
                <div>
                  <h2 className="text-xs font-bold tracking-wide text-blue-600">
                    Data Pribadi
                  </h2>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                    {profile.birthPlace || '—'}
                    {profile.birthDate ? `, ${profile.birthDate}` : ''}
                  </p>
                </div>
                {documents.length > 0 && (
                  <div>
                    <h2 className="text-xs font-bold tracking-wide text-blue-600">
                      Karya & Dokumen
                    </h2>
                    <ul className="mt-2 space-y-1.5 text-xs text-slate-700">
                      {documents.slice(0, 6).map((d) => (
                        <li key={d.id}>
                          • {d.title} ({d.year})
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Right main body */}
              <div className="space-y-6 md:col-span-2">
                <div>
                  <h2 className="border-b border-slate-200 pb-2 text-sm font-bold text-slate-900">
                    Ringkasan Profesional
                  </h2>
                  <p className="mt-2.5 text-sm leading-relaxed text-slate-700">
                    {profile.bio || 'Ringkasan bio profesional belum diisi.'}
                  </p>
                </div>

                <div>
                  <h2 className="border-b border-slate-200 pb-2 text-sm font-bold text-slate-900">
                    Prestasi & Penghargaan
                  </h2>
                  {achievements.length === 0 ? (
                    <p className="mt-2 text-xs text-slate-500">Belum ada catatan prestasi.</p>
                  ) : (
                    <div className="mt-3 space-y-3">
                      {achievements.map((a) => (
                        <div key={a.id}>
                          <div className="flex items-start justify-between gap-2 text-sm font-semibold text-slate-900">
                            <span>{a.title}</span>
                            <span className="font-mono-tabular text-xs text-slate-500 shrink-0">{a.year}</span>
                          </div>
                          <p className="text-xs text-blue-600">Tingkat {a.level}</p>
                          {a.description && (
                            <p className="mt-1 text-xs text-slate-600">{a.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h2 className="border-b border-slate-200 pb-2 text-sm font-bold text-slate-900">
                    Sertifikasi & Pelatihan
                  </h2>
                  {certificates.length === 0 ? (
                    <p className="mt-2 text-xs text-slate-500">Belum ada catatan sertifikat.</p>
                  ) : (
                    <div className="mt-3 space-y-2.5">
                      {certificates.map((c) => (
                        <div key={c.id} className="flex items-start justify-between gap-4 text-xs">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900">{c.eventName}</p>
                            <p className="text-slate-600">{c.organizer}</p>
                          </div>
                          <span className="font-mono-tabular text-slate-500 shrink-0">{c.year}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {activities.length > 0 && (
                  <div>
                    <h2 className="border-b border-slate-200 pb-2 text-sm font-bold text-slate-900">
                      Pengalaman & Kegiatan
                    </h2>
                    <div className="mt-3 space-y-2.5">
                      {activities.map((act) => (
                        <div key={act.id} className="text-xs">
                          <div className="flex items-start justify-between gap-2 font-semibold text-slate-900">
                            <span>{act.title}</span>
                            <span className="font-mono-tabular text-slate-500 shrink-0">{act.date}</span>
                          </div>
                          {act.description && (
                            <p className="mt-0.5 text-slate-600">{act.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* ATS Friendly Clean Monochrome Layout */
          <div className="space-y-5 p-5 font-sans text-slate-900 sm:space-y-6 sm:p-10">
            <header className="border-b-2 border-slate-900 pb-4">
              <h1 className="text-xl font-bold tracking-tight uppercase sm:text-2xl break-words">
                {profile.fullName || 'NAMA LENGKAP'}
              </h1>
              <p className="mt-1 text-sm font-medium text-slate-700 break-words">
                {[
                  profile.jabatanKelas,
                  profile.nipNisn ? `ID: ${profile.nipNisn}` : '',
                  profile.email,
                  profile.phone,
                ]
                  .filter(Boolean)
                  .join(' | ')}
              </p>
              {profile.address && <p className="mt-0.5 text-xs text-slate-600 break-words">{profile.address}</p>}
            </header>

            <section>
              <h2 className="border-b border-slate-300 pb-1 text-xs font-bold tracking-wider uppercase">
                Ringkasan Profesional
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-800">
                {profile.bio || 'Ringkasan bio belum diisi.'}
              </p>
            </section>

            <section>
              <h2 className="border-b border-slate-300 pb-1 text-xs font-bold tracking-wider uppercase">
                Pendidikan & Keahlian
              </h2>
              <p className="mt-2 text-sm">
                <strong>Pendidikan:</strong> {profile.education || '—'}
              </p>
              <p className="mt-1 text-sm">
                <strong>Keahlian:</strong> {profile.expertise || '—'}
              </p>
            </section>

            {achievements.length > 0 && (
              <section>
                <h2 className="border-b border-slate-300 pb-1 text-xs font-bold tracking-wider uppercase">
                  Prestasi & Penghargaan
                </h2>
                <ul className="mt-2 space-y-2 text-sm">
                  {achievements.map((a) => (
                    <li key={a.id}>
                      <strong>{a.title}</strong> — Tingkat {a.level} ({a.year})
                      {a.description ? `. ${a.description}` : ''}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {certificates.length > 0 && (
              <section>
                <h2 className="border-b border-slate-300 pb-1 text-xs font-bold tracking-wider uppercase">
                  Sertifikat & Pelatihan
                </h2>
                <ul className="mt-2 space-y-1.5 text-sm">
                  {certificates.map((c) => (
                    <li key={c.id}>
                      <strong>{c.eventName}</strong> — {c.organizer} ({c.year})
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {activities.length > 0 && (
              <section>
                <h2 className="border-b border-slate-300 pb-1 text-xs font-bold tracking-wider uppercase">
                  Kegiatan & Pengalaman
                </h2>
                <ul className="mt-2 space-y-1.5 text-sm">
                  {activities.map((act) => (
                    <li key={act.id}>
                      <strong>{act.title}</strong> ({act.date})
                      {act.description ? ` — ${act.description}` : ''}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {documents.length > 0 && (
              <section>
                <h2 className="border-b border-slate-300 pb-1 text-xs font-bold tracking-wider uppercase">
                  Karya & Dokumen Terpilih
                </h2>
                <ul className="mt-2 space-y-1 text-sm">
                  {documents.slice(0, 8).map((d) => (
                    <li key={d.id}>
                      {d.title} · {d.category} ({d.year})
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
