import type { LessonMeta } from '@/content/types';

export const meta: LessonMeta = {
  id: 'lifi-networks',
  track: 'networks',
  order: 1,
  title: 'LiFi networks: attocells, access and handover',
  subtitle: 'From one link to a building full of lights: multiple access, interference, handover, uplinks, hybrid LiFi/WiFi and the standards.',
  level: 'advanced',
  minutes: 28,
  tags: ['lifi', 'attocell', 'handover', 'multiple access', 'tdma', 'ofdma', 'noma', 'hybrid', 'wifi', '802.11bb', 'g.9991', 'uplink'],
  prerequisites: ['lambertian-channel', 'optical-ofdm'],
  references: ['haas2016lifi', 'wu2021hybrid', 'marshoud2016noma', 'ieee80211bb', 'itug9991', 'ieee802157', 'soltani2019orientation', 'haas2018paradigm'],
  objectives: [
    'Explain the attocell concept and area spectral efficiency',
    'Analyse SINR, frequency reuse and cell-edge interference',
    'Describe handover with hysteresis, and load balancing in hybrid LiFi/WiFi networks',
    'Compare TDMA, OFDMA and NOMA, and summarise IEEE 802.11bb and ITU-T G.9991',
  ],
  updated: '2026-11-02',
};
