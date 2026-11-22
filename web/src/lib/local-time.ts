// <input type="datetime-local"> works in wall-clock time with no zone. Conferences are in Sri Lanka time
// (UTC+05:30 all year, no daylight saving), so the editor converts at the edges.

export const EDITOR_TZ = "Asia/Colombo";
const OFFSET = "+05:30";

/** ISO instant -> "YYYY-MM-DDTHH:mm" in Sri Lanka time, for a datetime-local input. */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: EDITOR_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** "YYYY-MM-DDTHH:mm" in Sri Lanka time -> ISO instant with the offset, or null when empty or malformed. */
export function fromLocalInput(value: string): string | null {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? `${value}:00${OFFSET}` : null;
}

/** "YYYY-MM-DD" (a conference day) plus "HH:mm" -> ISO instant in Sri Lanka time. */
export function dayAndTime(day: string, time: string): string | null {
  return fromLocalInput(`${day}T${time}`);
}

/** The "HH:mm" part of an instant, in Sri Lanka time. */
export function timeOf(iso: string): string {
  return toLocalInput(iso).slice(11);
}
