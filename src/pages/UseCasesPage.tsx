import { Link, useNavigate, useParams } from 'react-router-dom';
import { Stage } from '@/three/Stage';
import { USE_CASES, useCaseById } from '@/usecases/data';
import { SCENES } from '@/usecases/scenes';
import { refById, refLink } from '@/content/references';
import { lessonById } from '@/content/registry';
import { IconArrow } from '@/shell/Icons';
import { useMedia } from '@/lib/useMedia';
import './usecases.css';

/** On portrait phones the scene band is narrow, so pull the camera back along the same line of sight. */
const PHONE_PULLBACK = 1.7;

/**
 * Use-case gallery: one live 3D scene at a time (so only one WebGL context), a rail to switch between
 * cases, and the engineering facts underneath.
 */
export default function UseCasesPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const uc = useCaseById(id ?? '') ?? USE_CASES[0];
  const idx = USE_CASES.indexOf(uc);
  const Scene = SCENES[uc.id];
  const narrow = useMedia('(max-width: 600px)');
  const camera = narrow
    ? (uc.camera.map((c, i) => uc.target[i] + (c - uc.target[i]) * PHONE_PULLBACK) as [number, number, number])
    : uc.camera;
  const go = (d: number) => nav(`/use-cases/${USE_CASES[(idx + d + USE_CASES.length) % USE_CASES.length].id}`);

  return (
    <div className="uc" style={{ ['--uc' as string]: uc.accent }}>
      <section className="uc-stage">
        <Stage key={`${uc.id}-${narrow}`} height="100%" flush camera={camera} target={uc.target} bloom={1.1} minDistance={0.2} maxDistance={400}>
          {Scene && <Scene />}
        </Stage>
        <div className="uc-overlay">
          <div className="uc-tags">
            {uc.tech.map((t) => (
              <span key={t} className="uc-tag">
                {t}
              </span>
            ))}
            <span className="uc-count mono">
              {String(idx + 1).padStart(2, '0')} / {String(USE_CASES.length).padStart(2, '0')}
            </span>
          </div>
          <h1>{uc.title}</h1>
          <p className="uc-tagline">{uc.tagline}</p>
          <dl className="uc-stats">
            <div>
              <dt>Range</dt>
              <dd>{uc.link.range}</dd>
            </div>
            <div>
              <dt>Data rate</dt>
              <dd>{uc.link.rate}</dd>
            </div>
            <div>
              <dt>Light</dt>
              <dd>{uc.link.wavelength}</dd>
            </div>
          </dl>
          <div className="uc-nav">
            <button type="button" className="icon-btn" onClick={() => go(-1)} aria-label="Previous use case">
              <span style={{ transform: 'rotate(180deg)', display: 'grid' }}>
                <IconArrow />
              </span>
            </button>
            <button type="button" className="icon-btn" onClick={() => go(1)} aria-label="Next use case">
              <IconArrow />
            </button>
            {uc.bench && (
              <Link className="btn small primary" to={`/bench?scenario=${uc.bench}`}>
                Build it in the Optical Bench
              </Link>
            )}
          </div>
        </div>
      </section>

      <nav className="uc-rail" aria-label="Use cases">
        {USE_CASES.map((u) => (
          <Link key={u.id} to={`/use-cases/${u.id}`} className={`uc-pill ${u.id === uc.id ? 'on' : ''}`} style={{ ['--a' as string]: u.accent }}>
            <i />
            {u.title}
          </Link>
        ))}
      </nav>

      <section className="page uc-detail">
        <p className="uc-story">{uc.story}</p>

        <div className="uc-flow" aria-label="Signal flow">
          {uc.flow.map((f, i) => (
            <div className="uc-flow-step" key={`${i}-${f}`} style={{ animationDelay: `${i * 0.25}s` }}>
              <span className="mono">{String(i + 1).padStart(2, '0')}</span>
              {f}
            </div>
          ))}
        </div>

        <div className="uc-grid">
          <article className="uc-card">
            <span className="eyebrow">The link</span>
            <dl className="uc-spec">
              <dt>Transmitter</dt>
              <dd>{uc.link.tx}</dd>
              <dt>Receiver</dt>
              <dd>{uc.link.rx}</dd>
              <dt>Wavelength</dt>
              <dd>{uc.link.wavelength}</dd>
              <dt>Range</dt>
              <dd>{uc.link.range}</dd>
              <dt>Data rate</dt>
              <dd>{uc.link.rate}</dd>
              <dt>Modulation</dt>
              <dd>{uc.link.modulation}</dd>
            </dl>
          </article>
          <article className="uc-card span2">
            <span className="eyebrow">What makes it hard</span>
            <div className="uc-challenges">
              {uc.challenges.map((c) => (
                <div key={c.title}>
                  <h3>{c.title}</h3>
                  <p>{c.text}</p>
                </div>
              ))}
            </div>
          </article>
          <article className="uc-card">
            <span className="eyebrow">Learn the pieces</span>
            <ul className="uc-links">
              {uc.lessons.map((lid) => {
                const l = lessonById(lid);
                return l ? (
                  <li key={lid}>
                    <Link to={`/learn/${lid}`}>
                      {l.title} <IconArrow />
                    </Link>
                  </li>
                ) : null;
              })}
            </ul>
          </article>
          <article className="uc-card span2">
            <span className="eyebrow">Sources {uc.standards.length > 0 && '& standards'}</span>
            {uc.standards.length > 0 && (
              <div className="uc-std">
                {uc.standards.map((s) => (
                  <span key={s} className="chip">
                    {s}
                  </span>
                ))}
              </div>
            )}
            <ul className="uc-refs">
              {uc.refs.map((rid) => {
                const r = refById(rid);
                if (!r) return null;
                return (
                  <li key={rid}>
                    <a href={refLink(r)} target="_blank" rel="noreferrer">
                      {r.title}
                    </a>
                    <span className="muted small">
                      {' '}
                      · {r.authors.split(',')[0]} et al. · {r.year}
                    </span>
                  </li>
                );
              })}
            </ul>
          </article>
        </div>
      </section>
    </div>
  );
}
