import { USE_CASES } from '@/usecases/data';

/**
 * Animated vignettes for the home page's "Four ways in" cards. Each sits on a dark "screen" panel
 * (the same in light and dark themes) so the light, rays and glows always read with full contrast.
 * Pure SVG + CSS animation: no extra WebGL contexts on the landing page.
 */

/** Optical Bench: a small room in perspective, a ceiling luminaire, a mirror bouncing light around a wall. */
export function BenchArt() {
  const floor = 'M40 196 L360 196 L300 128 L100 128 Z';
  const rays = [
    { d: 'M128 52 L120 168', c: '#ffd27a' },
    { d: 'M136 52 L156 172', c: '#ffd27a' },
    { d: 'M144 52 L200 150', c: '#ffd27a' },
    { d: 'M140 52 L262 74 L300 166', c: '#7ef0c0' },
    { d: 'M132 52 L262 82 L292 170', c: '#7ef0c0' },
  ];
  return (
    <svg viewBox="0 0 400 220" className="h-art" aria-hidden>
      <defs>
        <radialGradient id="ba-glow" cx="0.5" cy="0" r="1">
          <stop offset="0" stopColor="#ffd27a" stopOpacity="0.35" />
          <stop offset="1" stopColor="#ffd27a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ba-floor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1a1d2a" />
          <stop offset="1" stopColor="#0d0f17" />
        </linearGradient>
      </defs>
      {/* room */}
      <path d="M100 128 L100 30 L300 30 L300 128" fill="none" stroke="rgba(255,255,255,0.08)" />
      <path d={floor} fill="url(#ba-floor)" stroke="rgba(255,255,255,0.1)" />
      {[0.25, 0.5, 0.75].map((t) => (
        <line key={t} x1={40 + 320 * t} y1={196} x2={100 + 200 * t} y2={128} stroke="rgba(255,255,255,0.05)" />
      ))}
      {[150, 172].map((y) => (
        <line key={y} x1={40 + ((196 - y) / 68) * 60} y1={y} x2={360 - ((196 - y) / 68) * 60} y2={y} stroke="rgba(255,255,255,0.05)" />
      ))}
      {/* light cone */}
      <path d="M118 52 L60 196 L250 196 L152 52 Z" fill="url(#ba-glow)" />
      {/* blocking wall */}
      <path d="M226 196 L226 104 L238 98 L238 190 Z" fill="#232838" stroke="rgba(255,255,255,0.14)" />
      {/* rays */}
      {rays.map((r, i) => (
        <path key={i} d={r.d} stroke={r.c} strokeWidth="1.3" strokeOpacity="0.85" fill="none" className="h-ray" style={{ animationDelay: `${i * 0.3}s` }} />
      ))}
      {/* luminaire */}
      <rect x="112" y="44" width="44" height="8" rx="3" fill="#fff6dc" />
      <rect x="108" y="40" width="52" height="4" rx="2" fill="#3a3f52" />
      {/* mirror */}
      <path d="M254 64 L270 92" stroke="#e9eef7" strokeWidth="3.5" strokeLinecap="round" />
      {/* desk + receivers */}
      <path d="M96 176 L150 176 L158 186 L104 186 Z" fill="#6b4e2e" />
      <rect x="118" y="168" width="12" height="7" rx="2" fill="#8fd3ff" />
      <path d="M272 172 L326 172 L334 182 L280 182 Z" fill="#6b4e2e" />
      <rect x="292" y="164" width="12" height="7" rx="2" fill="#5ee0a8" />
      {/* live tags like the real Bench */}
      <g className="h-tag">
        <rect x="58" y="138" width="92" height="20" rx="10" fill="rgba(8,9,14,0.85)" stroke="rgba(255,255,255,0.18)" />
        <text x="104" y="152" textAnchor="middle" className="h-art-t">
          Desk PD <tspan fill="#5ee0a8">54 Mb/s</tspan>
        </text>
      </g>
      <g className="h-tag" style={{ animationDelay: '0.6s' }}>
        <rect x="256" y="132" width="110" height="20" rx="10" fill="rgba(8,9,14,0.85)" stroke="rgba(255,255,255,0.18)" />
        <text x="311" y="146" textAnchor="middle" className="h-art-t">
          via mirror <tspan fill="#5ee0a8">0.29 Mb/s</tspan>
        </text>
      </g>
    </svg>
  );
}

/** System view: 19 blocks in a transmitter row and a receiver row, with a pulse of data travelling through. */
export function SystemArt() {
  const tx = Array.from({ length: 9 }, (_, i) => ({ x: 34 + i * 38, y: 70, d: i < 4 ? 'd' : i < 7 ? 'a' : 'o' }));
  const rx = Array.from({ length: 10 }, (_, i) => ({ x: 366 - i * 37, y: 160, d: i < 2 ? 'o' : i < 5 ? 'a' : 'd' }));
  const col = { d: '#8fa6ff', a: '#5ee0a8', o: '#ffd27a' } as const;
  const path = `M${tx[0].x} ${tx[0].y} H${tx[8].x} C 400 70, 400 160, ${rx[0].x} 160 H${rx[9].x}`;
  return (
    <svg viewBox="0 0 400 220" className="h-art" aria-hidden>
      <path d={path} stroke="rgba(255,255,255,0.12)" strokeWidth="2" fill="none" />
      <path d={`M${tx[8].x} 70 C 400 70, 400 160, ${rx[0].x} 160`} stroke="#ffd27a" strokeWidth="2" strokeOpacity="0.5" fill="none" className="h-ray" />
      {[...tx, ...rx].map((b, i) => (
        <g key={i}>
          <rect x={b.x - 14} y={b.y - 12} width="28" height="24" rx="7" fill="#11141d" stroke={col[b.d as keyof typeof col]} strokeOpacity="0.85" />
          <text x={b.x} y={b.y + 4} textAnchor="middle" className="h-art-n" fill={col[b.d as keyof typeof col]}>
            {String(i + 1).padStart(2, '0')}
          </text>
        </g>
      ))}
      <circle r="5" fill="#fff6dc">
        <animateMotion dur="5s" repeatCount="indefinite" path={path} />
      </circle>
      <circle r="11" fill="#ffd27a" opacity="0.25">
        <animateMotion dur="5s" repeatCount="indefinite" path={path} />
      </circle>
      <text x="20" y="36" className="h-art-t" fill="rgba(255,255,255,0.55)">
        TRANSMITTER
      </text>
      <text x="20" y="200" className="h-art-t" fill="rgba(255,255,255,0.55)">
        RECEIVER
      </text>
      <g transform="translate(232,200)">
        {(['d', 'a', 'o'] as const).map((k, i) => (
          <g key={k} transform={`translate(${i * 56},0)`}>
            <circle r="3.5" cy="-4" fill={col[k]} />
            <text x="8" y="0" className="h-art-t" fill="rgba(255,255,255,0.55)">
              {['digital', 'analogue', 'optical'][i]}
            </text>
          </g>
        ))}
      </g>
    </svg>
  );
}

/** Use cases: every scenario as a glowing chip, wrapped into rows. */
export function UseCaseArt() {
  return (
    <div className="h-art h-uc" aria-hidden>
      {USE_CASES.map((u, i) => (
        <span key={u.id} style={{ ['--a' as string]: u.accent, animationDelay: `${(i % 7) * 0.35}s` }}>
          {u.title}
        </span>
      ))}
    </div>
  );
}

/** Link Lab: an open eye diagram with the sampling instant, and a 4-PAM constellation. */
export function EyeArt() {
  const levels = [40, 85, 130, 175];
  const traces: string[] = [];
  for (let a = 0; a < 4; a++)
    for (let b = 0; b < 4; b++) {
      const y0 = levels[a];
      const y1 = levels[b];
      const j = ((a * 4 + b) % 5) - 2;
      traces.push(`M10 ${y0 + j} C 70 ${y0 + j}, 80 ${y1 - j}, 140 ${y1 - j} S 210 ${levels[(a + b) % 4] + j}, 270 ${levels[(a + b) % 4] + j}`);
    }
  return (
    <svg viewBox="0 0 400 220" className="h-art" aria-hidden>
      {[40, 85, 130, 175].map((y) => (
        <line key={y} x1="10" x2="270" y1={y} y2={y} stroke="rgba(255,255,255,0.04)" />
      ))}
      {traces.map((d, i) => (
        <path key={i} d={d} stroke="#5ee0a8" strokeOpacity="0.38" strokeWidth="1.4" fill="none" />
      ))}
      <line x1="140" y1="22" x2="140" y2="196" stroke="#ffd27a" strokeDasharray="3 4" />
      <text x="146" y="30" className="h-art-t" fill="#ffd27a">
        sample
      </text>
      <rect x="296" y="30" width="88" height="160" rx="12" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.1)" />
      {levels.map((y, i) => (
        <g key={i}>
          {[0, 1, 2, 3, 4].map((k) => (
            <circle key={k} cx={322 + k * 9 + ((k * 7 + i * 3) % 5) - 2} cy={y + ((k * 5 + i) % 7) - 3} r="2.4" fill="#8fa6ff" opacity="0.85" />
          ))}
        </g>
      ))}
      <text x="340" y="206" textAnchor="middle" className="h-art-t" fill="rgba(255,255,255,0.55)">
        4-PAM
      </text>
    </svg>
  );
}
