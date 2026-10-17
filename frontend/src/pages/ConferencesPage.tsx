import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useDebounced, usePageTitle } from '../hooks';
import { formatNumber } from '../i18n/format';
import { api } from '../services/api';
import { CATEGORIES, type Conference, type Paged, type PublicStats } from '../types';
import { catColor, catMeta } from '../utils/categories';
import { errorMessage } from '../utils/errors';
import ConferenceCard from '../components/ConferenceCard';
import CustomSelect from '../components/CustomSelect';
import DatePicker from '../components/DatePicker';
import { EmptyState, Pagination, SkeletonCards } from '../components/ui';
import './ConferencesPage.css';

export default function ConferencesPage() {
  const { t, lang } = useApp();
  usePageTitle('nav_conferences');
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<Paged<Conference> | null>(null);
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState(params.get('q') ?? '');
  const debouncedQ = useDebounced(q, 350);

  const when = params.get('when') === 'past' ? 'past' : 'upcoming';
  const category = params.get('category') ?? '';
  const city = params.get('city') ?? '';
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const sort = params.get('sort') === 'popular' ? 'popular' : 'date';
  const page = Number(params.get('page') ?? '1') || 1;

  const update = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v); else next.delete(k);
    }
    if (!('page' in patch)) next.delete('page');
    setParams(next, { replace: true });
  };

  useEffect(() => {
    if ((params.get('q') ?? '') !== debouncedQ) update({ q: debouncedQ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ]);

  useEffect(() => { api.publicStats().then(setStats).catch(() => {}); }, []);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError('');
    api.conferences({ q: params.get('q'), category, city, when, date_from: from, date_to: to, sort, page, per_page: 12 })
      .then((d) => { if (alive) setData(d); })
      .catch((err) => { if (alive) { setError(errorMessage(err, t)); setData({ items: [], total: 0, page: 1, pages: 1 }); } });
    return () => { alive = false; };
  }, [params, category, city, when, from, to, sort, page, t]);

  const cityOptions = useMemo(() => [
    { value: '', label: t('all_cities') },
    ...(stats?.cities ?? []).map((c) => ({ value: c.city, label: `${c.city} (${formatNumber(c.count, lang)})` })),
  ], [stats, t, lang]);

  const filtered = Boolean(params.get('q') || category || city || from || to);
  const clear = () => { setQ(''); setParams(when === 'past' ? { when: 'past' } : {}, { replace: true }); };

  return (
    <div>
      <section className="conf-hero">
        <div className="container">
          <div className="conf-hero__top">
            <div>
              <h1><i className="fas fa-calendar-days" aria-hidden="true" /> {t('conferences_title')}</h1>
              <p>{t('conferences_subtitle')}</p>
            </div>
            <div className="tabs" role="tablist" aria-label={t('conferences_title')}>
              <button role="tab" className="tab" aria-selected={when === 'upcoming'} onClick={() => update({ when: '' })}>
                <i className="fas fa-rocket" /> {t('tab_upcoming')}
                {stats && <span className="count">{formatNumber(stats.upcoming, lang)}</span>}
              </button>
              <button role="tab" className="tab" aria-selected={when === 'past'} onClick={() => update({ when: 'past' })}>
                <i className="fas fa-clock-rotate-left" /> {t('tab_past')}
                {stats && <span className="count">{formatNumber(stats.held, lang)}</span>}
              </button>
            </div>
          </div>

          <div className="conf-filters card">
            <div className="input-icon conf-filters__search">
              <i className="fas fa-magnifying-glass" aria-hidden="true" />
              <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('search_placeholder')} aria-label={t('search_placeholder')} />
            </div>
            <div className="conf-filters__row">
              <CustomSelect value={city} options={cityOptions} onChange={(v) => update({ city: v })} icon="location-dot" ariaLabel={t('filter_city')} />
              <DatePicker value={from} onChange={(v) => update({ from: v })} clearable placeholder={t('filter_from')} ariaLabel={t('filter_from')} />
              <DatePicker value={to} onChange={(v) => update({ to: v })} clearable min={from || undefined} placeholder={t('filter_to')} ariaLabel={t('filter_to')} />
              <CustomSelect
                value={sort}
                onChange={(v) => update({ sort: v === 'date' ? '' : v })}
                icon="arrow-down-wide-short"
                ariaLabel={t('sort_by')}
                options={[
                  { value: 'date', label: when === 'past' ? t('sort_recent') : t('sort_soonest') },
                  { value: 'popular', label: t('sort_popular') },
                ]}
              />
            </div>
            <div className="conf-filters__cats" role="group" aria-label={t('filter_category')}>
              <button className="chip" aria-pressed={!category} onClick={() => update({ category: '' })}>
                <i className="fas fa-border-all" /> {t('all_categories')}
              </button>
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  className="chip chip--cat"
                  aria-pressed={category === c}
                  style={{ '--cat': catColor(c), '--chip-on': catColor(c) } as CSSProperties}
                  onClick={() => update({ category: category === c ? '' : c })}
                >
                  <i className={`fas fa-${catMeta(c).icon}`} /> {t(catMeta(c).key)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="band" style={{ paddingTop: 26 }}>
        <div className="container">
          <div className="row row--between" style={{ marginBottom: 16 }}>
            <p className="text-2" aria-live="polite">
              {data ? t('results_count', { count: formatNumber(data.total, lang) }) : t('loading')}
            </p>
            {filtered && <button className="btn btn--sm btn--ghost" onClick={clear}><i className="fas fa-filter-circle-xmark" /> {t('clear_filters')}</button>}
          </div>
          {error && <div className="alert alert--error" style={{ marginBottom: 16 }}><i className="fas fa-circle-exclamation" /> {error}</div>}
          {!data ? <SkeletonCards count={6} h={380} /> : data.items.length === 0 ? (
            <EmptyState icon="calendar-xmark" title={t('no_results_title')} message={filtered ? t('no_results_filtered') : t('no_results_none')}>
              {filtered && <button className="btn btn--primary" onClick={clear}><i className="fas fa-filter-circle-xmark" /> {t('clear_filters')}</button>}
            </EmptyState>
          ) : (
            <>
              <div className="grid grid-cards stagger">
                {data.items.map((c) => <ConferenceCard key={c.id} conf={c} />)}
              </div>
              <Pagination page={data.page} pages={data.pages} onPage={(p) => { update({ page: String(p) }); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
            </>
          )}
        </div>
      </section>
    </div>
  );
}
