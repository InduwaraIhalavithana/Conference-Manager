import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { anchorVisible, placePopup } from '../utils/popover';
import './CustomSelect.css';

export interface SelectOption<V extends string = string> {
  value: V;
  label: ReactNode;
  icon?: string;
  color?: string;
}

interface Props<V extends string> {
  value: V;
  options: SelectOption<V>[];
  onChange: (value: V) => void;
  placeholder?: string;
  ariaLabel?: string;
  id?: string;
  disabled?: boolean;
  compact?: boolean;
  className?: string;
  icon?: string;
}

/**
 * Dropdown drawn by the app instead of the OS, so it follows the theme (Windows Chrome draws native
 * lists white in dark mode). The list is portaled to <body> so modals and scroll boxes cannot clip it.
 */
export default function CustomSelect<V extends string>({
  value, options, onChange, placeholder, ariaLabel, id, disabled, compact, className, icon,
}: Props<V>) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<CSSProperties>({});
  const btnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = options.find((o) => o.value === value);
  // Type-to-jump: letters typed within a short time form one search ("te" -> Technology).
  const typed = useRef({ text: '', at: 0 });
  // Option to highlight when the list opens from typing, instead of the selected one.
  const pending = useRef<number | null>(null);

  const place = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;
    const wanted = Math.min(340, options.length * 48 + 12);
    const width = Math.max(btn.getBoundingClientRect().width, compact ? 170 : 0);
    const p = placePopup(btn, wanted, width);
    setPos({ ...p, maxHeight: Math.min(wanted, p.maxHeight) });
  }, [options.length, compact]);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    const idx = options.findIndex((o) => o.value === value);
    setActive(pending.current ?? (idx >= 0 ? idx : 0));
    pending.current = null;
  }, [open, place, options, value]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!btnRef.current?.contains(t) && !listRef.current?.contains(t)) setOpen(false);
    };
    // Follow the button while it is on screen; once it scrolls away (under the navbar or off
    // the bottom), close instead of leaving the list floating over other content.
    const onMove = () => (anchorVisible(btnRef.current) ? place() : setOpen(false));
    document.addEventListener('mousedown', onDown);
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const pick = (v: V) => {
    onChange(v);
    setOpen(false);
    btnRef.current?.focus();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      setActive((a) => (a + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (open && options[active]) pick(options[active].value);
      else setOpen(true);
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      setOpen(false);
    } else if (e.key === 'Home') {
      setActive(0);
    } else if (e.key === 'End') {
      setActive(options.length - 1);
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const now = Date.now();
      const text = (now - typed.current.at < 700 ? typed.current.text : '') + e.key.toLowerCase();
      typed.current = { text, at: now };
      const from = open && text.length === 1 ? active + 1 : open ? active : 0;
      for (let k = 0; k < options.length; k++) {
        const i = (from + k) % options.length;
        if (optionMatches(options[i], text)) {
          if (open) setActive(i);
          else { pending.current = i; setOpen(true); }
          break;
        }
      }
    }
  };

  return (
    <div className={`csel${open ? ' csel--open' : ''}${compact ? ' csel--compact' : ''}${className ? ` ${className}` : ''}`}>
      <button
        ref={btnRef}
        id={id}
        type="button"
        className={`csel__btn${selected ? '' : ' csel__btn--ph'}`}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={onKey}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
      >
        {icon && <i className={`fas fa-${icon} csel__lead`} aria-hidden="true" />}
        {selected?.icon && <i className={`fas fa-${selected.icon}`} style={{ color: selected.color }} aria-hidden="true" />}
        <span className="csel__label">{selected ? selected.label : placeholder}</span>
        <i className="fas fa-chevron-down csel__arrow" aria-hidden="true" />
      </button>
      {open && createPortal(
        <div ref={listRef} id={listId} className="csel__list" role="listbox" style={pos} aria-label={ariaLabel}>
          {options.map((o, i) => {
            const isSel = o.value === value;
            return (
              <div
                key={o.value}
                data-idx={i}
                role="option"
                aria-selected={isSel}
                className={`csel__opt${isSel ? ' csel__opt--sel' : ''}${i === active ? ' csel__opt--active' : ''}`}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => { e.preventDefault(); pick(o.value); }}
              >
                {o.icon && <i className={`fas fa-${o.icon}`} style={{ color: o.color }} aria-hidden="true" />}
                <span className="csel__opt-label">{o.label}</span>
                {isSel && <i className="fas fa-check csel__check" aria-hidden="true" />}
              </div>
            );
          })}
        </div>,
        document.body,
      )}
    </div>
  );
}

/** Does an option start with the typed text? Times also match without a leading zero ("9" finds 09:00). */
function optionMatches(o: SelectOption, text: string): boolean {
  const label = typeof o.label === 'string' ? o.label.toLowerCase() : '';
  const value = String(o.value).toLowerCase();
  return label.startsWith(text) || value.startsWith(text) || value.replace(/^0/, '').startsWith(text);
}
