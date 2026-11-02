/** Perceptual "inferno"-like colour map (dark → bright), returns [r,g,b] in 0..255. */
const STOPS: [number, number, number][] = [
  [8, 6, 30],
  [56, 14, 104],
  [120, 28, 109],
  [187, 55, 84],
  [237, 105, 37],
  [251, 180, 26],
  [252, 255, 164],
];

export function inferno(t: number): [number, number, number] {
  const x = Math.min(1, Math.max(0, t)) * (STOPS.length - 1);
  const i = Math.min(STOPS.length - 2, Math.floor(x));
  const f = x - i;
  const a = STOPS[i];
  const b = STOPS[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

export const infernoCss = (t: number) => {
  const [r, g, b] = inferno(t);
  return `rgb(${r | 0},${g | 0},${b | 0})`;
};

export function legendGradient(): string {
  return `linear-gradient(90deg, ${Array.from({ length: 7 }, (_, i) => infernoCss(i / 6)).join(',')})`;
}
