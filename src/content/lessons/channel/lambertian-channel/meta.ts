import type { LessonMeta } from '@/content/types';

export const meta: LessonMeta = {
  id: 'lambertian-channel',
  track: 'channel',
  order: 1,
  title: 'The Lambertian line-of-sight channel',
  subtitle: 'Derive H(0) from geometry, light up a 3D room, and see how beam width and field of view trade coverage for power.',
  level: 'core',
  minutes: 25,
  tags: ['channel', 'lambertian', 'los', 'fov', 'concentrator', 'path loss', 'coverage', 'komine'],
  prerequisites: ['im-dd'],
  references: ['kahn1997', 'komine2004', 'ghassemlooy2019book', 'soltani2019orientation'],
  objectives: [
    'Derive the Lambertian radiant intensity and compute the order m from the semi-angle',
    'Compute the LOS DC gain H(0) including optical filter and concentrator gains',
    'Predict how semi-angle, FOV and height change coverage and uniformity',
    'Explain why receiver orientation matters so much for mobile users',
  ],
  updated: '2026-11-02',
};
