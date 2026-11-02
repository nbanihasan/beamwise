import type { LessonMeta } from '@/content/types';

export const meta: LessonMeta = {
  id: 'surfaces-diffusion',
  track: 'channel',
  order: 2.5,
  title: 'Surfaces, materials and diffusion',
  subtitle: 'Why white plaster, glossy tiles, mirrors and black curtains create completely different channels, and how diffusers shape light on purpose.',
  level: 'core',
  minutes: 16,
  tags: ['reflection', 'brdf', 'lambertian', 'phong', 'specular', 'diffuse', 'diffuser', 'materials', 'reflectance', 'retroreflector'],
  prerequisites: ['multipath'],
  references: ['gfeller1979', 'phong1975', 'miramirkhani2015', 'barry1993', 'lee2011multipath', 'li2015retrovlc'],
  objectives: [
    'Describe reflection with a BRDF and distinguish Lambertian, glossy (Phong), specular and retro-reflection',
    'Predict how wall reflectance changes received power and delay spread',
    'Explain why reflectance is wavelength-dependent and why it matters for white-light and IR links',
    'Explain what a transmit or receive diffuser does to coverage and to the link budget',
  ],
  updated: '2026-11-02',
};
