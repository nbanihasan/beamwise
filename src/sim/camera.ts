/**
 * Optical camera communication (OCC): rolling-shutter image formation.
 * Each sensor row starts exposing t_row later than the previous one, so a flickering LED
 * paints bright/dark stripes. Stripe width (rows) = 1 / (f · t_row).
 * References: Danakis et al., IEEE GLOBECOM Wkshps 2012; IEEE 802.15.7-2018 (OCC PHY IV–VI);
 * Saeed et al., Physical Communication 2019; Cahyadi et al., Electronics 2020.
 */

export interface RollingShutterParams {
  rows: number; // sensor rows
  rowTimeUs: number; // row readout time t_row [µs]
  exposureUs: number; // exposure per row [µs]
  frameRate: number; // frames per second
}

/** Integrate an LED intensity function over each row's exposure window. */
export function rollingShutterRows(
  led: (tSeconds: number) => number,
  p: RollingShutterParams,
  frameIndex = 0,
  samplesPerRow = 8,
): Float64Array {
  const out = new Float64Array(p.rows);
  const t0 = frameIndex / p.frameRate;
  const tr = p.rowTimeUs * 1e-6;
  const te = Math.max(1e-7, p.exposureUs * 1e-6);
  for (let r = 0; r < p.rows; r++) {
    const start = t0 + r * tr;
    let s = 0;
    for (let k = 0; k < samplesPerRow; k++) s += led(start + ((k + 0.5) / samplesPerRow) * te);
    out[r] = s / samplesPerRow;
  }
  return out;
}

/** Square-wave / OOK LED intensity at bit rate Rb from a bit array (cycled). */
export function ookLed(bits: ArrayLike<number>, bitRate: number): (t: number) => number {
  return (t) => bits[Math.floor(t * bitRate) % bits.length] ? 1 : 0;
}

export const stripeWidthRows = (fHz: number, rowTimeUs: number) => 1 / (fHz * rowTimeUs * 1e-6);

/** Fraction of each frame lost while the sensor is not reading rows (inter-frame gap). */
export function frameGapFraction(p: RollingShutterParams): number {
  const active = p.rows * p.rowTimeUs * 1e-6;
  return Math.max(0, 1 - active * p.frameRate);
}

/** Rows-per-frame data rate upper bound for rolling-shutter OOK: one bit per stripe. */
export const rollingShutterRate = (p: RollingShutterParams, rowsPerBit: number) => (p.rows / rowsPerBit) * p.frameRate;
