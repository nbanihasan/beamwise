import type { LessonMeta } from '@/content/types';

export const meta: LessonMeta = {
  id: 'detection-coding',
  track: 'processing',
  order: 2,
  title: 'Detection, error correction and the full receiver',
  subtitle: 'Thresholds, maximum-likelihood decisions, soft information and forward error correction, assembled into a working link.',
  level: 'advanced',
  minutes: 22,
  tags: ['detection', 'demodulation', 'threshold', 'maximum likelihood', 'fec', 'reed-solomon', 'ldpc', 'convolutional', 'capacity'],
  prerequisites: ['equalization'],
  references: ['ieee802157', 'ghassemlooy2019book', 'kahn1997', 'ieee80211bb'],
  objectives: [
    'Place optimal decision thresholds for OOK and PAM, including signal-dependent noise',
    'Explain hard vs soft decisions and log-likelihood ratios',
    'Describe the FEC families used in OWC standards and the meaning of an FEC threshold',
    'Trace a bit through the complete transmitter–channel–receiver chain',
  ],
  updated: '2026-11-02',
};
