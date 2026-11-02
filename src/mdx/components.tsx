import { createContext, Suspense, useContext, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { refById } from '@/content/references';
import { lessonById } from '@/content/registry';
import { WIDGETS } from '@/widgets';

/** Lesson-level context: the ordered reference list used to number citations. */
export const LessonRefs = createContext<string[]>([]);

const ICON: Record<string, string> = { key: '★', note: 'i', warn: '!', math: '∑', research: '↗' };
const TITLE: Record<string, string> = { key: 'Key idea', note: 'Note', warn: 'Watch out', math: 'The maths', research: 'From the literature' };

export function Callout({ type = 'note', title, children }: { type?: 'key' | 'note' | 'warn' | 'math' | 'research'; title?: string; children: ReactNode }) {
  return (
    <aside className={`callout ${type}`}>
      <div className="callout-icon" aria-hidden>
        {ICON[type]}
      </div>
      <div>
        <div className="callout-title">{title ?? TITLE[type]}</div>
        {children}
      </div>
    </aside>
  );
}

export const KeyIdea = (p: { title?: string; children: ReactNode }) => <Callout type="key" {...p} />;
export const MathBox = (p: { title?: string; children: ReactNode }) => <Callout type="math" {...p} />;
export const Research = (p: { title?: string; children: ReactNode }) => <Callout type="research" {...p} />;

export function Cite({ id }: { id: string }) {
  const refs = useContext(LessonRefs);
  const r = refById(id);
  const n = refs.indexOf(id) + 1;
  if (!r) return <span className="cite">[?]</span>;
  return (
    <button
      type="button"
      className="cite"
      title={`${r.authors}, “${r.title}”, ${r.venue} (${r.year})`}
      onClick={() => document.getElementById(`ref-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
    >
      [{n > 0 ? n : '•'}]
    </button>
  );
}

export function Quiz({ q, options, answer, explain }: { q: string; options: string[]; answer: number; explain?: ReactNode }) {
  const [pick, setPick] = useState<number | null>(null);
  return (
    <div className="quiz">
      <span className="eyebrow">Check your understanding</span>
      <div className="quiz-q">{q}</div>
      <div className="quiz-options">
        {options.map((o, i) => (
          <button
            key={o}
            type="button"
            className={`quiz-option ${pick !== null && i === answer ? 'correct' : ''} ${pick === i && i !== answer ? 'wrong' : ''}`}
            onClick={() => setPick(i)}
          >
            {o}
          </button>
        ))}
      </div>
      {pick !== null && (
        <div className="quiz-explain">
          <strong>{pick === answer ? 'Correct. ' : 'Not quite. '}</strong>
          {explain}
        </div>
      )}
    </div>
  );
}

export function Compare({ children }: { children: ReactNode }) {
  return <div className="compare">{children}</div>;
}

export function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h4>{title}</h4>
      <p>{children}</p>
    </div>
  );
}

export function Steps({ children }: { children: ReactNode }) {
  return <ol className="steps">{children}</ol>;
}

export function LessonLink({ id, children }: { id: string; children?: ReactNode }) {
  const l = lessonById(id);
  return <Link to={`/learn/${id}`}>{children ?? l?.title ?? id}</Link>;
}

function WidgetFallback() {
  return <div className="widget" style={{ height: 320, display: 'grid', placeItems: 'center', color: 'var(--text-3)' }}>Loading interactive figure…</div>;
}

const wrapped = Object.fromEntries(
  Object.entries(WIDGETS).map(([name, Comp]) => [
    name,
    (props: Record<string, unknown>) => (
      <Suspense fallback={<WidgetFallback />}>
        <Comp {...props} />
      </Suspense>
    ),
  ]),
);

/** Everything an .mdx lesson can use without importing it. */
export const mdxComponents = {
  Callout,
  KeyIdea,
  MathBox,
  Research,
  Cite,
  Quiz,
  Compare,
  Card,
  Steps,
  LessonLink,
  table: (p: { children?: ReactNode }) => (
    <div className="table-wrap">
      <table>{p.children}</table>
    </div>
  ),
  ...wrapped,
};
