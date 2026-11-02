# Architecture

Lumen Atlas is a static single-page app (React 18, Vite, TypeScript). There is no server: everything, including simulations, runs in the browser, so it can be hosted on GitHub Pages or shipped as one HTML file.

## Design goals

- **Content is data.** Lessons, tracks, references and glossary entries are files, discovered at build time. Adding content never requires touching app code.
- **Physics is separate from pixels.** `src/sim/` has no React or DOM dependency. It is unit-tested and reusable (for example in notebooks or other apps).
- **Figures are composable.** Every figure is a registered component that any lesson can embed by name.
- **Performance by default.** Lessons and figures are code-split and lazy-loaded; 3D canvases mount only while on screen, so a long lesson never exceeds the browser's WebGL context limit.

## Data flow

```
content/lessons/*/*/meta.ts ──(eager glob)──► registry.ts ──► curriculum, search, navigation
content/lessons/*/*/lesson.mdx ─(lazy glob)──► LessonPage ──► MDXProvider(mdx/components.tsx)
                                                                   │
                                     widgets/index.ts (lazy) ◄──────┘
                                            │
                       viz/ (Plot, controls)   three/ (Stage)   sim/ (models)
```

## Modules

| Path | Responsibility |
| --- | --- |
| `src/sim/math.ts` | RNG, Gaussian and gamma samplers, Q-function, Poisson, linear solve, Jacobi eigenvalues/SVD |
| `src/sim/fft.ts` | Radix-2 FFT/IFFT, Welch PSD |
| `src/sim/lambertian.ts` | Lambertian order, LOS gain, concentrator gain, power maps, first-order reflections and impulse response |
| `src/sim/receiver.ts` | Responsivity, PIN/APD noise budget, optimal APD gain, SPAD dead time and photon-counting BER, analytical BERs, TIA bandwidth |
| `src/sim/modulation.ts` | PRBS, NRZ/RZ/Manchester/4B6B line codes, PAM, PPM, VPPM |
| `src/sim/ofdm.ts` | Gray QAM, Hermitian IFFT, DCO/ACO carrier maps, PAPR |
| `src/sim/dsp.ts` | LED one-pole response and inverse, Rapp non-linearity, LMS/DFE equaliser, eye slicing |
| `src/sim/outdoor.ts` | Kim attenuation, Rytov variance, gamma-gamma and log-normal fading, water types |
| `src/sim/positioning.ts` | RSS-to-distance inversion, least-squares trilateration |
| `src/sim/camera.ts` | Rolling-shutter row integration |
| `src/sim/color.ts` | CIE 1931 locus, CSK constellations, wavelength-to-RGB |
| `src/sim/linkSim.ts` | The end-to-end Link Lab simulator |

## Theming

Colours are CSS custom properties in `src/styles/tokens.css`, dark-first with a full light theme. Canvas plots resolve `var(--token)` colours at draw time and redraw on theme change. 3D scenes use a dark "instrument window" background in both themes, since emitted light reads best on dark.

## Roadmap ideas

- More lessons: channel coding in depth, UV non-line-of-sight links, OWC security, vehicular VLC, LiFi MAC protocols, SLIPT design, optical RIS optimisation.
- A higher-order reflection simulator (Barry's recursive method) running in a Web Worker.
- Measured LED and photodiode datasets to replace analytical models in figures.
- Translations (content files are already separated from code).
- An exercise mode with numeric answers checked against the simulators.
