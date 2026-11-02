import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

/**
 * Widget registry. Every interactive figure is available in any .mdx lesson by name, e.g. <LambertianRoom />.
 * To add one: create src/widgets/MyWidget.tsx with a default export and register it below.
 */
type W = LazyExoticComponent<ComponentType<Record<string, unknown>>>;
const w = (f: () => Promise<{ default: ComponentType<never> }>) => lazy(f as () => Promise<{ default: ComponentType<Record<string, unknown>> }>);

export const WIDGETS: Record<string, W> = {
  SpectrumExplorer: w(() => import('./SpectrumExplorer')),
  ImDdExplorer: w(() => import('./ImDdExplorer')),
  LedJunction: w(() => import('./LedJunction')),
  LedCurves: w(() => import('./LedCurves')),
  DriverLab: w(() => import('./DriverLab')),
  LambertianRoom: w(() => import('./LambertianRoom')),
  MultipathLab: w(() => import('./MultipathLab')),
  NoiseBudget: w(() => import('./NoiseBudget')),
  TurbulenceLab: w(() => import('./TurbulenceLab')),
  UnderwaterLab: w(() => import('./UnderwaterLab')),
  DetectorLab: w(() => import('./DetectorLab')),
  SpadLab: w(() => import('./SpadLab')),
  OpticsLab: w(() => import('./OpticsLab')),
  RollingShutter: w(() => import('./RollingShutter')),
  WaveformLab: w(() => import('./WaveformLab')),
  BerCurves: w(() => import('./BerCurves')),
  OfdmBuilder: w(() => import('./OfdmBuilder')),
  CskDiagram: w(() => import('./CskDiagram')),
  MimoLab: w(() => import('./MimoLab')),
  EqualizerLab: w(() => import('./EqualizerLab')),
  AttocellLab: w(() => import('./AttocellLab')),
  PositioningLab: w(() => import('./PositioningLab')),
  FrontierMap: w(() => import('./FrontierMap')),
  ChannelEffects: w(() => import('./ChannelEffects')),
  SurfaceLab: w(() => import('./SurfaceLab')),
  LinkGeometries: w(() => import('./LinkGeometries')),
  LensSystems: w(() => import('./LensSystems')),
  ReceiverZoo: w(() => import('./ReceiverZoo')),
  FecLab: w(() => import('./FecLab')),
  NeuralEqualizer: w(() => import('./NeuralEqualizer')),
  ChainWalk: w(() => import('./ChainWalk')),
};
