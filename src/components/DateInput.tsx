import React, { useEffect, useState } from 'react';
import {
  formatDateDMY,
  getDaysInMonth,
  parseDateParts,
  toISODateString,
} from '../lib/dateFormat';

interface DateInputProps {
  value: string;
  onChange: (isoDate: string) => void;
  required?: boolean;
  placeholder?: string;
  className?: string;
}

export const DateInput: React.FC<DateInputProps> = ({
  value,
  onChange,
  required = false,
  placeholder = 'hh-bb-tttt',
  className = '',
}) => {
  const [text, setText] = useState(() => (value ? formatDateDMY(value) : ''));

  useEffect(() => {
    setText(value ? formatDateDMY(value) : '');
  }, [value]);

  const parsedParts = parseDateParts(value);
  const isoValue = parsedParts ? toISODateString(parsedParts) : '';

  const handleTextChange = (raw: string) => {
    const cleaned = raw.replace(/[^\d-/]/g, '');
    let next = cleaned;

    if (raw.length > text.length) {
      if (/^\d+$/.test(cleaned)) {
        if (cleaned.length > 4) {
          next = `${cleaned.slice(0, 2)}-${cleaned.slice(2, 4)}-${cleaned.slice(4, 8)}`;
        } else if (cleaned.length > 2) {
          next = `${cleaned.slice(0, 2)}-${cleaned.slice(2)}`;
        }
      } else if (/^\d{2}$/.test(cleaned) || /^\d{2}-\d{2}$/.test(cleaned)) {
        next = `${cleaned}-`;
      }
    }

    next = next.slice(0, 10);
    setText(next);

    if (!next.trim()) {
      onChange('');
      return;
    }

    const match = /^(\d{2})[-/](\d{2})[-/](\d{4})$/.exec(next.trim());
    if (match) {
      const day = Number(match[1]);
      const month = Number(match[2]);
      const year = Number(match[3]);
      if (
        year >= 1900 &&
        year <= 2100 &&
        month >= 1 &&
        month <= 12 &&
        day >= 1 &&
        day <= getDaysInMonth(year, month)
      ) {
        onChange(toISODateString({ year, month, day }));
      }
    }
  };

  const handleBlur = () => {
    if (!text.trim()) {
      if (required && isoValue) {
        setText(formatDateDMY(isoValue));
      } else {
        onChange('');
      }
      return;
    }

    const match = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(text.trim());
    if (match) {
      const day = Number(match[1]);
      const month = Number(match[2]);
      const year = Number(match[3]);
      if (
        year >= 1900 &&
        year <= 2100 &&
        month >= 1 &&
        month <= 12 &&
        day >= 1 &&
        day <= getDaysInMonth(year, month)
      ) {
        const nextIso = toISODateString({ year, month, day });
        onChange(nextIso);
        setText(formatDateDMY(nextIso));
        return;
      }
    }

    // Revert to last valid value if incomplete/invalid
    setText(isoValue ? formatDateDMY(isoValue) : '');
  };

  return (
    <div className={`relative ${className}`}>
      <input
        type="text"
        inputMode="numeric"
        required={required}
        value={text}
        onChange={(e) => handleTextChange(e.target.value)}
        onBlur={handleBlur}
        placeholder={placeholder}
        maxLength={10}
        className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-10 pl-3.5 font-mono-tabular text-sm text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
      />
      <div
        title="Pilih tanggal"
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-400 hover:text-blue-600"
      >
        <i className="fa-regular fa-calendar pointer-events-none text-sm" aria-hidden="true" />
        <input
          type="date"
          aria-label="Pilih tanggal"
          value={isoValue}
          onChange={(e) => {
            const val = e.target.value;
            onChange(val);
            setText(val ? formatDateDMY(val) : '');
          }}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </div>
    </div>
  );
};
