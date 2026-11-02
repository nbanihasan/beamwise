/**
 * Visible light positioning (VLP) by received signal strength and trilateration.
 * References: Zhuang et al., IEEE COMST 2018; Do & Yoo, Sensors 2016.
 */
import { solve } from './math';

/**
 * Invert the Lambertian LOS model for an upward-facing receiver directly below the ceiling plane:
 * Pr = Pt (m+1) A h^{m+1} Ts g / (2π d^{m+3})  ->  d.
 */
export function rssToDistance(Pr: number, Pt: number, m: number, A: number, h: number, gain = 1): number {
  return Math.pow((Pt * (m + 1) * A * Math.pow(h, m + 1) * gain) / (2 * Math.PI * Pr), 1 / (m + 3));
}

/** Linear least-squares trilateration in 2D from anchors (x,y) and horizontal ranges r. */
export function trilaterate(anchors: [number, number][], r: number[]): [number, number] {
  const [x1, y1] = anchors[0];
  const rows: number[][] = [];
  const rhs: number[] = [];
  for (let i = 1; i < anchors.length; i++) {
    const [xi, yi] = anchors[i];
    rows.push([2 * (xi - x1), 2 * (yi - y1)]);
    rhs.push(r[0] ** 2 - r[i] ** 2 + xi ** 2 - x1 ** 2 + yi ** 2 - y1 ** 2);
  }
  // normal equations (AᵀA) p = Aᵀb
  const AtA = [
    [0, 0],
    [0, 0],
  ];
  const Atb = [0, 0];
  rows.forEach((row, i) => {
    for (let a = 0; a < 2; a++) {
      Atb[a] += row[a] * rhs[i];
      for (let b = 0; b < 2; b++) AtA[a][b] += row[a] * row[b];
    }
  });
  const p = solve(AtA, Atb);
  return [p[0], p[1]];
}
