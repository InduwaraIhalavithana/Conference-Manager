import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AppProvider } from '../context/AppContext';
import LoginPage from '../pages/LoginPage';

vi.mock('../services/api', () => ({
  api: {
    login: vi.fn(),
    getMe: vi.fn(),
  },
}));

import { api } from '../services/api';

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

function renderLogin() {
  return render(
    <AppProvider>
      <MemoryRouter initialEntries={['/login']}>
        <LoginPage />
      </MemoryRouter>
    </AppProvider>
  );
}

describe('LoginPage', () => {
  it('renders email and password fields', () => {
    renderLogin();
    expect(screen.getByPlaceholderText(/you@example.com/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
  });

  it('shows error on bad credentials', async () => {
    api.login.mockRejectedValue(new Error('Invalid email or password'));
    renderLogin();
    await userEvent.type(screen.getByPlaceholderText(/you@example.com/i), 'bad@email.com');
    await userEvent.type(screen.getByPlaceholderText('••••••••'), 'badpass');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => expect(screen.getByText('Invalid email or password')).toBeInTheDocument());
  });

  it('has a forgot password link', () => {
    renderLogin();
    expect(screen.getByText(/forgot your password/i)).toBeInTheDocument();
  });

  it('has a register link', () => {
    renderLogin();
    expect(screen.getByRole('link', { name: /register/i })).toBeInTheDocument();
  });
});
