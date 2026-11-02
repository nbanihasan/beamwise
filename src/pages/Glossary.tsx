import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { GLOSSARY } from '@/content/glossary';
import { lessonById } from '@/content/registry';

export function Glossary() {
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const w = q.toLowerCase();
    return [...GLOSSARY].sort((a, b) => a.term.localeCompare(b.term)).filter((g) => !w || `${g.term} ${g.abbr ?? ''} ${g.def}`.toLowerCase().includes(w));
  }, [q]);
  return (
    <div className="page">
      <span className="eyebrow">Glossary</span>
      <h1 style={{ fontSize: 'var(--step-4)', margin: '10px 0 12px' }}>The vocabulary of light links</h1>
      <input id="glossary-search" className="lib-search" style={{ maxWidth: 420, marginBottom: 22 }} placeholder="Find a term or acronym…" value={q} onChange={(e) => setQ(e.target.value)} />
      <dl className="gloss">
        {list.map((g) => (
          <div key={g.term}>
            <dt>
              {g.term}
              {g.abbr && <span className="mono muted"> · {g.abbr}</span>}
            </dt>
            <dd>
              {g.def}
              {g.lessons && (
                <span className="gloss-links">
                  {g.lessons.map((id) => (
                    <Link key={id} to={`/learn/${id}`}>
                      {lessonById(id)?.title ?? id}
                    </Link>
                  ))}
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
