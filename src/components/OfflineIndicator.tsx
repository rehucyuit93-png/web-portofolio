import React from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="no-print fixed bottom-4 left-4 z-50 flex items-center gap-2.5 rounded-xl border border-amber-300 bg-amber-500 px-3.5 py-2 text-xs font-semibold text-white shadow-lg"
    >
      <i className="fa-solid fa-wifi-slash" aria-hidden="true" />
      <span>Mode Offline — Menampilkan data tersimpan lokal</span>
    </div>
  );
};
