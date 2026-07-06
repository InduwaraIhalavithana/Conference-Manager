import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from '../services/api';

beforeEach(() => {
  vi.restoreAllMocks();
});

function mockFetch(status, body) {
  global.fetch = vi.fn().mockResolvedValue({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  });
}

describe('api.login', () => {
  it('returns data on success', async () => {
    mockFetch(200, { access_token: 'tok123' });
    const res = await api.login({ email: 'a@b.com', password: 'pw' });
    expect(res.access_token).toBe('tok123');
  });

  it('throws on 401', async () => {
    mockFetch(401, { detail: 'Invalid email or password' });
    await expect(api.login({ email: 'a@b.com', password: 'wrong' })).rejects.toThrow('Invalid email or password');
  });
});

describe('api.register', () => {
  it('throws on 409 duplicate email', async () => {
    mockFetch(409, { detail: 'Email already registered' });
    await expect(api.register({ first_name: 'A', last_name: 'B', email: 'dup@x.com', password: 'pw12345' })).rejects.toThrow('Email already registered');
  });
});

describe('api.upcomingConferences', () => {
  it('returns paginated result', async () => {
    mockFetch(200, { items: [{ id: 1, title: 'Conf' }], total: 1, page: 1, pages: 1 });
    const res = await api.upcomingConferences();
    expect(res.items).toHaveLength(1);
    expect(res.items[0].title).toBe('Conf');
  });
});

describe('api.deleteConference', () => {
  it('returns null on 204', async () => {
    global.fetch = vi.fn().mockResolvedValue({ status: 204, ok: true, json: async () => ({}) });
    const res = await api.deleteConference(1, 'token');
    expect(res).toBeNull();
  });
});
