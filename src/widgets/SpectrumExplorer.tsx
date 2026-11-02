import { useState } from 'react';
import { Widget, Readout, Readouts } from '@/viz/controls';
import { wavelengthToHex } from '@/sim/color';

/** The electromagnetic spectrum on a log-frequency axis, with the optical wireless bands called out. */
interface Band {
  id: string;
  name: string;
  f0: number; // Hz
  f1: number;
  color: string;
  owc?: boolean;
  lambda: string;
  uses: string;
  devices: string;
  standards?: string;
}

const C = 299792458;
const nm = (x: number) => C / (x * 1e-9);

const BANDS: Band[] = [
  { id: 'rf', name: 'Radio & microwave', f0: 3e3, f1: 3e11, color: '#55607a', lambda: '1 mm – 100 km', uses: 'Cellular, Wi-Fi, broadcast, radar. Crowded and licensed below ~100 GHz.', devices: 'Antennas, mixers, oscillators', standards: '3GPP NR, IEEE 802.11' },
  { id: 'thz', name: 'Terahertz', f0: 3e11, f1: 1e13, color: '#6c5a8a', lambda: '30 µm – 1 mm', uses: 'Emerging 6G links, imaging. Strong molecular absorption.', devices: 'Photomixers, QCLs, Schottky diodes' },
  { id: 'mir', name: 'Mid/far infrared', f0: 1e13, f1: nm(3000), color: '#8a3b50', lambda: '3 – 30 µm', uses: 'Thermal imaging, some FSO in atmospheric windows (3–5 µm, 8–12 µm).', devices: 'Quantum cascade lasers, HgCdTe detectors' },
  { id: 'nir', name: 'Near infrared', f0: nm(3000), f1: nm(780), color: '#c2456e', owc: true, lambda: '780 nm – 3 µm', uses: 'FSO backhaul (850, 1550 nm), IrDA, LiFi uplinks and IEEE 802.11bb (800–1000 nm).', devices: 'VCSELs, laser diodes, IR LEDs, Si/InGaAs photodiodes', standards: 'IEEE 802.11bb, IEEE 802.15.13, IrDA' },
  { id: 'vis', name: 'Visible light', f0: nm(780), f1: nm(380), color: 'url(#vis)', owc: true, lambda: '380 – 780 nm', uses: 'VLC and LiFi from illumination LEDs, optical camera communication, underwater links (blue-green).', devices: 'White/RGB LEDs, µLEDs, laser lighting, Si photodiodes, cameras', standards: 'IEEE 802.15.7, ITU-T G.9991, 802.11bb (also)' },
  { id: 'uv', name: 'Ultraviolet', f0: nm(380), f1: nm(10), color: '#7a5cff', owc: true, lambda: '10 – 380 nm', uses: 'UV-C (200–280 nm) is “solar-blind”: non-line-of-sight scattering links work in daylight.', devices: 'Deep-UV LEDs, PMTs, SiC/AlGaN detectors' },
  { id: 'x', name: 'X-ray & beyond', f0: nm(10), f1: 1e20, color: '#3b3f52', lambda: '< 10 nm', uses: 'Ionising: not used for communication.', devices: '—' },
];

const LOG0 = 3;
const LOG1 = 20;
const X = (f: number) => ((Math.log10(f) - LOG0) / (LOG1 - LOG0)) * 1000;

function fmtHz(f: number) {
  const u: [number, string][] = [[1e18, 'EHz'], [1e15, 'PHz'], [1e12, 'THz'], [1e9, 'GHz'], [1e6, 'MHz'], [1e3, 'kHz']];
  for (const [d, s] of u) if (f >= d * 0.9995) return `${Number((f / d).toPrecision(3))} ${s}`;
  return `${f} Hz`;
}

export default function SpectrumExplorer() {
  const [sel, setSel] = useState('vis');
  const b = BANDS.find((x) => x.id === sel)!;
  const bw = b.f1 - b.f0;
  const visStops = Array.from({ length: 9 }, (_, i) => 380 + (i * 400) / 8);

  return (
    <Widget
      title="Where optical wireless lives in the spectrum"
      caption={
        <p>
          The axis is logarithmic: every tick is ten times the frequency of the one before. The visible band alone spans about 400 THz, more than a thousand times all the
          radio spectrum below 300 GHz combined. Select a band to see what it is used for.
        </p>
      }
    >
      <div style={{ overflowX: 'auto' }}>
        <svg viewBox="0 0 1000 150" style={{ width: '100%', minWidth: 560, display: 'block' }} role="img" aria-label="Electromagnetic spectrum">
          <defs>
            <linearGradient id="vis" x1="1" x2="0">
              {visStops.map((w, i) => (
                <stop key={w} offset={i / 8} stopColor={wavelengthToHex(w)} />
              ))}
            </linearGradient>
          </defs>
          {BANDS.map((x) => (
            <g key={x.id} onClick={() => setSel(x.id)} style={{ cursor: 'pointer' }}>
              <rect
                x={X(x.f0)}
                y={x.id === sel ? 30 : 40}
                width={Math.max(2, X(x.f1) - X(x.f0))}
                height={x.id === sel ? 60 : 40}
                fill={x.color}
                opacity={x.id === sel ? 1 : x.owc ? 0.85 : 0.5}
                rx={4}
              />
              {x.owc && <rect x={X(x.f0)} y={22} width={X(x.f1) - X(x.f0)} height={3} fill="var(--phosphor)" rx={1.5} />}
            </g>
          ))}
          <text x={X(1e14) - 4} y={16} fill="var(--phosphor)" fontSize="11" fontFamily="var(--font-mono)" textAnchor="middle">
            optical wireless
          </text>
          {Array.from({ length: LOG1 - LOG0 + 1 }, (_, i) => LOG0 + i).map((e) => (
            <g key={e}>
              <line x1={X(10 ** e)} x2={X(10 ** e)} y1={100} y2={106} stroke="var(--plot-axis)" />
              {e % 3 === 0 && (
                <text x={X(10 ** e)} y={122} fill="var(--text-3)" fontSize="11" fontFamily="var(--font-mono)" textAnchor="middle">
                  {fmtHz(10 ** e)}
                </text>
              )}
            </g>
          ))}
          <text x={8} y={144} fill="var(--text-3)" fontSize="11" fontFamily="var(--font-mono)">
            frequency →
          </text>
        </svg>
      </div>
      <div className="seg" role="radiogroup" aria-label="Band">
        {BANDS.map((x) => (
          <button key={x.id} type="button" className={x.id === sel ? 'on' : ''} onClick={() => setSel(x.id)}>
            {x.name}
          </button>
        ))}
      </div>
      <Readouts>
        <Readout k="Wavelength" v={b.lambda} />
        <Readout k="Frequency" v={`${fmtHz(b.f0)} – ${fmtHz(b.f1)}`} />
        <Readout k="Width" v={fmtHz(bw)} tone={b.owc ? 'good' : undefined} />
        <Readout k="vs all RF ≤ 300 GHz" v={`${(bw / 3e11).toFixed(bw > 3e12 ? 0 : 2)}×`} />
      </Readouts>
      <div className="grid-2" style={{ fontSize: '0.92rem' }}>
        <div>
          <div className="eyebrow">Used for</div>
          <p style={{ margin: '4px 0 0' }}>{b.uses}</p>
        </div>
        <div>
          <div className="eyebrow">Typical devices{b.standards ? ' · standards' : ''}</div>
          <p style={{ margin: '4px 0 0' }}>
            {b.devices}
            {b.standards && <span className="muted"> · {b.standards}</span>}
          </p>
        </div>
      </div>
    </Widget>
  );
}
