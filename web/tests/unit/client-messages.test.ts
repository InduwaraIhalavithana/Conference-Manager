import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { CLIENT_PREFIXES, isClientKey } from "@/i18n/client-messages";

import en from "../../messages/en.json";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../src");
const KEYS = new Set(Object.keys(en));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "generated" ? [] : sourceFiles(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

function resolveImport(spec: string, from: string): string | null {
  const base = spec.startsWith("@/") ? join(ROOT, spec.slice(2)) : spec.startsWith(".") ? resolve(dirname(from), spec) : null;
  if (!base) return null;
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** Every file that runs in the browser: "use client" files and everything they import from src/. */
function browserFiles(): string[] {
  const all = sourceFiles(ROOT);
  const queue = all.filter((f) => /^\s*["']use client["']/.test(readFileSync(f, "utf8")));
  const seen = new Set<string>();
  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const m of readFileSync(file, "utf8").matchAll(/from\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g)) {
      const next = resolveImport(m[1] ?? m[2], file);
      if (next && !seen.has(next)) queue.push(next);
    }
  }
  return [...seen];
}

describe("messages sent to the browser", () => {
  const files = browserFiles();

  it("finds the client components", () => {
    expect(files.some((f) => f.endsWith("register-panel.tsx"))).toBe(true);
    expect(files.some((f) => f.endsWith("conference-card.tsx"))).toBe(true);
  });

  it("cover every message key that browser code mentions", () => {
    const missing = new Set<string>();
    for (const file of files) {
      const code = readFileSync(file, "utf8");
      // Keys with an underscore are distinctive anywhere (lists like ["days", "cd_days"]); one-word keys
      // such as "agenda" only count inside a t(...) call, so props like mode="cancel" are not mistaken.
      const found = [
        ...[...code.matchAll(/["'`]([a-z][a-z0-9]*_[a-zA-Z0-9_]*)["'`]/g)].map((m) => m[1]),
        ...[...code.matchAll(/(?<![\w.])t(?:\.rich)?\(\s*["']([a-z][a-z0-9]*)["']/g)].map((m) => m[1]),
      ];
      for (const key of found) if (KEYS.has(key) && !isClientKey(key)) missing.add(key);
    }
    expect([...missing].sort()).toEqual([]);
  });

  it("cover every key built at run time, like t(`kind_${kind}`)", () => {
    const prefixes = new Set<string>();
    for (const file of files) {
      for (const m of readFileSync(file, "utf8").matchAll(/`([a-z][a-z0-9_]*_)\$\{/g)) {
        if ([...KEYS].some((k) => k.startsWith(m[1]))) prefixes.add(m[1]);
      }
    }
    const uncovered = [...prefixes].filter((p) => !CLIENT_PREFIXES.some((c) => p.startsWith(c)));
    expect(uncovered).toEqual([]);
  });
});
