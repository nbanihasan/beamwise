import { Link } from 'react-router-dom';
import { TRACKS } from '@/content/tracks';
import { lessonsInTrack, LESSONS } from '@/content/registry';
import { colorForWavelength } from '@/lib/trackColor';
import { useProgress } from '@/lib/progress';
import { IconCheck } from '@/shell/Icons';

const LEVEL_LABEL = { foundation: 'Foundation', core: 'Core', advanced: 'Advanced', frontier: 'Frontier' };

export function Learn() {
  const progress = useProgress();
  const total = LESSONS.reduce((s, l) => s + l.minutes, 0);
  return (
    <div className="page">
      <span className="eyebrow">Curriculum</span>
      <h1 style={{ fontSize: 'var(--step-4)', margin: '10px 0 12px' }}>Zero to hero, one wavelength at a time</h1>
      <p className="muted" style={{ maxWidth: '64ch', marginTop: 0 }}>
        {LESSONS.length} lessons, about {Math.round(total / 60)} hours of reading and experimenting. Each lesson lists what it builds on, so you can also jump straight
        to the topic you need.
      </p>
      <div className="learn-tracks">
        {TRACKS.map((t, ti) => {
          const c = colorForWavelength(t.wavelength);
          return (
            <section key={t.id} className="learn-track" style={{ ['--tc' as string]: c }}>
              <div className="learn-track-head">
                <span className="mono" style={{ color: c, fontSize: '0.75rem' }}>
                  {String(ti + 1).padStart(2, '0')} · λ {t.wavelength} nm
                </span>
                <h2>{t.title}</h2>
                <p className="muted">{t.blurb}</p>
              </div>
              <ol className="learn-lessons">
                {lessonsInTrack(t.id).map((l) => (
                  <li key={l.id}>
                    <Link to={`/learn/${l.id}`}>
                      <span className={`learn-check ${progress[l.id] ? 'done' : ''}`}>{progress[l.id] ? <IconCheck /> : null}</span>
                      <span className="learn-title">
                        <strong>{l.title}</strong>
                        <span className="muted">{l.subtitle}</span>
                      </span>
                      <span className="learn-tags">
                        <span className={`chip level-${l.level}`}>{LEVEL_LABEL[l.level]}</span>
                        <span className="chip">{l.minutes} min</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            </section>
          );
        })}
      </div>
    </div>
  );
}
