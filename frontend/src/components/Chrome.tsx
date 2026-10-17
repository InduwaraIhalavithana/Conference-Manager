import { Component, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { translate } from '../i18n';

/** Thin bar at the top that fills as the page scrolls. */
export function ScrollProgress() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (ref.current) ref.current.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
    };
    const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(update); };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);
  return <div ref={ref} className="scroll-progress" aria-hidden="true" />;
}

export function BackToTop() {
  const { t } = useApp();
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 700);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  if (!show) return null;
  return (
    <button className="to-top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label={t('back_to_top')} title={t('back_to_top')}>
      <i className="fas fa-arrow-up" />
    </button>
  );
}

/** Scroll to the top on every page change (keeps hash links working). */
export function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname, hash]);
  return null;
}

interface EBState { error: Error | null }

/** Shows a friendly message instead of a blank page if a component crashes. */
export class ErrorBoundary extends Component<{ children: ReactNode; lang: 'en' | 'si' | 'ta' }, EBState> {
  state: EBState = { error: null };

  static getDerivedStateFromError(error: Error): EBState {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const l = this.props.lang;
    return (
      <div className="container page">
        <div className="empty">
          <div className="empty__icon"><i className="fas fa-triangle-exclamation" /></div>
          <h3>{translate(l, 'crash_title')}</h3>
          <p>{translate(l, 'crash_body')}</p>
          <button className="btn btn--primary" onClick={() => window.location.reload()}>
            <i className="fas fa-rotate" /> {translate(l, 'reload')}
          </button>
        </div>
      </div>
    );
  }
}
