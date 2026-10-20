import type { TKey, Params } from '../i18n';
import type { AppNotification } from '../types';

const AVATAR_COLORS = ['#0284c7', '#4f46e5', '#0f766e', '#7c3aed', '#c2410c', '#be185d', '#047857', '#1d4ed8'];

export function initials(name: string | null | undefined): string {
  const parts = (name || '?').trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] || '?').slice(0, 2);
  return letters.toUpperCase();
}

export function avatarColor(name: string | null | undefined): string {
  let hash = 0;
  for (const ch of name || '') hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/** Material-style ripple on any .btn, attached once for the whole app. */
export function initRipple(): void {
  document.addEventListener('pointerdown', (e) => {
    const btn = (e.target as HTMLElement | null)?.closest?.('.btn') as HTMLElement | null;
    if (!btn || btn.hasAttribute('disabled')) return;
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const wave = document.createElement('span');
    wave.className = 'ripple-wave';
    wave.style.width = wave.style.height = `${size}px`;
    wave.style.left = `${e.clientX - rect.left - size / 2}px`;
    wave.style.top = `${e.clientY - rect.top - size / 2}px`;
    btn.appendChild(wave);
    window.setTimeout(() => wave.remove(), 650);
  });
}

const NOTE_ICONS: Record<string, string> = {
  new_registration: 'user-plus',
  new_waitlist: 'hourglass-half',
  attendee_cancelled: 'user-minus',
  waitlist_promoted: 'arrow-up',
  conference_full: 'circle-check',
  conference_tomorrow: 'bell',
  feedback_reply: 'reply',
  account_restored: 'unlock',
  conference_removed: 'trash',
  new_organizer: 'user-tie',
  new_feedback: 'comment-dots',
  new_conference: 'calendar-plus',
  new_contact: 'envelope',
};

export const NOTIFICATION_KINDS = Object.keys(NOTE_ICONS);

export function notificationIcon(kind: string): string {
  return NOTE_ICONS[kind] ?? 'bell';
}

/** Notification text comes from its kind, so it shows in the reader's language. */
export function notificationText(n: AppNotification, t: (k: TKey, p?: Params) => string, has: (k: string) => k is TKey): string {
  const key = `note_${n.kind}`;
  return has(key) ? t(key, n.params) : t('note_generic');
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Google Calendar "add event" link. */
export function googleCalendarUrl(c: { title: string; date: string; time: string | null; end_time: string | null; location: string | null; description: string | null }): string {
  const day = c.date.replace(/-/g, '');
  let dates: string;
  if (c.time) {
    const start = `${day}T${c.time.slice(0, 5).replace(':', '')}00`;
    let end: string;
    if (c.end_time) {
      end = `${day}T${c.end_time.slice(0, 5).replace(':', '')}00`;
    } else {
      const [h, m] = c.time.split(':').map(Number);
      end = `${day}T${String(Math.min(23, h + 2)).padStart(2, '0')}${String(m).padStart(2, '0')}00`;
    }
    dates = `${start}/${end}`;
  } else {
    const next = new Date(Number(c.date.slice(0, 4)), Number(c.date.slice(5, 7)) - 1, Number(c.date.slice(8, 10)) + 1);
    const nextDay = `${next.getFullYear()}${String(next.getMonth() + 1).padStart(2, '0')}${String(next.getDate()).padStart(2, '0')}`;
    dates = `${day}/${nextDay}`;
  }
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: c.title,
    dates,
    details: (c.description || '').slice(0, 800),
    location: c.location || '',
    ctz: 'Asia/Colombo',
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

export function mapsSearchUrl(location: string, lat?: number | null, lng?: number | null): string {
  if (lat != null && lng != null) return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`;
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(location)}`;
}
