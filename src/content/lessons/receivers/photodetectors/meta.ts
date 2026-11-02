import type { LessonMeta } from '@/content/types';

export const meta: LessonMeta = {
  id: 'photodetectors',
  track: 'receivers',
  order: 1,
  title: 'Photodetectors: PIN, APD, SPAD and PMT',
  subtitle: 'Four ways to turn photons back into electrons, from the humble PIN to single-photon counters.',
  level: 'core',
  minutes: 26,
  tags: ['photodiode', 'pin', 'apd', 'spad', 'pmt', 'photomultiplier', 'responsivity', 'photon counting', 'dead time'],
  prerequisites: ['noise-snr'],
  references: ['huang2024spc', 'sarbazi2020', 'kahn1997', 'ghassemlooy2019book', 'zeng2017uwoc'],
  objectives: [
    'Compute responsivity from quantum efficiency and wavelength',
    'Explain internal gain and excess noise in APDs',
    'Describe Geiger-mode operation, dead time and saturation of SPADs and SPAD arrays',
    'Choose a detector for a given range, rate and ambient-light condition',
  ],
  updated: '2026-11-02',
};
