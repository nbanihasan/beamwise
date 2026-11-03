import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { Html, Line } from '@react-three/drei';
import { Stage } from '@/three/Stage';
import { Plot } from '@/viz/Plot';
import { Readout, Readouts, Segmented, Slider, Toggle, berTone } from '@/viz/controls';
import { DEFAULT_LINK, simulateLink, type LinkConfig } from '@/sim/linkSim';
import { lambertianOrder } from '@/sim/lambertian';
import { dB, eng, sci } from '@/sim/math';
import './linklab.css';

/** Link Lab: an end-to-end IM/DD link you can assemble, break and measure. */
const PRESETS: { id: string; label: string; cfg: Partial<LinkConfig> }[] = [
  { id: 'office', label: 'Office LiFi · DCO-OFDM', cfg: { scheme: 'dco-ofdm', symbolRateMHz: 40, qam: 16, ledBandwidthMHz: 20, equalizer: 'lms', ambientUA: 20, offsetM: 0.6, fovDeg: 60, dcBiasSigma: 3 } },
  { id: 'cheap', label: 'Low-cost OOK', cfg: { scheme: 'ook', symbolRateMHz: 8, ledBandwidthMHz: 4, equalizer: 'none', ambientUA: 20, offsetM: 0.6, fovDeg: 60 } },
  { id: 'fast', label: 'Faster than the LED', cfg: { scheme: 'ook', symbolRateMHz: 90, ledBandwidthMHz: 12, equalizer: 'dfe', ambientUA: 20, offsetM: 0.6, fovDeg: 60 } },
  { id: 'sun', label: 'Sunlit room', cfg: { scheme: 'pam4', symbolRateMHz: 25, ledBandwidthMHz: 20, equalizer: 'lms', ambientUA: 3000, offsetM: 0.6, fovDeg: 60 } },
  { id: 'edge', label: 'Edge of coverage', cfg: { scheme: 'ook', symbolRateMHz: 20, ledBandwidthMHz: 20, equalizer: 'lms', offsetM: 2.4, fovDeg: 50, ambientUA: 20 } },
];

const NARROW = '(max-width: 980px)';
function useNarrow() {
  const [n, setN] = useState(() => typeof window !== 'undefined' && window.matchMedia(NARROW).matches);
  useEffect(() => {
    const m = window.matchMedia(NARROW);
    const on = () => setN(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return n;
}

/** A collapsible group of controls. Its summary line shows the current key values, so a closed group still informs. */
function CtlGroup({ title, summary, defaultOpen, children }: { title: string; summary: string; defaultOpen: boolean; children: ReactNode }) {
  return (
    <details className="ctl-group" open={defaultOpen}>
      <summary>
        <span className="ctl-group-t">{title}</span>
        <span className="ctl-group-s mono">{summary}</span>
      </summary>
      <div className="ctl-group-body">{children}</div>
    </details>
  );
}

function Geometry({ cfg }: { cfg: LinkConfig }) {
  const h = cfg.heightM;
  const coneR = h * Math.tan((cfg.semiAngleDeg * Math.PI) / 180);
  const fovR = 1.2 * Math.tan((cfg.fovDeg * Math.PI) / 180);
  const inFov = Math.atan2(cfg.offsetM, h) <= (cfg.fovDeg * Math.PI) / 180;
  return (
    <>
      <ambientLight intensity={0.6} />
      <mesh position={[0, h, 0]}>
        <cylinderGeometry args={[0.28, 0.32, 0.08, 40]} />
        <meshStandardMaterial color="#fff6e0" emissive="#fff1cc" emissiveIntensity={3.5} toneMapped={false} />
      </mesh>
      <mesh position={[0, h / 2, 0]}>
        <coneGeometry args={[Math.min(coneR, 8), h, 48, 1, true]} />
        <meshBasicMaterial color="#ffe7a8" transparent opacity={0.07} depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
      </mesh>
      <group position={[cfg.offsetM, 0, 0]}>
        <mesh position={[0, 0.03, 0]}>
          <boxGeometry args={[0.22, 0.06, 0.22]} />
          <meshStandardMaterial color="#5ad8ff" emissive="#5ad8ff" emissiveIntensity={1.6} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0.6, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[Math.min(fovR, 6), 1.2, 40, 1, true]} />
          <meshBasicMaterial color="#5ad8ff" transparent opacity={0.07} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
        <Html position={[0, -0.3, 0]} center>
          <div className="scene-label">PD · FOV {cfg.fovDeg}°</div>
        </Html>
      </group>
      <Line points={[[0, h, 0], [cfg.offsetM, 0.06, 0]]} color={inFov ? '#ffcf6b' : '#ff6b7d'} lineWidth={2} dashed={!inFov} dashSize={0.08} gapSize={0.06} />
      <gridHelper args={[8, 16, '#232a3a', '#171c28']} />
      <Html position={[0, h + 0.35, 0]} center>
        <div className="scene-label">LED · Φ½ {cfg.semiAngleDeg}°</div>
      </Html>
    </>
  );
}

export default function LinkLabPage() {
  const [cfg, setCfg] = useState<LinkConfig>({ ...DEFAULT_LINK, ...PRESETS[0].cfg });
  const [preset, setPreset] = useState('office');
  const set = <K extends keyof LinkConfig>(k: K) => (v: LinkConfig[K]) => {
    setPreset('');
    setCfg((c) => ({ ...c, [k]: v }));
  };
  const deferred = useDeferredValue(cfg);
  const r = useMemo(() => simulateLink(deferred), [deferred]);
  const ofdm = cfg.scheme.endsWith('ofdm');
  const stale = deferred !== cfg;
  const narrow = useNarrow();
  const berText = r.ber === 0 ? `< ${sci(1 / r.nBits, 0)}` : sci(r.ber, 2);

  const blocks = [
    { k: 'Bits', v: ofdm ? `${cfg.qam}-QAM` : cfg.scheme.toUpperCase() },
    { k: 'Modulator', v: ofdm ? (cfg.scheme === 'dco-ofdm' ? 'DCO-OFDM' : 'ACO-OFDM') : `${cfg.symbolRateMHz} MBd` },
    { k: 'LED', v: `${cfg.ledBandwidthMHz} MHz · ${cfg.ledPowerW} W` },
    { k: 'Channel', v: r.H0 > 0 ? `H₀ ${sci(r.H0, 1)}` : 'no LOS' },
    { k: 'Photodiode', v: r.PrW > 0 ? `${dB(r.PrW * 1000).toFixed(1)} dBm` : '—' },
    { k: 'Equaliser', v: ofdm ? (cfg.equalizer === 'none' ? 'none' : 'one-tap') : cfg.equalizer.toUpperCase() },
    { k: 'Detector', v: `BER ${r.ber === 0 ? '< ' + sci(1 / r.nBits, 0) : sci(r.ber, 1)}` },
  ];

  return (
    <div className="lab">
      <header className="lab-head">
        <div>
          <span className="eyebrow">Playground</span>
          <h1>Link Lab</h1>
          <p className="muted">
            A complete intensity-modulation link, simulated sample by sample. Change any block and the bits are sent again: LED bias, non-linearity and bandwidth, a
            Lambertian channel with a diffuse tail, shot and amplifier noise, then equalisation and detection.
          </p>
        </div>
        <div className="lab-presets">
          <span className="eyebrow">Start from a scenario</span>
          <div className="seg">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={preset === p.id ? 'on' : ''}
                onClick={() => {
                  setPreset(p.id);
                  setCfg({ ...DEFAULT_LINK, ...p.cfg });
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {narrow && (
        <div className="lab-sticky" role="status" aria-live="polite" style={{ opacity: stale ? 0.7 : 1 }}>
          <div>
            <span>Throughput</span>
            <b>{r.throughputMbps.toFixed(1)} Mb/s</b>
          </div>
          <div>
            <span>SNR</span>
            <b>{r.measuredSnrDb.toFixed(1)} dB</b>
          </div>
          <div className={`tone-${berTone(r.ber)}`}>
            <span>BER</span>
            <b>{berText}</b>
          </div>
        </div>
      )}

      <div className="chain" aria-label="Signal chain">
        {blocks.map((b, i) => (
          <div className="chain-item" key={b.k}>
            <div className={`chain-block ${b.k === 'Detector' ? `tone-${berTone(r.ber)}` : ''} ${b.k === 'Channel' && r.H0 === 0 ? 'tone-bad' : ''}`}>
              <span className="eyebrow">{b.k}</span>
              <span className="mono">{b.v}</span>
            </div>
            {i < blocks.length - 1 && (
              <div className="chain-wire">
                <i />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="lab-grid">
        <aside className="lab-controls">
          <CtlGroup key={`mod-${narrow}`} title="Modulation" summary={ofdm ? `${cfg.scheme.toUpperCase()} · ${cfg.qam}-QAM` : `${cfg.scheme.toUpperCase()} · ${cfg.symbolRateMHz.toFixed(0)} MBd`} defaultOpen>
          <Segmented
            value={cfg.scheme}
            onChange={(v) => {
              setPreset('');
              setCfg((c) => ({ ...c, scheme: v, equalizer: v.endsWith('ofdm') ? (c.equalizer === 'none' ? 'none' : 'lms') : c.equalizer }));
            }}
            options={[
              { value: 'ook', label: 'OOK' },
              { value: 'manchester', label: 'Manchester' },
              { value: 'pam4', label: '4-PAM' },
              { value: 'dco-ofdm', label: 'DCO-OFDM' },
              { value: 'aco-ofdm', label: 'ACO-OFDM' },
            ]}
          />
          <Slider label={ofdm ? 'Sample rate' : 'Symbol rate'} value={cfg.symbolRateMHz} min={1} max={200} log onChange={set('symbolRateMHz')} format={(v) => `${v.toFixed(v < 10 ? 1 : 0)} ${ofdm ? 'MS/s' : 'MBd'}`} />
          {ofdm && <Segmented label="Subcarrier QAM" value={cfg.qam} onChange={set('qam')} options={[{ value: 4, label: '4' }, { value: 16, label: '16' }, { value: 64, label: '64' }]} />}
          {cfg.scheme === 'dco-ofdm' && <Slider label="DC bias" value={cfg.dcBiasSigma} min={1} max={5} step={0.1} onChange={set('dcBiasSigma')} format={(v) => `${v.toFixed(1)} σ`} />}

          </CtlGroup>
          <CtlGroup key={`tx-${narrow}`} title="Transmitter (LED)" summary={`${cfg.ledBandwidthMHz} MHz · ${cfg.ledPowerW.toPrecision(2)} W`} defaultOpen={!narrow}>
          <Slider label="LED bandwidth" value={cfg.ledBandwidthMHz} min={1} max={500} log onChange={set('ledBandwidthMHz')} format={(v) => `${v.toFixed(v < 10 ? 1 : 0)} MHz`} />
          <Slider label="Average optical power" value={cfg.ledPowerW} min={0.05} max={10} log onChange={set('ledPowerW')} format={(v) => `${v.toPrecision(2)} W`} />
          {!ofdm && <Slider label="Modulation index" value={cfg.modIndex} min={0.05} max={1} step={0.01} onChange={set('modIndex')} format={(v) => `${(v * 100).toFixed(0)} %`} />}
          <Toggle label="LED non-linearity" checked={cfg.nonlinear} onChange={set('nonlinear')} />
          <Slider label="Semi-angle Φ½" value={cfg.semiAngleDeg} min={10} max={80} step={1} onChange={set('semiAngleDeg')} format={(v) => `${v}° · m=${lambertianOrder(v).toFixed(1)}`} />

          </CtlGroup>
          <CtlGroup key={`ch-${narrow}`} title="Channel" summary={`${cfg.heightM.toFixed(1)} m high · ${cfg.offsetM.toFixed(1)} m off`} defaultOpen={!narrow}>
          <Slider label="Height above receiver" value={cfg.heightM} min={0.5} max={5} step={0.05} onChange={set('heightM')} format={(v) => `${v.toFixed(2)} m`} />
          <Slider label="Horizontal offset" value={cfg.offsetM} min={0} max={4} step={0.05} onChange={set('offsetM')} format={(v) => `${v.toFixed(2)} m`} />
          <Slider label="Diffuse share" value={cfg.diffuseFraction} min={0} max={0.6} step={0.01} onChange={set('diffuseFraction')} format={(v) => `${(v * 100).toFixed(0)} %`} />
          <Slider label="RMS delay spread" value={cfg.rmsDelayNs} min={0.5} max={30} step={0.5} onChange={set('rmsDelayNs')} format={(v) => `${v} ns`} />

          </CtlGroup>
          <CtlGroup key={`rx-${narrow}`} title="Receiver" summary={`FOV ${cfg.fovDeg}° · ${cfg.areaMm2.toPrecision(2)} mm²`} defaultOpen={!narrow}>
          <Slider label="Field of view" value={cfg.fovDeg} min={10} max={90} step={1} onChange={set('fovDeg')} format={(v) => `${v}°`} />
          <Slider label="Detector area" value={cfg.areaMm2} min={0.1} max={200} log onChange={set('areaMm2')} format={(v) => `${v.toPrecision(2)} mm²`} />
          <Slider label="Concentrator index n" value={cfg.lensIndex} min={0} max={2} step={0.05} onChange={set('lensIndex')} format={(v) => (v < 1 ? 'none' : v.toFixed(2))} />
          <Slider label="Ambient photocurrent" value={cfg.ambientUA} min={0.1} max={5000} log onChange={set('ambientUA')} format={(v) => `${v.toPrecision(2)} µA`} />
          <Slider label="Amplifier noise" value={cfg.tiaNoisePA} min={0.5} max={50} log onChange={set('tiaNoisePA')} format={(v) => `${v.toFixed(1)} pA/√Hz`} />

          </CtlGroup>
          <CtlGroup key={`dsp-${narrow}`} title="Receiver DSP" summary={cfg.equalizer === 'none' ? 'no equaliser' : cfg.equalizer.toUpperCase()} defaultOpen={!narrow}>
          {ofdm ? (
            <Segmented value={cfg.equalizer === 'none' ? 'none' : 'lms'} onChange={set('equalizer')} options={[{ value: 'none', label: 'Gain only' }, { value: 'lms', label: 'One-tap per subcarrier' }]} />
          ) : (
            <Segmented value={cfg.equalizer} onChange={set('equalizer')} options={[{ value: 'none', label: 'None' }, { value: 'zf', label: 'ZF' }, { value: 'lms', label: 'LMS' }, { value: 'dfe', label: 'DFE' }]} />
          )}
          <Slider label="Noise seed" value={cfg.seed} min={1} max={50} step={1} onChange={set('seed')} format={(v) => `#${v}`} />
          </CtlGroup>
        </aside>

        <section className="lab-main" style={{ opacity: stale ? 0.7 : 1 }}>
          {(() => {
            const grid = (
            <Readouts>
              <Readout k="Throughput" v={`${r.throughputMbps.toFixed(1)} Mb/s`} />
              <Readout k="Channel gain H₀" v={r.H0 > 0 ? sci(r.H0, 2) : 'no LOS'} tone={r.H0 > 0 ? undefined : 'bad'} />
              <Readout k="Received power" v={r.PrW > 0 ? `${dB(r.PrW * 1000).toFixed(1)} dBm` : '—'} />
              <Readout k="Photocurrent" v={eng(r.signalCurrent, 'A')} />
              <Readout k="SNR (theory)" v={`${r.snrDb.toFixed(1)} dB`} />
              <Readout k="SNR (measured)" v={`${r.measuredSnrDb.toFixed(1)} dB`} />
              <Readout k="Bit errors" v={`${r.errors} / ${r.nBits}`} />
              <Readout k="BER" v={berText} tone={berTone(r.ber)} />
            </Readouts>
            );
            return narrow ? (
              <details className="lab-more">
                <summary>All link numbers</summary>
                {grid}
              </details>
            ) : (
              grid
            );
          })()}
          {r.note && <div className="lab-note">{r.note}</div>}

          <div className="lab-row">
            <div className="lab-card">
              <Stage height={250} camera={[3.2, 2.2, 4.4]} target={[cfg.offsetM / 2, cfg.heightM / 2, 0]} bloom={0.8} hint="geometry">
                <Geometry cfg={cfg} />
              </Stage>
            </div>
            <div className="lab-card">
              <Plot
                title="LED + channel frequency response"
                height={250}
                logX={false}
                xLabel="MHz"
                yLabel="dB"
                y={[-30, 2]}
                series={[{ x: r.channelResponse.f, y: r.channelResponse.db, color: 'var(--phosphor)', width: 2 }]}
                hlines={[{ y: -3, label: '−3 dB' }]}
                vlines={[{ x: ofdm ? cfg.symbolRateMHz / 2 : cfg.symbolRateMHz / 2, label: 'Nyquist', color: 'var(--warn)' }]}
              />
            </div>
          </div>

          <div className="lab-card">
            <Plot
              title="Waveforms: drive signal → LED light → received photocurrent (time in µs)"
              height={210}
              legend
              series={[
                { x: r.waveforms.t, y: r.waveforms.drive.map((v) => v * 0.9 + 4), color: 'var(--c1)', width: 1.2, label: 'drive (normalised)' },
                { x: r.waveforms.t, y: r.waveforms.optical.map((v) => (v / cfg.ledPowerW - 1) * 0.9 + 1.6), color: 'var(--phosphor)', width: 1.4, label: 'LED light' },
                { x: r.waveforms.t, y: r.waveforms.received.map((v) => Math.max(-1.6, Math.min(1.6, v * (ofdm ? 1 : 0.9))) - 1.2), color: 'var(--c6)', width: 1.1, label: 'photocurrent (AC)' },
              ]}
              hideYTicks
            />
          </div>

          <div className="lab-row">
            {ofdm && r.constellation ? (
              <>
                <div className="lab-card">
                  <Plot
                    title="Constellation after equaliser"
                    height={260}
                    equalAspect
                    x={[-1.8, 1.8]}
                    y={[-1.5, 1.5]}
                    series={[
                      { x: r.constellation.eq.map((p) => p.re), y: r.constellation.eq.map((p) => p.im), kind: 'scatter', color: 'var(--phosphor)', size: 1.2, alpha: 0.7 },
                      { x: r.constellation.ideal.map((p) => p.re), y: r.constellation.ideal.map((p) => p.im), kind: 'scatter', color: 'var(--text)', size: 2.6 },
                    ]}
                  />
                </div>
                <div className="lab-card">
                  <Plot
                    title="SNR per subcarrier"
                    height={260}
                    xLabel="subcarrier frequency (MHz)"
                    yLabel="dB"
                    series={[{ x: r.subcarrierSnrDb!.f, y: r.subcarrierSnrDb!.snr, kind: 'stem', color: 'var(--c3)', size: 2 }]}
                    hlines={[{ y: 10 * Math.log10(cfg.qam === 4 ? 13.5 : cfg.qam === 16 ? 66 : 280), label: `≈ needed for ${cfg.qam}-QAM @1e-6`, color: 'var(--warn)' }]}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="lab-card">
                  <Plot title={r.eyeAfter ? 'Eye after zero-forcing' : 'Eye diagram (received)'} height={260} traces={r.eyeAfter ?? r.eyeBefore} traceColor={r.eyeAfter ? 'var(--phosphor)' : 'var(--c6)'} hideYTicks />
                </div>
                <div className="lab-card">
                  <Plot
                    title="Decision samples after equaliser"
                    height={260}
                    y={[-2, 2]}
                    series={[{ x: r.decisions.after.map((_, i) => i), y: r.decisions.after, kind: 'scatter', color: 'var(--phosphor)', size: 1.3 }]}
                    hlines={r.decisions.levels.slice(0, -1).map((l, i) => ({ y: (l + r.decisions.levels[i + 1]) / 2, color: 'var(--text-3)' }))}
                    hideYTicks
                  />
                </div>
              </>
            )}
          </div>

          <div className="lab-card">
            <Plot
              title="Power spectral density: transmitted (blue) vs received (cyan)"
              height={200}
              xLabel="MHz"
              yLabel="dB (relative)"
              series={[
                { x: r.psd.f, y: r.psd.tx.map((v) => v - Math.max(...r.psd.tx)), color: 'var(--c1)', width: 1.4 },
                { x: r.psd.f, y: r.psd.rx.map((v) => v - Math.max(...r.psd.rx)), color: 'var(--c6)', width: 1.4 },
              ]}
              y={[-60, 3]}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
