import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import katex from 'katex';
import { Stage } from '@/three/Stage';
import { ArchScene } from '@/arch/ArchScene';
import { BLOCKS, blockById } from '@/arch/blocks';
import { runChain } from '@/arch/chain';
import { SignalView, describeSignal } from '@/arch/SignalView';
import { lessonById } from '@/content/registry';
import { IconArrow } from '@/shell/Icons';
import './system.css';

/**
 * The whole VLC / LiFi link as one 3D object: 19 blocks from data source to data sink. Selecting a block
 * flies the camera to it and opens an inspector with its job, variants, key equation and the actual
 * signal at that point of a running example.
 */
export default function SystemPage() {
  const [params, setParams] = useSearchParams();
  const selected = params.get('block');
  const [touring, setTouring] = useState(false);
  const [labels, setLabels] = useState(false);
  const [variant, setVariant] = useState<number | null>(null);
  const sig = useMemo(runChain, []);
  const b = selected ? blockById(selected) : undefined;
  const select = (id: string | null) => {
    setVariant(null);
    setParams(id ? { block: id } : {}, { replace: true });
  };
  const step = (d: number) => {
    const i = b ? BLOCKS.indexOf(b) : -1;
    select(BLOCKS[(i + d + BLOCKS.length) % BLOCKS.length].id);
  };

  useEffect(() => {
    if (!touring) return;
    const t = setInterval(() => {
      const i = b ? BLOCKS.indexOf(b) : -1;
      if (i === BLOCKS.length - 1) {
        setTouring(false);
        return;
      }
      select(BLOCKS[i + 1].id);
    }, 5200);
    return () => clearInterval(t);
  }, [touring, b]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'Escape') select(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const desc = b ? describeSignal(b.signal, sig) : null;
  const tex = useMemo(() => (b?.tex ? katex.renderToString(b.tex, { throwOnError: false, displayMode: true }) : ''), [b]);
  const lesson = b?.lesson ? lessonById(b.lesson) : undefined;

  return (
    <div className="sys">
      <section className="sys-stage">
        <Stage height="100%" flush camera={[-2.2, 7.4, 16.5]} target={[-2.2, 0.2, 2.2]} bloom={1} minDistance={2} maxDistance={60} hint="drag to orbit · click a block · ← → to step">
          <ArchScene selected={selected} onSelect={(id) => select(id)} showLabels={labels} />
        </Stage>

        <header className="sys-head">
          <span className="eyebrow">System view</span>
          <h1>
            The whole link, <em>in 3D</em>
          </h1>
          <p>Nineteen blocks carry the word “Hi” from a server, through light, into a laptop. Click any block to see what it does and what the signal looks like there.</p>
          <div className="sys-legend">
            <span style={{ ['--d' as string]: '#8fa6ff' }}>Digital</span>
            <span style={{ ['--d' as string]: '#5ee0a8' }}>Analogue</span>
            <span style={{ ['--d' as string]: '#ffd27a' }}>Optical</span>
          </div>
          <div className="sys-actions">
            <button type="button" className="btn small primary" onClick={() => (touring ? setTouring(false) : (select(BLOCKS[0].id), setTouring(true)))}>
              {touring ? 'Stop tour' : 'Play guided tour'}
            </button>
            <button type="button" className={`btn small ${labels ? 'on' : ''}`} onClick={() => setLabels((l) => !l)}>
              Labels
            </button>
            {b && (
              <button type="button" className="btn small" onClick={() => select(null)}>
                Overview
              </button>
            )}
          </div>
        </header>

        {b && desc && (
          <aside className="sys-panel" aria-live="polite">
            <div className="sys-panel-top">
              <span className="mono sys-n">
                {String(b.n).padStart(2, '0')} / {BLOCKS.length}
              </span>
              <span className={`sys-domain ${b.domain}`}>{b.domain}</span>
              <span className="sys-side">{b.side === 'tx' ? 'Transmitter' : b.side === 'rx' ? 'Receiver' : 'Channel'}</span>
              <button type="button" className="sys-close" onClick={() => select(null)} aria-label="Close">
                ×
              </button>
            </div>
            <h2>{b.name}</h2>
            <p className="sys-what">{b.what}</p>

            <div className="sys-signal">
              <div className="sys-signal-title">
                <span>Signal here</span>
                <span className="mono">{desc.title}</span>
              </div>
              <SignalView key={b.id} draw={desc.draw} height={b.signal === 'bits' || b.signal === 'coded' || b.signal === 'rxCoded' || b.signal === 'decoded' ? 90 : 120} />
              {desc.legend && <div className="sys-signal-legend">{desc.legend}</div>}
            </div>

            <p className="sys-why">
              <strong>Why it matters.</strong> {b.why}
            </p>
            {tex && <div className="sys-tex" dangerouslySetInnerHTML={{ __html: tex }} />}
            <div className="sys-variants">
              <span className="eyebrow">Variants</span>
              <div>
                {b.variants.map((v, i) => (
                  <button key={v.name} type="button" className={`sys-chip ${variant === i ? 'on' : ''}`} onClick={() => setVariant(variant === i ? null : i)}>
                    {v.name}
                  </button>
                ))}
              </div>
              {variant !== null && <p className="sys-variant-note">{b.variants[variant].note}</p>}
            </div>
            <div className="sys-panel-foot">
              <button type="button" className="icon-btn" onClick={() => step(-1)} aria-label="Previous block">
                <span style={{ transform: 'rotate(180deg)', display: 'grid' }}>
                  <IconArrow />
                </span>
              </button>
              <button type="button" className="icon-btn" onClick={() => step(1)} aria-label="Next block">
                <IconArrow />
              </button>
              {lesson && (
                <Link to={`/learn/${lesson.id}`} className="btn small">
                  Deep dive: {lesson.title}
                </Link>
              )}
            </div>
          </aside>
        )}
      </section>

      <section className="page sys-strip">
        <div className="section-head">
          <span className="eyebrow">Signal path</span>
          <h2>
            From bits to light <em>and back</em>
          </h2>
        </div>
        <ol className="sys-steps">
          {BLOCKS.map((x) => (
            <li key={x.id}>
              <button type="button" className={`${x.domain} ${selected === x.id ? 'on' : ''}`} onClick={() => (select(x.id), window.scrollTo({ top: 0, behavior: 'smooth' }))}>
                <span className="mono">{String(x.n).padStart(2, '0')}</span>
                <strong>{x.name}</strong>
                <span className="sys-step-what">{x.what.split('. ')[0]}.</span>
              </button>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
