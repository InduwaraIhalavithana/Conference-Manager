import type { CSSProperties } from 'react';

const GAP = 6;
const EDGE = 8;

/** Bottom edge of the fixed navbar: popups must not slide under (or over) it. */
function navBottom(): number {
  return document.querySelector('.nav')?.getBoundingClientRect().bottom ?? 0;
}

/** Is the anchor still on screen (below the navbar and above the bottom edge)? */
export function anchorVisible(anchor: Element | null): boolean {
  if (!anchor) return false;
  const r = anchor.getBoundingClientRect();
  return r.bottom > navBottom() && r.top < window.innerHeight;
}

/**
 * Fixed-position style for a popup under its anchor, or above it when there is more room there.
 * `height` is the popup's natural height; `maxHeight` tells the caller how much fits.
 */
export function placePopup(anchor: Element, height: number, width: number, align: 'left' | 'right' = 'left'): CSSProperties & { maxHeight: number } {
  const r = anchor.getBoundingClientRect();
  const top = navBottom() + EDGE;
  const below = window.innerHeight - EDGE - (r.bottom + GAP);
  const above = r.top - GAP - top;
  const w = Math.min(width, window.innerWidth - 2 * EDGE);
  const wantedLeft = align === 'right' ? r.right - w : r.left;
  const left = Math.min(Math.max(EDGE, wantedLeft), window.innerWidth - w - EDGE);
  if (below >= height || below >= above) {
    return { left, top: r.bottom + GAP, width: w, maxHeight: Math.max(120, below) };
  }
  return { left, bottom: window.innerHeight - r.top + GAP, width: w, maxHeight: Math.max(120, above) };
}
