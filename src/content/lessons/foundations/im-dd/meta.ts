import type { LessonMeta } from '@/content/types';

export const meta: LessonMeta = {
  id: 'im-dd',
  track: 'foundations',
  order: 2,
  title: 'Intensity modulation & direct detection',
  subtitle: 'Why optical wireless signals must be real, non-negative and power-limited, and what that does to every design choice.',
  level: 'foundation',
  minutes: 18,
  tags: ['im/dd', 'basics', 'photodetection', 'bias', 'clipping', 'snr'],
  prerequisites: ['owc-landscape'],
  references: ['kahn1997', 'armstrong2009', 'ghassemlooy2019book', 'karunatilaka2015'],
  objectives: [
    'Explain why an LED cannot carry a negative or complex baseband signal',
    'Write the IM/DD channel model y(t) = R·h(t) ⊗ x(t) + n(t) and state its constraints',
    'Describe the role of DC bias and the clipping it prevents',
    'Distinguish optical power from electrical power in SNR calculations',
  ],
  updated: '2026-11-02',
};
