import type { LessonMeta } from '@/content/types';

export const meta: LessonMeta = {
  id: 'lens-systems',
  track: 'receivers',
  order: 2.5,
  title: 'Lens systems: imaging and non-imaging optics',
  subtitle: 'Thin lenses, Fresnel lenses, hemispheres, CPCs, angle-diversity and imaging receivers: how optics trade field of view for gain.',
  level: 'core',
  minutes: 20,
  tags: ['lens', 'cpc', 'concentrator', 'fresnel', 'hemispherical lens', 'etendue', 'fov', 'imaging receiver', 'angle diversity', 'collimator'],
  prerequisites: ['optics-frontend'],
  references: ['kahn1997', 'carruthers2000', 'kahn1998imaging', 'wang2013hemi', 'ghassemlooy2019book'],
  objectives: [
    'State the étendue limit and why concentrator gain falls as field of view grows',
    'Compare thin lens, Fresnel, hemispherical lens and CPC by gain, FOV and cost',
    'Explain imaging vs non-imaging receivers and when each is used',
    'Describe angle-diversity and imaging receivers for MIMO and blockage robustness',
  ],
  updated: '2026-11-02',
};
