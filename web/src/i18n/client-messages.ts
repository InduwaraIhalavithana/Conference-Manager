// The messages client components need. Server components read the full bundle on the server, so the
// browser only downloads these (about a fifth of the bundle) instead of every page and legal text.
// tests/unit/client-messages.test.ts fails if a client component uses a key that is not covered here.

/** Every key starting with one of these is sent (they are picked at run time, e.g. t(`kind_${kind}`)). */
export const CLIENT_PREFIXES = ["err_", "kind_", "cat_", "tab_", "topic_", "nav_", "language_name_", "cd_"] as const;

/** Single keys used by client components. */
export const CLIENT_KEYS = [
  "add_to_calendar", "agenda", "agenda_empty", "all_topics", "badge_cancelled", "browse_conferences",
  "calendar_google", "calendar_ics", "cancel_registration", "chars_left", "clear_filters", "close", "code_label",
  "code_verify_btn", "contact_form_title", "contact_message", "contact_message_ph", "contact_send",
  "contact_send_another", "contact_sent_body", "contact_sent_title", "contact_topic", "copy_link", "day_n",
  "distance_km", "edit_details", "field_email", "field_name", "filter_category", "filter_city", "filter_from",
  "filter_to", "full_waitlist_note", "hold_until", "join_waitlist", "language", "link_copied", "load_more",
  "near_me", "near_me_denied", "online_event", "open_menu", "open_ticket", "print", "reg_confirm_body",
  "reg_confirm_title", "reg_email_hint", "reg_privacy", "reg_success_title", "register_now", "reload",
  "resend_link", "resend_wait", "search", "search_placeholder", "seats_full", "seats_left", "seats_of",
  "ticket_cancelled", "ticket_confirmed_toast", "ticket_confirmed_wait_toast", "ticket_keep_link",
  "toggle_theme", "venue_no_map", "view_list", "view_map", "wait_confirm_body", "wait_success_body",
  "wait_success_title", "waiting_count", "your_email", "your_name",
] as const;

const KEYS = new Set<string>(CLIENT_KEYS);

export function isClientKey(key: string): boolean {
  return KEYS.has(key) || CLIENT_PREFIXES.some((p) => key.startsWith(p));
}

export function clientMessages(all: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(all).filter(([key]) => isClientKey(key)));
}
