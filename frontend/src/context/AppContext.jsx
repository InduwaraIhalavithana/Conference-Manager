import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { translations } from "../i18n/translations";

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

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  return (
    <AppContext.Provider value={{ token, user, role, lang, setLang, theme, toggleTheme, t, login, logout }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
