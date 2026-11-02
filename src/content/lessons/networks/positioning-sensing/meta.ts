import type { LessonMeta } from '@/content/types';

export const meta: LessonMeta = {
  id: 'positioning-sensing',
  track: 'networks',
  order: 2,
  title: 'Visible light positioning and sensing',
  subtitle: 'The same lights that carry data can tell a device where it is, to centimetres, and sense the room.',
  level: 'advanced',
  minutes: 20,
  tags: ['positioning', 'vlp', 'rss', 'trilateration', 'aoa', 'camera', 'sensing', 'isac'],
  prerequisites: ['lambertian-channel', 'camera-occ'],
  references: ['zhuang2018vlp', 'saeed2019occ', 'pathak2015survey', 'celik2023iot'],
  objectives: [
    'Invert the Lambertian model to estimate distance from received power',
    'Solve 2D trilateration by linear least squares',
    'Explain error sources: noise, tilt, model mismatch and geometry',
    'Compare RSS, AoA and camera-based positioning',
  ],
  updated: '2026-11-02',
};
