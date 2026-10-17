import type { TKey } from '../i18n';
import type { Category } from '../types';

export const CATEGORY_META: Record<Category, { icon: string; varName: string; key: TKey }> = {
  Tech: { icon: 'microchip', varName: '--cat-tech', key: 'cat_Tech' },
  Health: { icon: 'heart-pulse', varName: '--cat-health', key: 'cat_Health' },
  Education: { icon: 'graduation-cap', varName: '--cat-education', key: 'cat_Education' },
  Business: { icon: 'briefcase', varName: '--cat-business', key: 'cat_Business' },
  Science: { icon: 'flask', varName: '--cat-science', key: 'cat_Science' },
  Arts: { icon: 'palette', varName: '--cat-arts', key: 'cat_Arts' },
  Other: { icon: 'shapes', varName: '--cat-other', key: 'cat_Other' },
};

export function catMeta(category: Category | null | undefined) {
  return CATEGORY_META[category ?? 'Other'] ?? CATEGORY_META.Other;
}

/** CSS value for a category colour, used as `style={{ '--cat': catColor(c) }}`. */
export function catColor(category: Category | null | undefined): string {
  return `var(${catMeta(category).varName})`;
}

/** Gradient used when a conference has no cover photo. */
export function coverGradient(category: Category | null | undefined, seed = 0): string {
  const c = catColor(category);
  const angle = 115 + (seed % 5) * 12;
  return `linear-gradient(${angle}deg, color-mix(in srgb, ${c} 85%, #000 15%) 0%, color-mix(in srgb, ${c} 55%, #312e81) 55%, #1e1b4b 100%)`;
}
