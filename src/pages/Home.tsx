import { lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { TRACKS } from '@/content/tracks';
import { LESSONS, lessonsInTrack } from '@/content/registry';
import { REFERENCES, REF_KIND_LABEL, refLink } from '@/content/references';
import { WIDGETS } from '@/widgets';
import { USE_CASES } from '@/usecases/data';
import { colorForWavelength } from '@/lib/trackColor';
import { useProgress } from '@/lib/progress';
import { IconArrow } from '@/shell/Icons';
import './home.css';

const HeroStage = lazy(() => import('@/three/HeroStage'));

const FEATURED_REFS = ['kahn1997', 'haas2016lifi', 'ghassemlooy2019book', 'khalighi2014fso', 'saeed2019occ', 'zeng2017uwoc'];

/** Animated SVG vignettes for the explore cards (no extra WebGL contexts). */
function SystemArt() {
  const blocks = Array.from({ length: 9 });
  return (
    <svg viewBox="0 0 360 150" className="art" aria-hidden>
      <defs>
        <linearGradient id="bus" x1="0" x2="1">
          <stop offset="0" stopColor="#8fa6ff" />
          <stop offset="0.5" stopColor="#ffd27a" />
          <stop offset="1" stopColor="#5ee0a8" />
        </linearGradient>
      </defs>
      <path d="M20 110 H170 Q180 110 185 100 L200 50 Q205 40 215 40 H340" stroke="url(#bus)" strokeWidth="1.5" fill="none" className="art-bus" />
      {blocks.map((_, i) => {
        const x = i < 5 ? 20 + i * 34 : 215 + (i - 5) * 34;
        const y = i < 5 ? 110 : 40;
        const c = i < 3 ? '#8fa6ff' : i < 7 ? '#5ee0a8' : '#8fa6ff';
        return <rect key={i} x={x - 12} y={y - 9} width="24" height="18" rx="5" fill="rgba(255,255,255,0.04)" stroke={c} strokeOpacity="0.8" className="art-chip" style={{ animationDelay: `${i * 0.18}s` }} />;
      })}
      <circle cx="192" cy="75" r="16" fill="#ffd27a" opacity="0.12" />
      <circle cx="192" cy="75" r="5" fill="#ffd27a" />
    </svg>
  );
}

function BenchArt() {
  return (
    <svg viewBox="0 0 360 150" className="art" aria-hidden>
      <rect x="20" y="62" width="22" height="26" rx="4" fill="none" stroke="#ffd27a" />
      <path d="M150 30 L162 120" stroke="#e9eef7" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="250" cy="75" rx="7" ry="30" fill="rgba(143,211,255,0.15)" stroke="#8fd3ff" />
      <rect x="318" y="66" width="18" height="18" rx="4" fill="none" stroke="#5ee0a8" />
      {[-18, -9, 0, 9, 18].map((o, i) => (
        <path key={i} d={`M42 75 L156 ${75 + o * 1.6} L250 ${70 + o} L327 75`} stroke="#ffd27a" strokeOpacity={0.5} fill="none" className="art-ray" style={{ animationDelay: `${i * 0.25}s` }} />
      ))}
      <text x="20" y="140" className="art-label">
        LED → mirror → lens → photodiode
      </text>
    </svg>
  );
}

function EyeArt() {
  const traces = Array.from({ length: 18 }, (_, i) => {
    const a = i % 2 ? 1 : -1;
    const b = i % 3 ? 1 : -1;
    const j = (i % 5) * 1.5;
    return `M10 ${75 - a * (38 + j)} C 90 ${75 - a * (38 + j)}, 110 ${75 - b * (38 - j)}, 180 ${75 - b * (38 - j)} S 270 ${75 + a * (36 + j)}, 350 ${75 + a * (36 + j)}`;
  });
  return (
    <svg viewBox="0 0 360 150" className="art" aria-hidden>
      {traces.map((d, i) => (
        <path key={i} d={d} stroke="#5ee0a8" strokeOpacity="0.32" fill="none" />
      ))}
      <line x1="180" y1="20" x2="180" y2="130" stroke="#ffd27a" strokeDasharray="3 4" />
    </svg>
  );
}

export function Home() {
  const progress = useProgress();
  const done = LESSONS.filter((l) => progress[l.id]).length;
  const firstUndone = LESSONS.find((l) => !progress[l.id]) ?? LESSONS[0];

  return (
    <div className="home">
      <section className="h-hero">
        <div className="h-hero-scene">
          <Suspense fallback={null}>
            <HeroStage />
          </Suspense>
        </div>
        <div className="h-hero-copy">
          <span className="eyebrow">Open courseware · optical wireless communications</span>
          <h1>
            Send data on
            <br />a <em>beam of light.</em>
          </h1>
          <p className="h-lede">
            From first photons to LiFi networks, camera links, laser links between satellites and underwater optics. Every idea is a 3D scene you can turn, or a simulation you can break.
          </p>
          <div className="h-cta">
            <Link className="btn primary" to={`/learn/${firstUndone?.id ?? ''}`}>
              {done > 0 ? 'Continue learning' : 'Start learning'} <IconArrow />
            </Link>
            <Link className="btn" to="/bench">
              Open the Optical Bench
            </Link>
            <Link className="btn ghost" to="/system">
              See the system in 3D
            </Link>
          </div>
        </div>
        <dl className="h-stats">
          <div>
            <dt>Lessons</dt>
            <dd>{LESSONS.length}</dd>
          </div>
          <div>
            <dt>Interactive figures</dt>
            <dd>{Object.keys(WIDGETS).length}</dd>
          </div>
          <div>
            <dt>Use cases in 3D</dt>
            <dd>{USE_CASES.length}</dd>
          </div>
          <div>
            <dt>References</dt>
            <dd>{REFERENCES.length}</dd>
          </div>
        </dl>
      </section>

      <section className="page h-explore">
        <div className="section-head">
          <span className="eyebrow">Explore</span>
          <h2>
            Four ways <em>in</em>
          </h2>
        </div>
        <div className="bento">
          <Link to="/bench" className="bento-card big accent">
            <BenchArt />
            <div>
              <span className="eyebrow">Lab · 3D ray tracing</span>
              <h3>Optical Bench</h3>
              <p>
                Pick a scenario, then place LEDs, lasers, mirrors, lenses, prisms, polarizers, SPADs and cameras in 3D. Watch the rays, read the link budget, and let the advisor design the whole
                modem chain.
              </p>
            </div>
          </Link>
          <Link to="/system" className="bento-card">
            <SystemArt />
            <div>
              <span className="eyebrow">3D · architecture</span>
              <h3>The whole link</h3>
              <p>Nineteen blocks from server to laptop. Fly to any of them and see the signal there.</p>
            </div>
          </Link>
          <Link to="/use-cases" className="bento-card">
            <div className="uc-mosaic" aria-hidden>
              {USE_CASES.map((u) => (
                <span key={u.id} style={{ ['--a' as string]: u.accent }}>
                  {u.title}
                </span>
              ))}
            </div>
            <div>
              <span className="eyebrow">3D · applications</span>
              <h3>{USE_CASES.length} use cases</h3>
              <p>From satellite laser links to cars, TVs, factories and the sea floor.</p>
            </div>
          </Link>
          <Link to="/lab" className="bento-card">
            <EyeArt />
            <div>
              <span className="eyebrow">Simulator</span>
              <h3>Link Lab</h3>
              <p>An end-to-end IM/DD link: eye diagrams, constellations, BER.</p>
            </div>
          </Link>
        </div>
      </section>

      <section className="page h-path">
        <div className="section-head">
          <span className="eyebrow">The curriculum</span>
          <h2>
            A path <em>through the spectrum</em>
          </h2>
          <p className="muted">Eight tracks, each tagged with a wavelength: violet for first principles, infrared for the research frontier.</p>
        </div>
        <div className="spectrum-line" aria-hidden />
        <div className="track-rail">
          {TRACKS.map((t, i) => {
            const ls = lessonsInTrack(t.id);
            const c = colorForWavelength(t.wavelength);
            const n = ls.filter((l) => progress[l.id]).length;
            return (
              <article className="track-card" key={t.id} style={{ ['--tc' as string]: c }}>
                <div className="track-top">
                  <span className="mono track-lambda">λ {t.wavelength} nm</span>
                  <span className="mono track-n">{String(i + 1).padStart(2, '0')}</span>
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
                  <span className="track-meter">
                    <i style={{ width: `${(n / Math.max(1, ls.length)) * 100}%` }} />
                  </span>
                  {n}/{ls.length}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="page refs-home">
        <div className="section-head">
          <span className="eyebrow">Grounded in the literature</span>
          <h2>
            Every lesson <em>cites its sources</em>
          </h2>
          <p className="muted">
            Surveys and tutorials from IEEE Communications Surveys &amp; Tutorials, JLT, JSAC and Proceedings of the IEEE, the standard textbooks, and the IEEE 802.15.7, 802.11bb and ITU-T G.9991
            standards. Every DOI is checked.
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
          Browse all {REFERENCES.length} references <IconArrow />
        </Link>
      </section>

      <section className="page grow">
        <div className="grow-card">
          <div>
            <span className="eyebrow">Open source, built to grow</span>
            <h2>
              One folder <em>per lesson</em>
            </h2>
            <p className="muted">
              Lessons are Markdown with LaTeX; figures, bench components, scenarios and use cases are typed data plus small React modules. Add one and it joins the curriculum, the search and the
              navigation automatically.
            </p>
            <Link to="/contribute" className="btn small">
              How to contribute <IconArrow />
            </Link>
          </div>
          <pre className="tree mono" aria-label="Project layout">{`src/
├─ content/lessons/<track>/<id>/  meta.ts + lesson.mdx
├─ widgets/                       interactive figures
├─ bench/catalog.ts               bench components
├─ bench/scenarios.ts             bench scenarios
└─ usecases/data.ts + scenes.tsx  3D use cases`}</pre>
        </div>
      </section>
    </div>
  );
}
