const ICONS: Record<string, string> = {
  login: 'right-to-bracket',
  create_conference: 'calendar-plus',
  update_conference: 'pen',
  delete_conference: 'trash',
  update_profile: 'user-pen',
  update_photo: 'camera',
  change_password: 'key',
  reset_password: 'key',
  send_reminders: 'bell',
  cancel_attendee: 'user-minus',
  admin_suspend: 'user-lock',
  admin_unsuspend: 'unlock',
  admin_delete_organizer: 'user-xmark',
  admin_delete_conference: 'calendar-xmark',
};

export function activityIcon(action: string): string {
  return ICONS[action] ?? 'circle-dot';
}

export const ACTIVITY_ACTIONS = Object.keys(ICONS);
