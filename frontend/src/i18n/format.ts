import type { Lang } from '../types';

const LOCALES: Record<Lang, string> = { en: 'en-GB', si: 'si-LK', ta: 'ta-LK' };

/*
 * Chrome ships no Sinhala date data (Intl falls back to English for "si"), so Sinhala dates,
 * times and "x minutes ago" are built from these tables, following the CLDR Sinhala patterns.
 */
const SI_MONTHS = ['ජනවාරි', 'පෙබරවාරි', 'මාර්තු', 'අප්‍රේල්', 'මැයි', 'ජූනි', 'ජූලි', 'අගෝස්තු', 'සැප්තැම්බර්', 'ඔක්තෝබර්', 'නොවැම්බර්', 'දෙසැම්බර්'];
const SI_MONTHS_SHORT = ['ජන', 'පෙබ', 'මාර්තු', 'අප්‍රේල්', 'මැයි', 'ජූනි', 'ජූලි', 'අගෝ', 'සැප්', 'ඔක්', 'නොවැ', 'දෙසැ'];
const SI_DAYS = ['ඉරිදා', 'සඳුදා', 'අඟහරුවාදා', 'බදාදා', 'බ්‍රහස්පතින්දා', 'සිකුරාදා', 'සෙනසුරාදා'];
const SI_DAYS_SHORT = ['ඉරි', 'සඳු', 'අඟ', 'බදා', 'බ්‍රහ', 'සිකු', 'සෙන'];
const SI_UNITS: Record<'minute' | 'hour' | 'day' | 'month' | 'year', string> = { minute: 'මිනිත්තු', hour: 'පැය', day: 'දින', month: 'මාස', year: 'වසර' };

function siTime(d: Date): string {
  const h = d.getHours();
  return `${h < 12 ? 'පෙ.ව.' : 'ප.ව.'} ${h % 12 || 12}.${String(d.getMinutes()).padStart(2, '0')}`;
}

function siDate(d: Date, style: string): string {
  const y = d.getFullYear();
  const m = d.getMonth();
  const day = d.getDate();
  switch (style) {
    case 'long': return `${y} ${SI_MONTHS[m]} ${day}, ${SI_DAYS[d.getDay()]}`;
    case 'short': return `${y} ${SI_MONTHS_SHORT[m]} ${day}`;
    case 'weekday': return SI_DAYS_SHORT[d.getDay()];
    case 'month-day': return `${SI_MONTHS_SHORT[m]} ${day}`;
    case 'month-year': return `${y} ${SI_MONTHS[m]}`;
    default: return `${y} ${SI_MONTHS[m]} ${day}`;
  }
}

export function locale(lang: Lang): string {
  return LOCALES[lang];
}

/** yyyy-mm-dd from the API, read as a local calendar date (no timezone shift). */
export function parseDay(day: string): Date {
  const [y, m, d] = day.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type DateStyle = 'long' | 'medium' | 'short' | 'weekday' | 'month-day' | 'month-year';

export function formatDate(value: string | Date, lang: Lang, style: DateStyle = 'medium'): string {
  const d = typeof value === 'string' ? (value.length <= 10 ? parseDay(value) : new Date(value)) : value;
  if (lang === 'si') return siDate(d, style);
  const opts: Intl.DateTimeFormatOptions =
    style === 'long' ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
      : style === 'short' ? { day: 'numeric', month: 'short', year: 'numeric' }
        : style === 'weekday' ? { weekday: 'short' }
          : style === 'month-day' ? { day: 'numeric', month: 'short' }
            : style === 'month-year' ? { month: 'long', year: 'numeric' }
              : { day: 'numeric', month: 'long', year: 'numeric' };
  return new Intl.DateTimeFormat(locale(lang), opts).format(d);
}

/** Month abbreviation for calendar badges, e.g. "Oct". */
export function monthShort(day: string, lang: Lang): string {
  if (lang === 'si') return SI_MONTHS_SHORT[parseDay(day).getMonth()];
  return new Intl.DateTimeFormat(locale(lang), { month: 'short' }).format(parseDay(day));
}

/** "09:30:00" -> "9:30 AM" in the reader's language. */
export function formatTime(time: string | null | undefined, lang: Lang): string {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const d = new Date(2000, 0, 1, h, m);
  if (lang === 'si') return siTime(d);
  return new Intl.DateTimeFormat(locale(lang), { hour: 'numeric', minute: '2-digit' }).format(d);
}

export function formatDateTime(iso: string, lang: Lang): string {
  if (lang === 'si') {
    const d = new Date(iso);
    return `${siDate(d, 'short')}, ${siTime(d)}`;
  }
  return new Intl.DateTimeFormat(locale(lang), { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    .format(new Date(iso));
}

export function formatNumber(n: number, lang: Lang): string {
  return new Intl.NumberFormat(locale(lang)).format(n);
}

/** "3 hours ago" / "in 2 days" in the reader's language. */
export function relativeTime(iso: string, lang: Lang): string {
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  if (lang === 'si') return siRelative(diff);
  const rtf = new Intl.RelativeTimeFormat(locale(lang), { numeric: 'auto' });
  const abs = Math.abs(diff);
  if (abs < 45) return rtf.format(0, 'second');
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day');
  if (abs < 86400 * 365) return rtf.format(Math.round(diff / (86400 * 30)), 'month');
  return rtf.format(Math.round(diff / (86400 * 365)), 'year');
}

function siRelative(diff: number): string {
  const abs = Math.abs(diff);
  if (abs < 45) return 'දැන්';
  const [n, unit] = abs < 3600 ? [Math.round(abs / 60), 'minute' as const]
    : abs < 86400 ? [Math.round(abs / 3600), 'hour' as const]
      : abs < 86400 * 30 ? [Math.round(abs / 86400), 'day' as const]
        : abs < 86400 * 365 ? [Math.round(abs / (86400 * 30)), 'month' as const]
          : [Math.round(abs / (86400 * 365)), 'year' as const];
  if (unit === 'day' && n === 1) return diff < 0 ? 'ඊයේ' : 'හෙට';
  return diff < 0 ? `${SI_UNITS[unit]} ${n}කට පෙර` : `${SI_UNITS[unit]} ${n}කින්`;
}

/** Whole days from today to a yyyy-mm-dd date (negative when past). */
export function daysUntil(day: string): number {
  const today = parseDay(todayISO()).getTime();
  return Math.round((parseDay(day).getTime() - today) / 86400000);
}

export function weekdayNames(lang: Lang, style: 'short' | 'long' = 'short'): string[] {
  // Monday first, matching the backend.
  const base = new Date(2024, 0, 1); // a Monday
  if (lang === 'si') return Array.from({ length: 7 }, (_, i) => (style === 'long' ? SI_DAYS : SI_DAYS_SHORT)[(i + 1) % 7]);
  return Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale(lang), { weekday: style }).format(new Date(base.getTime() + i * 86400000)),
  );
}

export function monthNames(lang: Lang): string[] {
  if (lang === 'si') return [...SI_MONTHS];
  return Array.from({ length: 12 }, (_, i) => new Intl.DateTimeFormat(locale(lang), { month: 'long' }).format(new Date(2024, i, 1)));
}
