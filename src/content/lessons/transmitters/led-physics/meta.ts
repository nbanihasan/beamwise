import type { LessonMeta } from '@/content/types';

export const meta: LessonMeta = {
  id: 'led-physics',
  track: 'transmitters',
  order: 1,
  title: 'LEDs: how light is made',
  subtitle: 'Junctions, bandgaps, phosphors and micro-LEDs, and the two LED properties that limit every link: non-linearity and bandwidth.',
  level: 'foundation',
  minutes: 22,
  tags: ['led', 'micro-led', 'phosphor', 'bandwidth', 'non-linearity', 'semiconductor', 'rgb'],
  prerequisites: ['im-dd'],
  references: ['karunatilaka2015', 'tsonev2014', 'islim2017', 'bian2019', 'ghassemlooy2017vlcbook', 'ieee1789'],
  objectives: [
    'Explain radiative recombination and relate emission wavelength to bandgap',
    'Compare phosphor-converted white, RGB and micro-LEDs for communication',
    'Read an L–I curve and choose a bias point and swing',
    'Estimate an LED’s modulation bandwidth and the data rate it allows',
  ],
  updated: '2026-11-02',
};
