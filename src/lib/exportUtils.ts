import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import { formatDateDMY } from './dateFormat';
import type {
  Achievement,
  Activity,
  AuditLog,
  Certificate,
  GalleryItem,
  PortfolioDocument,
  UserProfile,
} from '../types/portfolio';

export function exportCVToPDF(params: {
  template: 'modern' | 'ats';
  profile: UserProfile;
  documents: PortfolioDocument[];
  certificates: Certificate[];
  achievements: Achievement[];
  activities: Activity[];
}): void {
  const { template, profile, documents, certificates, achievements, activities } = params;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 44;
  const contentWidth = pageWidth - margin * 2;
  let y = 50;

  const ensureSpace = (needed = 48) => {
    if (y + needed > pageHeight - 48) {
      doc.addPage();
      y = 48;
    }
  };

  if (template === 'modern') {
    // Modern header block
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, pageWidth, 118, 'F');
    doc.setFillColor(124, 58, 237);
    doc.rect(pageWidth * 0.65, 0, pageWidth * 0.35, 118, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.text(profile.fullName || 'Nama Lengkap', margin, 48);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    const subtitle = [profile.jabatanKelas, profile.nipNisn ? `NIP/NISN: ${profile.nipNisn}` : '']
      .filter(Boolean)
      .join('  •  ');
    doc.text(subtitle || 'Pendidik / Profesional', margin, 70);

    doc.setFontSize(9.5);
    const contactLine = [profile.email, profile.phone, profile.address].filter(Boolean).join('  |  ');
    doc.text(doc.splitTextToSize(contactLine, contentWidth), margin, 90);
    y = 146;
  } else {
    // ATS Friendly strict monochrome header
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text((profile.fullName || 'NAMA LENGKAP').toUpperCase(), margin, y);
    y += 18;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const atsMeta = [
      profile.jabatanKelas,
      profile.nipNisn ? `ID: ${profile.nipNisn}` : '',
      profile.email,
      profile.phone,
    ]
      .filter(Boolean)
      .join(' | ');
    doc.text(doc.splitTextToSize(atsMeta, contentWidth), margin, y);
    y += 18;
    if (profile.address) {
      doc.text(profile.address, margin, y);
      y += 14;
    }
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(1);
    doc.line(margin, y, pageWidth - margin, y);
    y += 22;
  }

  const drawSectionTitle = (title: string) => {
    ensureSpace(40);
    if (template === 'modern') {
      doc.setTextColor(37, 99, 235);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text(title, margin, y);
      y += 6;
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.8);
      doc.line(margin, y, pageWidth - margin, y);
      y += 16;
    } else {
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(title.toUpperCase(), margin, y);
      y += 5;
      doc.setDrawColor(100, 116, 139);
      doc.setLineWidth(0.6);
      doc.line(margin, y, pageWidth - margin, y);
      y += 14;
    }
  };

  if (profile.bio || profile.expertise || profile.education) {
    drawSectionTitle('Ringkasan Profesional & Pendidikan');
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    if (profile.bio) {
      const bioLines = doc.splitTextToSize(profile.bio, contentWidth);
      doc.text(bioLines, margin, y);
      y += bioLines.length * 14 + 6;
    }
    if (profile.education) {
      doc.setFont('helvetica', 'bold');
      doc.text('Pendidikan Terakhir: ', margin, y);
      doc.setFont('helvetica', 'normal');
      doc.text(profile.education, margin + 108, y);
      y += 15;
    }
    if (profile.expertise) {
      doc.setFont('helvetica', 'bold');
      doc.text('Bidang Keahlian: ', margin, y);
      doc.setFont('helvetica', 'normal');
      const expLines = doc.splitTextToSize(profile.expertise, contentWidth - 95);
      doc.text(expLines, margin + 95, y);
      y += expLines.length * 14 + 8;
    }
  }

  if (achievements.length > 0) {
    drawSectionTitle('Prestasi & Penghargaan');
    for (const item of achievements) {
      ensureSpace(44);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(15, 23, 42);
      doc.text(`${item.title} (${item.year})`, margin, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(71, 85, 105);
      doc.text(`Tingkat: ${item.level}`, pageWidth - margin, y, { align: 'right' });
      y += 14;
      if (item.description) {
        const desc = doc.splitTextToSize(item.description, contentWidth);
        doc.text(desc, margin, y);
        y += desc.length * 13 + 6;
      } else {
        y += 4;
      }
    }
  }

  if (certificates.length > 0) {
    drawSectionTitle('Sertifikasi & Pelatihan');
    for (const cert of certificates) {
      ensureSpace(40);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(15, 23, 42);
      doc.text(cert.eventName, margin, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(71, 85, 105);
      doc.text(`${cert.organizer} · ${cert.year}`, margin, y + 13);
      y += 28;
    }
  }

  if (activities.length > 0) {
    drawSectionTitle('Pengalaman & Kegiatan');
    for (const act of activities) {
      ensureSpace(42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(15, 23, 42);
      doc.text(`${act.title}`, margin, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(71, 85, 105);
      doc.text(formatDateDMY(act.date), pageWidth - margin, y, { align: 'right' });
      y += 14;
      if (act.description) {
        const desc = doc.splitTextToSize(act.description, contentWidth);
        doc.text(desc, margin, y);
        y += desc.length * 13 + 6;
      }
    }
  }

  if (documents.length > 0) {
    drawSectionTitle('Karya & Dokumen Terpilih');
    for (const d of documents.slice(0, 10)) {
      ensureSpace(30);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(`• ${d.title} (${d.category}, ${d.year}) [${d.fileType}]`, margin, y);
      y += 16;
    }
  }

  const slug = profile.username || 'portofolio';
  doc.save(`CV_${template.toUpperCase()}_${slug}.pdf`);
}

export function exportPortfolioToExcel(params: {
  profile: UserProfile | null;
  documents: PortfolioDocument[];
  certificates: Certificate[];
  achievements: Achievement[];
  activities: Activity[];
  galleries: GalleryItem[];
  logs: AuditLog[];
}): void {
  const wb = XLSX.utils.book_new();

  const profileRows = params.profile
    ? [
        {
          Nama_Lengkap: params.profile.fullName,
          Username: params.profile.username,
          NIP_NISN: params.profile.nipNisn,
          Jabatan_Kelas: params.profile.jabatanKelas,
          Tempat_Lahir: params.profile.birthPlace,
          Tanggal_Lahir: params.profile.birthDate ? formatDateDMY(params.profile.birthDate) : '',
          Pendidikan: params.profile.education,
          Bidang_Keahlian: params.profile.expertise,
          Email: params.profile.email,
          No_HP: params.profile.phone,
          Alamat: params.profile.address,
          Bio: params.profile.bio,
        },
      ]
    : [];

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(profileRows), 'Profil');
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      params.documents.map((d) => ({
        Judul: d.title,
        Kategori: d.category,
        Tahun: d.year,
        Tipe: d.fileType,
        Nama_File: d.fileName,
        Publik: d.isPublic ? 'Ya' : 'Tidak',
        Deskripsi: d.description,
      }))
    ),
    'Dokumen'
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      params.certificates.map((c) => ({
        Kegiatan: c.eventName,
        Penyelenggara: c.organizer,
        Tahun: c.year,
        Publik: c.isPublic ? 'Ya' : 'Tidak',
        Deskripsi: c.description,
      }))
    ),
    'Sertifikat'
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      params.achievements.map((a) => ({
        Prestasi: a.title,
        Tingkat: a.level,
        Tahun: a.year,
        Publik: a.isPublic ? 'Ya' : 'Tidak',
        Deskripsi: a.description,
      }))
    ),
    'Prestasi'
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      params.activities.map((a) => ({
        Kegiatan: a.title,
        Tanggal: formatDateDMY(a.date),
        Tahun: a.year,
        Publik: a.isPublic ? 'Ya' : 'Tidak',
        Deskripsi: a.description,
      }))
    ),
    'Kegiatan'
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      params.galleries.map((g) => ({
        Judul: g.title,
        Album: g.album,
        Tahun: g.year,
        Keterangan: g.caption,
      }))
    ),
    'Galeri'
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      params.logs.map((l) => ({
        Aksi: l.action,
        Modul: l.module,
        Detail: l.detail,
      }))
    ),
    'Riwayat_Aktivitas'
  );

  const fileName = `Portofolio_${params.profile?.username || 'data'}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

export function exportBackupJSON(payload: Record<string, unknown>, username: string): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `backup_portofolio_${username}_${formatDateDMY(new Date())}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
