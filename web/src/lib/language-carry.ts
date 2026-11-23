// Changing language rebuilds the page, so what the visitor was doing is carried across it: how far they had scrolled
// and what they had typed. Kept for one page change in this tab only; passwords and files are never read.

const KEY = "cm_language_carry";
const FIELDS =
  'main input:not([type=password]):not([type=hidden]):not([type=file]):not([type=checkbox]):not([type=radio]), main textarea, main select';

type Carry = { path: string; y: number; values: string[] };
type Field = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

// Next.js keeps the previous page hidden in the document, so only the visible fields count.
const fields = () => Array.from(document.querySelectorAll<Field>(FIELDS)).filter((f) => f.checkVisibility());

export function saveForLanguageChange(path: string): void {
  try {
    const carry: Carry = { path, y: window.scrollY, values: fields().map((f) => f.value) };
    sessionStorage.setItem(KEY, JSON.stringify(carry));
  } catch {
    // Blocked storage: the language still changes.
  }
}

/** Sets a value the way typing does, so the page's own state updates too. */
function fill(field: Field, value: string) {
  if (field.value === value) return;
  const proto = Object.getPrototypeOf(field) as object;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(field, value);
  field.dispatchEvent(new Event(field instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
}

export function restoreAfterLanguageChange(): void {
  let carry: Carry | null = null;
  try {
    const raw = sessionStorage.getItem(KEY);
    carry = raw ? (JSON.parse(raw) as Carry) : null;
  } catch {
    return;
  }
  if (!carry) return;
  const { path, y, values } = carry;
  const started = performance.now();
  let arrived = false;
  let filled = !values.some(Boolean);
  // The new page mounts just before the address changes, and parts of it stream in, so keep trying briefly.
  const attempt = () => {
    if (!arrived && window.location.pathname === path) {
      arrived = true;
      try {
        sessionStorage.removeItem(KEY);
      } catch {
        // Nothing to clean up.
      }
    }
    if (arrived) {
      if (!filled) {
        const now = fields();
        if (now.length === values.length) {
          now.forEach((f, i) => fill(f, values[i]));
          filled = true;
        }
      }
      const tall = document.documentElement.scrollHeight >= y + window.innerHeight;
      if (tall) window.scrollTo({ top: y, behavior: "instant" });
      if (filled && tall) return;
    }
    if (performance.now() - started < 2500) requestAnimationFrame(attempt);
    else if (!arrived) {
      try {
        sessionStorage.removeItem(KEY);
      } catch {
        // Nothing to clean up.
      }
    }
  };
  requestAnimationFrame(attempt);
}
