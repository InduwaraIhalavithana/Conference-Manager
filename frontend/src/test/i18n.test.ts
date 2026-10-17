import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { dictionaries, hasKey, translate } from '../i18n';
import en from '../i18n/en';
import { TOURS } from '../components/Tour';
import { ACTIVITY_ACTIONS } from '../pages/organizer/activity';
import { NOTIFICATION_KINDS } from '../utils/misc';
import { CATEGORIES, SESSION_KINDS } from '../types';

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

// Words that are the same in every language on purpose (brand names, formats).
const SAME_EVERYWHERE = new Set(['email_placeholder', 'calendar_google']);

describe('dictionaries', () => {
  for (const lang of ['si', 'ta'] as const) {
    const dict = dictionaries[lang];

    it(`${lang} has exactly the English keys`, () => {
      expect(Object.keys(dict).sort()).toEqual(Object.keys(en).sort());
    });

    it(`${lang} has no empty texts and keeps every placeholder`, () => {
      for (const [key, value] of Object.entries(dict)) {
        expect(value.trim(), key).not.toBe('');
        expect(placeholders(value), key).toEqual(placeholders(en[key as keyof typeof en]));
      }
    });

    it(`${lang} is actually translated`, () => {
      const untranslated = Object.keys(en).filter((k) => !SAME_EVERYWHERE.has(k) && dict[k as keyof typeof en] === en[k as keyof typeof en]);
      expect(untranslated).toEqual([]);
    });

    it(`${lang} text is written in its own script`, () => {
      const script = lang === 'si' ? /[඀-෿]/ : /[஀-௿]/;
      const latinOnly = Object.entries(dict).filter(([k, v]) => !SAME_EVERYWHERE.has(k) && !script.test(v)).map(([k]) => k);
      expect(latinOnly).toEqual([]);
    });
  }

  it('fills placeholders', () => {
    expect(translate('en', 'in_days', { count: 3 })).toBe('In 3 days');
    expect(translate('si', 'in_days', { count: 3 })).toBe('තව දින 3කින්');
  });
});

describe('keys that are built at runtime exist', () => {
  it('every guided-tour step has a title and body', () => {
    for (const [name, steps] of Object.entries(TOURS)) {
      steps.forEach((_, i) => {
        expect(hasKey(`tour_${name}_${i + 1}_title`), `${name} ${i + 1}`).toBe(true);
        expect(hasKey(`tour_${name}_${i + 1}_body`), `${name} ${i + 1}`).toBe(true);
      });
    }
  });

  it('categories, session kinds, activity actions and notifications are translated', () => {
    CATEGORIES.forEach((c) => expect(hasKey(`cat_${c}`), c).toBe(true));
    SESSION_KINDS.forEach((k) => expect(hasKey(`kind_${k}`), k).toBe(true));
    ACTIVITY_ACTIONS.forEach((a) => expect(hasKey(`act_${a}`), a).toBe(true));
    NOTIFICATION_KINDS.forEach((n) => expect(hasKey(`note_${n}`), n).toBe(true));
    ['general', 'attending', 'organizing', 'technical', 'partnership'].forEach((t) => expect(hasKey(`topic_${t}`)).toBe(true));
  });

  it('every error code and notification kind the backend can send has a translation', () => {
    const root = join(__dirname, '..', '..', '..', 'backend', 'app');
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (p.endsWith('.py')) files.push(p);
      }
    };
    walk(root);
    const source = files.map((f) => readFileSync(f, 'utf8')).join('\n');
    const codes = new Set([...source.matchAll(/AppError\(\s*\d+,\s*"([a-z_]+)"/g)].map((m) => m[1]));
    const kinds = new Set([...source.matchAll(/notify_(?:organizer|admins)\(\s*db,\s*(?:[\w.]+,\s*)?"([a-z_]+)"/g)].map((m) => m[1]));
    expect(codes.size).toBeGreaterThan(15);
    expect(kinds.size).toBeGreaterThan(8);
    codes.forEach((c) => expect(hasKey(`err_${c}`), `err_${c}`).toBe(true));
    kinds.forEach((k) => expect(hasKey(`note_${k}`), `note_${k}`).toBe(true));
  });
});
