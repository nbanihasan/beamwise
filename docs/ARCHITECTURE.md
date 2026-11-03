# Architecture

Beamwise is a static single-page app (React 18, Vite, TypeScript). There is no server: everything, including simulations, runs in the browser, so it can be hosted on GitHub Pages or shipped as one HTML file.

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
| `src/sim/neural.ts` | PAM-4 LED channel, least-squares FIR/DFE/Volterra, a small MLP trained with Adam |
| `src/bench/types.ts` | Bench state: objects, environment, modem chain, goals (plain JSON: undo, save, share) |
| `src/bench/catalog.ts` | Every placeable component: category, mount, defaults, editable properties |
| `src/bench/scenarios.ts` | Scenario presets with environment, seed objects, camera and a challenge |
| `src/bench/optics.ts` | Spectra, detector responsivities, filters, ambient light, materials, glass dispersion, water and fog optics |
| `src/bench/tracer.ts` | Ray tracer: next-event estimation for direct, diffuse, scattered and flat-mirror paths; Monte Carlo rays through curved mirrors, lenses, prisms, retroreflectors and RIS; impulse responses; coverage maps; bounce-point search |
| `src/bench/link.ts` | Link engine: PIN/APD/PMT noise, photon counting, bandwidth and ISI, 17 modulations, 11 FEC models, line codes, 11 equalisers, OFDM bit loading, camera links, scintillation, MIMO, eye safety |
| `src/bench/advisor.ts` | Diagnosis with one-click fixes and a recommended block-by-block blueprint |
| `src/arch/` | System-view blocks and a deterministic chain that produces the signal at every block |
| `src/usecases/` | Use-case data and 3D scenes |
| `src/three/kit/` | Shared 3D kit: beam shader, photon streams, lighting, scenery and optical-component models |

## Theming

Colours are CSS custom properties in `src/styles/tokens.css`, dark-first with a full light theme. Canvas plots resolve `var(--token)` colours at draw time and redraw on theme change. 3D scenes use a dark "instrument window" background in both themes, since emitted light reads best on dark.

## Optical Bench physics in one paragraph

Light transport combines two estimators. Next-event estimation adds the exact contribution of every direct path, wall reflection (Lambertian + Phong), scattering event (Henyey–Greenstein in water and fog) and flat-mirror path (image method) to each receiver, with shadow rays that block on opaque objects and attenuate through filters, polarizers (Malus) and splitters. Monte Carlo rays, sampled from each source's Lambertian or Gaussian pattern, follow curved mirrors, thin lenses, refracting prisms (Cauchy dispersion), retroreflectors and RIS panels; they count only when they reach a receiver through such optics, so nothing is counted twice. Each contribution keeps its delay, giving the impulse response and RMS delay spread. The link engine converts photocurrent into SNR and evaluates the chosen chain. Unit tests check the tracer against the closed-form Lambertian LOS gain, the image-source mirror solution, Malus's law and Beer–Lambert attenuation.

## Optical Bench physics in one paragraph

Light transport combines two estimators. Next-event estimation adds the exact contribution of every direct path, wall reflection (Lambertian + Phong), scattering event (Henyey–Greenstein in water and fog) and flat-mirror path (image method) to each receiver, with shadow rays that block on opaque objects and attenuate through filters, polarizers (Malus) and splitters. Monte Carlo rays, sampled from each source's Lambertian or Gaussian pattern, follow curved mirrors, thin lenses, refracting prisms (Cauchy dispersion), retroreflectors and RIS panels; they count only when they reach a receiver through such optics, so nothing is counted twice. Each contribution keeps its delay, giving the impulse response and RMS delay spread. The link engine converts photocurrent into SNR and evaluates the chosen chain. Unit tests check the tracer against the closed-form Lambertian LOS gain, the image-source mirror solution, Malus's law and Beer–Lambert attenuation, and run every scenario end to end.

## Roadmap ideas

- More lessons: UV non-line-of-sight links, OWC security, vehicular VLC, LiFi MAC protocols, SLIPT design, optical RIS optimisation.
- A higher-order reflection simulator (Barry's recursive method) running in a Web Worker.
- Measured LED and photodiode datasets to replace analytical models in figures.
- Translations (content files are already separated from code).
- An exercise mode with numeric answers checked against the simulators.
