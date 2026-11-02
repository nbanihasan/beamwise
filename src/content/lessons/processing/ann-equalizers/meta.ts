import type { LessonMeta } from '@/content/types';

export const meta: LessonMeta = {
  id: 'ann-equalizers',
  track: 'processing',
  order: 1.5,
  title: 'Neural-network equalisers and learned receivers',
  subtitle: 'Why LED non-linearity defeats linear equalisers, how Volterra series and neural networks fix it, and where end-to-end learning is heading.',
  level: 'advanced',
  minutes: 22,
  tags: ['ann', 'neural network', 'mlp', 'lstm', 'cnn', 'volterra', 'nonlinear equalization', 'machine learning', 'autoencoder', 'deep learning'],
  prerequisites: ['equalization'],
  references: ['stepniak2013volterra', 'chi2018dnn', 'lu2019lstm', 'oshea2017dl', 'lee2018dlvlc', 'chi2020_6g'],
  objectives: [
    'Explain why a compressive LED creates non-linear ISI that linear equalisers cannot remove',
    'Write a second-order Volterra equaliser and count its parameters',
    'Describe an MLP equaliser as a learned non-linear classifier over a window of samples',
    'Weigh neural equalisers against classical ones: gain, training data, complexity, generalisation',
  ],
  updated: '2026-11-02',
};
