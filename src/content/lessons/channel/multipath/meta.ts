import type { LessonMeta } from '@/content/types';

export const meta: LessonMeta = {
  id: 'multipath',
  track: 'channel',
  order: 2,
  title: 'Multipath, delay spread and bandwidth',
  subtitle: 'Reflections off walls arrive late. See the impulse response form in 3D and learn when it limits your data rate.',
  level: 'core',
  minutes: 20,
  tags: ['multipath', 'diffuse', 'impulse response', 'delay spread', 'isi', 'reflections'],
  prerequisites: ['lambertian-channel'],
  references: ['barry1993', 'lee2011multipath', 'kahn1997', 'ghassemlooy2019book'],
  objectives: [
    'Compute the first-order reflection contribution from a wall element',
    'Define mean delay and RMS delay spread from an impulse response',
    'Relate delay spread to channel bandwidth and maximum ISI-free symbol rate',
    'Explain the difference between LOS, diffuse and non-directed links',
  ],
  updated: '2026-11-02',
};
