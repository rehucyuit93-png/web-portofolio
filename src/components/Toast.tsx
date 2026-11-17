import React from 'react';

export interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

export const ToastContainer: React.FC<{
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="no-print fixed right-4 bottom-4 z-50 flex max-w-sm flex-col gap-2">
      {toasts.map((toast) => {
        const tone =
          toast.type === 'success'
            ? 'border-emerald-200 bg-white text-slate-900 dark:border-emerald-800/70 dark:bg-slate-900 dark:text-slate-100'
            : toast.type === 'error'
              ? 'border-rose-200 bg-white text-slate-900 dark:border-rose-800/70 dark:bg-slate-900 dark:text-slate-100'
              : 'border-blue-200 bg-white text-slate-900 dark:border-blue-800/70 dark:bg-slate-900 dark:text-slate-100';

        const icon =
          toast.type === 'success'
            ? 'fa-circle-check text-emerald-600 dark:text-emerald-400'
            : toast.type === 'error'
              ? 'fa-circle-exclamation text-rose-600 dark:text-rose-400'
              : 'fa-circle-info text-blue-600 dark:text-blue-400';

        return (
          <div
            key={toast.id}
            role="alert"
            className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg ${tone}`}
          >
            <i className={`fa-solid ${icon} mt-0.5 text-base`} aria-hidden="true" />
            <p className="flex-1 leading-snug">{toast.message}</p>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-200"
              aria-label="Tutup notifikasi"
            >
              <i className="fa-solid fa-xmark" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export const ConfirmModal: React.FC<{
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ open, title, description, confirmLabel = 'Hapus', danger = true, onConfirm, onCancel }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{description}</p>
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-xl px-4 py-2 text-sm font-semibold text-white transition-colors ${
              danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
