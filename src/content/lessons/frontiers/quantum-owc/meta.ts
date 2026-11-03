import type { LessonMeta } from '@/content/types';

export const meta: LessonMeta = {
  id: 'quantum-owc',
  track: 'frontiers',
  order: 2,
  title: 'Quantum optical links: QKD and entanglement',
  subtitle: 'Single photons, polarization qubits and entangled pairs: how free-space optics distributes keys whose secrecy is guaranteed by physics.',
  level: 'frontier',
  minutes: 22,
  tags: ['quantum', 'qkd', 'bb84', 'e91', 'entanglement', 'bell', 'chsh', 'qber', 'single photon', 'satellite', 'micius', 'spdc'],
  prerequisites: ['optical-components', 'photodetectors'],
  references: ['bennett1984', 'ekert1991', 'chsh1969', 'liao2017micius', 'yin2020entangled', 'huang2024spc'],
  objectives: [
    'Run the BB84 protocol: bases, sifting, error estimation',
    'Explain why an intercept-resend eavesdropper raises the QBER to about 25 %',
    'Compute the secret-key fraction 1 − 2h(Q) and the 11 % abort threshold',
    'Describe polarization entanglement and the CHSH inequality',
    'Explain why satellites are used for long-distance quantum links',
  ],
  updated: '2026-11-03',
};
