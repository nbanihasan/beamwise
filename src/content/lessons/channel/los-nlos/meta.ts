import type { LessonMeta } from '@/content/types';

export const meta: LessonMeta = {
  id: 'los-nlos',
  track: 'channel',
  order: 1.5,
  title: 'LOS, NLOS and link geometry',
  subtitle: 'Directed, non-directed, diffuse and tracked links: the four ways to point light at a receiver, and what each costs in power, bandwidth and robustness.',
  level: 'foundation',
  minutes: 14,
  tags: ['los', 'nlos', 'diffuse', 'directed', 'non-directed', 'tracked', 'blockage', 'shadowing', 'beam steering'],
  prerequisites: ['lambertian-channel'],
  references: ['kahn1997', 'gfeller1979', 'barry1993', 'haas2016lifi', 'aboagye2023ris'],
  objectives: [
    'Classify a link by the directionality of its transmitter and receiver and by the presence of a line of sight',
    'Explain why diffuse links survive blockage but are slow, and directed links are fast but fragile',
    'Read the effect of a blocker in the impulse response',
    'Name the techniques that recover from blockage (cell overlap, angle diversity, RIS, hybrid RF)',
  ],
  updated: '2026-11-02',
};
