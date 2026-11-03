import type { LessonMeta } from '@/content/types';

export const meta: LessonMeta = {
  id: 'smart-surfaces',
  track: 'frontiers',
  order: 3,
  title: 'Smart surfaces: RIS, metasurfaces, MEMS and liquid crystals',
  subtitle: 'Surfaces that can be programmed to steer, focus or block light, so the channel itself becomes something you can design.',
  level: 'frontier',
  minutes: 22,
  tags: ['ris', 'irs', 'metasurface', 'generalized snell', 'mems', 'micromirror', 'dmd', 'liquid crystal', 'slm', 'beam steering', 'smart glass', 'electrochromic'],
  prerequisites: ['los-nlos', 'surfaces-diffusion'],
  references: ['aboagye2023ris', 'abdelhady2021ris', 'ndjiongue2021steer', 'ndjiongue2021lc', 'yu2011metasurface'],
  objectives: [
    'Explain how a reconfigurable surface creates an NLOS path where a wall blocks LOS',
    'Apply the generalized Snell law to a phase-gradient metasurface',
    'Compare MEMS mirror arrays, DMDs, metasurfaces and liquid crystals on range, speed and loss',
    'Name transmitter- and receiver-side uses of liquid crystals and smart glass',
  ],
  updated: '2026-11-03',
};
