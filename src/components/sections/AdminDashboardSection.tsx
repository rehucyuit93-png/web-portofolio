import React, { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatDateDMY } from '../../lib/dateFormat';
import { formatAuthErrorMessage, sendPasswordResetSafe } from '../../lib/firebase';
import { formatFirestoreErrorForUser } from '../../lib/firestoreError';
import {
  adminCreateUserRecord,
  adminDeleteUserRecord,
  adminUpdateUserRoleOrStatus,
  fetchAllAdminCollections,
  writeAuditLog,
} from '../../lib/portfolioService';
import type {
  Achievement,
  AuditLog,
  Certificate,
  PortfolioDocument,
  UserAccount,
  UserRole,
} from '../../types/portfolio';
import { ConfirmModal } from '../Toast';

interface AdminDashboardSectionProps {
  adminAccount: UserAccount;
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const AdminDashboardSection: React.FC<AdminDashboardSectionProps> = ({
  adminAccount,
  onNotify,
}) => {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [documents, setDocuments] = useState<PortfolioDocument[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [showAddUser, setShowAddUser] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserAccount | null>(null);

  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('guru');
  const [newNipNisn, setNewNipNisn] = useState('');
  const [newJabatan, setNewJabatan] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchAllAdminCollections();
      setUsers(res.users);
      setDocuments(res.documents);
      setCertificates(res.certificates);
      setAchievements(res.achievements);
      setLogs(res.logs);
    } catch (err: unknown) {
      onNotify('error', formatFirestoreErrorForUser(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchSearch =
        u.displayName.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase()) ||
        (u.nipNisn || '').toLowerCase().includes(search.toLowerCase());
      const matchRole = roleFilter === 'all' || u.role === roleFilter;
      return matchSearch && matchRole;
    });
  }, [users, search, roleFilter]);

  // Analytics datasets
  const roleDistribution = useMemo(() => {
    const counts = { admin: 0, guru: 0, siswa: 0 };
    users.forEach((u) => {
      if (u.role in counts) counts[u.role] += 1;
    });
    return [
      { name: 'Admin', value: counts.admin, color: '#7C3AED' },
      { name: 'Guru', value: counts.guru, color: '#2563EB' },
      { name: 'Siswa', value: counts.siswa, color: '#0EA5E9' },
    ];
  }, [users]);

  const yearlyUploads = useMemo(() => {
    const map = new Map<number, { year: string; dokumen: number; sertifikat: number }>();
    documents.forEach((d) => {
      const cur = map.get(d.year) || { year: String(d.year), dokumen: 0, sertifikat: 0 };
      cur.dokumen += 1;
      map.set(d.year, cur);
    });
    certificates.forEach((c) => {
      const cur = map.get(c.year) || { year: String(c.year), dokumen: 0, sertifikat: 0 };
      cur.sertifikat += 1;
      map.set(c.year, cur);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([, val]) => val);
  }, [documents, certificates]);

  const dailyActivity = useMemo(() => {
    const map = new Map<string, number>();
    logs.forEach((l) => {
      const ts = l.createdAt as { toDate?: () => Date } | undefined;
      const dateStr = ts?.toDate ? formatDateDMY(ts.toDate()) : 'Hari Ini';
      map.set(dateStr, (map.get(dateStr) || 0) + 1);
    });
    return Array.from(map.entries())
      .slice(0, 7)
      .reverse()
      .map(([tanggal, aktivitas]) => ({ tanggal, aktivitas }));
  }, [logs]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await adminCreateUserRecord({
        displayName: newName.trim(),
        email: newEmail.trim(),
        role: newRole,
        nipNisn: newNipNisn.trim(),
        jabatanKelas: newJabatan.trim(),
        adminUid: adminAccount.uid,
      });
      await writeAuditLog({
        uid: adminAccount.uid,
        userEmail: adminAccount.email,
        userName: adminAccount.displayName,
        action: 'ADMIN_ACTION',
        module: 'Manajemen Pengguna',
        detail: `Menambahkan pengguna ${newName.trim()} (${newRole})`,
      });
      setShowAddUser(false);
      setNewName('');
      setNewEmail('');
      setNewNipNisn('');
      setNewJabatan('');
      onNotify('success', 'Pengguna baru berhasil ditambahkan.');
      await loadData();
    } catch (err: unknown) {
      onNotify('error', formatFirestoreErrorForUser(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (email: string) => {
    try {
      await sendPasswordResetSafe(email);
      onNotify('success', `Email reset password dikirim ke ${email}.`);
    } catch (err: unknown) {
      onNotify('error', formatAuthErrorMessage(err).message);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await adminDeleteUserRecord(deleteTarget.uid);
      await writeAuditLog({
        uid: adminAccount.uid,
        userEmail: adminAccount.email,
        userName: adminAccount.displayName,
        action: 'ADMIN_ACTION',
        module: 'Manajemen Pengguna',
        detail: `Menghapus pengguna ${deleteTarget.displayName} (${deleteTarget.email})`,
      });
      setDeleteTarget(null);
      onNotify('success', 'Pengguna berhasil dihapus.');
      await loadData();
    } catch (err: unknown) {
      onNotify('error', formatFirestoreErrorForUser(err));
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI Overview */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Jumlah Pengguna</p>
          <p className="mt-2 font-mono-tabular text-3xl font-bold text-slate-900 dark:text-white">
            {users.length}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Dokumen Upload</p>
          <p className="mt-2 font-mono-tabular text-3xl font-bold text-blue-600 dark:text-blue-400">
            {documents.length}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Sertifikat</p>
          <p className="mt-2 font-mono-tabular text-3xl font-bold text-violet-600 dark:text-violet-400">
            {certificates.length}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Prestasi & Log</p>
          <p className="mt-2 font-mono-tabular text-3xl font-bold text-slate-900 dark:text-white">
            {achievements.length} / {logs.length}
          </p>
        </div>
      </div>

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Komposisi Pengguna</h3>
          <div className="mt-3 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={roleDistribution} dataKey="value" nameKey="name" innerRadius={48} outerRadius={78} paddingAngle={3}>
                  {roleDistribution.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 text-xs text-slate-600 dark:text-slate-300">
            {roleDistribution.map((r) => (
              <span key={r.name} className="font-mono-tabular">
                {r.name}: {r.value}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Dokumen & Sertifikat per Tahun
          </h3>
          <div className="mt-3 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={yearlyUploads}>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b826" />
                <XAxis dataKey="year" fontSize={11} />
                <YAxis allowDecimals={false} fontSize={11} />
                <Tooltip />
                <Bar dataKey="dokumen" name="Dokumen" fill="#2563EB" radius={[4, 4, 0, 0]} />
                <Bar dataKey="sertifikat" name="Sertifikat" fill="#7C3AED" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Aktivitas Harian</h3>
          <div className="mt-3 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyActivity}>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b826" />
                <XAxis dataKey="tanggal" fontSize={11} />
                <YAxis allowDecimals={false} fontSize={11} />
                <Tooltip />
                <Bar dataKey="aktivitas" name="Aktivitas" fill="#2563EB" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* User Management Table */}
      <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:p-5 dark:border-slate-800">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Manajemen Seluruh Pengguna
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Kelola peran (Admin, Guru, Siswa), reset password, atau hapus akun.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama / email..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 outline-none focus:border-blue-600 sm:w-auto dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 sm:w-auto dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            >
              <option value="all">Semua Role</option>
              <option value="admin">Admin</option>
              <option value="guru">Guru</option>
              <option value="siswa">Siswa</option>
            </select>
            <button
              type="button"
              onClick={() => setShowAddUser(true)}
              className="w-full rounded-xl bg-blue-600 px-3.5 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 sm:w-auto sm:py-2"
            >
              + Tambah Pengguna
            </button>
          </div>
        </div>

        <div>
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500">Memuat data pengguna...</div>
          ) : (
            <>
              {/* Mobile User Cards */}
              <div className="divide-y divide-slate-200 md:hidden dark:divide-slate-800">
                {filteredUsers.map((u) => (
                  <div key={u.uid} className="space-y-2.5 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 dark:text-white break-words">
                          {u.displayName}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 break-all">
                          {u.email}
                        </p>
                        {u.nipNisn && (
                          <p className="mt-0.5 font-mono-tabular text-[11px] text-slate-500 dark:text-slate-400">
                            ID: {u.nipNisn}
                          </p>
                        )}
                      </div>
                      {u.isActive ? (
                        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
                          Aktif
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 shrink-0">
                          Nonaktif
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <select
                        value={u.role}
                        onChange={async (e) => {
                          const nextRole = e.target.value as UserRole;
                          await adminUpdateUserRoleOrStatus(u.uid, { role: nextRole }, adminAccount.uid);
                          onNotify('success', `Role ${u.displayName} diubah menjadi ${nextRole}.`);
                          await loadData();
                        }}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium dark:border-slate-700 dark:bg-slate-950"
                      >
                        <option value="admin">Admin</option>
                        <option value="guru">Guru</option>
                        <option value="siswa">Siswa</option>
                      </select>

                      <div className="flex items-center gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => handleResetPassword(u.email)}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          Reset Password
                        </button>
                        {u.uid !== adminAccount.uid && (
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(u)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                            title="Hapus Pengguna"
                          >
                            <i className="fa-solid fa-trash" aria-hidden="true" />
                          </button>
                        )}
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
                      <th className="px-5 py-3">Pengguna</th>
                      <th className="px-4 py-3">NIP / NISN</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-5 py-3 text-right">Aksi Admin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {filteredUsers.map((u) => (
                      <tr key={u.uid} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="px-5 py-3">
                          <p className="font-semibold text-slate-900 dark:text-white">{u.displayName}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{u.email}</p>
                        </td>
                        <td className="px-4 py-3 font-mono-tabular text-xs text-slate-600 dark:text-slate-300">
                          {u.nipNisn || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={u.role}
                            onChange={async (e) => {
                              const nextRole = e.target.value as UserRole;
                              await adminUpdateUserRoleOrStatus(u.uid, { role: nextRole }, adminAccount.uid);
                              onNotify('success', `Role ${u.displayName} diubah menjadi ${nextRole}.`);
                              await loadData();
                            }}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium dark:border-slate-700 dark:bg-slate-950"
                          >
                            <option value="admin">Admin</option>
                            <option value="guru">Guru</option>
                            <option value="siswa">Siswa</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {u.isActive ? (
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">Aktif</span>
                          ) : (
                            <span className="font-semibold text-rose-600 dark:text-rose-400">Nonaktif</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div className="inline-flex items-center gap-2 text-xs">
                            <button
                              type="button"
                              onClick={() => handleResetPassword(u.email)}
                              className="rounded-lg border border-slate-200 px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                              Reset Password
                            </button>
                            {u.uid !== adminAccount.uid && (
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(u)}
                                className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                                title="Hapus Pengguna"
                              >
                                <i className="fa-solid fa-trash" aria-hidden="true" />
                              </button>
                            )}
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
      </div>

      {/* Monitoring Logs */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="text-base font-bold text-slate-900 dark:text-white">
          Monitoring Aktivitas Pengguna Terbaru
        </h3>
        <div className="mt-4 divide-y divide-slate-200 dark:divide-slate-800">
          {logs.slice(0, 12).map((l) => (
            <div key={l.id} className="flex flex-col justify-between gap-2 py-2.5 text-xs sm:flex-row sm:items-center">
              <div>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {l.userName || l.userEmail || l.uid}
                </span>{' '}
                <span className="text-slate-500 dark:text-slate-400">— {l.detail}</span>
              </div>
              <span className="font-mono-tabular text-slate-500 dark:text-slate-400">
                {l.module} · {l.action}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Add User Modal */}
      {showAddUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-4">
          <form
            onSubmit={handleAddUser}
            className="max-h-[92dvh] w-full max-w-md space-y-4 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-xl sm:p-6 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Tambah Pengguna Baru
              </h3>
              <button
                type="button"
                onClick={() => setShowAddUser(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <i className="fa-solid fa-xmark" aria-hidden="true" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Nama Lengkap
              </label>
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Email
              </label>
              <input
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Role
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                >
                  <option value="guru">Guru</option>
                  <option value="siswa">Siswa</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  NIP / NISN
                </label>
                <input
                  type="text"
                  value={newNipNisn}
                  onChange={(e) => setNewNipNisn(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono-tabular text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Jabatan / Kelas
              </label>
              <input
                type="text"
                value={newJabatan}
                onChange={(e) => setNewJabatan(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddUser(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {submitting ? 'Menyimpan...' : 'Simpan Pengguna'}
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Hapus Pengguna?"
        description={`Anda yakin ingin menghapus data akun ${deleteTarget?.displayName || ''} (${deleteTarget?.email || ''})?`}
        confirmLabel="Ya, Hapus"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
