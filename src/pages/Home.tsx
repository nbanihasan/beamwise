import { lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { TRACKS } from '@/content/tracks';
import { LESSONS, lessonsInTrack } from '@/content/registry';
import { REFERENCES, REF_KIND_LABEL, refLink } from '@/content/references';
import { WIDGETS } from '@/widgets';
import { colorForWavelength } from '@/lib/trackColor';
import { useProgress } from '@/lib/progress';
import { IconArrow } from '@/shell/Icons';
import './home.css';

const HeroStage = lazy(() => import('@/three/HeroStage'));

const FEATURED_REFS = ['kahn1997', 'haas2016lifi', 'ghassemlooy2019book', 'armstrong2009', 'saeed2019occ', 'aboagye2023ris'];

export function Home() {
  const progress = useProgress();
  const done = LESSONS.filter((l) => progress[l.id]).length;
  const firstUndone = LESSONS.find((l) => !progress[l.id]) ?? LESSONS[0];

  return (
    <div className="home">
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">Open courseware · optical wireless communications</span>
          <h1>
            Learn to send data
            <br />
            <em>on a beam of light.</em>
          </h1>
          <p className="lede">
            Lumen Atlas takes you from “what is a photon?” to optical OFDM, SPAD receivers and LiFi networks. Every equation comes with a 3D scene or a live
            simulation you can change and break.
          </p>
          <div className="hero-cta">
            <Link className="btn primary" to={`/learn/${firstUndone?.id ?? ''}`}>
              {done > 0 ? 'Continue learning' : 'Start at the beginning'} <IconArrow />
            </Link>
            <Link className="btn" to="/lab">
              Open the Link Lab
            </Link>
          </div>
          <dl className="hero-stats">
            <div>
              <dt>Lessons</dt>
              <dd>{LESSONS.length}</dd>
            </div>
            <div>
              <dt>Interactive figures</dt>
              <dd>{Object.keys(WIDGETS).length}</dd>
            </div>
            <div>
              <dt>Curated references</dt>
              <dd>{REFERENCES.length}</dd>
            </div>
            <div>
              <dt>Your progress</dt>
              <dd>
                {done}/{LESSONS.length}
              </dd>
            </div>
          </dl>
        </div>
        <div className="hero-scene">
          <Suspense fallback={<div className="scene" style={{ height: '100%' }} />}>
            <HeroStage />
          </Suspense>
        </div>
      </section>

      <section className="path page">
        <div className="section-head">
          <span className="eyebrow">The curriculum</span>
          <h2>A path through the spectrum</h2>
          <p className="muted">
            Eight tracks, each tagged with a wavelength. Start in the violet with first principles and work towards the infrared, where current research lives.
          </p>
        </div>
        <div className="spectrum-rail" aria-hidden>
          {TRACKS.map((t) => (
            <span key={t.id} style={{ background: colorForWavelength(t.wavelength) }} />
          ))}
        </div>
        <div className="track-grid">
          {TRACKS.map((t, i) => {
            const ls = lessonsInTrack(t.id);
            const c = colorForWavelength(t.wavelength);
            const n = ls.filter((l) => progress[l.id]).length;
            return (
              <article className="track-card" key={t.id} style={{ ['--tc' as string]: c }}>
                <div className="track-top">
                  <span className="mono track-lambda">
                    λ {t.wavelength} nm{t.wavelength > 780 ? ' · IR' : ''}
                  </span>
                  <span className="mono track-n">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                </div>
                <h3>{t.title}</h3>
                <p>{t.blurb}</p>
                <ul>
                  {ls.map((l) => (
                    <li key={l.id}>
                      <Link to={`/learn/${l.id}`}>
                        <span className={`dotp ${progress[l.id] ? 'done' : ''}`} />
                        {l.title}
                      </Link>
                    </li>
                  ))}
                </ul>
                <div className="track-foot mono">
                  {n}/{ls.length} complete
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="page showcase">
        <div className="section-head">
          <span className="eyebrow">Learn by changing things</span>
          <h2>Simulations, not screenshots</h2>
        </div>
        <div className="show-grid">
          <Link to="/learn/lambertian-channel" className="show-card">
            <span className="eyebrow">3D · Channel</span>
            <h3>Light up a room</h3>
            <p>Move LEDs, narrow their beams and watch the received-power map on the desk plane redraw from the Lambertian model.</p>
          </Link>
          <Link to="/learn/camera-occ" className="show-card">
            <span className="eyebrow">3D · Camera receivers</span>
            <h3>See the rolling shutter</h3>
            <p>Each sensor row exposes a little later than the last, so a flickering LED paints data stripes into a single photo.</p>
          </Link>
          <Link to="/lab" className="show-card accent">
            <span className="eyebrow">Playground</span>
            <h3>Link Lab</h3>
            <p>Bits, LED, room, photodiode, equaliser, decisions. Build a whole link and measure eye diagrams, constellations and BER.</p>
          </Link>
        </div>
      </section>

      <section className="page refs-home">
        <div className="section-head">
          <span className="eyebrow">Grounded in the literature</span>
          <h2>Every lesson cites its sources</h2>
          <p className="muted">
            Content follows the field’s surveys, tutorials and textbooks: IEEE Communications Surveys &amp; Tutorials, JLT, JSAC, the IEEE 802.15.7 and 802.11bb standards,
            and the standard OWC handbooks.
          </p>
        </div>
        <ol className="ref-list">
          {FEATURED_REFS.map((id) => {
            const r = REFERENCES.find((x) => x.id === id)!;
            return (
              <li key={id}>
                <span className="chip">{REF_KIND_LABEL[r.kind]}</span>
                <div>
                  <a href={refLink(r)} target="_blank" rel="noreferrer">
                    {r.title}
                  </a>
                  <div className="muted small">
                    {r.authors} · {r.venue} · {r.year}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
        <Link to="/library" className="btn small">
          Browse the full library <IconArrow />
        </Link>
      </section>

      <section className="page grow">
        <div className="grow-card">
          <div>
            <span className="eyebrow">Open source, built to grow</span>
            <h2>One folder per lesson</h2>
            <p className="muted">
              Write a lesson in Markdown with LaTeX, drop in any of the interactive figures by name, and it joins the curriculum, the search and the navigation
              automatically. New simulations are plain TypeScript modules with unit tests.
            </p>
            <Link to="/contribute" className="btn small">
              How to contribute <IconArrow />
            </Link>
          </div>
          <pre className="tree mono" aria-label="Lesson folder layout">{`src/content/lessons/
└─ channel/
   └─ lambertian-channel/
      ├─ meta.ts      ← title, level, refs
      └─ lesson.mdx   ← prose, $math$, <Widgets/>`}</pre>
        </div>
      </section>
    </div>
  );
}
