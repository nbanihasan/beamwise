import type { BenchObject, Chain, Environment, Goals, Vec3 } from './types';
import { catalog } from './catalog';

/**
 * Scenario presets: the starting point of every bench session. A scenario fixes the environment
 * (room or open space, medium, ambient light, surfaces) and seeds a few objects; the user then adds,
 * moves and configures components. Each one has a "challenge" so students have a goal.
 */
export interface Scenario {
  id: string;
  name: string;
  short: string;
  blurb: string;
  challenge: string;
  kind: 'indoor' | 'outdoor' | 'underwater' | 'space' | 'lab';
  room?: { L: number; W: number; H: number }; // indoor: walls at ±L/2, ±W/2, ceiling at H
  bounds: { min: Vec3; max: Vec3 };
  /** heights used when spawning objects by mount type */
  heights: { ceiling: number; desk: number; free: number; pole: number };
  /** visual size multiplier for very large scenes (models only, not physics) */
  visualScale: number;
  snap: number;
  env: Environment;
  chain?: Partial<Chain>;
  goals?: Partial<Goals>;
  objects: BenchObject[];
  camera: { pos: Vec3; target: Vec3; near: number; far: number };
}

export const DEFAULT_ENV: Environment = {
  medium: 'air',
  visibilityKm: 20,
  waterType: 'clear',
  turbulence: 0.2,
  ambient: 'indoor',
  wallMaterial: 'plaster',
  floorMaterial: 'carpet',
  ceilingMaterial: 'plaster',
};

export const DEFAULT_CHAIN: Chain = {
  coding: 'ldpc12',
  interleaver: true,
  lineCode: 'none',
  modulation: 'dco',
  qam: 64,
  bitLoading: true,
  symbolRateMHz: 0,
  preEq: 'none',
  modIndex: 0.6,
  equalizer: 'onetap',
  sync: 'pilots',
  mac: 'ofdma',
  mimo: false,
  targetBer: 1e-6,
};

export const DEFAULT_GOALS: Goals = { targetMbps: 100, mobility: 'walking', illumination: true, budget: 'mid' };

let seq = 0;
export function makeObject(kind: BenchObject['kind'], pos: Vec3, over: Partial<Omit<BenchObject, 'props'>> & { props?: BenchObject['props'] } = {}): BenchObject {
  const c = catalog(kind);
  seq++;
  return {
    id: over.id ?? `${kind}-${Date.now().toString(36)}-${seq}`,
    kind,
    name: over.name ?? c.label,
    pos,
    yaw: over.yaw ?? 0,
    pitch: over.pitch ?? c.pitch,
    props: { ...c.defaults, ...(over.props ?? {}) },
  };
}

const o = (id: string, kind: BenchObject['kind'], pos: Vec3, extra: Partial<Omit<BenchObject, 'props'>> & { props?: BenchObject['props'] } = {}) => makeObject(kind, pos, { id, ...extra });

export const SCENARIOS: Scenario[] = [
  {
    id: 'office',
    name: 'LiFi office',
    short: 'Office',
    blurb: 'A 6 × 5 × 3 m office lit by four LiFi luminaires. Plaster walls, carpet, normal office lighting.',
    challenge: 'Deliver 100 Mb/s to both desks while the lights still look like lights. Then make the link survive the person standing up.',
    kind: 'indoor',
    room: { L: 6, W: 5, H: 3 },
    bounds: { min: [-3, 0, -2.5], max: [3, 3, 2.5] },
    heights: { ceiling: 2.95, desk: 0.8, free: 1.2, pole: 2.95 },
    visualScale: 1,
    snap: 0.1,
    env: { ...DEFAULT_ENV },
    objects: [
      o('ap1', 'panel', [-1.5, 2.95, -1.2], { name: 'AP 1' }),
      o('ap2', 'panel', [1.5, 2.95, -1.2], { name: 'AP 2' }),
      o('ap3', 'panel', [-1.5, 2.95, 1.2], { name: 'AP 3' }),
      o('ap4', 'panel', [1.5, 2.95, 1.2], { name: 'AP 4' }),
      o('desk1', 'box', [-1.4, 0, -0.9], { name: 'Desk', props: { w: 1.4, h: 0.75, d: 0.7, material: 'wood' } }),
      o('desk2', 'box', [1.6, 0, 1.0], { name: 'Desk', props: { w: 1.4, h: 0.75, d: 0.7, material: 'wood' } }),
      o('rx1', 'pin', [-1.3, 0.8, -0.9], { name: 'Laptop PD', props: { concentrator: 'hemi' } }),
      o('rx2', 'apd', [1.7, 0.8, 1.0], { name: 'Phone APD', props: { fov: 50 } }),
      o('person', 'person', [0.2, 0, -0.4], { name: 'Colleague' }),
    ],
    camera: { pos: [4.6, 4.3, 5.6], target: [0, 0.9, 0], near: 0.02, far: 200 },
  },
  {
    id: 'corridor',
    name: 'Around the corner (NLOS)',
    short: 'Corridor',
    blurb: 'Two corridors joined at the far end. The transmitter cannot see the receiver.',
    challenge: 'There is no line of sight. Route the beam around the partition with a mirror or a RIS at the far end, or rely on diffuse reflections. Tip: select the receiver and press “Find a bounce point”.',
    kind: 'indoor',
    room: { L: 8, W: 6, H: 2.8 },
    bounds: { min: [-4, 0, -3], max: [4, 2.8, 3] },
    heights: { ceiling: 2.75, desk: 1.0, free: 1.4, pole: 2.75 },
    visualScale: 1,
    snap: 0.1,
    env: { ...DEFAULT_ENV, wallMaterial: 'concrete', floorMaterial: 'concrete', ambient: 'dark' },
    chain: { modulation: 'ook', coding: 'rs6432', lineCode: 'manchester', equalizer: 'none', mac: 'p2p', qam: 4, bitLoading: false, sync: 'preamble' },
    goals: { targetMbps: 10, illumination: false, mobility: 'static' },
    objects: [
      o('w1', 'wall', [0.5, 0, 0.3], { name: 'Partition', yaw: 0, props: { w: 7, h: 2.8, material: 'concrete' } }),
      o('tx', 'irled', [3.5, 1.4, -1.5], { name: 'IR transmitter', yaw: -90, pitch: 0, props: { power: 0.3, semi: 15 } }),
      o('rx', 'apd', [3.5, 1.2, 1.8], { name: 'Receiver', yaw: -90, pitch: 0, props: { fov: 30, filter: 'ir' } }),
    ],
    camera: { pos: [0.5, 9.5, 8.5], target: [0, 0.8, 0], near: 0.02, far: 200 },
  },
  {
    id: 'bench',
    name: 'Optical table',
    short: 'Optics lab',
    blurb: 'A dark lab with a 2.4 × 1.2 m optical table. Ideal for lenses, mirrors, prisms and polarizers.',
    challenge: 'Collimate the laser, fold it twice with mirrors onto the photodiode, then split it with the prism and see the colours separate.',
    kind: 'lab',
    room: { L: 5, W: 4, H: 2.8 },
    bounds: { min: [-1.2, 0.9, -0.6], max: [1.2, 1.5, 0.6] },
    heights: { ceiling: 2.75, desk: 1.0, free: 1.05, pole: 2.75 },
    visualScale: 1,
    snap: 0.025,
    env: { ...DEFAULT_ENV, ambient: 'dark', wallMaterial: 'black', floorMaterial: 'black', ceilingMaterial: 'black' },
    chain: { modulation: 'ook', coding: 'none', lineCode: 'none', equalizer: 'none', mac: 'p2p', qam: 4, bitLoading: false, sync: 'preamble' },
    goals: { targetMbps: 500, illumination: false, mobility: 'static' },
    objects: [
      o('table', 'box', [0, 0, 0], { name: 'Optical table', props: { w: 2.4, h: 0.95, d: 1.2, material: 'black' } }),
      o('laser', 'laser', [-1.05, 1.05, -0.3], { name: 'Laser', yaw: 90, pitch: 0, props: { power: 0.005, div: 8, spectrum: 'green' } }),
      o('lens', 'lens', [-0.75, 1.05, -0.3], { name: 'Collimating lens', yaw: 90, props: { focal: 0.15, size: 0.05 } }),
      o('m1', 'mirror', [0.4, 1.05, -0.3], { name: 'Mirror 1', yaw: -45, props: { size: 0.08 } }),
      o('pd', 'pin', [0.4, 1.05, 0.45], { name: 'Photodiode', yaw: 180, pitch: 0, props: { area: 1, fov: 30 } }),
    ],
    camera: { pos: [1.6, 2.3, 2.1], target: [0, 1.0, 0], near: 0.01, far: 100 },
  },
  {
    id: 'screen',
    name: 'Screen to camera',
    short: 'Screen → camera',
    blurb: 'A monitor shows coded frames; a phone camera reads them. Optical camera communication.',
    challenge: 'Find how the camera frame rate, distance and block size limit the data rate. Then try a rolling-shutter LED link instead.',
    kind: 'indoor',
    room: { L: 4, W: 4, H: 2.8 },
    bounds: { min: [-2, 0, -2], max: [2, 2.8, 2] },
    heights: { ceiling: 2.75, desk: 0.95, free: 1.1, pole: 2.75 },
    visualScale: 1,
    snap: 0.05,
    env: { ...DEFAULT_ENV, ambient: 'window' },
    chain: { modulation: 'ufsook', coding: 'rs6432', lineCode: 'none', equalizer: 'none', mac: 'p2p', qam: 4, bitLoading: false, sync: 'preamble' },
    goals: { targetMbps: 0.1, illumination: false, mobility: 'walking' },
    objects: [
      o('desk', 'box', [0, 0, -0.9], { name: 'Desk', props: { w: 1.6, h: 0.75, d: 0.8, material: 'wood' } }),
      o('scr', 'screen', [0, 1.15, -1.15], { name: 'Monitor', props: { w: 0.6 } }),
      o('cam', 'camera', [0.05, 1.1, 0.2], { name: 'Phone camera', yaw: 180, pitch: 0 }),
    ],
    camera: { pos: [2.6, 2.2, 2.4], target: [0, 1.0, -0.4], near: 0.01, far: 100 },
  },
  {
    id: 'street',
    name: 'Street (V2X)',
    short: 'Street',
    blurb: 'A road at dusk with street lamps and two cars. Vehicle-to-vehicle and infrastructure-to-vehicle light links.',
    challenge: 'Reach the following car from the leading car’s tail light at 20 m in daylight. Watch what the sun does to your receiver, then fight back with optics.',
    kind: 'outdoor',
    bounds: { min: [-8, 0, -30], max: [8, 8, 30] },
    heights: { ceiling: 6, desk: 0.8, free: 0.8, pole: 6 },
    visualScale: 1,
    snap: 0.25,
    env: { ...DEFAULT_ENV, ambient: 'daylight', visibilityKm: 10, floorMaterial: 'concrete' },
    chain: { modulation: 'ook', coding: 'rscc', lineCode: 'manchester', equalizer: 'dfe', mac: 'csma', qam: 4, bitLoading: false, sync: 'preamble' },
    goals: { targetMbps: 1, illumination: true, mobility: 'vehicle' },
    objects: [
      o('lamp1', 'streetlamp', [-4.6, 6, -8], { name: 'Street lamp' }),
      o('lamp2', 'streetlamp', [-4.6, 6, 10], { name: 'Street lamp' }),
      o('car1', 'car', [1.8, 0, 6], { name: 'Leading car' }),
      o('tail', 'headlight', [1.8, 0.75, 3.75], { name: 'Tail light', yaw: 180, props: { spectrum: 'red', power: 0.5, semi: 20 } }),
      o('car2', 'car', [1.8, 0, -16], { name: 'Following car' }),
      o('rx', 'pin', [1.8, 0.8, -13.7], { name: 'Front PD', yaw: 0, pitch: 0, props: { fov: 20, area: 10, concentrator: 'lens' } }),
    ],
    camera: { pos: [14, 9, -22], target: [0, 1, -4], near: 0.05, far: 600 },
  },
  {
    id: 'fso',
    name: 'Building to building (FSO)',
    short: 'FSO',
    blurb: 'Two rooftop terminals 400 m apart. Clear air, haze or fog; daytime turbulence.',
    challenge: 'Carry 1 Gb/s across 400 m. Then drop the visibility to 500 m (fog) and find out what still works.',
    kind: 'outdoor',
    bounds: { min: [-250, 0, -60], max: [250, 80, 60] },
    heights: { ceiling: 30, desk: 30, free: 30, pole: 30 },
    visualScale: 10,
    snap: 1,
    env: { ...DEFAULT_ENV, ambient: 'daylight', visibilityKm: 10, turbulence: 0.5 },
    chain: { modulation: 'ook', coding: 'ldpc34', lineCode: 'none', equalizer: 'lms', mac: 'p2p', qam: 4, bitLoading: false, sync: 'gardner' },
    goals: { targetMbps: 1000, illumination: false, mobility: 'static' },
    objects: [
      o('tx', 'laser', [-200, 30, 0], { name: 'Laser terminal', yaw: 90, pitch: 0, props: { power: 0.05, div: 1, spectrum: 'nir1550', bw: 5000 } }),
      o('rx', 'ingaas', [200, 30, 0], { name: 'Receiver telescope', yaw: -90, pitch: 0, props: { area: 0.2, concentrator: 'lens', fov: 0.5 } }),
    ],
    camera: { pos: [120, 120, 320], target: [0, 25, 0], near: 0.5, far: 5000 },
  },
  {
    id: 'underwater',
    name: 'Underwater',
    short: 'Underwater',
    blurb: 'A 40 m stretch of sea. A sensor node on the seabed talks to an AUV with a blue-green beam.',
    challenge: 'Get 10 Mb/s to the AUV 25 m away in coastal water. Which colour, detector and beam width win?',
    kind: 'underwater',
    bounds: { min: [-20, 0, -8], max: [20, 15, 8] },
    heights: { ceiling: 14, desk: 1, free: 4, pole: 14 },
    visualScale: 1,
    snap: 0.25,
    env: { ...DEFAULT_ENV, medium: 'water', waterType: 'coastal', ambient: 'underwater', turbulence: 0.2 },
    chain: { modulation: 'ook', coding: 'ldpc12', lineCode: 'none', equalizer: 'dfe', mac: 'p2p', qam: 4, bitLoading: false, sync: 'preamble' },
    goals: { targetMbps: 10, illumination: false, mobility: 'walking' },
    objects: [
      o('node', 'laser', [-12, 1, 0], { name: 'Seabed node', yaw: 90, pitch: 8, props: { power: 0.5, div: 60, spectrum: 'blue' } }),
      o('auv', 'pmt', [13, 4.5, 0], { name: 'AUV receiver', yaw: -90, pitch: -8, props: { area: 500, fov: 30 } }),
    ],
    camera: { pos: [4, 12, 30], target: [0, 3, 0], near: 0.05, far: 800 },
  },
  {
    id: 'space',
    name: 'Satellite to satellite',
    short: 'Space',
    blurb: 'Two satellites 2,000 km apart. No atmosphere: just divergence, pointing and photons.',
    challenge: 'Close a 10 Gb/s link over 2,000 km. How narrow must the beam be, and how big the telescope?',
    kind: 'space',
    bounds: { min: [-1.2e6, -2e5, -2e5], max: [1.2e6, 2e5, 2e5] },
    heights: { ceiling: 0, desk: 0, free: 0, pole: 0 },
    visualScale: 30000,
    snap: 1000,
    env: { ...DEFAULT_ENV, medium: 'vacuum', ambient: 'dark', turbulence: 0 },
    chain: { modulation: 'ook', coding: 'ldpc56', lineCode: 'none', equalizer: 'lms', mac: 'p2p', qam: 4, bitLoading: false, sync: 'gardner' },
    goals: { targetMbps: 10000, illumination: false, mobility: 'static' },
    objects: [
      o('sat1', 'laser', [-1e6, 0, 0], { name: 'Satellite A terminal', yaw: 90, pitch: 0, props: { power: 2, div: 0.02, spectrum: 'nir1550', bw: 20000 } }),
      o('sat2', 'ingaas', [1e6, 0, 0], { name: 'Satellite B telescope', yaw: -90, pitch: 0, props: { area: 0.5, fov: 0.5, concentrator: 'lens', filter: 'nir', bw: 20000 } }),
    ],
    camera: { pos: [0, 6e5, 1.6e6], target: [0, 0, 0], near: 100, far: 1e8 },
  },
  {
    id: 'sandbox',
    name: 'Empty room',
    short: 'Sandbox',
    blurb: 'An empty 5 × 5 × 3 m room. Build anything.',
    challenge: 'Your rules. Try a diffuse IR link off the ceiling, or a two-LED, two-PD MIMO link.',
    kind: 'indoor',
    room: { L: 5, W: 5, H: 3 },
    bounds: { min: [-2.5, 0, -2.5], max: [2.5, 3, 2.5] },
    heights: { ceiling: 2.95, desk: 0.85, free: 1.2, pole: 2.95 },
    visualScale: 1,
    snap: 0.1,
    env: { ...DEFAULT_ENV },
    objects: [],
    camera: { pos: [5.5, 5, 6.5], target: [0, 1, 0], near: 0.02, far: 200 },
  },
];

export const scenarioById = (id: string) => SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0];
