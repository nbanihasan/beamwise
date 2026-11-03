import type { LessonMeta } from '@/content/types';

export const meta: LessonMeta = {
  id: 'multiple-access',
  track: 'networks',
  order: 1.5,
  title: 'Multiple access: TDMA, FDMA, OFDMA, CDMA, SDMA, WDMA, NOMA',
  subtitle: 'How many users share one light: slicing time, frequency, codes, space, colour and power, and what each costs.',
  level: 'core',
  minutes: 22,
  tags: ['multiple access', 'tdma', 'fdma', 'ofdma', 'cdma', 'ocdma', 'sdma', 'wdma', 'noma', 'sic', 'csma', 'mac', 'attocell'],
  prerequisites: ['lifi-networks', 'optical-ofdm'],
  references: ['salehi1989', 'marshoud2016noma', 'ieee80211bb', 'itug9991', 'ieee802157', 'haas2016lifi', 'chun2016wdm'],
  objectives: [
    'Identify which resource each multiple-access scheme slices',
    'Explain why OCDMA codes are only quasi-orthogonal with on/off light',
    'Explain spatial reuse in LiFi attocells',
    'Compute NOMA rates with successive interference cancellation and compare them with time sharing',
    'Name the schemes used by IEEE 802.15.7, 802.11bb and ITU-T G.9991',
  ],
  updated: '2026-11-03',
};
