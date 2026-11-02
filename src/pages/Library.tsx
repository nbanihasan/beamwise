import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { REFERENCES, REF_KIND_LABEL, refLink } from '@/content/references';
import { LESSONS } from '@/content/registry';
import type { RefKind } from '@/content/types';
import { Link } from 'react-router-dom';

const KINDS: (RefKind | 'all')[] = ['all', 'survey', 'tutorial', 'book', 'paper', 'magazine', 'standard'];

export function Library() {
  const [kind, setKind] = useState<RefKind | 'all'>('all');
  const [q, setQ] = useState('');
  const loc = useLocation();
  const focus = (loc.state as { focus?: string } | null)?.focus;

  useEffect(() => {
    if (focus) setTimeout(() => document.getElementById(`lib-${focus}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 60);
  }, [focus]);

  const list = useMemo(() => {
    const w = q.toLowerCase().trim();
    return REFERENCES.filter((r) => (kind === 'all' || r.kind === kind) && (!w || `${r.title} ${r.authors} ${r.venue} ${r.topics.join(' ')}`.toLowerCase().includes(w))).sort(
      (a, b) => b.year - a.year,
    );
  }, [kind, q]);

  return (
    <div className="page">
      <span className="eyebrow">Library</span>
      <h1 style={{ fontSize: 'var(--step-4)', margin: '10px 0 12px' }}>The reading list behind the atlas</h1>
      <p className="muted" style={{ maxWidth: '66ch', marginTop: 0 }}>
        Surveys and tutorials to orient yourself, the handbooks to go deep, landmark papers, and the standards that turn research into products. Each entry shows which
        lessons cite it.
      </p>
      <div className="lib-bar">
        <div className="seg" role="radiogroup" aria-label="Filter by kind">
          {KINDS.map((k) => (
            <button key={k} type="button" className={k === kind ? 'on' : ''} onClick={() => setKind(k)}>
              {k === 'all' ? 'All' : REF_KIND_LABEL[k]}
              <span className="mono" style={{ opacity: 0.6, marginLeft: 6 }}>
                {k === 'all' ? REFERENCES.length : REFERENCES.filter((r) => r.kind === k).length}
              </span>
            </button>
          ))}
        </div>
        <input id="lib-search" className="lib-search" placeholder="Filter by title, author, topic…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <ol className="lib-list">
        {list.map((r) => {
          const citedBy = LESSONS.filter((l) => l.references.includes(r.id));
          const href = refLink(r);
          return (
            <li key={r.id} id={`lib-${r.id}`} className={focus === r.id ? 'focus' : ''}>
              <div className="lib-year mono">{r.year}</div>
              <div style={{ minWidth: 0 }}>
                <div className="lib-title">
                  {href ? (
                    <a href={href} target="_blank" rel="noreferrer">
                      {r.title}
                    </a>
                  ) : (
                    r.title
                  )}
                </div>
                <div className="muted lib-sub">
                  {r.authors} · <em>{r.venue}</em>
                </div>
                {r.note && <p className="lib-note">{r.note}</p>}
                <div className="lib-tags">
                  <span className="chip">{REF_KIND_LABEL[r.kind]}</span>
                  {r.topics.map((t) => (
                    <span key={t} className="chip">
                      {t}
                    </span>
                  ))}
                  {citedBy.map((l) => (
                    <Link key={l.id} to={`/learn/${l.id}`} className="chip" style={{ color: 'var(--pump)' }}>
                      ↳ {l.title}
                    </Link>
                  ))}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
