import type { LessonMeta } from '@/content/types';

export const meta: LessonMeta = {
  id: 'optical-ofdm',
  track: 'modulation',
  order: 2,
  title: 'Optical OFDM: DCO, ACO and beyond',
  subtitle: 'Hermitian symmetry, bias and clipping: how the workhorse of Wi-Fi and 5G was adapted to a channel that only accepts positive, real signals.',
  level: 'advanced',
  minutes: 30,
  tags: ['ofdm', 'dco-ofdm', 'aco-ofdm', 'u-ofdm', 'hermitian', 'papr', 'clipping', 'bit loading', 'dmt'],
  prerequisites: ['single-carrier', 'multipath'],
  references: ['armstrong2009', 'armstrong2006aco', 'tsonev2012uofdm', 'tsonev2014', 'islim2017', 'ghassemlooy2019book'],
  objectives: [
    'Explain how OFDM turns a dispersive channel into many flat subchannels',
    'Construct a real OFDM signal with Hermitian symmetry',
    'Compare DCO-OFDM and ACO-OFDM in power and spectral efficiency',
    'Describe PAPR, clipping noise and adaptive bit loading',
  ],
  updated: '2026-11-02',
};
