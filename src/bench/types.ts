/**
 * Optical Bench data model. Everything the bench shows or computes derives from a BenchState, which is
 * plain JSON: it can be saved, shared in a URL, undone and re-done.
 *
 * Coordinates: metres, Y up, origin at floor centre. Orientation: yaw (around Y, 0 = facing +Z) and
 * pitch (−90 = facing straight down, +90 = straight up). An object "faces" its emission / acceptance /
 * reflecting direction.
 */
export type Vec3 = [number, number, number];

export type Category = 'source' | 'receiver' | 'optic' | 'environment';

export type Kind =
  // sources
  | 'led'
  | 'rgbled'
  | 'microled'
  | 'irled'
  | 'uvled'
  | 'laser'
  | 'vcsel'
  | 'panel'
  | 'streetlamp'
  | 'headlight'
  | 'screen'
  // receivers
  | 'pin'
  | 'apd'
  | 'spad'
  | 'sipm'
  | 'pmt'
  | 'ingaas'
  | 'camera'
  | 'solar'
  // optics
  | 'mirror'
  | 'concave'
  | 'convex'
  | 'retro'
  | 'prism'
  | 'lens'
  | 'lensNeg'
  | 'fresnel'
  | 'diffuser'
  | 'polarizer'
  | 'filter'
  | 'splitter'
  | 'ris'
  // environment
  | 'wall'
  | 'person'
  | 'car'
  | 'box';

export type PropValue = number | string | boolean;

export interface BenchObject {
  id: string;
  kind: Kind;
  name: string;
  pos: Vec3;
  yaw: number;
  pitch: number;
  props: Record<string, PropValue>;
}

export type Medium = 'air' | 'fog' | 'water' | 'vacuum';
export type Ambient = 'dark' | 'night' | 'indoor' | 'window' | 'daylight' | 'underwater';

export interface Environment {
  medium: Medium;
  visibilityKm: number; // fog / haze (Kim model)
  waterType: string; // id from WATER_TYPES
  turbulence: number; // 0..1 → Cn² 1e-17 .. 1e-12 (air) or temperature-gradient strength (water)
  ambient: Ambient;
  wallMaterial: string;
  floorMaterial: string;
  ceilingMaterial: string;
}

export type Modulation =
  | 'ook'
  | 'manchester'
  | 'vppm'
  | 'ppm4'
  | 'ppm16'
  | 'pam4'
  | 'pam8'
  | 'csk4'
  | 'csk16'
  | 'cap16'
  | 'scfde'
  | 'dco'
  | 'aco'
  | 'adoofdm'
  | 'uofdm'
  | 'rsook'
  | 'ufsook';

export type Coding = 'none' | 'hamming74' | 'rs6432' | 'rs255239' | 'cc' | 'rscc' | 'ldpc12' | 'ldpc34' | 'ldpc56' | 'turbo13' | 'polar12';
export type LineCode = 'none' | 'manchester' | '4b6b' | '8b10b';
export type Equalizer = 'none' | 'zf' | 'mmse' | 'lms' | 'rls' | 'dfe' | 'volterra' | 'mlp' | 'lstm' | 'mlse' | 'onetap';
export type PreEq = 'none' | 'passive' | 'digital';
export type Sync = 'preamble' | 'pilots' | 'gardner';
export type Mac = 'p2p' | 'tdma' | 'ofdma' | 'noma' | 'csma';

export interface Chain {
  coding: Coding;
  interleaver: boolean;
  lineCode: LineCode;
  modulation: Modulation;
  qam: number; // OFDM / CAP constellation (max, with bit loading)
  bitLoading: boolean;
  symbolRateMHz: number; // 0 = auto (fastest that meets the BER target)
  preEq: PreEq;
  modIndex: number; // 0..1
  equalizer: Equalizer;
  sync: Sync;
  mac: Mac;
  mimo: boolean;
  targetBer: number; // post-FEC target
}

export interface Goals {
  targetMbps: number;
  mobility: 'static' | 'walking' | 'vehicle';
  illumination: boolean;
  budget: 'low' | 'mid' | 'high';
}

export interface BenchState {
  scenario: string;
  objects: BenchObject[];
  env: Environment;
  chain: Chain;
  goals: Goals;
  selected: string | null;
}
