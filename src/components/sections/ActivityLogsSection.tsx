import React, { useMemo, useState } from 'react';
import type { AuditLog, LogAction } from '../../types/portfolio';

export const ActivityLogsSection: React.FC<{ logs: AuditLog[] }> = ({ logs }) => {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      const matchSearch =
        l.detail.toLowerCase().includes(search.toLowerCase()) ||
        l.module.toLowerCase().includes(search.toLowerCase());
      const matchAction = actionFilter === 'all' || l.action === actionFilter;
      return matchSearch && matchAction;
    });
  }, [logs, search, actionFilter]);

  const formatTimestamp = (ts: unknown) => {
    if (!ts) return 'Baru saja';
    if (typeof (ts as { toDate?: () => Date }).toDate === 'function') {
      return (ts as { toDate: () => Date }).toDate().toLocaleString('id-ID');
    }
    return String(ts);
  };

  const labelAction = (action: LogAction) => {
    switch (action) {
      case 'LOGIN':
        return 'Login';
      case 'UPLOAD_FILE':
        return 'Upload File';
      case 'EDIT_DATA':
        return 'Edit Data';
      case 'DELETE_DATA':
        return 'Hapus Data';
      case 'PUBLISH_PORTFOLIO':
        return 'Publikasi';
      case 'ADMIN_ACTION':
        return 'Aksi Admin';
      default:
        return action;
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center dark:border-slate-800 dark:bg-slate-900">
        <div className="relative flex-1">
          <i className="fa-solid fa-magnifying-glass absolute top-1/2 left-3.5 -translate-y-1/2 text-xs text-slate-400" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari riwayat aktivitas..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pr-3 pl-9 text-sm text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />
        </div>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
        >
          <option value="all">Semua Aktivitas</option>
          <option value="LOGIN">Login</option>
          <option value="UPLOAD_FILE">Upload File</option>
          <option value="EDIT_DATA">Edit Data</option>
          <option value="DELETE_DATA">Hapus Data</option>
          <option value="PUBLISH_PORTFOLIO">Publikasi</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
            Belum ada riwayat aktivitas yang sesuai filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3.5">Jenis Aksi</th>
                  <th className="px-4 py-3.5">Modul</th>
                  <th className="px-4 py-3.5">Keterangan</th>
                  <th className="px-5 py-3.5 text-right">Waktu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filtered.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="px-5 py-3 text-xs font-semibold text-blue-600 dark:text-blue-400">
                      {labelAction(log.action)}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700 dark:text-slate-300">
                      {log.module}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-900 dark:text-slate-100">
                      {log.detail}
                    </td>
                    <td className="px-5 py-3 text-right font-mono-tabular text-xs text-slate-500 dark:text-slate-400">
                      {formatTimestamp(log.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
