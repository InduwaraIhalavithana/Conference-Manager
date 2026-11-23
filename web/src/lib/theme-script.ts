// Kept out of the "use client" theme module: a server component (the root layout) reads THEME_SCRIPT, and a
// plain value exported from a client module reaches the browser as a reference, not as the string, which
// made the <head> script empty on the client and caused a hydration warning.
export const THEME_KEY = "cm_theme";

export const THEME_SCRIPT = `try{if(localStorage.getItem("${THEME_KEY}")==="light")document.documentElement.classList.remove("dark")}catch(e){}`;
