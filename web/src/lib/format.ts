// Dates, times and numbers in the reader's language, shown in the conference's own time zone.
//
// Month and day names come from our own tables (CLDR wording), not from Intl: Chrome ships no Sinhala date
// data, and Node and browsers disagree on Tamil word order and some English abbreviations. Pages render on
// the server and then in the browser, so both must produce exactly the same text (or React reports a
// hydration mismatch). Only the time zone arithmetic uses Intl, which is the same everywhere.
import { INTL_LOCALE, type Locale } from "@/i18n/routing";

type Names = { months: string[]; monthsShort: string[]; days: string[]; am: string; pm: string };

const NAMES: Record<Locale, Names> = {
  en: {
    months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    monthsShort: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    am: "am",
    pm: "pm",
  },
  si: {
    months: ["ජනවාරි", "පෙබරවාරි", "මාර්තු", "අප්‍රේල්", "මැයි", "ජූනි", "ජූලි", "අගෝස්තු", "සැප්තැම්බර්", "ඔක්තෝබර්", "නොවැම්බර්", "දෙසැම්බර්"],
    monthsShort: ["ජන", "පෙබ", "මාර්තු", "අප්‍රේල්", "මැයි", "ජූනි", "ජූලි", "අගෝ", "සැප්", "ඔක්", "නොවැ", "දෙසැ"],
    days: ["ඉරිදා", "සඳුදා", "අඟහරුවාදා", "බදාදා", "බ්‍රහස්පතින්දා", "සිකුරාදා", "සෙනසුරාදා"],
    am: "පෙ.ව.",
    pm: "ප.ව.",
  },
  ta: {
    months: ["ஜனவரி", "பிப்ரவரி", "மார்ச்", "ஏப்ரல்", "மே", "ஜூன்", "ஜூலை", "ஆகஸ்ட்", "செப்டம்பர்", "அக்டோபர்", "நவம்பர்", "டிசம்பர்"],
    monthsShort: ["ஜன.", "பிப்.", "மார்.", "ஏப்.", "மே", "ஜூன்", "ஜூலை", "ஆக.", "செப்.", "அக்.", "நவ.", "டிச."],
    days: ["ஞாயிறு", "திங்கள்", "செவ்வாய்", "புதன்", "வியாழன்", "வெள்ளி", "சனி"],
    am: "முற்பகல்",
    pm: "பிற்பகல்",
  },
};

export const DEFAULT_TZ = "Asia/Colombo";

type Parts = { year: number; month: number; day: number; hour: number; minute: number; weekday: number };

/** Calendar parts of an instant in a time zone (month 0-11, weekday 0 = Sunday). */
function partsIn(value: string | Date, timeZone: string): Parts {
  const date = typeof value === "string" ? new Date(value) : value;
  const raw = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => Number(raw.find((p) => p.type === type)?.value ?? "0");
  const year = get("year");
  const month = get("month") - 1;
  const day = get("day");
  return { year, month, day, hour: get("hour"), minute: get("minute"), weekday: new Date(Date.UTC(year, month, day)).getUTCDay() };
}

/** A yyyy-mm-dd day (no time) read as that calendar date, not shifted by any time zone. */
function dayParts(day: string): Parts {
  const [year, month, date] = day.slice(0, 10).split("-").map(Number);
  return { year, month: month - 1, day: date, hour: 0, minute: 0, weekday: new Date(Date.UTC(year, month - 1, date)).getUTCDay() };
}

export type DateStyle = "long" | "medium" | "short" | "month-day" | "weekday";

function render(p: Parts, locale: Locale, style: DateStyle): string {
  const n = NAMES[locale];
  if (locale === "si") {
    switch (style) {
      case "long":
        return `${p.year} ${n.months[p.month]} ${p.day}, ${n.days[p.weekday]}`;
      case "short":
        return `${p.year} ${n.monthsShort[p.month]} ${p.day}`;
      case "month-day":
        return `${n.monthsShort[p.month]} ${p.day}`;
      case "weekday":
        return n.days[p.weekday];
      default:
        return `${p.year} ${n.months[p.month]} ${p.day}`;
    }
  }
  // English (en-GB) and Tamil both put the day first.
  switch (style) {
    case "long":
      return `${n.days[p.weekday]}, ${p.day} ${n.months[p.month]} ${p.year}`;
    case "short":
      return `${p.day} ${n.monthsShort[p.month]} ${p.year}`;
    case "month-day":
      return `${p.day} ${n.monthsShort[p.month]}`;
    case "weekday":
      return n.days[p.weekday];
    default:
      return `${p.day} ${n.months[p.month]} ${p.year}`;
  }
}

/** An instant (ISO date-time) as a date in the given time zone. */
export function formatDate(iso: string, locale: Locale, style: DateStyle = "medium", timeZone = DEFAULT_TZ): string {
  return render(partsIn(iso, timeZone), locale, style);
}

/** A calendar day (yyyy-mm-dd). */
export function formatDay(day: string, locale: Locale, style: DateStyle = "medium"): string {
  return render(dayParts(day), locale, style);
}

export function formatTime(iso: string, locale: Locale, timeZone = DEFAULT_TZ): string {
  const p = partsIn(iso, timeZone);
  const n = NAMES[locale];
  const clock = `${p.hour % 12 || 12}${locale === "si" ? "." : ":"}${String(p.minute).padStart(2, "0")}`;
  const half = p.hour < 12 ? n.am : n.pm;
  return locale === "en" ? `${clock} ${half}` : `${half} ${clock}`;
}

/** Month abbreviation and day number for calendar-style date badges. */
export function dateBadge(iso: string, locale: Locale, timeZone = DEFAULT_TZ): { month: string; day: number } {
  const p = partsIn(iso, timeZone);
  return { month: NAMES[locale].monthsShort[p.month], day: p.day };
}

/** A date range: one date for one-day events, otherwise "12 Feb – 13 Feb 2027" (both years when they differ). */
export function formatRange(startIso: string, endIso: string, locale: Locale, timeZone = DEFAULT_TZ): string {
  const a = partsIn(startIso, timeZone);
  const b = partsIn(endIso, timeZone);
  if (a.year === b.year && a.month === b.month && a.day === b.day) return render(a, locale, "medium");
  return `${render(a, locale, a.year === b.year ? "month-day" : "short")} – ${render(b, locale, "short")}`;
}

export function formatNumber(n: number, locale: Locale): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale]).format(n);
}

/** The text of a {en, si, ta} field in the reader's language, falling back to English. */
export function localized(text: { en: string; si?: string | null; ta?: string | null } | null | undefined, locale: Locale): string {
  if (!text) return "";
  return (locale === "si" ? text.si : locale === "ta" ? text.ta : null) || text.en;
}
