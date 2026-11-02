/**
 * Colour science for VLC: CIE 1931 chromaticity, colour-shift keying (CSK) constellations,
 * and an approximate wavelength -> sRGB mapping for visuals.
 */

/** CIE 1931 2° spectral locus (x, y), selected wavelengths in nm. */
export const SPECTRAL_LOCUS: [number, number, number][] = [
  [380, 0.1741, 0.005], [420, 0.1714, 0.0051], [440, 0.1644, 0.0109], [450, 0.1566, 0.0177], [460, 0.144, 0.0297],
  [470, 0.1241, 0.0578], [475, 0.1096, 0.0868], [480, 0.0913, 0.1327], [485, 0.0687, 0.2007], [490, 0.0454, 0.295],
  [495, 0.0235, 0.4127], [500, 0.0082, 0.5384], [505, 0.0039, 0.6548], [510, 0.0139, 0.7502], [515, 0.0389, 0.812],
  [520, 0.0743, 0.8338], [525, 0.1142, 0.8262], [530, 0.1547, 0.8059], [540, 0.2296, 0.7543], [550, 0.3016, 0.6923],
  [560, 0.3731, 0.6245], [570, 0.4441, 0.5547], [580, 0.5125, 0.4866], [590, 0.5752, 0.4242], [600, 0.627, 0.3725],
  [610, 0.6658, 0.334], [620, 0.6915, 0.3083], [630, 0.7079, 0.292], [640, 0.719, 0.2809], [660, 0.73, 0.27], [700, 0.7347, 0.2653],
];

export function locusPoint(nm: number): [number, number] {
  const L = SPECTRAL_LOCUS;
  if (nm <= L[0][0]) return [L[0][1], L[0][2]];
  for (let i = 1; i < L.length; i++) {
    if (nm <= L[i][0]) {
      const t = (nm - L[i - 1][0]) / (L[i][0] - L[i - 1][0]);
      return [L[i - 1][1] + t * (L[i][1] - L[i - 1][1]), L[i - 1][2] + t * (L[i][2] - L[i - 1][2])];
    }
  }
  const last = L[L.length - 1];
  return [last[1], last[2]];
}

/**
 * CSK constellation inside the triangle spanned by three LED colours (chromaticity points).
 * 4-CSK: the three vertices plus the centroid. 8/16-CSK: barycentric lattice points.
 */
export function cskConstellation(M: 4 | 8 | 16, vertices: [number, number][]): [number, number][] {
  const [A, B, C] = vertices;
  const bary = (a: number, b: number, c: number): [number, number] => [a * A[0] + b * B[0] + c * C[0], a * A[1] + b * B[1] + c * C[1]];
  if (M === 4) return [A, B, C, bary(1 / 3, 1 / 3, 1 / 3)];
  const steps = M === 8 ? 3 : 5;
  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) for (let j = 0; j <= steps - i; j++) pts.push(bary(i / steps, j / steps, (steps - i - j) / steps));
  // pick M points spread over the triangle (lattice has 10 / 21 points)
  const step = pts.length / M;
  return Array.from({ length: M }, (_, k) => pts[Math.floor(k * step)]);
}

/** Barycentric weights (LED drive ratios) that reproduce chromaticity p inside triangle ABC. */
export function cskWeights(p: [number, number], tri: [number, number][]): [number, number, number] {
  const [A, B, C] = tri;
  const det = (B[1] - C[1]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[1] - C[1]);
  const a = ((B[1] - C[1]) * (p[0] - C[0]) + (C[0] - B[0]) * (p[1] - C[1])) / det;
  const b = ((C[1] - A[1]) * (p[0] - C[0]) + (A[0] - C[0]) * (p[1] - C[1])) / det;
  return [a, b, 1 - a - b];
}

/** Approximate visible wavelength (380–780 nm) to sRGB hex, for drawing only. */
export function wavelengthToHex(nm: number): string {
  let r = 0;
  let g = 0;
  let b = 0;
  if (nm >= 380 && nm < 440) [r, g, b] = [-(nm - 440) / 60, 0, 1];
  else if (nm < 490) [r, g, b] = [0, (nm - 440) / 50, 1];
  else if (nm < 510) [r, g, b] = [0, 1, -(nm - 510) / 20];
  else if (nm < 580) [r, g, b] = [(nm - 510) / 70, 1, 0];
  else if (nm < 645) [r, g, b] = [1, -(nm - 645) / 65, 0];
  else if (nm <= 780) [r, g, b] = [1, 0, 0];
  let f = 1;
  if (nm < 420) f = 0.3 + (0.7 * (nm - 380)) / 40;
  else if (nm > 700) f = 0.3 + (0.7 * (780 - nm)) / 80;
  const to = (c: number) => Math.round(255 * Math.pow(Math.max(0, c * f), 0.8)).toString(16).padStart(2, '0');
  if (nm < 380 || nm > 780) return nm < 380 ? '#7a5cff' : '#8a1a2a';
  return `#${to(r)}${to(g)}${to(b)}`;
}
