import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { translations } from "../i18n/translations";
import { api } from "../services/api";

function getTokenExp(token) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.exp ?? null;
  } catch { return null; }
}

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("cm_token") || null);
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("cm_user") || "null"); } catch { return null; }
  });
  const [role, setRole] = useState(() => localStorage.getItem("cm_role") || null);
  const [lang, setLang] = useState(() => localStorage.getItem("cm_lang") || "en");
  const [theme, setTheme] = useState(() => localStorage.getItem("cm_theme") || "dark");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("cm_theme", theme);
  }, [theme]);

  // Auto-refresh token when within 1 hour of expiry
  useEffect(() => {
    if (!token || role !== "organizer") return;
    const exp = getTokenExp(token);
    if (!exp) return;
    const msUntilExpiry = exp * 1000 - Date.now();
    const msUntilRefresh = msUntilExpiry - 60 * 60 * 1000; // 1 hour before expiry
    if (msUntilRefresh <= 0) {
      api.refreshToken(token).then((res) => {
        setToken(res.access_token);
        localStorage.setItem("cm_token", res.access_token);
      }).catch(() => {});
      return;
    }
    const timer = setTimeout(() => {
      api.refreshToken(token).then((res) => {
        setToken(res.access_token);
        localStorage.setItem("cm_token", res.access_token);
      }).catch(() => {});
    }, msUntilRefresh);
    return () => clearTimeout(timer);
  }, [token, role]);

  useEffect(() => {
    localStorage.setItem("cm_lang", lang);
  }, [lang]);

  const t = useCallback(
    (key) => translations[lang]?.[key] ?? translations["en"][key] ?? key,
    [lang]
  );

  const login = useCallback((tok, userData, userRole) => {
    setToken(tok);
    setUser(userData);
    setRole(userRole);
    localStorage.setItem("cm_token", tok);
    localStorage.setItem("cm_user", JSON.stringify(userData));
    localStorage.setItem("cm_role", userRole);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setRole(null);
    localStorage.removeItem("cm_token");
    localStorage.removeItem("cm_user");
    localStorage.removeItem("cm_role");
  }, []);

  const updateUser = useCallback((data) => {
    setUser((prev) => {
      const updated = { ...prev, ...data };
      localStorage.setItem("cm_user", JSON.stringify(updated));
      return updated;
    });
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  return (
    <AppContext.Provider value={{ token, user, role, lang, setLang, theme, toggleTheme, t, login, logout, updateUser }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
