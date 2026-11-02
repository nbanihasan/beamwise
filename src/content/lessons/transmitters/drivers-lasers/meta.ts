import type { LessonMeta } from '@/content/types';

export const meta: LessonMeta = {
  id: 'drivers-lasers',
  track: 'transmitters',
  order: 2,
  title: 'Drivers, pre-emphasis and laser sources',
  subtitle: 'The electronics between the DAC and the photons, and when a laser diode or VCSEL beats an LED.',
  level: 'core',
  minutes: 18,
  tags: ['driver', 'bias-tee', 'pre-emphasis', 'pre-equalisation', 'laser', 'vcsel', 'eye safety'],
  prerequisites: ['led-physics'],
  references: ['karunatilaka2015', 'ghassemlooy2019book', 'chi2020_6g', 'ieee8021513', 'khalighi2014fso'],
  objectives: [
    'Sketch a bias-tee LED driver and explain each component',
    'Explain how analogue pre-emphasis extends the usable bandwidth and what it costs',
    'Compare LEDs, laser diodes and VCSELs as OWC sources',
    'State why eye safety limits laser power differently from LED power',
  ],
  updated: '2026-11-02',
};
