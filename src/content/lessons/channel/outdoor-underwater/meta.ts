import type { LessonMeta } from '@/content/types';

export const meta: LessonMeta = {
  id: 'outdoor-underwater',
  track: 'channel',
  order: 4,
  title: 'Outdoors and underwater: FSO and UWOC channels',
  subtitle: 'Fog, turbulence, pointing and sea water: the channels of long-range laser links and underwater light.',
  level: 'advanced',
  minutes: 24,
  tags: ['fso', 'turbulence', 'scintillation', 'gamma-gamma', 'fog', 'uwoc', 'underwater', 'beer-lambert'],
  prerequisites: ['noise-snr'],
  references: ['khalighi2014fso', 'andrews2005book', 'alhabash2001', 'kim2001', 'zeng2017uwoc', 'uysal2016book'],
  objectives: [
    'Separate deterministic attenuation (weather) from random fading (turbulence)',
    'Compute the Rytov variance and choose a log-normal or gamma-gamma model',
    'Estimate outage probability from the irradiance distribution',
    'Explain the blue-green window and Beer–Lambert loss in sea water',
  ],
  updated: '2026-11-02',
};
