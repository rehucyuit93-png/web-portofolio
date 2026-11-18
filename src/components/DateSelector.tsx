import React, { useMemo } from 'react';
import {
  MONTHS_ID,
  getDaysInMonth,
  parseDateParts,
  toISODateString,
} from '../lib/dateFormat';

interface DateSelectorProps {
  value: string;
  onChange: (isoDate: string) => void;
  minYear?: number;
  maxYear?: number;
  allowEmpty?: boolean;
  required?: boolean;
  className?: string;
}

export const DateSelector: React.FC<DateSelectorProps> = ({
  value,
  onChange,
  minYear = 1940,
  maxYear = new Date().getFullYear() + 2,
  allowEmpty = false,
  required = false,
  className = '',
}) => {
  const parts = useMemo(() => parseDateParts(value), [value]);

  const currentDay = parts?.day ?? '';
  const currentMonth = parts?.month ?? '';
  const currentYear = parts?.year ?? '';

  const effectiveYear = typeof currentYear === 'number' ? currentYear : new Date().getFullYear();
  const effectiveMonth = typeof currentMonth === 'number' ? currentMonth : 1;
  const maxDay = getDaysInMonth(effectiveYear, effectiveMonth);

  const days = useMemo(() => Array.from({ length: maxDay }, (_, i) => i + 1), [maxDay]);
  const years = useMemo(() => {
    const list: number[] = [];
    for (let y = maxYear; y >= minYear; y -= 1) {
      list.push(y);
    }
    return list;
  }, [minYear, maxYear]);

  const updatePart = (patch: Partial<{ day: number; month: number; year: number }>) => {
    const fallbackYear = Math.min(maxYear, Math.max(minYear, new Date().getFullYear()));
    const nextYear = patch.year ?? (typeof currentYear === 'number' ? currentYear : fallbackYear);
    const nextMonth = patch.month ?? (typeof currentMonth === 'number' ? currentMonth : 1);
    const nextDay = patch.day ?? (typeof currentDay === 'number' ? currentDay : 1);
    onChange(toISODateString({ year: nextYear, month: nextMonth, day: nextDay }));
  };

  const selectClass =
    'rounded-xl border border-slate-200 bg-white px-2.5 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white';

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Tanggal (1-31) */}
        <select
          aria-label="Tanggal"
          required={required}
          value={currentDay}
          onChange={(e) => {
            if (!e.target.value) {
              if (allowEmpty) onChange('');
              return;
            }
            updatePart({ day: Number(e.target.value) });
          }}
          className={`w-[72px] shrink-0 font-mono-tabular ${selectClass}`}
        >
          <option value="">Tgl</option>
          {days.map((d) => (
            <option key={d} value={d}>
              {String(d).padStart(2, '0')}
            </option>
          ))}
        </select>

        {/* Bulan (Januari-Desember) */}
        <select
          aria-label="Bulan"
          required={required}
          value={currentMonth}
          onChange={(e) => {
            if (!e.target.value) {
              if (allowEmpty) onChange('');
              return;
            }
            updatePart({ month: Number(e.target.value) });
          }}
          className={`min-w-0 flex-1 ${selectClass}`}
        >
          <option value="">Bulan</option>
          {MONTHS_ID.map((label, idx) => (
            <option key={label} value={idx + 1}>
              {label}
            </option>
          ))}
        </select>

        {/* Tahun (YYYY) */}
        <select
          aria-label="Tahun"
          required={required}
          value={currentYear}
          onChange={(e) => {
            if (!e.target.value) {
              if (allowEmpty) onChange('');
              return;
            }
            updatePart({ year: Number(e.target.value) });
          }}
          className={`w-[88px] shrink-0 font-mono-tabular ${selectClass}`}
        >
          <option value="">Tahun</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>

        {allowEmpty && value && (
          <button
            type="button"
            onClick={() => onChange('')}
            title="Kosongkan tanggal"
            aria-label="Kosongkan tanggal"
            className="flex h-10 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
};
