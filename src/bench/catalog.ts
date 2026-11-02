import type { Category, Kind, PropValue } from './types';

/**
 * Component catalogue for the Optical Bench. Each entry declares how the component is named, where it
 * mounts by default, its editable properties (with ranges and units) and a one-line explanation.
 * Physical behaviour lives in tracer.ts (light) and link.ts (signal); rendering in BenchModels.tsx.
 * To add a component: add a Kind in types.ts, an entry here, a case in tracer.ts and a model.
 */
export type Mount = 'ceiling' | 'desk' | 'floor' | 'wall' | 'free' | 'pole';

export interface PropSpec {
  key: string;
  label: string;
  type: 'num' | 'sel' | 'bool' | 'target';
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  log?: boolean;
  options?: { value: string; label: string }[];
  help?: string;
}

export interface CatalogEntry {
  kind: Kind;
  category: Category;
  label: string;
  blurb: string;
  mount: Mount;
  pitch: number;
  defaults: Record<string, PropValue>;
  props: PropSpec[];
  /** SVG path (24×24) for the library tile */
  glyph: string;
  lesson?: string;
}

export const SPECTRA = [
  { value: 'white', label: 'White (phosphor)' },
  { value: 'blue', label: 'Blue 450 nm' },
  { value: 'green', label: 'Green 520 nm' },
  { value: 'red', label: 'Red 630 nm' },
  { value: 'rgb', label: 'RGB' },
  { value: 'ir850', label: 'IR 850 nm' },
  { value: 'ir940', label: 'IR 940 nm' },
  { value: 'uv365', label: 'UV 365 nm' },
  { value: 'nir1550', label: 'IR 1550 nm' },
];

const CONC = {
  key: 'concentrator',
  label: 'Optics in front',
  type: 'sel' as const,
  options: [
    { value: 'none', label: 'None (bare)' },
    { value: 'lens', label: 'Imaging lens' },
    { value: 'hemi', label: 'Hemispherical lens' },
    { value: 'cpc', label: 'CPC concentrator' },
  ],
  help: 'Concentrators trade FOV for gain: g ≈ n²/sin²(FOV).',
};
const FILTER = {
  key: 'filter',
  label: 'Optical filter',
  type: 'sel' as const,
  options: [
    { value: 'none', label: 'None' },
    { value: 'blue', label: 'Blue band-pass (450 ± 20 nm)' },
    { value: 'green', label: 'Green band-pass (520 ± 20 nm)' },
    { value: 'red', label: 'Red band-pass (630 ± 20 nm)' },
    { value: 'ir', label: 'IR long-pass (> 780 nm)' },
    { value: 'nir', label: '1550 nm band-pass' },
  ],
  help: 'Rejects ambient light outside the signal band. A blue filter also removes the slow phosphor component of a white LED.',
};
const FOV = { key: 'fov', label: 'Field of view (half-angle)', type: 'num' as const, min: 0.1, max: 90, log: true, unit: '°' };
const AREA = { key: 'area', label: 'Active area', type: 'num' as const, min: 0.001, max: 2000, log: true, unit: 'mm²' };
const POWER = { key: 'power', label: 'Optical power', type: 'num' as const, min: 0.0001, max: 50, log: true, unit: 'W' };
const SEMI = { key: 'semi', label: 'Beam semi-angle Φ½', type: 'num' as const, min: 2, max: 85, step: 1, unit: '°' };
const SPEC = { key: 'spectrum', label: 'Spectrum', type: 'sel' as const, options: SPECTRA };
const BW = { key: 'bw', label: 'Modulation bandwidth', type: 'num' as const, min: 0.01, max: 20000, log: true, unit: 'MHz' };
const SIZE = (max = 2) => ({ key: 'size', label: 'Size', type: 'num' as const, min: 0.01, max, log: true, unit: 'm' });

const G = {
  led: 'M12 3a6 6 0 0 1 6 6v5H6V9a6 6 0 0 1 6-6Zm-4 11v4m8-4v4M4 21h16',
  laser: 'M3 12h9m0-4h5l4 4-4 4h-5zM14 12h7',
  panel: 'M3 7h18v3H3zM6 13l-2 6m14-6 2 6m-8-6v7',
  lamp: 'M5 21V5h9m0 0 3 3H11zm0 3v2',
  head: 'M3 15h4l3-5h6l3 5h2v3H3z',
  screen: 'M3 5h18v11H3zM8 20h8m-4-4v4',
  pd: 'M7 4h10v6l-5 4-5-4zM12 14v6M8 20h8',
  apd: 'M7 4h10v6l-5 4-5-4zM12 14v6m-4 0h8M10 7h4',
  spad: 'M6 6h12v12H6zM9 9h2v2H9zm4 0h2v2h-2zm-4 4h2v2H9zm4 0h2v2h-2z',
  pmt: 'M4 9h12l4 3-4 3H4zM7 9v6m3-6v6m3-6v6',
  camera: 'M4 7h4l2-2h4l2 2h4v12H4zm8 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
  solar: 'M3 17 6 7h12l3 10zM9 7l-1 10m8-10 1 10M4.5 12h15',
  mirror: 'M7 4v16M7 6l10-2m-10 8 10-2m-10 8 10-2',
  concave: 'M8 3c6 4 6 14 0 18M13 12h8',
  convex: 'M14 3c-6 4-6 14 0 18M3 12h8',
  retro: 'M4 4h16v16H4zM4 4l8 8 8-8M12 12v8',
  prism: 'M12 3 21 20H3zM2 10l10 3m0 0 10-5m-10 5 10 2',
  lens: 'M12 3c3 3 3 15 0 18-3-3-3-15 0-18zM3 12h3m12 0h3',
  lensNeg: 'M9 3c3 3 3 15 0 18h6c-3-3-3-15 0-18zM3 12h3m12 0h3',
  fresnel: 'M9 3v18m0-15 3 2m-3 3 3 2m-3 3 3 2M3 12h3m9 0h6',
  diffuser: 'M12 3v18M3 12h6m6 0 6-4m-6 4h6m-6 0 6 4',
  polarizer: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8 5v14m4-16v18m4-16v14',
  filter: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 4a5 5 0 1 0 0 10 5 5 0 0 0 0-10',
  splitter: 'M5 5h14v14H5zM5 19 19 5M2 12h3m14 0h3M12 2v3',
  ris: 'M3 3h18v18H3zM9 3v18m6-18v18M3 9h18M3 15h18',
  wall: 'M3 4h18v16H3zM3 9h18M3 14h18M9 4v5m6 0v5m-9 0v6m9-6v6',
  person: 'M12 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM7 21v-6a5 5 0 0 1 10 0v6',
  car: 'M3 15l2-5h14l2 5v4H3zM7 19v2m10-2v2M6 10l2-4h8l2 4',
  box: 'M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4m-8 4v8',
};

const MATERIAL_OPTS = [
  { value: 'plaster', label: 'White plaster (ρ 0.8)' },
  { value: 'wood', label: 'Wood (ρ 0.45, glossy)' },
  { value: 'tile', label: 'Glazed tile (glossy)' },
  { value: 'concrete', label: 'Concrete (ρ 0.35)' },
  { value: 'carpet', label: 'Carpet (ρ 0.15)' },
  { value: 'metal', label: 'Brushed metal (glossy)' },
  { value: 'glass', label: 'Glass (weak specular)' },
  { value: 'black', label: 'Black / absorber (ρ 0.04)' },
];

export const CATALOG: CatalogEntry[] = [
  // ---------------- sources ----------------
  { kind: 'panel', category: 'source', label: 'LiFi luminaire', blurb: 'Ceiling LED panel: the typical LiFi access point.', mount: 'ceiling', pitch: -90, defaults: { power: 4, semi: 60, spectrum: 'white', bw: 4, size: 0.6 }, props: [POWER, SEMI, SPEC, BW], glyph: G.panel, lesson: 'lifi-networks' },
  { kind: 'led', category: 'source', label: 'White LED', blurb: 'Phosphor white LED: cheap, bright, slow (few MHz).', mount: 'ceiling', pitch: -90, defaults: { power: 1, semi: 60, spectrum: 'white', bw: 4 }, props: [POWER, SEMI, SPEC, BW], glyph: G.led, lesson: 'led-physics' },
  { kind: 'rgbled', category: 'source', label: 'RGB LED', blurb: 'Three colour chips: WDM or colour-shift keying.', mount: 'ceiling', pitch: -90, defaults: { power: 1, semi: 60, spectrum: 'rgb', bw: 15 }, props: [POWER, SEMI, SPEC, BW], glyph: G.led, lesson: 'csk-mimo' },
  { kind: 'microled', category: 'source', label: 'Micro-LED', blurb: 'Tiny GaN pixel: hundreds of MHz, low power.', mount: 'desk', pitch: 0, defaults: { power: 0.005, semi: 60, spectrum: 'blue', bw: 400 }, props: [POWER, SEMI, SPEC, BW], glyph: G.led, lesson: 'research-frontiers' },
  { kind: 'irled', category: 'source', label: 'IR LED', blurb: 'Invisible 850/940 nm: LiFi uplink, remote links.', mount: 'desk', pitch: 0, defaults: { power: 0.1, semi: 30, spectrum: 'ir850', bw: 30 }, props: [POWER, SEMI, SPEC, BW], glyph: G.led },
  { kind: 'uvled', category: 'source', label: 'UV LED', blurb: 'Deep-UV scatters strongly: non-line-of-sight links.', mount: 'desk', pitch: 30, defaults: { power: 0.05, semi: 30, spectrum: 'uv365', bw: 10 }, props: [POWER, SEMI, SPEC, BW], glyph: G.led, lesson: 'channel-impairments' },
  { kind: 'laser', category: 'source', label: 'Laser diode', blurb: 'Narrow, fast beam: FSO, underwater, laser lighting.', mount: 'free', pitch: 0, defaults: { power: 0.01, div: 2, spectrum: 'green', bw: 1000 }, props: [POWER, { key: 'div', label: 'Divergence (full angle)', type: 'num', min: 0.01, max: 300, log: true, unit: 'mrad' }, SPEC, BW], glyph: G.laser, lesson: 'drivers-lasers' },
  { kind: 'vcsel', category: 'source', label: 'VCSEL', blurb: 'Vertical-cavity laser: GHz, wider beam, IR.', mount: 'ceiling', pitch: -90, defaults: { power: 0.005, div: 250, spectrum: 'ir940', bw: 5000 }, props: [POWER, { key: 'div', label: 'Divergence (full angle)', type: 'num', min: 1, max: 600, log: true, unit: 'mrad' }, SPEC, BW], glyph: G.laser },
  { kind: 'streetlamp', category: 'source', label: 'Street lamp', blurb: 'Outdoor LED luminaire on a pole: infrastructure-to-vehicle.', mount: 'pole', pitch: -90, defaults: { power: 20, semi: 60, spectrum: 'white', bw: 2 }, props: [POWER, SEMI, SPEC, BW], glyph: G.lamp },
  { kind: 'headlight', category: 'source', label: 'Headlight / tail light', blurb: 'Vehicle lamp: vehicle-to-vehicle links.', mount: 'free', pitch: -3, defaults: { power: 2, semi: 15, spectrum: 'white', bw: 5 }, props: [POWER, SEMI, SPEC, BW], glyph: G.head, lesson: 'camera-occ' },
  { kind: 'screen', category: 'source', label: 'Display / screen', blurb: 'Screen showing coded frames: screen-to-camera OCC.', mount: 'desk', pitch: 0, defaults: { power: 0.4, semi: 60, spectrum: 'white', bw: 0.00012, w: 0.6, h: 0.35, block: 24 }, props: [POWER, { key: 'w', label: 'Width', type: 'num', min: 0.05, max: 3, step: 0.01, unit: 'm' }, { key: 'block', label: 'Code block size', type: 'num', min: 4, max: 80, step: 1, unit: 'px' }], glyph: G.screen, lesson: 'camera-occ' },

  // ---------------- receivers ----------------
  { kind: 'pin', category: 'receiver', label: 'PIN photodiode', blurb: 'Linear, cheap, fast: the default receiver.', mount: 'desk', pitch: 90, defaults: { area: 1, fov: 60, concentrator: 'none', filter: 'none', bw: 50, noise: 5 }, props: [AREA, FOV, CONC, FILTER, BW, { key: 'noise', label: 'TIA input noise', type: 'num', min: 0.5, max: 50, log: true, unit: 'pA/√Hz' }], glyph: G.pd, lesson: 'photodetectors' },
  { kind: 'apd', category: 'receiver', label: 'APD', blurb: 'Avalanche gain M lifts the signal above amplifier noise.', mount: 'desk', pitch: 90, defaults: { area: 0.5, fov: 45, concentrator: 'none', filter: 'none', bw: 200, noise: 5, gain: 30, k: 0.02 }, props: [AREA, FOV, CONC, FILTER, BW, { key: 'gain', label: 'Avalanche gain M', type: 'num', min: 1, max: 300, log: true }, { key: 'noise', label: 'TIA input noise', type: 'num', min: 0.5, max: 50, log: true, unit: 'pA/√Hz' }], glyph: G.apd, lesson: 'photodetectors' },
  { kind: 'spad', category: 'receiver', label: 'SPAD', blurb: 'Counts single photons; blind during dead time.', mount: 'desk', pitch: 90, defaults: { area: 0.01, fov: 60, concentrator: 'none', filter: 'none', pde: 0.35, dead: 20, dcr: 1000 }, props: [AREA, FOV, CONC, FILTER, { key: 'pde', label: 'Photon detection efficiency', type: 'num', min: 0.05, max: 0.8, step: 0.01 }, { key: 'dead', label: 'Dead time', type: 'num', min: 1, max: 200, log: true, unit: 'ns' }], glyph: G.spad, lesson: 'receiver-zoo' },
  { kind: 'sipm', category: 'receiver', label: 'SiPM', blurb: 'Thousands of SPADs in parallel: huge dynamic range.', mount: 'desk', pitch: 90, defaults: { area: 9, fov: 60, concentrator: 'none', filter: 'none', pde: 0.3, dead: 30, dcr: 200000, cells: 4774 }, props: [AREA, FOV, CONC, FILTER, { key: 'pde', label: 'Photon detection efficiency', type: 'num', min: 0.05, max: 0.6, step: 0.01 }, { key: 'cells', label: 'Micro-cells', type: 'num', min: 100, max: 20000, log: true }], glyph: G.spad, lesson: 'receiver-zoo' },
  { kind: 'pmt', category: 'receiver', label: 'Photomultiplier', blurb: 'Gain 10⁶, very large area: underwater and space.', mount: 'free', pitch: 0, defaults: { area: 500, fov: 60, concentrator: 'none', filter: 'none', bw: 200, gain: 1e6, qe: 0.25 }, props: [AREA, FOV, CONC, FILTER, BW], glyph: G.pmt, lesson: 'receiver-zoo' },
  { kind: 'ingaas', category: 'receiver', label: 'InGaAs PD', blurb: 'For 1550 nm FSO; fast and eye-safe band.', mount: 'free', pitch: 0, defaults: { area: 0.1, fov: 20, concentrator: 'lens', filter: 'nir', bw: 2000, noise: 3 }, props: [AREA, FOV, CONC, FILTER, BW], glyph: G.pd },
  { kind: 'camera', category: 'receiver', label: 'Camera (CMOS)', blurb: 'Rolling-shutter image sensor: optical camera communication.', mount: 'desk', pitch: 90, defaults: { fov: 35, fps: 30, rows: 1080, rowUs: 18, filter: 'none', area: 20, concentrator: 'lens' }, props: [{ key: 'fov', label: 'Field of view (half-angle)', type: 'num', min: 5, max: 70, step: 1, unit: '°' }, { key: 'fps', label: 'Frame rate', type: 'num', min: 15, max: 1000, log: true, unit: 'fps' }, { key: 'rows', label: 'Sensor rows', type: 'num', min: 240, max: 4320, step: 10 }, { key: 'rowUs', label: 'Row readout time', type: 'num', min: 2, max: 60, step: 0.5, unit: 'µs' }], glyph: G.camera, lesson: 'camera-occ' },
  { kind: 'solar', category: 'receiver', label: 'Solar cell', blurb: 'Harvests power and receives data at once.', mount: 'desk', pitch: 90, defaults: { area: 1600, fov: 90, concentrator: 'none', filter: 'none', bw: 0.2, noise: 50 }, props: [AREA, FOV, BW], glyph: G.solar, lesson: 'receiver-zoo' },

  // ---------------- optics ----------------
  { kind: 'mirror', category: 'optic', label: 'Flat mirror', blurb: 'Specular reflector: route light around obstacles.', mount: 'free', pitch: 0, defaults: { size: 0.4, refl: 0.95 }, props: [SIZE(3), { key: 'refl', label: 'Reflectance', type: 'num', min: 0.1, max: 1, step: 0.01 }], glyph: G.mirror, lesson: 'surfaces-diffusion' },
  { kind: 'concave', category: 'optic', label: 'Concave mirror', blurb: 'Focuses (f = R/2): collect a wide beam onto a detector.', mount: 'free', pitch: 0, defaults: { size: 0.3, focal: 0.5, refl: 0.95 }, props: [SIZE(2), { key: 'focal', label: 'Focal length', type: 'num', min: 0.05, max: 5, log: true, unit: 'm' }], glyph: G.concave, lesson: 'lens-systems' },
  { kind: 'convex', category: 'optic', label: 'Convex mirror', blurb: 'Spreads reflected light: wide-angle coverage.', mount: 'free', pitch: 0, defaults: { size: 0.3, focal: 0.5, refl: 0.95 }, props: [SIZE(2), { key: 'focal', label: 'Focal length', type: 'num', min: 0.05, max: 5, log: true, unit: 'm' }], glyph: G.convex },
  { kind: 'retro', category: 'optic', label: 'Retroreflector', blurb: 'Sends light straight back to its source.', mount: 'free', pitch: 0, defaults: { size: 0.15, eff: 0.6, spread: 1 }, props: [SIZE(1), { key: 'eff', label: 'Efficiency', type: 'num', min: 0.05, max: 1, step: 0.01 }, { key: 'spread', label: 'Return spread', type: 'num', min: 0.1, max: 10, step: 0.1, unit: '°' }], glyph: G.retro, lesson: 'surfaces-diffusion' },
  { kind: 'prism', category: 'optic', label: 'Prism', blurb: 'Refracts and disperses: colours separate (WDM).', mount: 'free', pitch: 0, defaults: { size: 0.12, glass: 'sf11' }, props: [SIZE(0.5), { key: 'glass', label: 'Glass', type: 'sel', options: [{ value: 'bk7', label: 'BK7 crown (low dispersion)' }, { value: 'f2', label: 'F2 flint' }, { value: 'sf11', label: 'SF11 dense flint (high dispersion)' }] }], glyph: G.prism },
  { kind: 'lens', category: 'optic', label: 'Convex lens', blurb: 'Collimates or focuses (thin-lens model).', mount: 'free', pitch: 0, defaults: { size: 0.1, focal: 0.2 }, props: [SIZE(1), { key: 'focal', label: 'Focal length', type: 'num', min: 0.01, max: 5, log: true, unit: 'm' }], glyph: G.lens, lesson: 'lens-systems' },
  { kind: 'lensNeg', category: 'optic', label: 'Concave lens', blurb: 'Diverges: widen a laser beam.', mount: 'free', pitch: 0, defaults: { size: 0.1, focal: 0.2 }, props: [SIZE(1), { key: 'focal', label: '|Focal length|', type: 'num', min: 0.01, max: 5, log: true, unit: 'm' }], glyph: G.lensNeg },
  { kind: 'fresnel', category: 'optic', label: 'Fresnel lens', blurb: 'Large, flat, light lens for big apertures.', mount: 'free', pitch: 0, defaults: { size: 0.3, focal: 0.3, eff: 0.88 }, props: [SIZE(2), { key: 'focal', label: 'Focal length', type: 'num', min: 0.05, max: 5, log: true, unit: 'm' }], glyph: G.fresnel, lesson: 'lens-systems' },
  { kind: 'diffuser', category: 'optic', label: 'Diffuser', blurb: 'Spreads transmitted light: coverage, eye safety.', mount: 'free', pitch: 0, defaults: { size: 0.2, angle: 20, eff: 0.9 }, props: [SIZE(2), { key: 'angle', label: 'Diffusion angle', type: 'num', min: 1, max: 80, step: 1, unit: '°' }], glyph: G.diffuser, lesson: 'surfaces-diffusion' },
  { kind: 'polarizer', category: 'optic', label: 'Polarizer', blurb: 'Passes one polarisation: Malus’s law cos²θ.', mount: 'free', pitch: 0, defaults: { size: 0.1, angle: 0 }, props: [SIZE(1), { key: 'angle', label: 'Axis angle', type: 'num', min: 0, max: 180, step: 1, unit: '°' }], glyph: G.polarizer },
  { kind: 'filter', category: 'optic', label: 'Band-pass filter', blurb: 'Passes a wavelength band, blocks ambient light.', mount: 'free', pitch: 0, defaults: { size: 0.1, center: 450, width: 40, T: 0.9 }, props: [SIZE(1), { key: 'center', label: 'Centre wavelength', type: 'num', min: 350, max: 1600, step: 5, unit: 'nm' }, { key: 'width', label: 'Bandwidth (FWHM)', type: 'num', min: 2, max: 300, step: 1, unit: 'nm' }], glyph: G.filter },
  { kind: 'splitter', category: 'optic', label: 'Beam splitter', blurb: 'Splits power between two paths.', mount: 'free', pitch: 0, defaults: { size: 0.08, ratio: 0.5 }, props: [SIZE(0.5), { key: 'ratio', label: 'Reflected share', type: 'num', min: 0.05, max: 0.95, step: 0.05 }], glyph: G.splitter },
  { kind: 'ris', category: 'optic', label: 'Optical RIS', blurb: 'Reconfigurable surface: steer reflections to a target.', mount: 'wall', pitch: 0, defaults: { size: 0.6, eff: 0.8, target: '' }, props: [SIZE(3), { key: 'eff', label: 'Efficiency', type: 'num', min: 0.1, max: 1, step: 0.01 }, { key: 'target', label: 'Steer towards', type: 'target' }], glyph: G.ris, lesson: 'research-frontiers' },

  // ---------------- environment ----------------
  { kind: 'wall', category: 'environment', label: 'Wall / partition', blurb: 'Blocks and reflects light by its material.', mount: 'floor', pitch: 0, defaults: { w: 2, h: 2.4, material: 'plaster' }, props: [{ key: 'w', label: 'Width', type: 'num', min: 0.2, max: 20, step: 0.1, unit: 'm' }, { key: 'h', label: 'Height', type: 'num', min: 0.2, max: 10, step: 0.1, unit: 'm' }, { key: 'material', label: 'Material', type: 'sel', options: MATERIAL_OPTS }], glyph: G.wall, lesson: 'surfaces-diffusion' },
  { kind: 'person', category: 'environment', label: 'Person', blurb: 'A body that blocks the beam.', mount: 'floor', pitch: 0, defaults: { height: 1.75 }, props: [{ key: 'height', label: 'Height', type: 'num', min: 1, max: 2.1, step: 0.01, unit: 'm' }], glyph: G.person, lesson: 'los-nlos' },
  { kind: 'car', category: 'environment', label: 'Car', blurb: 'A vehicle body (blocks and reflects).', mount: 'floor', pitch: 0, defaults: { color: 'silver' }, props: [], glyph: G.car },
  { kind: 'box', category: 'environment', label: 'Box / furniture', blurb: 'Generic obstacle with a material.', mount: 'floor', pitch: 0, defaults: { w: 1, h: 0.75, d: 0.6, material: 'wood' }, props: [{ key: 'w', label: 'Width', type: 'num', min: 0.1, max: 10, step: 0.05, unit: 'm' }, { key: 'h', label: 'Height', type: 'num', min: 0.1, max: 5, step: 0.05, unit: 'm' }, { key: 'd', label: 'Depth', type: 'num', min: 0.1, max: 10, step: 0.05, unit: 'm' }, { key: 'material', label: 'Material', type: 'sel', options: MATERIAL_OPTS }], glyph: G.box },
];

export const catalog = (k: Kind) => CATALOG.find((c) => c.kind === k)!;
export const CATEGORY_LABEL: Record<Category, string> = { source: 'Transmitters', receiver: 'Receivers', optic: 'Optics', environment: 'Environment' };
export const isSource = (k: Kind) => catalog(k).category === 'source';
export const isReceiver = (k: Kind) => catalog(k).category === 'receiver';
export { MATERIAL_OPTS };
