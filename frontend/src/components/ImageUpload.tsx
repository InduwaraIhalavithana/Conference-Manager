import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import toast from 'react-hot-toast';
import { useApp } from '../context/AppContext';
import { errorMessage } from '../utils/errors';
import './ImageUpload.css';

const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

interface Props {
  current: string | null;
  maxMb: number;
  shape: 'round' | 'wide';
  onUpload: (file: File) => Promise<unknown>;
  onRemove: () => Promise<unknown>;
  placeholder?: ReactNode;
  label?: string;
}

/** Choose / replace / remove an image. Checks type and size before uploading and says why it refused. */
export default function ImageUpload({ current, maxMb, shape, onUpload, onRemove, placeholder, label }: Props) {
  const { t } = useApp();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'up' | 'rm' | null>(null);
  const [problem, setProblem] = useState('');
  const [drag, setDrag] = useState(false);

  const handle = async (file: File | undefined) => {
    setProblem('');
    if (!file) return;
    if (!TYPES.includes(file.type)) {
      setProblem(t('upload_bad_type'));
      return;
    }
    if (file.size > maxMb * 1024 * 1024) {
      setProblem(t('upload_too_big', { size: (file.size / 1024 / 1024).toFixed(1), max: maxMb }));
      return;
    }
    setBusy('up');
    try {
      await onUpload(file);
      toast.success(t('upload_done'));
    } catch (err) {
      setProblem(errorMessage(err, t));
    } finally {
      setBusy(null);
      if (input.current) input.current.value = '';
    }
  };

  const remove = async () => {
    setBusy('rm');
    setProblem('');
    try {
      await onRemove();
      toast.success(t('upload_removed'));
    } catch (err) {
      setProblem(errorMessage(err, t));
    } finally {
      setBusy(null);
    }
  };

  const style = current ? ({ backgroundImage: `url(${current})` } as CSSProperties) : undefined;

  return (
    <div className={`upl upl--${shape}`}>
      <div
        className={`upl__drop${drag ? ' upl__drop--drag' : ''}${current ? ' upl__drop--has' : ''}`}
        style={style}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files?.[0]); }}
        onClick={() => input.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') input.current?.click(); }}
        aria-label={label ?? t('upload_choose')}
      >
        {!current && (placeholder ?? <i className="fas fa-image" aria-hidden="true" />)}
        {busy === 'up' && <span className="upl__busy"><span className="spinner" /></span>}
        <span className="upl__hover"><i className="fas fa-camera" /> {current ? t('upload_replace') : t('upload_choose')}</span>
      </div>
      <div className="upl__side">
        <div className="row">
          <button type="button" className="btn btn--sm" onClick={() => input.current?.click()} disabled={busy !== null}>
            <i className="fas fa-upload" /> {current ? t('upload_replace') : t('upload_choose')}
          </button>
          {current && (
            <button type="button" className="btn btn--sm btn--danger" onClick={remove} disabled={busy !== null}>
              {busy === 'rm' ? <span className="spinner" /> : <i className="fas fa-trash" />} {t('upload_remove')}
            </button>
          )}
        </div>
        <p className="hint">{t('upload_rules', { max: maxMb })}</p>
        {problem && (
          <div className="alert alert--warning" role="alert">
            <i className="fas fa-triangle-exclamation" /> <span>{problem}</span>
          </div>
        )}
      </div>
      <input ref={input} type="file" accept={TYPES.join(',')} hidden onChange={(e) => handle(e.target.files?.[0])} />
    </div>
  );
}
