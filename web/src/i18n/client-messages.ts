// The messages client components need. Server components read the full bundle on the server, so the
// browser only downloads these (about a fifth of the bundle) instead of every page and legal text.
// tests/unit/client-messages.test.ts fails if a client component uses a key that is not covered here.

/** Every key starting with one of these is sent (they are picked at run time, e.g. t(`kind_${kind}`)). */
export const CLIENT_PREFIXES = [
  "err_", "kind_", "cat_", "tab_", "topic_", "nav_", "language_name_", "cd_",
  // The organizer and admin areas (Phase 5) are client-rendered.
  "field_", "note_", "notifications", "pw_", "upload_", "stat_", "status_", "check_", "qa_", "dash_",
  "sign_out_", "admin_home_", "no_upcoming_",
  // The conference editor and attendees page (Phase 5b).
  "add_", "delete_", "edit_", "remove_", "reminders_", "conf_", "pub_problem_", "speakers_", "track", "cancel_",
  "publish", "pin_", "no_conferences_yet", "duplicate", "unpublish", "attendee",
  // The check-in desk and analytics (Phase 5c).
  "ci_", "an_", "analytics_", "avg_fill",
] as const;

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
  // Sign-in pages and the organizer area.
  "admin_login", "back_to_login", "change_password", "create_account", "current_password", "email_locked",
  "email_placeholder", "forgot_password", "forgot_sent", "getting_started", "have_account", "hide_password",
  "language_help", "loading", "login", "logout", "mark_all_read", "member_since", "new_password", "next_event",
  "no_account", "open_menu_account", "optional", "or", "organization_hint", "organizer_login", "password_changed",
  "profile_photo", "profile_photo_help", "profile_saved", "quick_actions", "reset_done", "reset_save", "save_changes",
  "send_reset_link", "settings_sub", "show_password", "signed_in_as", "upcoming_conferences", "verify_done",
  "verify_sent_body", "welcome_back",
  "actions", "agenda_empty_body", "capacity_and_status", "capacity_help", "checked_in", "conference_cancelled_banner",
  "cover_help", "create_conference", "day_label", "day_label_ph", "delete", "description_placeholder", "draft_hint",
  "edit", "export_csv", "links_help", "location_placeholder", "my_conferences_sub", "n_registered", "new_conference",
  "no_results_filtered", "no_track", "online_url_help", "promoted_badge", "quick_pin", "ready_to_publish",
  "registered_on", "room_placeholder", "save", "saved", "search_attendees", "search_my_conferences", "send_reminders",
  "shown_of_total", "summary_help", "tags_help", "times_local_help", "title_placeholder", "translations_help",
  "undo_check_in", "venue", "view_public", "waitlist_enabled",
] as const;

const KEYS = new Set<string>(CLIENT_KEYS);

export function isClientKey(key: string): boolean {
  return KEYS.has(key) || CLIENT_PREFIXES.some((p) => key.startsWith(p));
}

export function clientMessages(all: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(all).filter(([key]) => isClientKey(key)));
}
