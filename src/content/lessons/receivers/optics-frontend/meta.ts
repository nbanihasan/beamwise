import type { LessonMeta } from '@/content/types';

export const meta: LessonMeta = {
  id: 'optics-frontend',
  track: 'receivers',
  order: 2,
  title: 'Receiver optics and the analogue front-end',
  subtitle: 'Lenses, concentrators, filters, angle diversity and the transimpedance amplifier: the parts that decide sensitivity and bandwidth.',
  level: 'core',
  minutes: 20,
  tags: ['optics', 'concentrator', 'cpc', 'filter', 'tia', 'angle diversity', 'imaging receiver', 'etendue'],
  prerequisites: ['photodetectors', 'lambertian-channel'],
  references: ['kahn1997', 'zeng2009mimo', 'ghassemlooy2019book', 'soltani2019orientation'],
  objectives: [
    'Explain the concentrator gain n²/sin²Ψc and the étendue limit behind it',
    'Describe how optical filters reduce background noise',
    'Analyse the TIA gain–bandwidth–noise trade-off',
    'Compare single-element, angle-diversity and imaging receivers',
  ],
  updated: '2026-11-02',
};
