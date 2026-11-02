import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Segmented, Widget } from '@/viz/controls';
import { refById, refLink } from '@/content/references';

/** A map of active research directions, filterable by layer and maturity. */
type Layer = 'all' | 'device' | 'phy' | 'network' | 'system';
interface Topic {
  title: string;
  layer: Exclude<Layer, 'all'>;
  maturity: 1 | 2 | 3; // 1 lab, 2 prototype, 3 standard/product
  what: string;
  hard: string;
  ref?: string;
  lesson?: string;
}

const TOPICS: Topic[] = [
  { title: 'Micro-LED transmitters', layer: 'device', maturity: 2, what: 'GaN µLEDs and µLED arrays with GHz bandwidth; multi-Gb/s from a single emitter.', hard: 'Low optical power per pixel, driver integration, droop.', ref: 'islim2017', lesson: 'led-physics' },
  { title: 'Laser-based lighting', layer: 'device', maturity: 2, what: 'Blue laser diodes + phosphor give white light with GHz modulation bandwidth.', hard: 'Eye safety, speckle, cost, thermal management.', lesson: 'drivers-lasers' },
  { title: 'Wavelength-division multiplexing', layer: 'phy', maturity: 2, what: 'Independent streams on RGB(Y) colours multiply the data rate; >15 Gb/s from off-the-shelf LEDs.', hard: 'Colour crosstalk, filters, colour quality of the illumination.', ref: 'bian2019' },
  { title: 'Single-photon receivers', layer: 'device', maturity: 2, what: 'SPAD arrays approach the quantum limit, extending range and fighting outage.', hard: 'Dead time, dark counts, ambient light saturation.', ref: 'huang2024spc', lesson: 'photodetectors' },
  { title: 'Optical RIS and mirrors', layer: 'phy', maturity: 1, what: 'Programmable mirror arrays or liquid-crystal metasurfaces steer light around blockages and fix orientation loss.', hard: 'Fast reconfiguration, channel estimation, size and cost.', ref: 'aboagye2023ris', lesson: 'research-frontiers' },
  { title: 'NOMA and rate splitting', layer: 'network', maturity: 1, what: 'Superpose users in power and decode with SIC; well suited to high-SNR LiFi downlinks.', hard: 'Error propagation, user pairing, fairness.', ref: 'marshoud2016noma', lesson: 'lifi-networks' },
  { title: 'Hybrid LiFi / WiFi', layer: 'network', maturity: 3, what: 'Load balancing and handover across light and radio for seamless coverage.', hard: 'Blockage prediction, signalling overhead, mobility.', ref: 'wu2021hybrid', lesson: 'lifi-networks' },
  { title: 'Device orientation & mobility', layer: 'phy', maturity: 2, what: 'Measured models of how phones tilt show orientation dominates LiFi channel statistics.', hard: 'Angle-diverse receivers, fast beam/AP selection.', ref: 'soltani2019orientation' },
  { title: 'Integrated sensing & positioning', layer: 'system', maturity: 2, what: 'The same luminaires locate devices to centimetres and sense presence or gestures.', hard: 'Multipath, tilt, joint design of sensing and communication.', ref: 'zhuang2018vlp', lesson: 'positioning-sensing' },
  { title: 'SLIPT: power + data', layer: 'device', maturity: 2, what: 'Solar cells as receivers harvest energy and decode data, enabling battery-free IoT nodes.', hard: 'Low bandwidth of large cells, power/data trade-off.', ref: 'wang2015solar' },
  { title: 'Optical camera communication for V2X & IoT', layer: 'system', maturity: 2, what: 'Cameras already in cars and phones decode tail-lights, signs and screens.', hard: 'Low frame rates, motion blur, detection of the source in the image.', ref: 'saeed2019occ', lesson: 'camera-occ' },
  { title: 'Machine-learning receivers', layer: 'phy', maturity: 1, what: 'Learned equalisers and end-to-end autoencoders handle LED non-linearity and memory.', hard: 'Generalisation across channels, complexity, interpretability.' },
  { title: 'Standardised LiFi', layer: 'system', maturity: 3, what: 'IEEE 802.11bb and ITU-T G.9991 bring interoperable LiFi to Wi-Fi chipsets and networks.', hard: 'Ecosystem, cost, uplink design.', ref: 'ieee80211bb', lesson: 'lifi-networks' },
  { title: 'Underwater & air-to-water links', layer: 'system', maturity: 2, what: 'Blue-green lasers and SPADs connect AUVs, sensors and drones through water.', hard: 'Scattering, pointing, turbulence and bubbles.', ref: 'zeng2017uwoc', lesson: 'outdoor-underwater' },
];

const MAT = ['', 'Lab research', 'Prototypes', 'Standards & products'];

export default function FrontierMap() {
  const [layer, setLayer] = useState<Layer>('all');
  const list = TOPICS.filter((t) => layer === 'all' || t.layer === layer).sort((a, b) => b.maturity - a.maturity);
  return (
    <Widget
      title="Where the field is moving"
      eyebrow="Interactive map"
      caption={<p>Maturity reflects the state of the art as described in the cited surveys and standards. Filter by the layer of the stack each direction mainly changes.</p>}
    >
      <Segmented
        value={layer}
        onChange={setLayer}
        options={[
          { value: 'all', label: 'All' },
          { value: 'device', label: 'Devices' },
          { value: 'phy', label: 'Physical layer' },
          { value: 'network', label: 'Networking' },
          { value: 'system', label: 'Systems' },
        ]}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 10 }}>
        {list.map((t) => {
          const r = t.ref ? refById(t.ref) : undefined;
          return (
            <div key={t.title} style={{ padding: 14, borderRadius: 12, border: '1px solid var(--line)', background: 'var(--bg-2)', display: 'grid', gap: 6, alignContent: 'start', minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                <span className="eyebrow">{t.layer}</span>
                <span title={MAT[t.maturity]} style={{ display: 'flex', gap: 3 }}>
                  {[1, 2, 3].map((k) => (
                    <i key={k} style={{ width: 14, height: 4, borderRadius: 2, background: k <= t.maturity ? 'var(--phosphor)' : 'var(--surface-3)' }} />
                  ))}
                </span>
              </div>
              <strong style={{ fontFamily: 'var(--font-display)', fontSize: '1.02rem', lineHeight: 1.25 }}>{t.title}</strong>
              <span style={{ fontSize: '0.88rem' }}>{t.what}</span>
              <span className="muted" style={{ fontSize: '0.84rem' }}>
                Open problems: {t.hard}
              </span>
              <span style={{ display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: '0.82rem' }}>
                {r && (
                  <a href={refLink(r)} target="_blank" rel="noreferrer">
                    {r.authors.split(',')[0]} {r.year} ↗
                  </a>
                )}
                {t.lesson && <Link to={`/learn/${t.lesson}`}>lesson →</Link>}
              </span>
            </div>
          );
        })}
      </div>
    </Widget>
  );
}
