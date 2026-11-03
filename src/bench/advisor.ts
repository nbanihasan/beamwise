/**
 * Optical Bench advisor: reads the traced scene and link reports and produces
 *  (1) a diagnosis with concrete, one-click fixes, and
 *  (2) a recommended block-by-block blueprint for the scenario and goals, each choice with its reason.
 * Rules follow the design guidance of the OWC surveys (Kahn & Barry 1997; Haas et al. 2016;
 * Khalighi & Uysal 2014; Zeng et al. 2017; Saeed et al. 2019; IEEE 802.15.7 / 802.11bb / G.9991).
 */
import type { BenchObject, Chain, Goals, PropValue } from './types';
import type { Scenario } from './scenarios';
import type { BenchAnalysis, LinkReport } from './link';
import { CODES, EQS, MODS } from './link';
import type { TraceResult } from './tracer';

export interface Fix {
  label: string;
  chain?: Partial<Chain>;
  patch?: { id: string; props?: Record<string, PropValue> };
  bounce?: { src: string; rx: string };
  aim?: { id: string; at: string };
  swapKind?: { id: string; kind: BenchObject['kind'] };
}

export interface Finding {
  level: 'good' | 'warn' | 'bad' | 'info';
  title: string;
  text: string;
  fixes: Fix[];
}

export interface BlueprintRow {
  block: string;
  group: 'tx' | 'channel' | 'rx' | 'net';
  choice: string;
  why: string;
  chain?: Partial<Chain>;
  current?: string;
}

export interface Advice {
  findings: Finding[];
  blueprint: BlueprintRow[];
  headline: string;
}

const fmtRate = (b: number) => (b >= 1e9 ? `${(b / 1e9).toPrecision(3)} Gb/s` : b >= 1e6 ? `${(b / 1e6).toPrecision(3)} Mb/s` : b >= 1e3 ? `${(b / 1e3).toPrecision(3)} kb/s` : `${b.toFixed(0)} b/s`);
export { fmtRate };

/** dB value for advisor text; a receiver with no light at all reads "no signal" instead of -Infinity. */
const fdb = (x: number, unit = 'dB') => (Number.isFinite(x) ? `${x.toFixed(1)} ${unit}` : 'no signal');

export function advise(sc: Scenario, objects: BenchObject[], tr: TraceResult, an: BenchAnalysis, chain: Chain, goals: Goals): Advice {
  const findings: Finding[] = [];
  const target = goals.targetMbps * 1e6;
  const srcObjs = objects.filter((o) => tr.sources.some((s) => s.id === o.id));
  const rxObjs = objects.filter((o) => tr.receivers.some((r) => r.rx.id === o.id));

  if (!srcObjs.length) findings.push({ level: 'bad', title: 'No transmitter', text: 'Add a light source from the library (Transmitters).', fixes: [] });
  if (!rxObjs.length) findings.push({ level: 'bad', title: 'No receiver', text: 'Add a photodetector or camera from the library (Receivers).', fixes: [] });

  for (const s of an.safety) findings.push({ level: 'warn', title: 'Eye safety', text: s, fixes: [] });

  an.reports.forEach((r: LinkReport) => {
    const rxObj = objects.find((o) => o.id === r.rxId);
    if (!rxObj) return;
    const srcObj = r.servingSource >= 0 ? objects.find((o) => o.id === tr.sources[r.servingSource]?.id) : srcObjs[0];
    const name = r.name;
    const props = rxObj.props;
    const conc = props.concentrator as string | undefined;
    const fov = (props.fov as number) ?? 60;
    const ok = r.throughput >= target;
    if (ok) {
      findings.push({ level: 'good', title: `${name}: ${fmtRate(r.throughput)}`, text: `Meets the ${fmtRate(target)} goal at a post-FEC BER below ${chain.targetBer.toExponential(0)}. Margin: SNR ${fdb(r.snrEffDb)}.`, fixes: [] });
    }
    switch (r.limit) {
      case 'blocked':
        findings.push({
          level: 'bad',
          title: `${name}: line of sight blocked`,
          text: 'Something sits between the transmitter and this receiver. Move it, add a second luminaire, or route the light around it with a mirror or RIS.',
          fixes: srcObj ? [{ label: 'Find a bounce point and add a mirror', bounce: { src: srcObj.id, rx: rxObj.id } }] : [],
        });
        break;
      case 'fov':
      case 'nosignal':
        findings.push({
          level: 'bad',
          title: `${name}: no light arrives`,
          text: 'The receiver does not see any transmitter (outside its field of view or outside the beam). Aim it, widen its FOV, or use the corridor trick: reflect around corners.',
          fixes: [
            ...(srcObj ? [{ label: `Aim ${name} at ${srcObj.name}`, aim: { id: rxObj.id, at: srcObj.id } }, { label: `Aim ${srcObj.name} at ${name}`, aim: { id: srcObj.id, at: rxObj.id } }] : []),
            ...(fov < 70 ? [{ label: 'Widen FOV to 70°', patch: { id: rxObj.id, props: { fov: 70, concentrator: conc === 'cpc' || conc === 'lens' ? 'hemi' : conc ?? 'none' } } }] : []),
            ...(srcObj ? [{ label: 'Find a bounce point and add a mirror', bounce: { src: srcObj.id, rx: rxObj.id } }] : []),
          ],
        });
        break;
      case 'ambient':
        findings.push({
          level: 'warn',
          title: `${name}: drowned in ambient light`,
          text: `Background photocurrent is ${(r.iBg / Math.max(1e-30, r.iSig)).toFixed(0)}× the signal. Its shot noise dominates. Narrow the FOV (less sky, more concentration) and add an optical filter matched to your source.`,
          fixes: [
            { label: 'Narrow FOV to 15° with a lens', patch: { id: rxObj.id, props: { fov: 15, concentrator: 'lens' } } },
            { label: 'Add a matching optical filter', patch: { id: rxObj.id, props: { filter: matchFilter(srcObj) } } },
          ],
        });
        break;
      case 'isi':
        findings.push({
          level: 'warn',
          title: `${name}: bandwidth-limited`,
          text: `The system bandwidth is ${(r.bSys / 1e6).toPrecision(3)} MHz (LED ${(r.bLed / 1e6).toPrecision(3)} MHz, detector ${(r.bRx / 1e6).toPrecision(3)} MHz, channel ${isFinite(r.bCh) ? (r.bCh / 1e6).toPrecision(3) : '∞'} MHz). Signalling faster smears symbols together.`,
          fixes: [
            { label: 'Use DCO-OFDM with bit loading', chain: { modulation: 'dco', bitLoading: true, equalizer: 'onetap', lineCode: 'none' } },
            { label: 'Keep single-carrier, add a DFE', chain: { equalizer: 'dfe' } },
            { label: 'Add analogue pre-equalisation', chain: { preEq: 'passive' } },
            ...(r.bLed < r.bRx && srcObj && (srcObj.props.spectrum === 'white') ? [{ label: 'Blue filter at the receiver (removes slow phosphor)', patch: { id: rxObj.id, props: { filter: 'blue' } } }] : []),
          ],
        });
        break;
      case 'distortion':
        findings.push({
          level: 'warn',
          title: `${name}: LED non-linearity limits SNR`,
          text: 'Multilevel signals hit the curved part of the LED characteristic. A non-linear equaliser or a smaller modulation depth removes the error floor.',
          fixes: [
            { label: 'Volterra equaliser', chain: { equalizer: 'volterra' } },
            { label: 'Neural-network equaliser', chain: { equalizer: 'mlp' } },
            { label: 'Lower modulation index to 0.4', chain: { modIndex: 0.4 } },
          ],
        });
        break;
      case 'saturated':
        findings.push({
          level: 'warn',
          title: `${name}: photon counter saturated`,
          text: 'Too many photons for the dead time. SPADs shine when light is scarce; with this much light a PIN or APD is better.',
          fixes: [{ label: 'Narrow FOV + filter', patch: { id: rxObj.id, props: { fov: 20, filter: matchFilter(srcObj) } } }],
        });
        break;
      case 'noise':
        if (!ok) {
          const fixes: Fix[] = [];
          const noLos = r.shares.los < 0.01 && r.shares.optics < 0.01;
          if (noLos && srcObj) fixes.push({ label: 'Find a bounce point and add a mirror', bounce: { src: srcObj.id, rx: rxObj.id } });
          if (!conc || conc === 'none') fixes.push({ label: `Add a CPC concentrator (FOV ${Math.min(fov, 40)}°)`, patch: { id: rxObj.id, props: { concentrator: 'cpc', fov: Math.min(fov, 40) } } });
          if (rxObj.kind === 'pin') fixes.push({ label: 'Swap the PIN for an APD (internal gain)', swapKind: { id: rxObj.id, kind: 'apd' } });
          if (MODS[chain.modulation].multilevel) fixes.push({ label: 'Use a more robust modulation (OOK)', chain: { modulation: 'ook', equalizer: 'dfe' } });
          fixes.push({ label: 'Stronger FEC (LDPC r=½)', chain: { coding: 'ldpc12' } });
          if (srcObj && !noLos) fixes.push({ label: `Aim ${srcObj.name} at ${name}`, aim: { id: srcObj.id, at: rxObj.id } });
          findings.push({
            level: noLos ? 'bad' : 'warn',
            title: noLos ? `${name}: no line of sight` : `${name}: not enough light (SNR ${fdb(r.snrDb)})`,
            text: noLos
              ? `All ${fdb(r.prxDbm, 'dBm')} arrives by diffuse reflection, far too weak. Give the light a specular path: a mirror or RIS that both ends can see.`
              : `Received ${fdb(r.prxDbm, 'dBm')}. Collect more light, add gain, or trade rate for robustness.`,
            fixes,
          });
        }
        break;
      case 'camera':
        if (!r.camera?.inView) findings.push({ level: 'bad', title: `${name}: no light source in the camera view`, text: 'Point the camera at an LED or screen.', fixes: srcObj ? [{ label: `Aim camera at ${srcObj.name}`, aim: { id: rxObj.id, at: srcObj.id } }] : [] });
        else findings.push({ level: 'info', title: `${name}: camera link`, text: `${r.camera.rowsCovered.toFixed(0)} sensor rows see the source → ≈ ${r.camera.bitsPerFrame.toFixed(0)} bits per frame. Move closer or use a bigger source for more rows; raise the frame rate for more frames.`, fixes: [] });
        break;
    }
    r.warnings.forEach((w) => findings.push({ level: 'info', title: name, text: w, fixes: [] }));
    if (r.limit === 'ok' && r.throughput < target) {
      const fixes: Fix[] = [];
      const bwBound = r.bSys * 6 < target;
      const white = srcObj?.props.spectrum === 'white';
      if (bwBound && white && props.filter !== 'blue') fixes.push({ label: 'Blue filter: drop the slow phosphor (≈ 4× bandwidth)', patch: { id: rxObj.id, props: { filter: 'blue' } } });
      if (bwBound && chain.preEq === 'none') fixes.push({ label: 'Analogue pre-equaliser (≈ 3× bandwidth)', chain: { preEq: 'passive' } });
      if (MODS[chain.modulation].family !== 'ofdm' && bwBound) fixes.push({ label: 'Switch to DCO-OFDM with bit loading', chain: { modulation: 'dco', bitLoading: true, equalizer: 'onetap', lineCode: 'none' } });
      if (MODS[chain.modulation].family === 'ofdm' && chain.qam < 256) fixes.push({ label: 'Allow up to 256-QAM', chain: { qam: 256, bitLoading: true } });
      if (CODES[chain.coding].rate < 0.7 && r.snrEffDb > 12) fixes.push({ label: 'Lighter FEC: LDPC r=⅚', chain: { coding: 'ldpc56' } });
      if ((!conc || conc === 'none') && r.snrDb < 30) fixes.push({ label: 'Hemispherical lens on the receiver', patch: { id: rxObj.id, props: { concentrator: 'hemi' } } });
      if (srcObj && bwBound && srcObj.kind !== 'laser') fixes.push({ label: `Faster source: make ${srcObj.name} a laser diode`, swapKind: { id: srcObj.id, kind: 'laser' } });
      findings.push({
        level: 'warn',
        title: `${name}: ${fmtRate(r.throughput)}, below the ${fmtRate(target)} goal`,
        text: bwBound
          ? `Bandwidth is the bottleneck: ${(r.bSys / 1e6).toPrecision(2)} MHz of system bandwidth cannot carry ${fmtRate(target)} at this SNR. Widen it or pack more bits per hertz.`
          : `SNR is the bottleneck (${fdb(r.snrEffDb)} effective). Collect more light or reduce noise.`,
        fixes,
      });
    }
  });

  // flicker check
  if (goals.illumination && MODS[chain.modulation].family === 'sc' && !MODS[chain.modulation].dcBalanced && chain.lineCode === 'none')
    findings.push({
      level: 'warn',
      title: 'Possible visible flicker',
      text: 'With lighting on, long runs of identical bits change the lamp’s average brightness. Use a DC-balanced line code or VPPM (IEEE 802.15.7, IEEE 1789).',
      fixes: [
        { label: 'Add Manchester line code', chain: { lineCode: 'manchester' } },
        { label: 'Use 8B10B (more efficient)', chain: { lineCode: '8b10b' } },
      ],
    });
  if (MODS[chain.modulation].family === 'ofdm' && chain.lineCode !== 'none') findings.push({ level: 'info', title: 'Line code with OFDM', text: 'OFDM is already DC-free around its bias; an RLL code only costs rate.', fixes: [{ label: 'Remove line code', chain: { lineCode: 'none' } }] });
  if (chain.mimo && an.mimo) {
    const c = an.mimo.cond;
    findings.push({
      level: c > 30 ? 'warn' : 'good',
      title: `MIMO: condition number ${c.toFixed(1)}`,
      text: c > 30 ? 'The channels from each LED look almost the same to every detector, so the streams cannot be separated. Spread the LEDs or use an imaging/angle-diverse receiver.' : `The channel matrix is well conditioned: spatial multiplexing could reach ≈ ${fmtRate(an.mimo.capacityBps)}.`,
      fixes: [],
    });
  }

  return { findings, blueprint: blueprint(sc, objects, tr, an, chain, goals), headline: headline(an, target) };
}

function headline(an: BenchAnalysis, target: number) {
  if (!an.reports.length) return 'Add a transmitter and a receiver to start.';
  const best = an.reports.reduce((a, b) => (b.throughput > a.throughput ? b : a));
  const all = an.reports.every((r) => r.throughput >= target);
  if (all) return `All receivers meet the goal. Best: ${best.name}, ${fmtRate(best.throughput)}.`;
  const worst = an.reports.reduce((a, b) => (b.throughput < a.throughput ? b : a));
  return `${worst.name} is the weakest link (${fmtRate(worst.throughput)}). Start with the first suggestion below.`;
}

function matchFilter(src?: BenchObject): string {
  const s = (src?.props.spectrum as string) ?? 'white';
  if (s === 'nir1550') return 'nir';
  if (s.startsWith('ir')) return 'ir';
  if (s === 'red') return 'red';
  if (s === 'green') return 'green';
  return 'blue';
}

function blueprint(sc: Scenario, objects: BenchObject[], tr: TraceResult, an: BenchAnalysis, chain: Chain, goals: Goals): BlueprintRow[] {
  const rows: BlueprintRow[] = [];
  const target = goals.targetMbps * 1e6;
  const rep = an.reports.length ? an.reports.reduce((a, b) => (b.throughput < a.throughput ? b : a)) : undefined;
  const hasCamera = objects.some((o) => o.kind === 'camera');
  const outdoor = sc.kind === 'outdoor';
  const water = sc.kind === 'underwater';
  const space = sc.kind === 'space';
  const longRange = (rep?.rangeM ?? 0) > 30;
  const bSys = rep?.bSys ?? 20e6;
  const snr = rep?.snrDb ?? 20;
  const photonStarved = (rep?.prxW ?? 1) < 1e-8;

  // ---- transmitter
  let source = 'Phosphor-white LED luminaire';
  let sWhy = 'Lighting and data from the same fixture; a few MHz of bandwidth is enough with OFDM.';
  if (hasCamera) {
    source = 'LED or screen in the camera’s view';
    sWhy = 'Optical camera communication needs a visible, reasonably large source to cover many sensor rows.';
  } else if (space) {
    source = '1550 nm laser, µrad divergence, fine-pointing mirror';
    sWhy = 'Vacuum has no loss, so divergence and pointing set the budget; 1550 nm has mature fibre-amplifier technology.';
  } else if (water) {
    source = 'Blue-green (450–520 nm) laser diode';
    sWhy = 'Water absorbs least in the blue-green window; a laser gives the power density for tens of metres.';
  } else if (outdoor && longRange && !goals.illumination) {
    source = '1550 nm laser (FSO)';
    sWhy = 'Higher eye-safe power than 850 nm and slightly better penetration in haze.';
  } else if (outdoor) {
    source = 'Vehicle / street LED lamps';
    sWhy = 'Infrastructure and vehicles already carry LEDs that can be modulated for V2X.';
  } else if (target > 2e9) {
    source = 'Laser diode or micro-LED array (with diffuser for lighting)';
    sWhy = 'Gb/s rates need hundreds of MHz to GHz of modulation bandwidth that phosphor LEDs do not have.';
  } else if (!goals.illumination) {
    source = 'IR LED or VCSEL (850–940 nm)';
    sWhy = 'Invisible, so the link works even when lights are off; this is the LiFi uplink band (802.11bb).';
  }
  rows.push({ block: 'Light source', group: 'tx', choice: source, why: sWhy });

  // ---- coding
  let coding = 'ldpc12' as Chain['coding'];
  let cWhy = 'Near-capacity FEC for packet data (G.9991, 802.11bb).';
  if (hasCamera) {
    coding = 'rs6432';
    cWhy = 'Camera links lose whole rows or frames at once: byte-oriented Reed–Solomon handles erasures well (802.15.7 OCC).';
  } else if (outdoor && !longRange) {
    coding = 'rscc';
    cWhy = 'RS outer + convolutional inner code, as in 802.15.7 PHY I for outdoor links.';
  } else if (snr > 25 && target > 1e8) {
    coding = 'ldpc56';
    cWhy = 'Plenty of SNR: a high-rate LDPC keeps the overhead low.';
  } else if (photonStarved || space) {
    coding = 'ldpc12';
    cWhy = 'Every photon counts: a strong rate-½ LDPC (or turbo) gives the most coding gain.';
  }
  rows.push({ block: 'Channel coding (FEC)', group: 'tx', choice: CODES[coding].label, why: cWhy, chain: { coding }, current: CODES[chain.coding].label });
  rows.push({
    block: 'Interleaver',
    group: 'tx',
    choice: outdoor || water || goals.mobility !== 'static' ? 'Deep interleaver (spans fades)' : 'Short block interleaver',
    why: outdoor || water ? 'Turbulence fades and blockage last milliseconds: spread each codeword across them.' : 'Hands and heads cause short bursts.',
    chain: { interleaver: true },
    current: chain.interleaver ? 'On' : 'Off',
  });

  // ---- modulation
  let modulation: Chain['modulation'];
  let mWhy: string;
  let eq: Chain['equalizer'];
  let eqWhy: string;
  if (hasCamera) {
    modulation = objects.some((o) => o.kind === 'screen') ? 'ufsook' : 'rsook';
    mWhy = modulation === 'rsook' ? 'Rolling-shutter OOK turns each sensor row into a sample: the fastest LED-to-camera scheme.' : 'Screen barcodes / UFSOOK are flicker-free and robust to unsynchronised frame rates.';
    eq = 'none';
    eqWhy = 'Camera links are frame-rate-limited, not ISI-limited.';
  } else if (photonStarved || space) {
    modulation = 'ppm16';
    mWhy = 'Photon-starved: PPM puts all the energy of several bits into one pulse, the most power-efficient choice (deep-space links use it).';
    eq = 'none';
    eqWhy = 'Wide slots make ISI negligible.';
  } else if (target > bSys * 1.5 && snr > 15) {
    modulation = 'dco';
    mWhy = `The goal (${fmtRate(target)}) is far above the ${(bSys / 1e6).toPrecision(2)} MHz system bandwidth: OFDM with adaptive bit loading packs bits where the SNR allows.`;
    eq = 'onetap';
    eqWhy = 'OFDM equalises each subcarrier with one complex gain; the cyclic prefix absorbs the delay spread.';
  } else if (goals.illumination && target < 20e6) {
    modulation = 'vppm';
    mWhy = 'Supports dimming and is flicker-free (802.15.7 PHY I/II).';
    eq = target > bSys * 0.5 ? 'dfe' : 'none';
    eqWhy = eq === 'dfe' ? 'A DFE removes the LED’s slow tail without boosting noise.' : 'Slow enough that no equaliser is needed.';
  } else if (snr > 22 && target > bSys) {
    modulation = 'pam4';
    mWhy = 'High SNR: 4-PAM doubles the bit rate per symbol over OOK.';
    eq = 'volterra';
    eqWhy = 'Multilevel signals expose LED non-linearity; a Volterra or neural equaliser fixes it.';
  } else {
    modulation = 'ook';
    mWhy = 'Simple and robust; enough for this rate.';
    eq = target > bSys * 0.6 ? 'dfe' : 'none';
    eqWhy = eq === 'dfe' ? 'The symbol rate approaches the bandwidth: a DFE removes ISI.' : 'No equaliser needed at this rate.';
  }
  const lineCode: Chain['lineCode'] = MODS[modulation].family === 'sc' && goals.illumination && !MODS[modulation].dcBalanced ? '8b10b' : 'none';
  rows.push({
    block: 'Line code (RLL)',
    group: 'tx',
    choice: lineCode === 'none' ? 'None needed' : '8B10B',
    why: lineCode === 'none' ? (MODS[modulation].dcBalanced ? `${MODS[modulation].label} is already DC-balanced.` : 'No illumination constraint.') : 'Keeps the average brightness constant (no flicker) with only 20 % overhead.',
    chain: { lineCode },
    current: chain.lineCode,
  });
  rows.push({ block: 'Modulation', group: 'tx', choice: MODS[modulation].label, why: mWhy, chain: { modulation, ...(MODS[modulation].family === 'ofdm' ? { bitLoading: true, qam: 256 } : {}) }, current: MODS[chain.modulation].label });
  rows.push({
    block: 'DAC, driver & pre-emphasis',
    group: 'tx',
    choice: target > bSys * 2 && !hasCamera ? 'Bias-T driver + analogue pre-equaliser' : 'Bias-T driver',
    why: target > bSys * 2 ? 'A passive pre-equaliser flattens the LED roll-off and extends usable bandwidth ~3×, at the cost of ~5 dB power.' : 'DC bias sets the light level; the signal rides on top.',
    chain: { preEq: target > bSys * 2 && !hasCamera ? 'passive' : 'none' },
    current: chain.preEq,
  });
  rows.push({
    block: 'Transmit optics',
    group: 'tx',
    choice: space || (outdoor && longRange) ? 'Telescope / collimator (narrow beam)' : water ? 'Collimating lens, moderate divergence' : goals.illumination ? 'Diffuser / luminaire optic (wide, even)' : 'TIR lens (moderate beam)',
    why: space || longRange ? 'Range is set by divergence: narrow the beam as far as pointing allows.' : goals.illumination ? 'Even illumination and eye safety; coverage beats peak power.' : 'Concentrate power toward the coverage area.',
  });

  // ---- channel
  rows.push({
    block: 'Link geometry',
    group: 'channel',
    choice: space || longRange ? 'Directed LOS with tracking (PAT)' : goals.mobility === 'static' ? 'Directed or non-directed LOS' : 'Non-directed LOS, overlapping cells',
    why: space || longRange ? 'Narrow beams need acquisition, pointing and tracking.' : goals.mobility === 'static' ? 'Fixed devices can use narrow beams for SNR.' : 'Mobile users need coverage and handover more than peak SNR.',
  });

  // ---- receiver
  let det = 'PIN photodiode';
  let dWhy = 'Linear, cheap and fast at moderate power.';
  if (hasCamera) {
    det = 'CMOS camera (rolling shutter)';
    dWhy = 'Already in every phone and car.';
  } else if (photonStarved || water) {
    det = water ? 'SiPM or PMT (photon counting)' : 'SPAD / SiPM array';
    dWhy = 'Single-photon sensitivity when only a few photons arrive per bit.';
  } else if (space || (outdoor && longRange)) {
    det = space ? 'InGaAs APD behind a telescope' : 'InGaAs APD';
    dWhy = 'Internal gain beats amplifier noise at long range; InGaAs for 1550 nm.';
  } else if (snr < 15) {
    det = 'APD';
    dWhy = 'Avalanche gain buys 5–10 dB when amplifier noise dominates.';
  }
  rows.push({ block: 'Photodetector', group: 'rx', choice: det, why: dWhy });
  rows.push({
    block: 'Receive optics & filter',
    group: 'rx',
    choice: hasCamera ? 'Camera lens' : outdoor || sc.env.ambient === 'daylight' ? 'Narrow-FOV lens + band-pass filter' : goals.mobility !== 'static' ? 'Hemispherical lens (wide FOV) + filter' : 'CPC concentrator + filter',
    why: outdoor ? 'Sunlight is the main noise source: reject it in angle and wavelength.' : goals.mobility !== 'static' ? 'Moving, tilting devices need a wide field of view; a hemisphere gives n² gain over ±70°.' : 'Fixed geometry allows a narrow FOV and high concentration gain.',
  });
  rows.push({ block: 'Front end (TIA, AGC, ADC)', group: 'rx', choice: target > 1e9 ? 'Wideband TIA + ≥ 2 GS/s ADC' : 'TIA + AGC + ADC (≥ 2× symbol rate)', why: 'AGC tracks the 30–40 dB power swing as users move; the TIA sets the noise floor.' });
  rows.push({ block: 'Synchronisation', group: 'rx', choice: MODS[modulation].family === 'ofdm' ? 'Preamble + pilot tones' : 'Preamble + Gardner timing loop', why: MODS[modulation].family === 'ofdm' ? 'Pilots track timing and channel drift between frames.' : 'Finds frames and the best sampling instant.', chain: { sync: MODS[modulation].family === 'ofdm' ? 'pilots' : 'gardner' }, current: chain.sync });
  rows.push({ block: 'Equaliser', group: 'rx', choice: EQS[eq].label, why: eqWhy, chain: { equalizer: eq }, current: EQS[chain.equalizer].label });
  rows.push({ block: 'Detection & decoding', group: 'rx', choice: coding.startsWith('ldpc') || coding === 'turbo13' || coding === 'polar12' || coding === 'cc' ? 'Soft-decision (LLR) demapper + iterative decoder' : 'Hard decisions + algebraic decoder', why: 'Soft information is worth about 2 dB for soft-decision codes.' });

  // ---- network
  const multiUser = objects.filter((o) => tr.receivers.some((r) => r.rx.id === o.id)).length > 1;
  const mac: Chain['mac'] = !multiUser ? 'p2p' : MODS[modulation].family === 'ofdm' ? 'ofdma' : outdoor ? 'csma' : 'tdma';
  rows.push({ block: 'Multiple access (MAC)', group: 'net', choice: { p2p: 'Point-to-point', tdma: 'TDMA', ofdma: 'OFDMA', noma: 'NOMA', csma: 'CSMA/CA' }[mac], why: multiUser ? 'Several receivers share each light: divide time or subcarriers between them.' : 'A single link needs no MAC sharing.', chain: { mac }, current: chain.mac });
  const std = hasCamera ? 'IEEE 802.15.7 (OCC PHYs IV–VI)' : space ? 'CCSDS optical (space links)' : outdoor && longRange ? 'Proprietary FSO / IEC 60825 eye safety' : sc.kind === 'indoor' && target >= 1e8 ? 'IEEE 802.11bb or ITU-T G.9991' : sc.id === 'office' ? 'IEEE 802.11bb (LiFi)' : 'IEEE 802.15.7 / 802.15.13';
  rows.push({ block: 'Standard to follow', group: 'net', choice: std, why: 'Interoperability and proven parameter choices.' });
  return rows;
}
