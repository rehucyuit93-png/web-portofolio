export const MONTHS_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
] as const;

export const MONTHS_SHORT_ID = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
] as const;

export interface DateParts {
  year: number;
  month: number; // 1..12
  day: number; // 1..31
}

export function getDaysInMonth(year: number, month: number): number {
  if (!year || !month) return 31;
  return new Date(year, month, 0).getDate();
}

export function getTodayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function toISODateString(parts: DateParts): string {
  const maxDay = getDaysInMonth(parts.year, parts.month);
  const safeDay = Math.min(Math.max(1, parts.day), maxDay);
  return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;
}

export function parseDateParts(value: unknown): DateParts | null {
  if (!value) return null;

  if (typeof (value as { toDate?: () => Date }).toDate === 'function') {
    const d = (value as { toDate: () => Date }).toDate();
    if (!Number.isNaN(d.getTime())) {
      return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
    }
    return null;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return { year: value.getFullYear(), month: value.getMonth() + 1, day: value.getDate() };
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    // YYYY-MM-DD or YYYY/MM/DD (parse directly to avoid UTC midnight day-shift)
    const isoMatch = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(trimmed);
    if (isoMatch) {
      const year = Number(isoMatch[1]);
      const month = Number(isoMatch[2]);
      const day = Number(isoMatch[3]);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return { year, month, day };
      }
    }

    // DD-MM-YYYY or DD/MM/YYYY
    const dmyMatch = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(trimmed);
    if (dmyMatch) {
      const day = Number(dmyMatch[1]);
      const month = Number(dmyMatch[2]);
      const year = Number(dmyMatch[3]);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return { year, month, day };
      }
    }

    // Full ISO timestamp
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return {
        year: parsed.getFullYear(),
        month: parsed.getMonth() + 1,
        day: parsed.getDate(),
      };
    }
  }

  return null;
}

export function formatDateIndo(
  value: unknown,
  style: 'long' | 'short' | 'numeric' = 'long'
): string {
  if (!value) return '';
  const parts = parseDateParts(value);
  if (!parts) return typeof value === 'string' ? value : '';

  const { day, month, year } = parts;
  if (style === 'numeric') {
    return `${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}-${year}`;
  }
  if (style === 'short') {
    return `${day} ${MONTHS_SHORT_ID[month - 1]} ${year}`;
  }
  return `${day} ${MONTHS_ID[month - 1]} ${year}`;
}

export function formatDateTimeIndo(ts: unknown): string {
  if (!ts) return 'Baru saja';

  let dateObj: Date | null = null;
  if (typeof (ts as { toDate?: () => Date }).toDate === 'function') {
    dateObj = (ts as { toDate: () => Date }).toDate();
  } else if (ts instanceof Date) {
    dateObj = ts;
  } else if (typeof ts === 'string') {
    const parsed = new Date(ts);
    if (!Number.isNaN(parsed.getTime())) dateObj = parsed;
  }

  if (!dateObj || Number.isNaN(dateObj.getTime())) {
    return typeof ts === 'string' ? formatDateIndo(ts) || ts : 'Baru saja';
  }

  const day = dateObj.getDate();
  const monthName = MONTHS_SHORT_ID[dateObj.getMonth()];
  const year = dateObj.getFullYear();
  const hh = String(dateObj.getHours()).padStart(2, '0');
  const mm = String(dateObj.getMinutes()).padStart(2, '0');
  return `${day} ${monthName} ${year}, ${hh}.${mm}`;
}
