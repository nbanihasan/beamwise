import type { LessonMeta } from '@/content/types';

export const meta: LessonMeta = {
  id: 'receiver-zoo',
  track: 'receivers',
  order: 1.5,
  title: 'The receiver zoo: how each detector works',
  subtitle: 'PIN, APD, SPAD, SiPM, photomultiplier, camera, solar cell and LED-as-receiver: mechanism, gain, speed and where each one wins.',
  level: 'core',
  minutes: 18,
  tags: ['pin', 'apd', 'spad', 'sipm', 'pmt', 'photomultiplier', 'cmos', 'camera', 'solar cell', 'led receiver', 'event camera', 'detector'],
  prerequisites: ['photodetectors'],
  references: ['huang2024spc', 'sarbazi2020', 'ahmed2020sipm', 'wang2015solar', 'dietz2003led', 'saeed2019occ', 'gallego2022event', 'zeng2017uwoc'],
  objectives: [
    'Explain the physical mechanism of each detector type',
    'Compare internal gain, bandwidth, sensitivity and dynamic range across detectors',
    'Choose a detector for a given link: indoor LiFi, underwater, long-range FSO, OCC or energy-harvesting IoT',
  ],
  updated: '2026-11-02',
};
