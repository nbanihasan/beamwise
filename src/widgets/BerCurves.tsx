import { useMemo, useState } from 'react';
import { Plot } from '@/viz/Plot';
import { Readout, Readouts, Toggle, Widget } from '@/viz/controls';
import { berOOK, berPAM, berPPM, berQAM } from '@/sim/receiver';

/** Analytical BER curves for IM/DD formats vs electrical SNR. */
const CURVES = [
  { id: 'ook', label: 'OOK', color: 'var(--phosphor)', f: (s: number) => berOOK(s), eff: 1 },
  { id: 'ppm4', label: '4-PPM', color: 'var(--c3)', f: (s: number) => berPPM(s, 4), eff: 0.5 },
  { id: 'ppm16', label: '16-PPM', color: 'var(--c6)', f: (s: number) => berPPM(s, 16), eff: 0.25 },
  { id: 'pam4', label: '4-PAM', color: 'var(--c4)', f: (s: number) => berPAM(s, 4), eff: 2 },
  { id: 'pam8', label: '8-PAM', color: 'var(--c5)', f: (s: number) => berPAM(s, 8), eff: 3 },
  { id: 'qam16', label: '16-QAM (per subcarrier)', color: 'var(--c1)', f: (s: number) => berQAM(s, 16), eff: 4 },
] as const;

export default function BerCurves() {
  const [on, setOn] = useState<Record<string, boolean>>({ ook: true, ppm4: true, ppm16: false, pam4: true, pam8: true, qam16: false });
  const snr = useMemo(() => Array.from({ length: 141 }, (_, i) => i * 0.25), []);
  const need = (f: (s: number) => number) => {
    for (const d of snr) if (f(Math.pow(10, d / 10)) < 1e-6) return d;
    return NaN;
  };
  return (
    <Widget
      title="BER vs SNR for IM/DD formats"
      controls={
        <>
          {CURVES.map((c) => (
            <Toggle key={c.id} label={<span style={{ color: c.color }}>{c.label}</span>} checked={!!on[c.id]} onChange={(v) => setOn((o) => ({ ...o, [c.id]: v }))} />
          ))}
          <Readouts>
            {CURVES.filter((c) => on[c.id]).map((c) => (
              <Readout key={c.id} k={`${c.label} @1e-6`} v={`${need(c.f).toFixed(1)} dB`} />
            ))}
          </Readouts>
        </>
      }
      caption={
        <p>
          SNR here is electrical, (R·P<sub>avg</sub>)²/σ², at equal average optical power. Multi-level PAM buys bits per symbol with SNR. PPM spends bandwidth to save
          power; its curves sit left of OOK but it carries fewer bits per slot. The dashed line at 3.8 × 10⁻³ is the classic hard-decision FEC threshold: a stronger code
          lets the raw link run there and still deliver error-free data.
        </p>
      }
    >
      <Plot
        height={300}
        logY
        x={[0, 35]}
        y={[1e-9, 0.5]}
        xLabel="electrical SNR (dB)"
        yLabel="bit error rate"
        legend
        series={CURVES.filter((c) => on[c.id]).map((c) => ({ x: snr, y: snr.map((d) => c.f(Math.pow(10, d / 10))), color: c.color, width: 2, label: c.label }))}
        hlines={[
          { y: 3.8e-3, label: 'FEC limit 3.8e-3', color: 'var(--warn)' },
          { y: 1e-6, label: '1e-6', color: 'var(--good)' },
        ]}
      />
    </Widget>
  );
}
