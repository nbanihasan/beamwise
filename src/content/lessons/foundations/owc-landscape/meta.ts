import type { LessonMeta } from '@/content/types';

export const meta: LessonMeta = {
  id: 'owc-landscape',
  track: 'foundations',
  order: 1,
  title: 'The optical wireless landscape',
  subtitle: 'VLC, LiFi, camera links, free-space optics and underwater light: what they are and why they exist.',
  level: 'foundation',
  minutes: 14,
  tags: ['overview', 'vlc', 'lifi', 'occ', 'fso', 'uwoc', 'spectrum', 'history'],
  prerequisites: [],
  references: ['kahn1997', 'haas2016lifi', 'pathak2015survey', 'chowdhury2018', 'matheus2019', 'celik2023iot', 'ieee802157', 'ieee80211bb'],
  objectives: [
    'Name the five families of optical wireless communication and where each one is used',
    'Explain why the optical spectrum is attractive compared with radio',
    'List the main practical challenges: line of sight, ambient light, uplink and mobility',
    'Draw the blocks of a generic optical wireless link',
  ],
  updated: '2026-11-02',
};
