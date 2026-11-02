import type { LessonMeta } from '@/content/types';

export const meta: LessonMeta = {
  id: 'single-carrier',
  track: 'modulation',
  order: 1,
  title: 'Single-carrier modulation: OOK, PPM, PAM and line codes',
  subtitle: 'The simplest ways to write bits in light, how they trade power for bandwidth, and how they stay flicker-free and dimmable.',
  level: 'core',
  minutes: 26,
  tags: ['ook', 'ppm', 'vppm', 'pam', 'manchester', '4b6b', 'rll', 'dimming', 'flicker', 'ber'],
  prerequisites: ['im-dd', 'noise-snr'],
  references: ['kahn1997', 'ieee802157', 'ghassemlooy2019book', 'karunatilaka2015', 'ieee1789'],
  objectives: [
    'Generate OOK, RZ, Manchester, 4B6B, PPM, VPPM and PAM waveforms',
    'Compare formats by power efficiency and bandwidth efficiency',
    'Explain why run-length-limited codes prevent flicker and baseline wander',
    'Read BER-vs-SNR curves and the FEC threshold',
  ],
  updated: '2026-11-02',
};
