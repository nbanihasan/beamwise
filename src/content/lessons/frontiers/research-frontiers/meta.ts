import type { LessonMeta } from '@/content/types';

export const meta: LessonMeta = {
  id: 'research-frontiers',
  track: 'frontiers',
  order: 1,
  title: 'Research frontiers: where OWC is going',
  subtitle: 'Micro-LED arrays, laser lighting, optical RIS, single-photon receivers, SLIPT, machine learning and 6G, with pointers into the literature.',
  level: 'frontier',
  minutes: 22,
  tags: ['6g', 'ris', 'micro-led', 'laser lighting', 'spad', 'slipt', 'machine learning', 'noma', 'isac', 'research'],
  prerequisites: ['lifi-networks', 'photodetectors'],
  references: ['chi2020_6g', 'aboagye2023ris', 'huang2024spc', 'islim2017', 'bian2019', 'wang2015solar', 'celik2023iot', 'wu2021hybrid', 'ieee8021513'],
  objectives: [
    'Name the main open research directions in OWC and the problem each addresses',
    'Explain how optical RIS overcome blockage and orientation loss',
    'Describe the energy-harvesting receiver idea (SLIPT)',
    'Find the right survey or tutorial to start research in each direction',
  ],
  updated: '2026-11-02',
};
