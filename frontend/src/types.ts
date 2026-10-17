export type Lang = 'en' | 'si' | 'ta';
export type Theme = 'dark' | 'light';
export type Role = 'organizer' | 'admin';

export const CATEGORIES = ['Tech', 'Health', 'Education', 'Business', 'Science', 'Arts', 'Other'] as const;
export type Category = (typeof CATEGORIES)[number];

export const SESSION_KINDS = ['keynote', 'talk', 'workshop', 'panel', 'break'] as const;
export type SessionKind = (typeof SESSION_KINDS)[number];

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
}

export interface Conference {
  id: number;
  organizer_id: number;
  title: string;
  description: string | null;
  date: string; // yyyy-mm-dd
  time: string | null; // HH:MM:SS
  end_time: string | null;
  location: string | null;
  venue_lat: number | null;
  venue_lng: number | null;
  max_attendees: number | null;
  status: 'published' | 'draft';
  category: Category | null;
  cover_image: string | null;
  created_at: string;
  attendee_count: number;
  waitlist_count: number;
  checked_in_count: number;
  speaker_count: number;
  session_count: number;
  organizer_name: string;
  organizer_avatar: string | null;
  organizer_organization: string | null;
}

export interface Speaker {
  id: number;
  conference_id: number;
  name: string;
  job_title: string | null;
  organization: string | null;
  bio: string | null;
  photo: string | null;
  position: number;
}

export interface AgendaSession {
  id: number;
  conference_id: number;
  speaker_id: number | null;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string | null;
  room: string | null;
  kind: SessionKind;
}

export interface ConferenceDetails {
  conference: Conference;
  speakers: Speaker[];
  sessions: AgendaSession[];
  related?: Conference[];
}

export interface Attendee {
  id: number;
  conference_id: number;
  name: string;
  email: string;
  status: 'registered' | 'waitlisted';
  ticket_code: string | null;
  checked_in_at: string | null;
  registered_at: string;
  waitlist_position: number | null;
}

export interface Ticket {
  attendee: Attendee;
  conference: Conference;
}

export interface Organizer {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  organization: string | null;
  bio: string | null;
  avatar: string | null;
  lang: Lang;
  is_suspended: boolean;
  created_at?: string;
}

export interface AdminUser {
  id: number;
  username: string;
  email: string | null;
}

export type User = Organizer | AdminUser;

export interface AppNotification {
  id: number;
  kind: string;
  params: Record<string, string | number>;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export interface Feedback {
  id: number;
  organizer_id: number;
  subject: string;
  message: string;
  status: 'open' | 'resolved';
  reply: string | null;
  created_at: string;
  organizer_name?: string;
  organizer_email?: string;
  organizer_avatar?: string | null;
}

export interface ContactMessage {
  id: number;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: 'open' | 'resolved';
  created_at: string;
}

export interface ActivityItem {
  id?: number;
  action: string;
  target: string | null;
  created_at: string;
  organizer_name?: string | null;
  organizer_avatar?: string | null;
}

export interface DayCount {
  date: string;
  count: number;
}

export interface OrganizerOverview {
  trend: DayCount[];
  activity: ActivityItem[];
}

export interface OrganizerAnalytics {
  totals: {
    conferences: number;
    upcoming: number;
    past: number;
    registered: number;
    waitlisted: number;
    checked_in: number;
    checkin_rate: number | null;
    avg_fill: number | null;
    registrations_in_period: number;
  };
  trend: { date: string; registrations: number; checkins: number }[];
  by_conference: {
    id: number;
    title: string;
    date: string;
    category: Category | null;
    max_attendees: number | null;
    registered: number;
    waitlisted: number;
    checked_in: number;
  }[];
  by_category: { category: Category; conferences: number; registered: number }[];
  by_weekday: number[];
}

export interface AdminStats {
  total_organizers: number;
  active_organizers: number;
  suspended: number;
  total_confs: number;
  upcoming_confs: number;
  total_attendees: number;
  waitlisted: number;
  checked_in: number;
  open_feedback: number;
  open_contacts: number;
}

export interface AdminTrends {
  registrations: DayCount[];
  organizers: DayCount[];
}

export interface AdminAnalytics {
  by_category: { category: Category; conferences: number; registered: number }[];
  by_month: { month: string; count: number }[];
  top_organizers: {
    id: number;
    name: string;
    avatar: string | null;
    organization: string | null;
    conferences: number;
    attendees: number;
  }[];
  top_conferences: Conference[];
  checkin_rate: number | null;
  cities: { city: string; count: number }[];
}

export interface AdminOrganizer extends Organizer {
  conference_count: number;
  attendee_count: number;
}

export interface PublicStats {
  upcoming: number;
  held: number;
  attendees: number;
  checked_in: number;
  organizers: number;
  speakers: number;
  sessions: number;
  registrations_this_week: number;
  categories: { category: Category; count: number }[];
  cities: { city: string; count: number }[];
  recent: { conference_id: number; title: string; at: string }[];
}

export interface FeaturedSpeaker {
  id: number;
  name: string;
  job_title: string | null;
  organization: string | null;
  photo: string | null;
  conference_id: number;
  conference_title: string;
}

export interface Featured {
  next: Conference[];
  speakers: FeaturedSpeaker[];
}
