import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import en from "../../messages/en.json";
import si from "../../messages/si.json";
import ta from "../../messages/ta.json";

const BUNDLES = { en, si, ta } as Record<string, Record<string, string>>;
const placeholders = (text: string) => [...text.matchAll(/\{(\w+)[,}]/g)].map((m) => m[1]).sort();
const tags = (text: string) => [...text.matchAll(/<(\w+)>/g)].map((m) => m[1]).sort();

describe("translations", () => {
  it("has the same keys in English, Sinhala and Tamil", () => {
    const keys = Object.keys(en).sort();
    for (const [lang, bundle] of Object.entries(BUNDLES)) {
      expect(Object.keys(bundle).sort(), lang).toEqual(keys);
    }
  });

  it("has no empty messages", () => {
    for (const [lang, bundle] of Object.entries(BUNDLES)) {
      const empty = Object.entries(bundle).filter(([, v]) => !v.trim()).map(([k]) => k);
      expect(empty, lang).toEqual([]);
    }
  });

  it("uses the same {placeholders} and <tags> in every language", () => {
    for (const [key, text] of Object.entries(en as Record<string, string>)) {
      for (const lang of ["si", "ta"]) {
        expect(placeholders(BUNDLES[lang][key]), `${lang}.${key}`).toEqual(placeholders(text));
        expect(tags(BUNDLES[lang][key]), `${lang}.${key}`).toEqual(tags(text));
      }
    }
  });

  it("has a message for every error code the API can return", () => {
    const schema = readFileSync(new URL("../../src/graphql/schema.graphql", import.meta.url), "utf8");
    const block = schema.match(/enum ErrorCode \{([^}]*)\}/);
    expect(block).not.toBeNull();
    const codes = block![1].split(/\s+/).filter(Boolean);
    expect(codes.length).toBeGreaterThan(20);
    const missing = codes.map((c) => `err_${c.toLowerCase()}`).filter((k) => !(k in en));
    expect(missing).toEqual([]);
  });
});
