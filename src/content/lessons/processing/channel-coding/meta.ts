import type { LessonMeta } from '@/content/types';

export const meta: LessonMeta = {
  id: 'channel-coding',
  track: 'processing',
  order: 3,
  title: 'Encoders and decoders: channel coding for light',
  subtitle: 'From Hamming and Reed–Solomon to convolutional, turbo, LDPC and polar codes, plus interleaving, and which ones the optical standards use.',
  level: 'core',
  minutes: 24,
  tags: ['fec', 'hamming', 'reed-solomon', 'convolutional', 'viterbi', 'turbo', 'ldpc', 'polar', 'interleaver', 'coding gain', 'syndrome', 'rll'],
  prerequisites: ['detection-coding'],
  references: ['hamming1950', 'reed1960', 'viterbi1967', 'gallager1962', 'berrou1993', 'arikan2009', 'ieee802157', 'itug9991', 'ghassemlooy2019book'],
  objectives: [
    'Explain code rate, minimum distance and coding gain',
    'Encode and decode a Hamming(7,4) word using syndromes',
    'Contrast algebraic block codes, convolutional codes and modern iterative codes',
    'Explain why interleaving is essential on bursty optical channels',
    'Name the codes used in IEEE 802.15.7 and ITU-T G.9991',
  ],
  updated: '2026-11-02',
};
