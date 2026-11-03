import type { LessonMeta } from '@/content/types';

export const meta: LessonMeta = {
  id: 'optical-components',
  track: 'receivers',
  order: 2.7,
  title: 'Optical components: splitters, polarizers, wave plates and isolators',
  subtitle: 'The passive parts on every optical bench, what each does to power and polarization, and where they turn up in optical wireless systems.',
  level: 'core',
  minutes: 20,
  tags: ['beam splitter', 'pbs', 'dichroic', 'polarizer', 'malus', 'wave plate', 'half-wave', 'quarter-wave', 'faraday', 'isolator', 'circulator', 'stokes', 'mueller', 'filter'],
  prerequisites: ['optics-frontend'],
  references: ['ghassemlooy2019book', 'chan2017poli', 'bennett1984', 'chun2016wdm'],
  objectives: [
    'Apply Malus’s law and predict the three-polarizer result',
    'Use half- and quarter-wave plates to rotate and convert polarization',
    'Distinguish non-polarizing, polarizing and dichroic beam splitters',
    'Explain how a Faraday isolator protects a laser',
    'Describe polarization with Stokes vectors and Mueller matrices',
  ],
  updated: '2026-11-03',
};
