// The API stores a notification as a kind plus parameters; the text is chosen here, in the reader's language.

type Params = Record<string, unknown>;

const KINDS: Record<string, { key: string; params: (p: Params) => Record<string, string | number> }> = {
  new_registration: { key: "note_new_registration", params: (p) => ({ attendee: String(p.name ?? ""), conference: String(p.title ?? "") }) },
  new_waitlister: { key: "note_new_waitlist", params: (p) => ({ attendee: String(p.name ?? ""), conference: String(p.title ?? "") }) },
  attendee_cancelled: { key: "note_attendee_cancelled", params: (p) => ({ attendee: String(p.name ?? ""), conference: String(p.title ?? "") }) },
  waitlist_promoted: { key: "note_waitlist_promoted", params: (p) => ({ attendee: String(p.name ?? ""), conference: String(p.title ?? "") }) },
  conference_full: { key: "note_conference_full", params: (p) => ({ conference: String(p.title ?? "") }) },
  new_feedback: { key: "note_new_feedback", params: (p) => ({ organizer: String(p.organizer ?? ""), subject: String(p.subject ?? "") }) },
  feedback_reply: { key: "note_feedback_reply", params: (p) => ({ subject: String(p.subject ?? "") }) },
  account_restored: { key: "note_account_restored", params: () => ({}) },
  conference_removed: { key: "note_conference_removed", params: (p) => ({ conference: String(p.title ?? "") }) },
  reminders_sent: { key: "note_reminders_sent", params: (p) => ({ count: Number(p.count ?? 0), conference: String(p.title ?? "") }) },
  new_organizer: { key: "note_new_organizer", params: (p) => ({ name: String(p.name ?? "") }) },
  contact_message: { key: "note_new_contact", params: (p) => ({ name: String(p.name ?? "") }) },
};

export function notificationText(
  t: (key: string, values?: Record<string, string | number>) => string,
  kind: string,
  params: Params,
): string {
  const known = KINDS[kind];
  return known ? t(known.key, known.params(params)) : t("note_generic");
}

/** Every message key a notification can use (the translation test checks they exist). */
export const NOTIFICATION_KEYS = [...Object.values(KINDS).map((k) => k.key), "note_generic"];
