import type { LessonMeta } from '@/content/types';

export const meta: LessonMeta = {
  id: 'equalization',
  track: 'processing',
  order: 1,
  title: 'Synchronisation and equalisation',
  subtitle: 'Find the symbols in time, then undo what the LED and the room did to them: zero-forcing, MMSE/LMS, decision feedback and one-tap OFDM.',
  level: 'advanced',
  minutes: 26,
  tags: ['equalizer', 'zf', 'mmse', 'lms', 'dfe', 'synchronisation', 'clock recovery', 'eye diagram', 'isi'],
  prerequisites: ['single-carrier', 'multipath'],
  references: ['karunatilaka2015', 'ghassemlooy2019book', 'armstrong2009', 'kahn1997'],
  objectives: [
    'Describe frame, symbol and carrier synchronisation for IM/DD links',
    'Read an eye diagram: opening, jitter, ISI and noise',
    'Contrast zero-forcing, MMSE (LMS) and decision-feedback equalisers, including noise enhancement',
    'Explain why OFDM equalisation is a single complex division per subcarrier',
  ],
  updated: '2026-11-02',
};
