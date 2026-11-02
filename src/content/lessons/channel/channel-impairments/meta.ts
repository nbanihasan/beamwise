import type { LessonMeta } from '@/content/types';

export const meta: LessonMeta = {
  id: 'channel-impairments',
  track: 'channel',
  order: 4.5,
  title: 'Channel impairments, visualised',
  subtitle: 'Absorption, scattering, turbulence, scintillation, beam spreading, pointing error and weather: what each one does to the photons, and what engineers do about it.',
  level: 'core',
  minutes: 18,
  tags: ['absorption', 'scattering', 'turbulence', 'scintillation', 'beam wander', 'divergence', 'pointing error', 'fog', 'weather', 'mie', 'rayleigh'],
  prerequisites: ['lambertian-channel'],
  references: ['khalighi2014fso', 'andrews2005book', 'kim2001', 'zeng2017uwoc', 'kaushal2016uwoc', 'kaushal2017space', 'alhabash2001', 'xu2008uv'],
  objectives: [
    'Tell absorption (photons destroyed) from scattering (photons redirected) and predict their effect on power and delay',
    'Explain beam wander and scintillation as two faces of turbulence, and what the Rytov variance measures',
    'Estimate geometric and pointing losses for a diverging beam',
    'Match each impairment with its standard mitigation',
  ],
  updated: '2026-11-02',
};
