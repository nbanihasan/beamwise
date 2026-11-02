import type { LessonMeta } from '@/content/types';

export const meta: LessonMeta = {
  id: 'noise-snr',
  track: 'channel',
  order: 3,
  title: 'Noise, SNR and the link budget',
  subtitle: 'Shot noise from signal and sunlight, thermal noise from the amplifier, and how they decide the bit error rate.',
  level: 'core',
  minutes: 22,
  tags: ['noise', 'shot noise', 'thermal noise', 'ambient light', 'snr', 'apd', 'link budget'],
  prerequisites: ['lambertian-channel'],
  references: ['komine2004', 'kahn1997', 'ghassemlooy2019book', 'pathak2015survey'],
  objectives: [
    'Write the shot, background and thermal noise variances and identify which dominates',
    'Explain thermal-limited vs shot-limited operation from the slope of SNR vs power',
    'Show why APD gain has an optimum',
    'Assemble a simple optical link budget from transmit power to BER',
  ],
  updated: '2026-11-02',
};
