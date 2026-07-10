import { Children, useEffect, useRef, useState } from "react";
import "./CustomSelect.css";

export default function CustomSelect({ name, value, onChange, disabled, children, className, style, compact }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const options = [];
  Children.forEach(children, (child) => {
    if (child?.type === "option") {
      options.push({ value: child.props.value ?? "", label: child.props.children });
    }
  });

  const selected = options.find((o) => String(o.value) === String(value ?? ""));
  const isEmpty = !selected || selected.value === "";

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const keyHandler = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", keyHandler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", keyHandler);
    };
  }, [open]);

  const pick = (val) => {
    onChange({ target: { name, value: val } });
    setOpen(false);
  };

  const handleKey = (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((o) => !o); }
    if (e.key === "ArrowDown" && !open) { e.preventDefault(); setOpen(true); }
  };

  return (
    <div
      ref={ref}
      className={`csel${open ? " csel--open" : ""}${disabled ? " csel--disabled" : ""}${compact ? " csel--compact" : ""}${className ? " " + className : ""}`}
      style={style}
    >
      <button
        type="button"
        className={`csel__btn${isEmpty ? " csel__btn--ph" : ""}`}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={handleKey}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="csel__label">{selected?.label ?? ""}</span>
        <i className="fas fa-chevron-down csel__arrow" />
      </button>
      {open && (
        <div className="csel__list" role="listbox">
          {options.map((opt, i) => (
            <div
              key={i}
              role="option"
              aria-selected={String(opt.value) === String(value ?? "")}
              className={`csel__opt${String(opt.value) === String(value ?? "") ? " csel__opt--sel" : ""}${opt.value === "" ? " csel__opt--ph" : ""}`}
              onMouseDown={() => pick(opt.value)}
            >
              {opt.label}
              {String(opt.value) === String(value ?? "") && <i className="fas fa-check csel__check" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
