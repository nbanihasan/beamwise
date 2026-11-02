import type { TrackDef } from './types';

/**
 * The curriculum is a path through the spectrum: each track is tagged with a wavelength,
 * from violet (first principles) to infrared (research frontier).
 * Add a track here, then create src/content/lessons/<track-id>/<lesson-id>/.
 */
export const TRACKS: TrackDef[] = [
  { id: 'foundations', order: 0, wavelength: 410, title: 'Foundations', blurb: 'What optical wireless is, why it matters, and the one rule that shapes everything: intensity modulation with direct detection.' },
  { id: 'transmitters', order: 1, wavelength: 450, title: 'Transmitters', blurb: 'LEDs, micro-LEDs, lasers and the driver electronics that turn bits into photons.' },
  { id: 'channel', order: 2, wavelength: 495, title: 'The Channel', blurb: 'Lambertian geometry, multipath, noise, turbulence and water: everything that happens between emitter and detector.' },
  { id: 'receivers', order: 3, wavelength: 530, title: 'Receivers', blurb: 'Photodiodes, APDs, SPADs, photomultipliers, optics and cameras: how light becomes current again.' },
  { id: 'modulation', order: 4, wavelength: 575, title: 'Modulation & Coding', blurb: 'OOK, PPM, PAM, optical OFDM, colour-shift keying and MIMO: the alphabets we write in light.' },
  { id: 'processing', order: 5, wavelength: 605, title: 'Receiver DSP', blurb: 'Synchronisation, equalisation, detection and error correction: recovering the bits.' },
  { id: 'networks', order: 6, wavelength: 640, title: 'Systems & Networks', blurb: 'LiFi attocells, handover, multiple access, positioning and the standards that tie it together.' },
  { id: 'frontiers', order: 7, wavelength: 850, title: 'Research Frontiers', blurb: 'Gigabit micro-LEDs, optical RIS, single-photon receivers, sensing and 6G.' },
];

export const trackById = (id: string) => TRACKS.find((t) => t.id === id);
