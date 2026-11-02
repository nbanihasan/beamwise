import { useEffect, useRef, useState, type ComponentType } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MDXProvider } from '@mdx-js/react';
import { lessonById, LESSONS, neighbours } from '@/content/registry';
import { TRACKS, trackById } from '@/content/tracks';
import { refById, refLink, REF_KIND_LABEL } from '@/content/references';
import { LessonRefs, mdxComponents } from '@/mdx/components';
import { setComplete, useProgress } from '@/lib/progress';
import { colorForWavelength, trackColor } from '@/lib/trackColor';
import { IconArrow, IconCheck } from '@/shell/Icons';
import { NotFound } from './NotFound';

const LEVEL_LABEL = { foundation: 'Foundation', core: 'Core', advanced: 'Advanced', frontier: 'Frontier' };

export function LessonPage() {
  const { id = '' } = useParams();
  const lesson = lessonById(id);
  const progress = useProgress();
  const [Body, setBody] = useState<ComponentType<Record<string, unknown>> | null>(null);
  const [toc, setToc] = useState<{ id: string; text: string }[]>([]);
  const [active, setActive] = useState('');
  const prose = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    setBody(null);
    setToc([]);
    lesson?.load().then((m) => live && setBody(() => m.default));
    return () => {
      live = false;
    };
  }, [lesson]);

  useEffect(() => {
    if (!Body || !prose.current) return;
    const hs = Array.from(prose.current.querySelectorAll('h2[id]')) as HTMLElement[];
    setToc(hs.map((h) => ({ id: h.id, text: h.textContent ?? '' })));
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActive(vis[0].target.id);
      },
      { rootMargin: '-80px 0px -65% 0px' },
    );
    hs.forEach((h) => io.observe(h));
    return () => io.disconnect();
  }, [Body]);

  if (!lesson) return <NotFound />;
  const track = trackById(lesson.track);
  const { prev, next } = neighbours(lesson.id);
  const done = !!progress[lesson.id];
  const tc = trackColor(lesson.track);

  return (
    <div className="lesson-layout">
      <nav className="lesson-nav" aria-label="Curriculum">
        {TRACKS.map((t) => (
          <div className="track" key={t.id}>
            <div className="track-title">
              <span className="swatch" style={{ background: colorForWavelength(t.wavelength) }} />
              {t.title}
            </div>
            {LESSONS.filter((l) => l.track === t.id).map((l) => (
              <Link key={l.id} to={`/learn/${l.id}`} className={l.id === lesson.id ? 'active' : ''}>
                <span className={`check ${progress[l.id] ? 'done' : ''}`}>{progress[l.id] && <IconCheck />}</span>
                {l.title}
              </Link>
            ))}
          </div>
        ))}
      </nav>

      <article style={{ minWidth: 0 }}>
        <header className="lesson-header">
          <div className="lesson-meta">
            <Link to="/learn" className="chip" style={{ color: tc }}>
              <span className="dot" />
              {track?.title} · λ {track?.wavelength} nm
            </Link>
            <span className={`chip level-${lesson.level}`}>{LEVEL_LABEL[lesson.level]}</span>
            <span className="chip">{lesson.minutes} min</span>
            {lesson.draft && <span className="chip" style={{ color: 'var(--warn)' }}>Draft</span>}
          </div>
          <h1>{lesson.title}</h1>
          <p className="subtitle">{lesson.subtitle}</p>
          {lesson.prerequisites.length > 0 && (
            <p className="muted" style={{ fontSize: '0.9rem', margin: '14px 0 0' }}>
              Builds on:{' '}
              {lesson.prerequisites.map((p, i) => (
                <span key={p}>
                  {i > 0 && ', '}
                  <Link to={`/learn/${p}`}>{lessonById(p)?.title ?? p}</Link>
                </span>
              ))}
            </p>
          )}
          <div className="objectives">
            <span className="eyebrow">By the end you will be able to</span>
            <ul>
              {lesson.objectives.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
          </div>
        </header>

        <LessonRefs.Provider value={lesson.references}>
          <MDXProvider components={mdxComponents as never}>
            <div className="prose" ref={prose}>
              {Body ? <Body /> : <p className="muted">Loading lesson…</p>}
            </div>
          </MDXProvider>
        </LessonRefs.Provider>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', margin: '40px 0 10px' }}>
          <button type="button" className={`btn ${done ? '' : 'primary'}`} onClick={() => setComplete(lesson.id, !done)}>
            {done ? 'Completed · mark as not done' : 'Mark lesson complete'}
          </button>
          <span className="muted" style={{ fontSize: '0.85rem' }}>
            Progress is saved in this browser only.
          </span>
        </div>

        {lesson.references.length > 0 && (
          <section style={{ marginTop: 40 }}>
            <h2 style={{ fontSize: 'var(--step-2)', marginBottom: 14 }} id="references">
              References
            </h2>
            <ol className="lesson-refs">
              {lesson.references.map((rid) => {
                const r = refById(rid);
                if (!r) return null;
                const href = refLink(r);
                return (
                  <li key={rid} id={`ref-${rid}`}>
                    <span className="chip">{REF_KIND_LABEL[r.kind]}</span>
                    <div>
                      {r.authors}, “{href ? <a href={href} target="_blank" rel="noreferrer">{r.title}</a> : r.title},” <em>{r.venue}</em>, {r.year}.
                      {r.note && <div className="muted" style={{ fontSize: '0.85rem', marginTop: 2 }}>{r.note}</div>}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        <nav className="pager" aria-label="Lesson pager">
          {prev ? (
            <Link to={`/learn/${prev.id}`} className="pager-link">
              <span className="eyebrow">Previous</span>
              <span>{prev.title}</span>
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link to={`/learn/${next.id}`} className="pager-link next">
              <span className="eyebrow">Next</span>
              <span>
                {next.title} <IconArrow />
              </span>
            </Link>
          ) : (
            <Link to="/lab" className="pager-link next">
              <span className="eyebrow">Finale</span>
              <span>
                Build a full link in the Link Lab <IconArrow />
              </span>
            </Link>
          )}
        </nav>
      </article>

      <aside className="lesson-toc" aria-label="On this page">
        <span className="eyebrow">On this page</span>
        {toc.map((t) => (
          <button key={t.id} type="button" className={active === t.id ? 'active' : ''} onClick={() => document.getElementById(t.id)?.scrollIntoView({ behavior: 'smooth' })}>
            {t.text}
          </button>
        ))}
        {lesson.references.length > 0 && (
          <button type="button" onClick={() => document.getElementById('references')?.scrollIntoView({ behavior: 'smooth' })}>
            References
          </button>
        )}
      </aside>
    </div>
  );
}
