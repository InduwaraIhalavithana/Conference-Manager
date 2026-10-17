import { useEffect, useRef, useState } from 'react';
import QRCodeLib from 'qrcode';
import jsQR from 'jsqr';
import { useApp } from '../context/AppContext';

/** QR code drawn on a canvas. Dark modules on white, whatever the theme, so scanners read it. */
export function QRCode({ value, size = 220 }: { value: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    QRCodeLib.toCanvas(ref.current, value, { width: size, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#0b1628', light: '#ffffff' } })
      .catch(() => {});
  }, [value, size]);
  return <canvas ref={ref} width={size} height={size} className="qr-canvas" aria-label="QR" />;
}

/**
 * Camera scanner. Decodes frames with jsQR (works on Windows Chrome, which has no BarcodeDetector).
 * Calls onCode once per distinct code; the same code is ignored for a few seconds.
 */
export function QrScanner({ onCode, paused }: { onCode: (code: string) => void; paused?: boolean }) {
  const { t } = useApp();
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<'starting' | 'on' | 'denied' | 'unsupported'>('starting');
  const last = useRef({ code: '', at: 0 });
  const cb = useRef(onCode);
  cb.current = onCode;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    if (!navigator.mediaDevices?.getUserMedia) {
      setState('unsupported');
      return;
    }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((s) => {
        if (stopped) { s.getTracks().forEach((tr) => tr.stop()); return; }
        stream = s;
        const v = video.current!;
        v.srcObject = s;
        v.setAttribute('playsinline', 'true');
        v.play().catch(() => {});
        setState('on');
        const tick = () => {
          if (stopped) return;
          const c = canvas.current;
          if (c && v.readyState >= 2 && !pausedRef.current) {
            const w = v.videoWidth;
            const h = v.videoHeight;
            c.width = w;
            c.height = h;
            const ctx = c.getContext('2d', { willReadFrequently: true });
            if (ctx) {
              ctx.drawImage(v, 0, 0, w, h);
              const found = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' });
              const now = Date.now();
              if (found?.data && (found.data !== last.current.code || now - last.current.at > 4000)) {
                last.current = { code: found.data, at: now };
                cb.current(found.data);
              }
            }
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      })
      .catch(() => setState('denied'));
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((tr) => tr.stop());
    };
  }, []);

  return (
    <div className="scanner">
      <video ref={video} muted className={state === 'on' ? '' : 'is-hidden'} />
      <canvas ref={canvas} hidden />
      {state === 'on' && <div className="scanner__frame" aria-hidden="true"><span /></div>}
      {state !== 'on' && (
        <div className="scanner__msg">
          <i className={`fas fa-${state === 'starting' ? 'camera' : 'video-slash'}`} aria-hidden="true" />
          <span>{state === 'starting' ? t('scanner_starting') : state === 'denied' ? t('scanner_denied') : t('scanner_unsupported')}</span>
        </div>
      )}
    </div>
  );
}
