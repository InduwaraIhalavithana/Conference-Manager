import en from './en';
import si from './si';
import ta from './ta';
import type { Lang } from '../types';

export type TKey = keyof typeof en;
export type Dictionary = Record<TKey, string>;
export type Params = Record<string, string | number | null | undefined>;

export const dictionaries: Record<Lang, Dictionary> = { en, si, ta };
export const LANGS: { code: Lang; short: string; name: string }[] = [
  { code: 'en', short: 'EN', name: 'English' },
  { code: 'si', short: 'සිං', name: 'සිංහල' },
  { code: 'ta', short: 'தமி', name: 'தமிழ்' },
];

/** Look up a key and fill {placeholders}. Falls back to English, then the key itself. */
export function translate(lang: Lang, key: TKey, params?: Params): string {
  let text = dictionaries[lang]?.[key] ?? en[key] ?? String(key);
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.split(`{${name}}`).join(value === null || value === undefined ? '' : String(value));
    }
  }
  return text;
}

/** Keys that exist only as data (notification kinds, error codes, actions) are checked at runtime. */
export function hasKey(key: string): key is TKey {
  return Object.prototype.hasOwnProperty.call(en, key);
}
