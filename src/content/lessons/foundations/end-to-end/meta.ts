import type { LessonMeta } from '@/content/types';

export const meta: LessonMeta = {
  id: 'end-to-end',
  track: 'foundations',
  order: 3,
  title: 'The end-to-end system: every block in a VLC link',
  subtitle: 'Nineteen blocks from data source to data sink. What each one does, and what the signal looks like as it passes through.',
  level: 'foundation',
  minutes: 15,
  tags: ['architecture', 'block diagram', 'transmitter', 'receiver', 'system', 'pipeline', 'chain'],
  prerequisites: ['im-dd'],
  references: ['ghassemlooy2019book', 'ieee802157', 'haas2016lifi', 'karunatilaka2015'],
  objectives: [
    'Name the blocks of a VLC/LiFi transmitter and receiver in signal order',
    'Say which domain (digital, analogue, optical) each block works in',
    'Follow one message through the chain and recognise the signal at each point',
  ],
  updated: '2026-11-02',
};
