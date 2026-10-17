import type {
  AdminAnalytics, AdminOrganizer, AdminStats, AdminTrends, AdminUser, AgendaSession, AppNotification, Attendee,
  Conference, ConferenceDetails, ContactMessage, Featured, Feedback, ActivityItem, Lang, Organizer,
  OrganizerAnalytics, OrganizerOverview, Paged, PublicStats, Speaker, Ticket,
} from '../types';

/** An API failure. `code` is a stable id the UI translates; `detail` is the server's English text. */
export class ApiError extends Error {
  status: number;
  code: string;
  extra: Record<string, unknown>;

  constructor(status: number, code: string, detail: string, extra: Record<string, unknown> = {}) {
    super(detail);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

let tokenGetter: () => string | null = () => null;
let onUnauthorized: () => void = () => {};

/** Wired up by AppContext: where the token lives and what to do when the server says it expired. */
export function configureApi(getToken: () => string | null, unauthorized: () => void) {
  tokenGetter = getToken;
  onUnauthorized = unauthorized;
}

type Query = Record<string, string | number | boolean | null | undefined>;

function withQuery(path: string, query?: Query): string {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== null && v !== undefined && v !== '') params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

async function request<T>(method: string, path: string, body?: unknown, opts: { auth?: boolean; token?: string } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const token = opts.auth === false ? null : opts.token ?? tokenGetter();
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload: BodyInit | undefined;
  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let res: Response;
  try {
    res = await fetch(path, { method, headers, body: payload });
  } catch {
    throw new ApiError(0, 'network', 'Network error');
  }
  if (res.status === 204) return null as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const { detail, code, ...extra } = data as { detail?: unknown; code?: string };
    if (res.status === 401 && token) onUnauthorized();
    throw new ApiError(res.status, code || `http_${res.status}`, typeof detail === 'string' ? detail : `HTTP ${res.status}`, extra);
  }
  return data as T;
}

const get = <T>(path: string, query?: Query) => request<T>('GET', withQuery(path, query));
const post = <T>(path: string, body?: unknown) => request<T>('POST', path, body);
const put = <T>(path: string, body?: unknown) => request<T>('PUT', path, body);
const del = <T>(path: string, body?: unknown) => request<T>('DELETE', path, body);

function upload<T>(path: string, file: File): Promise<T> {
  const form = new FormData();
  form.append('file', file);
  return request<T>('POST', path, form);
}

export interface ConferenceInput {
  title: string;
  description: string | null;
  date: string;
  time: string | null;
  end_time: string | null;
  location: string | null;
  venue_lat: number | null;
  venue_lng: number | null;
  max_attendees: number | null;
  status: 'published' | 'draft';
  category: string | null;
}

export type SpeakerInput = Pick<Speaker, 'name' | 'job_title' | 'organization' | 'bio' | 'position'>;
export type SessionInput = Pick<AgendaSession, 'title' | 'description' | 'start_time' | 'end_time' | 'room' | 'kind' | 'speaker_id'>;

export const api = {
  // Auth
  register: (body: { first_name: string; last_name: string; email: string; password: string; phone?: string | null; organization?: string | null; lang: Lang }) =>
    request<{ access_token: string }>('POST', '/auth/register', body, { auth: false }),
  login: (body: { email: string; password: string }) =>
    request<{ access_token: string }>('POST', '/auth/login', body, { auth: false }),
  adminLogin: (body: { email: string; password: string }) =>
    request<{ access_token: string }>('POST', '/auth/admin/login', body, { auth: false }),
  refreshToken: () => post<{ access_token: string }>('/auth/refresh'),
  /** Pass the fresh token right after sign-in, before it is stored. */
  me: (token?: string) => request<Organizer>('GET', '/auth/me', undefined, { token }),
  adminMe: (token?: string) => request<AdminUser>('GET', '/auth/admin/me', undefined, { token }),
  forgotPassword: (email: string) => request<{ code: string }>('POST', '/auth/forgot-password', { email }, { auth: false }),
  resetPassword: (token: string, new_password: string) =>
    request<{ code: string }>('POST', '/auth/reset-password', { token, new_password }, { auth: false }),

  // Public
  publicStats: () => get<PublicStats>('/api/public/stats'),
  featured: () => get<Featured>('/api/public/featured'),
  contact: (body: { name: string; email: string; subject: string; message: string }) => post<{ id: number }>('/api/public/contact', body),
  conferences: (query: Query) => get<Paged<Conference>>('/api/conferences/upcoming', query),
  conference: (id: number | string) => get<Conference>(`/api/conferences/${id}`),
  conferenceDetails: (id: number | string) => get<ConferenceDetails>(`/api/conferences/${id}/details`),
  calendarUrl: (id: number | string) => `/api/conferences/${id}/calendar.ics`,
  registerAttendee: (confId: number, body: { name: string; email: string; lang: Lang }) =>
    request<Attendee>('POST', `/api/attendees/${confId}`, body, { auth: false }),
  ticket: (code: string) => request<Ticket>('GET', `/api/tickets/${encodeURIComponent(code)}`, undefined, { auth: false }),
  cancelTicket: (code: string) => request<null>('DELETE', `/api/tickets/${encodeURIComponent(code)}`, undefined, { auth: false }),

  // Organizer: conferences
  myConferences: (query: Query) => get<Paged<Conference>>('/api/conferences/', query),
  myConference: (id: number | string) => get<ConferenceDetails>(`/api/conferences/mine/${id}`),
  createConference: (body: ConferenceInput) => post<Conference>('/api/conferences/', body),
  updateConference: (id: number, body: ConferenceInput) => put<Conference>(`/api/conferences/${id}`, body),
  deleteConference: (id: number) => del<null>(`/api/conferences/${id}`),
  uploadCover: (id: number, file: File) => upload<Conference>(`/api/conferences/${id}/cover`, file),
  removeCover: (id: number) => del<Conference>(`/api/conferences/${id}/cover`),
  sendReminders: (id: number) => post<{ sent: number; email_enabled: boolean }>(`/api/conferences/${id}/reminders`),

  // Organizer: agenda
  addSpeaker: (confId: number, body: SpeakerInput) => post<Speaker>(`/api/conferences/${confId}/speakers`, body),
  updateSpeaker: (confId: number, id: number, body: SpeakerInput) => put<Speaker>(`/api/conferences/${confId}/speakers/${id}`, body),
  deleteSpeaker: (confId: number, id: number) => del<null>(`/api/conferences/${confId}/speakers/${id}`),
  uploadSpeakerPhoto: (confId: number, id: number, file: File) => upload<Speaker>(`/api/conferences/${confId}/speakers/${id}/photo`, file),
  removeSpeakerPhoto: (confId: number, id: number) => del<Speaker>(`/api/conferences/${confId}/speakers/${id}/photo`),
  addSession: (confId: number, body: SessionInput) => post<AgendaSession>(`/api/conferences/${confId}/sessions`, body),
  updateSession: (confId: number, id: number, body: SessionInput) => put<AgendaSession>(`/api/conferences/${confId}/sessions/${id}`, body),
  deleteSession: (confId: number, id: number) => del<null>(`/api/conferences/${confId}/sessions/${id}`),

  // Organizer: attendees
  attendees: (confId: number | string) => get<Attendee[]>(`/api/attendees/${confId}`),
  cancelAttendee: (confId: number, attendeeId: number) => del<null>(`/api/attendees/${confId}/${attendeeId}`),
  checkIn: (confId: number, code: string) => post<Attendee>(`/api/attendees/${confId}/check-in`, { code }),
  setCheckIn: (confId: number, attendeeId: number, checkedIn: boolean) =>
    put<Attendee>(`/api/attendees/${confId}/${attendeeId}/check-in?checked_in=${checkedIn}`),
  exportAttendees: async (confId: number): Promise<Blob> => {
    const res = await fetch(`/api/attendees/${confId}/export`, { headers: { Authorization: `Bearer ${tokenGetter()}` } });
    if (!res.ok) throw new ApiError(res.status, `http_${res.status}`, 'Export failed');
    return res.blob();
  },

  // Organizer: profile
  overview: () => get<OrganizerOverview>('/api/organizers/me/overview'),
  analytics: (days: number) => get<OrganizerAnalytics>('/api/organizers/me/analytics', { days }),
  updateProfile: (body: Pick<Organizer, 'first_name' | 'last_name' | 'phone' | 'organization' | 'bio'>) => put<Organizer>('/api/organizers/me', body),
  updateLanguage: (lang: Lang) => put<{ lang: Lang }>('/api/organizers/me/language', { lang }),
  uploadPhoto: (file: File) => upload<Organizer>('/api/organizers/me/photo', file),
  removePhoto: () => del<Organizer>('/api/organizers/me/photo'),
  changePassword: (current_password: string, new_password: string) => put<null>('/api/organizers/me/password', { current_password, new_password }),
  deleteAccount: (password: string) => del<null>('/api/organizers/me', { password }),
  submitFeedback: (body: { subject: string; message: string }) => post<Feedback>('/api/feedback/', body),
  myFeedback: () => get<Feedback[]>('/api/feedback/mine'),

  // Notifications (organizer or admin, decided by the token)
  notifications: (limit = 20) => get<{ items: AppNotification[]; unread: number }>('/api/notifications/', { limit }),
  unreadCount: () => get<{ unread: number }>('/api/notifications/unread-count'),
  markRead: (id: number) => put<null>(`/api/notifications/${id}/read`),
  markAllRead: () => put<null>('/api/notifications/read-all'),

  // Admin
  adminStats: () => get<AdminStats>('/api/admin/stats'),
  adminTrends: (days = 30) => get<AdminTrends>('/api/admin/trends', { days }),
  adminAnalytics: () => get<AdminAnalytics>('/api/admin/analytics'),
  adminOrganizers: (query: Query) => get<Paged<AdminOrganizer>>('/api/admin/organizers', query),
  suspendOrganizer: (id: number) => put<null>(`/api/admin/organizers/${id}/suspend`),
  unsuspendOrganizer: (id: number) => put<null>(`/api/admin/organizers/${id}/unsuspend`),
  deleteOrganizer: (id: number) => del<null>(`/api/admin/organizers/${id}`),
  adminConferences: (query: Query) => get<Paged<Conference>>('/api/admin/conferences', query),
  adminDeleteConference: (id: number) => del<null>(`/api/admin/conferences/${id}`),
  adminFeedback: () => get<Feedback[]>('/api/admin/feedback'),
  replyFeedback: (id: number, reply: string) => put<null>(`/api/admin/feedback/${id}/reply`, { reply }),
  resolveFeedback: (id: number) => put<null>(`/api/admin/feedback/${id}/resolve`),
  adminContacts: () => get<ContactMessage[]>('/api/admin/contacts'),
  resolveContact: (id: number) => put<null>(`/api/admin/contacts/${id}/resolve`),
  activity: (query: Query) => get<Paged<ActivityItem>>('/api/admin/activity', query),
};

