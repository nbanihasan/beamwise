import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LESSONS } from '@/content/registry';
import { GLOSSARY } from '@/content/glossary';
import { REFERENCES } from '@/content/references';
import { trackById } from '@/content/tracks';

interface Item {
  kind: string;
  title: string;
  sub: string;
  hay: string;
  go: () => void;
}

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);

  const items = useMemo<Item[]>(() => {
    const pages: Item[] = [
      { kind: 'Page', title: 'Link Lab', sub: 'End-to-end link simulator', hay: 'link lab simulator playground ber', go: () => nav('/lab') },
      { kind: 'Page', title: 'Curriculum', sub: 'All tracks and lessons', hay: 'learn curriculum lessons', go: () => nav('/learn') },
      { kind: 'Page', title: 'Library', sub: 'Surveys, tutorials, books, standards', hay: 'library references papers surveys', go: () => nav('/library') },
    ];
    const lessons: Item[] = LESSONS.map((l) => ({
      kind: 'Lesson',
      title: l.title,
      sub: `${trackById(l.track)?.title ?? ''} · ${l.subtitle}`,
      hay: `${l.title} ${l.subtitle} ${l.tags.join(' ')}`.toLowerCase(),
      go: () => nav(`/learn/${l.id}`),
    }));
    const terms: Item[] = GLOSSARY.map((g) => ({
      kind: 'Term',
      title: g.abbr ? `${g.term} (${g.abbr})` : g.term,
      sub: g.def,
      hay: `${g.term} ${g.abbr ?? ''} ${g.def}`.toLowerCase(),
      go: () => (g.lessons?.[0] ? nav(`/learn/${g.lessons[0]}`) : nav('/glossary')),
    }));
    const refs: Item[] = REFERENCES.map((r) => ({
      kind: 'Paper',
      title: r.title,
      sub: `${r.authors} · ${r.venue} · ${r.year}`,
      hay: `${r.title} ${r.authors} ${r.venue} ${r.topics.join(' ')}`.toLowerCase(),
      go: () => nav('/library', { state: { focus: r.id } }),
    }));
    return [...pages, ...lessons, ...terms, ...refs];
  }, [nav]);

  const results = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return items.slice(0, 14);
    return items
      .map((it) => {
        let score = 0;
        for (const w of words) {
          if (it.title.toLowerCase().includes(w)) score += 3;
          else if (it.hay.includes(w)) score += 1;
          else return null;
        }
        return { it, score };
      })
      .filter((x): x is { it: Item; score: number } => !!x)
      .sort((a, b) => b.score - a.score)
      .slice(0, 30)
      .map((x) => x.it);
  }, [q, items]);

  useEffect(() => setSel(0), [q]);

  const run = (it?: Item) => {
    if (!it) return;
    it.go();
    onClose();
  };

  return (
    <div className="palette-backdrop" onMouseDown={onClose} role="presentation">
      <div className="palette" role="dialog" aria-label="Search" onMouseDown={(e) => e.stopPropagation()}>
        <input
          ref={input}
          id="palette-input"
          value={q}
          placeholder="Search lessons, terms, papers…  e.g. “rolling shutter”, “APD”, “802.11bb”"
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setSel((s) => Math.min(results.length - 1, s + 1));
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              setSel((s) => Math.max(0, s - 1));
            }
            if (e.key === 'Enter') run(results[sel]);
          }}
        />
        <div className="palette-list">
          {results.length === 0 && <div className="muted" style={{ padding: 14 }}>No matches. Try a broader word, such as “noise” or “OFDM”.</div>}
          {results.map((it, i) => (
            <button key={`${it.kind}-${it.title}`} type="button" className={`palette-item ${i === sel ? 'sel' : ''}`} onMouseEnter={() => setSel(i)} onClick={() => run(it)}>
              <span className="kind">{it.kind}</span>
              <span>
                {it.title}
                <span className="sub">{it.sub}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
