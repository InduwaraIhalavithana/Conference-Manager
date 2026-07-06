import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppProvider, useApp } from '../context/AppContext';

beforeEach(() => {
  localStorage.clear();
});

function Fixture() {
  const { token, user, role, lang, setLang, theme, toggleTheme, login, logout } = useApp();
  return (
    <div>
      <span data-testid="token">{token || 'none'}</span>
      <span data-testid="role">{role || 'none'}</span>
      <span data-testid="user">{user?.first_name || 'none'}</span>
      <span data-testid="lang">{lang}</span>
      <span data-testid="theme">{theme}</span>
      <button onClick={() => login('tok', { first_name: 'Alice' }, 'organizer')}>Login</button>
      <button onClick={logout}>Logout</button>
      <button onClick={toggleTheme}>Toggle Theme</button>
      <button onClick={() => setLang('si')}>Set Sinhala</button>
    </div>
  );
}

function renderFixture() {
  return render(<AppProvider><Fixture /></AppProvider>);
}

describe('AppContext', () => {
  it('starts with no token', () => {
    renderFixture();
    expect(screen.getByTestId('token').textContent).toBe('none');
  });

  it('login sets token, user, role', async () => {
    renderFixture();
    await userEvent.click(screen.getByText('Login'));
    expect(screen.getByTestId('token').textContent).toBe('tok');
    expect(screen.getByTestId('role').textContent).toBe('organizer');
    expect(screen.getByTestId('user').textContent).toBe('Alice');
  });

  it('logout clears state', async () => {
    renderFixture();
    await userEvent.click(screen.getByText('Login'));
    await userEvent.click(screen.getByText('Logout'));
    expect(screen.getByTestId('token').textContent).toBe('none');
    expect(screen.getByTestId('role').textContent).toBe('none');
  });

  it('toggleTheme switches between dark and light', async () => {
    renderFixture();
    const initial = screen.getByTestId('theme').textContent;
    await userEvent.click(screen.getByText('Toggle Theme'));
    const after = screen.getByTestId('theme').textContent;
    expect(after).not.toBe(initial);
  });

  it('setLang persists to localStorage', async () => {
    renderFixture();
    await userEvent.click(screen.getByText('Set Sinhala'));
    expect(screen.getByTestId('lang').textContent).toBe('si');
    expect(localStorage.getItem('cm_lang')).toBe('si');
  });

  it('token persists to localStorage on login', async () => {
    renderFixture();
    await userEvent.click(screen.getByText('Login'));
    expect(localStorage.getItem('cm_token')).toBe('tok');
  });
});
