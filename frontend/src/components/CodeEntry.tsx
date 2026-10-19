import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from 'react';
import { useApp } from '../context/AppContext';
import { errorMessage } from '../utils/errors';

const LENGTH = 6;

/**
 * Six boxes for an emailed code. Typing moves to the next box, Backspace goes back, and pasting
 * (or the phone's one-time-code autofill) fills them all. Submits by itself once all six are in.
 */
export default function CodeEntry({ onSubmit, label }: { onSubmit: (code: string) => Promise<unknown>; label?: string }) {
  const { t } = useApp();
  const [digits, setDigits] = useState<string[]>(Array(LENGTH).fill(''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  // After a wrong code, start again in the first box (once the boxes are enabled again).
  useEffect(() => {
    if (error && !busy) boxes.current[0]?.focus();
  }, [error, busy]);

  const submit = async (code: string) => {
    if (code.length !== LENGTH || busy) return;
    setBusy(true);
    setError('');
    try {
      await onSubmit(code);
    } catch (err) {
      setError(errorMessage(err, t));
      setDigits(Array(LENGTH).fill(''));
    } finally {
      setBusy(false);
    }
  };

  const fill = (from: number, text: string) => {
    const incoming = text.replace(/\D/g, '').slice(0, LENGTH - from).split('');
    if (!incoming.length) return;
    const next = [...digits];
    incoming.forEach((d, i) => { next[from + i] = d; });
    setDigits(next);
    boxes.current[Math.min(from + incoming.length, LENGTH - 1)]?.focus();
    if (next.every(Boolean)) submit(next.join(''));
  };

  const onKey = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      const next = [...digits];
      next[i - 1] = '';
      setDigits(next);
      boxes.current[i - 1]?.focus();
      e.preventDefault();
    } else if (e.key === 'ArrowLeft' && i > 0) boxes.current[i - 1]?.focus();
    else if (e.key === 'ArrowRight' && i < LENGTH - 1) boxes.current[i + 1]?.focus();
  };

  const onChange = (i: number, value: string) => {
    if (!value) {
      const next = [...digits];
      next[i] = '';
      setDigits(next);
      return;
    }
    fill(i, value);
  };

  const onPaste = (i: number, e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    fill(i, e.clipboardData.getData('text'));
  };

  const onForm = (e: FormEvent) => {
    e.preventDefault();
    submit(digits.join(''));
  };

  return (
    <form className="code-entry" onSubmit={onForm}>
      <label className="code-entry__label" htmlFor="code-0">{label ?? t('code_label')}</label>
      <div className="code-entry__boxes" role="group" aria-label={label ?? t('code_label')}>
        {digits.map((d, i) => (
          <input
            key={i}
            id={`code-${i}`}
            ref={(el) => { boxes.current[i] = el; }}
            className={`code-entry__box${d ? ' is-filled' : ''}`}
            value={d}
            onChange={(e) => onChange(i, e.target.value)}
            onKeyDown={(e) => onKey(i, e)}
            onPaste={(e) => onPaste(i, e)}
            onFocus={(e) => e.target.select()}
            inputMode="numeric"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            maxLength={i === 0 ? LENGTH : 1}
            aria-label={`${i + 1}`}
            disabled={busy}
            autoFocus={i === 0}
          />
        ))}
      </div>
      {error && <div className="alert alert--error" role="alert"><i className="fas fa-circle-exclamation" /> <span>{error}</span></div>}
      <button className="btn btn--primary btn--block" disabled={busy || digits.some((d) => !d)}>
        {busy ? <span className="spinner" /> : <><i className="fas fa-circle-check" /> {t('code_verify_btn')}</>}
      </button>
    </form>
  );
}
