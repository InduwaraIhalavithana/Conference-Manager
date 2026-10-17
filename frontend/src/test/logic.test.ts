import { describe, expect, it, vi } from 'vitest';
import { formatDate, formatTime, monthShort, relativeTime, weekdayNames, daysUntil, todayISO } from '../i18n/format';
import { translate } from '../i18n';
import { ApiError } from '../services/api';
import { errorMessage } from '../utils/errors';
import { avatarColor, googleCalendarUrl, initials, mapsSearchUrl } from '../utils/misc';
import { passwordScore } from '../pages/auth/RegisterPage';

const t = (lang: 'en' | 'si' | 'ta') => (k: Parameters<typeof translate>[1], p?: Parameters<typeof translate>[2]) => translate(lang, k, p);

describe('dates and times', () => {
  it('Sinhala uses Sinhala month and day names (Chrome has no Sinhala date data)', () => {
    expect(formatDate('2026-10-20', 'si', 'long')).toBe('2026 ඔක්තෝබර් 20, අඟහරුවාදා');
    expect(formatDate('2026-10-20', 'si', 'month-day')).toBe('ඔක් 20');
    expect(monthShort('2026-01-05', 'si')).toBe('ජන');
    expect(formatTime('09:30:00', 'si')).toBe('පෙ.ව. 9.30');
    expect(formatTime('14:05', 'si')).toBe('ප.ව. 2.05');
    expect(weekdayNames('si', 'long')[0]).toBe('සඳුදා');
  });

  it('English dates read naturally', () => {
    expect(formatDate('2026-10-20', 'en', 'long')).toMatch(/^Tuesday,? 20 October 2026$/);
    expect(formatTime('', 'en')).toBe('');
  });

  it('relative time in Sinhala', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-17T10:00:00Z'));
    expect(relativeTime('2026-10-17T09:55:00Z', 'si')).toBe('මිනිත්තු 5කට පෙර');
    expect(relativeTime('2026-10-16T09:00:00Z', 'si')).toBe('ඊයේ');
    expect(relativeTime('2026-10-17T09:59:50Z', 'si')).toBe('දැන්');
    vi.useRealTimers();
  });

  it('counts days to a date', () => {
    expect(daysUntil(todayISO())).toBe(0);
  });
});

describe('error messages', () => {
  it('translates server error codes with their details', () => {
    expect(errorMessage(new ApiError(401, 'invalid_credentials', 'x'), t('en'))).toBe('The email or password is not correct.');
    expect(errorMessage(new ApiError(413, 'file_too_large', 'x', { max_mb: 2 }), t('en'))).toBe('The image is too large. The limit is 2 MB.');
    expect(errorMessage(new ApiError(409, 'email_taken', 'x'), t('ta'))).toBe(translate('ta', 'err_email_taken'));
  });

  it('names the fields that failed validation, in the reader language', () => {
    const err = new ApiError(422, 'validation_error', 'x', { fields: [{ field: 'email' }, { field: 'password' }] });
    expect(errorMessage(err, t('en'))).toBe('Please check: Email address, Password.');
  });

  it('never shows raw text for unknown problems', () => {
    expect(errorMessage(new ApiError(0, 'network', 'x'), t('en'))).toBe(translate('en', 'err_network'));
    expect(errorMessage(new ApiError(500, 'http_500', 'boom'), t('en'))).toBe(translate('en', 'err_server'));
    expect(errorMessage(new Error('weird'), t('en'))).toBe(translate('en', 'err_generic'));
  });
});

describe('helpers', () => {
  it('builds a Google Calendar link with start and end', () => {
    const url = googleCalendarUrl({ title: 'Expo', date: '2026-11-05', time: '09:30:00', end_time: '17:00:00', location: 'Galle', description: null });
    expect(url).toContain('dates=20261105T093000%2F20261105T170000');
    expect(url).toContain('text=Expo');
  });

  it('all-day events end the next day', () => {
    const url = googleCalendarUrl({ title: 'X', date: '2026-12-31', time: null, end_time: null, location: null, description: null });
    expect(url).toContain('dates=20261231%2F20270101');
  });

  it('map links prefer the pinned location', () => {
    expect(mapsSearchUrl('Kandy', 7.29, 80.63)).toContain('mlat=7.29');
    expect(mapsSearchUrl('Kandy')).toContain('search?query=Kandy');
  });

  it('initials and stable avatar colours', () => {
    expect(initials('Nimal de Silva')).toBe('NS');
    expect(initials('Kasun')).toBe('KA');
    expect(avatarColor('Nimal')).toBe(avatarColor('Nimal'));
  });

  it('password strength', () => {
    expect(passwordScore('')).toBe(0);
    expect(passwordScore('abcdefgh')).toBe(1);
    expect(passwordScore('Abcdefgh12!xyz')).toBe(4);
  });
});
