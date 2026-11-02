import type { LessonMeta } from '@/content/types';

export const meta: LessonMeta = {
  id: 'camera-occ',
  track: 'receivers',
  order: 3,
  title: 'Cameras as receivers: optical camera communication',
  subtitle: 'Global shutter, rolling shutter and the IEEE 802.15.7 OCC modes: how a phone camera reads data from a lamp.',
  level: 'core',
  minutes: 24,
  tags: ['occ', 'camera', 'rolling shutter', 'global shutter', 'image sensor', 'undersampling', '802.15.7'],
  prerequisites: ['photodetectors'],
  references: ['danakis2012', 'saeed2019occ', 'cahyadi2020occ', 'ieee802157', 'chowdhury2018'],
  objectives: [
    'Explain why a camera’s frame rate limits global-shutter OCC',
    'Derive the stripe width of a rolling-shutter image and the data rate it allows',
    'Describe the effect of exposure time, ISO and distance on decoding',
    'Name the OCC modulation families in IEEE 802.15.7-2018',
  ],
  updated: '2026-11-02',
};
