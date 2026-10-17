import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from '../App';

function signIn(role: 'organizer' | 'admin') {
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 86400 })).replace(/=+$/, '');
  localStorage.setItem('cm_token', `x.${payload}.y`);
  localStorage.setItem('cm_role', role);
  localStorage.setItem('cm_user', JSON.stringify(role === 'admin'
    ? { id: 1, username: 'admin', email: 'admin@example.com' }
    : { id: 3, first_name: 'Nimal', last_name: 'Perera', email: 'n@example.com', avatar: null, lang: 'en' }));
}

function at(path: string) {
  window.history.pushState({}, '', path);
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
    new Response(JSON.stringify({ items: [], total: 0, page: 1, pages: 1, unread: 0 }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  return render(<App />);
}

describe('role guards', () => {
  it('visitors opening an organizer page are sent to sign in', async () => {
    at('/dashboard');
    await waitFor(() => expect(window.location.pathname).toBe('/login'));
  });

  it('visitors opening an admin page are sent to the admin sign-in', async () => {
    at('/admin/organizers');
    await waitFor(() => expect(window.location.pathname).toBe('/admin/login'));
  });

  it('an organizer cannot open admin pages', async () => {
    signIn('organizer');
    at('/admin');
    await waitFor(() => expect(window.location.pathname).toBe('/dashboard'));
  });

  it('an admin cannot open organizer pages', async () => {
    signIn('admin');
    at('/my-conferences');
    await waitFor(() => expect(window.location.pathname).toBe('/admin'));
  });

  it('a signed-in admin opening the sign-in page goes to the dashboard (no redirect loop)', async () => {
    signIn('admin');
    at('/login');
    await waitFor(() => expect(window.location.pathname).toBe('/admin'));
    at('/register');
    await waitFor(() => expect(window.location.pathname).toBe('/admin'));
  });

  it('unknown addresses show the not-found page', async () => {
    at('/no-such-page');
    expect(await screen.findByText('Page not found')).toBeInTheDocument();
  });
});
