import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import toast from 'react-hot-toast';
import { api, configureApi } from '../services/api';
import { translate, type Params, type TKey } from '../i18n';
import type { Lang, Role, Theme, User } from '../types';

interface AppState {
  token: string | null;
  role: Role | null;
  user: User | null;
  lang: Lang;
  theme: Theme;
  t: (key: TKey, params?: Params) => string;
  setLang: (lang: Lang) => void;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  login: (token: string, user: User, role: Role) => void;
  logout: () => void;
  updateUser: (patch: Partial<User>) => void;
}

const AppContext = createContext<AppState | null>(null);

const store = {
  get(key: string): string | null {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  set(key: string, value: string | null) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch { /* private mode */ }
  },
};

function tokenExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}

function initialLang(): Lang {
  const saved = store.get('cm_lang');
  return saved === 'si' || saved === 'ta' || saved === 'en' ? saved : 'en';
}

function initialTheme(): Theme {
  const saved = store.get('cm_theme');
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function initialSession(): { token: string | null; role: Role | null; user: User | null } {
  const token = store.get('cm_token');
  const role = store.get('cm_role');
  const exp = token ? tokenExpiry(token) : null;
  if (!token || (role !== 'organizer' && role !== 'admin') || (exp && exp * 1000 < Date.now())) {
    return { token: null, role: null, user: null };
  }
  try {
    return { token, role, user: JSON.parse(store.get('cm_user') || 'null') };
  } catch {
    return { token: null, role: null, user: null };
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState(initialSession);
  const [lang, setLangState] = useState<Lang>(initialLang);
  const [theme, setThemeState] = useState<Theme>(initialTheme);
  const tokenRef = useRef(session.token);
  tokenRef.current = session.token;
  const langRef = useRef(lang);
  langRef.current = lang;

  const t = useCallback((key: TKey, params?: Params) => translate(lang, key, params), [lang]);

  const logout = useCallback(() => {
    setSession({ token: null, role: null, user: null });
    store.set('cm_token', null);
    store.set('cm_user', null);
    store.set('cm_role', null);
  }, []);

  // The API client reads the token from here and signs the user out when the server rejects it.
  useEffect(() => {
    configureApi(
      () => tokenRef.current,
      () => {
        if (!tokenRef.current) return;
        logout();
        toast.error(translate(langRef.current, 'session_expired'), { id: 'session-expired' });
      },
    );
  }, [logout]);

  const login = useCallback((token: string, user: User, role: Role) => {
    tokenRef.current = token;
    setSession({ token, role, user });
    store.set('cm_token', token);
    store.set('cm_user', JSON.stringify(user));
    store.set('cm_role', role);
    // Emails follow the language the organizer is using right now.
    if (role === 'organizer' && 'lang' in user && user.lang !== langRef.current) {
      api.updateLanguage(langRef.current).catch(() => {});
    }
  }, []);

  const updateUser = useCallback((patch: Partial<User>) => {
    setSession((prev) => {
      if (!prev.user) return prev;
      const user = { ...prev.user, ...patch } as User;
      store.set('cm_user', JSON.stringify(user));
      return { ...prev, user };
    });
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    store.set('cm_theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('lang', lang);
    store.set('cm_lang', lang);
  }, [lang]);

  const setTheme = useCallback((next: Theme) => {
    const root = document.documentElement;
    root.classList.add('theme-anim');
    setThemeState(next);
    window.setTimeout(() => root.classList.remove('theme-anim'), 500);
  }, []);
  const toggleTheme = useCallback(() => setTheme(theme === 'dark' ? 'light' : 'dark'), [setTheme, theme]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    // Organizers get emails in the language they use here.
    if (session.role === 'organizer' && session.token) {
      api.updateLanguage(next).catch(() => {});
    }
  }, [session.role, session.token]);

  // Keep organizer sessions alive: refresh the token an hour before it expires.
  useEffect(() => {
    if (!session.token || session.role !== 'organizer') return;
    const exp = tokenExpiry(session.token);
    if (!exp) return;
    const wait = Math.max(0, exp * 1000 - Date.now() - 3600_000);
    const timer = window.setTimeout(() => {
      api.refreshToken()
        .then((res) => {
          tokenRef.current = res.access_token;
          setSession((prev) => ({ ...prev, token: res.access_token }));
          store.set('cm_token', res.access_token);
        })
        .catch(() => {});
    }, wait);
    return () => window.clearTimeout(timer);
  }, [session.token, session.role]);

  const value = useMemo<AppState>(() => ({
    ...session, lang, theme, t, setLang, toggleTheme, setTheme, login, logout, updateUser,
  }), [session, lang, theme, t, setLang, toggleTheme, setTheme, login, logout, updateUser]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
