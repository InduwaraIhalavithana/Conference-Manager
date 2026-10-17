import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
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

  const place = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const wanted = Math.min(340, options.length * 48 + 12);
    const below = window.innerHeight - r.bottom - 12;
    const up = below < Math.min(wanted, 220) && r.top > below;
    const width = Math.max(r.width, compact ? 170 : r.width);
    const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
    setPos(up
      ? { left, bottom: window.innerHeight - r.top + 6, width, maxHeight: Math.min(wanted, r.top - 12) }
      : { left, top: r.bottom + 6, width, maxHeight: Math.min(wanted, Math.max(160, below)) });
  }, [options.length, compact]);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    const idx = options.findIndex((o) => o.value === value);
    setActive(idx >= 0 ? idx : 0);
  }, [open, place, options, value]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!btnRef.current?.contains(t) && !listRef.current?.contains(t)) setOpen(false);
    };
    const onMove = () => place();
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
