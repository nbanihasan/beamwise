import { wavelengthToHex } from '@/sim/color';
import { trackById } from '@/content/tracks';

/** Colour of a track = colour of its wavelength (infrared shown as a deep rose, since it is invisible). */
export function colorForWavelength(nm: number): string {
  if (nm > 780) return '#c2456e';
  if (nm < 440) return '#9a7bff'; // deep violet is too dark to read as text; lift it
  return wavelengthToHex(nm);
}

export function trackColor(trackId: string): string {
  const t = trackById(trackId);
  return t ? colorForWavelength(t.wavelength) : '#888';
}
