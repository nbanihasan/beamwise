import type { LessonMeta } from '@/content/types';

export const meta: LessonMeta = {
  id: 'line-codes',
  track: 'modulation',
  order: 1.5,
  title: 'Line codes: Manchester, Miller, 4B6B and friends',
  subtitle: 'Why a lamp cannot simply send NRZ, and how run-length-limited codes keep the brightness steady, the clock alive and the spectrum away from DC.',
  level: 'core',
  minutes: 16,
  tags: ['line code', 'manchester', 'differential manchester', 'miller', 'nrz', 'nrzi', 'rz', '4b6b', '8b10b', 'vppm', 'rll', 'dc balance', 'flicker', 'dimming'],
  prerequisites: ['single-carrier'],
  references: ['rajagopal2012', 'ieee802157', 'ieee1789', 'ghassemlooy2019book'],
  objectives: [
    'Encode a bit string in NRZ, Manchester, differential Manchester and Miller by hand',
    'Explain DC balance, maximum run length and transition density, and why each matters for a lamp',
    'Compare the bandwidth cost of each code from its power spectrum',
    'Explain how VPPM separates dimming from data',
  ],
  updated: '2026-11-03',
};
