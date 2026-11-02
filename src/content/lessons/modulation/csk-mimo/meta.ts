import type { LessonMeta } from '@/content/types';

export const meta: LessonMeta = {
  id: 'csk-mimo',
  track: 'modulation',
  order: 3,
  title: 'Colour and space: CSK, WDM and optical MIMO',
  subtitle: 'Use the colour of light and the many LEDs in a ceiling as extra dimensions for data.',
  level: 'advanced',
  minutes: 24,
  tags: ['csk', 'color shift keying', 'wdm', 'mimo', 'spatial modulation', 'imaging receiver', 'cie'],
  prerequisites: ['single-carrier', 'optics-frontend'],
  references: ['ieee802157', 'bian2019', 'zeng2009mimo', 'fath2013mimo', 'mesleh2011sm', 'matheus2019'],
  objectives: [
    'Place CSK symbols on the CIE 1931 chromaticity diagram and explain why CSK is flicker-free',
    'Explain wavelength-division multiplexing with RGB(Y) LEDs',
    'Explain why non-imaging optical MIMO channels are ill-conditioned',
    'Compare repetition coding, spatial multiplexing and spatial modulation',
  ],
  updated: '2026-11-02',
};
