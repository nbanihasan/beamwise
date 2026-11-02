# Lumen Atlas

**An open, interactive 3D atlas for learning optical wireless communications, from zero to hero.**

Lumen Atlas teaches visible light communication (VLC), LiFi, optical camera communication (OCC), free-space optics (FSO) and underwater optical links (UWOC). Each equation comes with a 3D scene or a live simulation you can change and break. The content follows the field's surveys, tutorials, handbooks and standards, and every lesson cites its sources.

## What's inside

| | |
| --- | --- |
| **19 lessons** in 8 tracks | Foundations → Transmitters → Channel → Receivers → Modulation & Coding → Receiver DSP → Systems & Networks → Research Frontiers |
| **23 interactive figures** | LED junction physics in 3D, a Lambertian room with a live power map, multipath ray tracing, PIN/APD/SPAD/PMT detectors, rolling-shutter cameras, optical OFDM builder, CSK on the CIE diagram, optical MIMO, turbulence, underwater links, LiFi attocells with handover, visible-light positioning, and more |
| **Link Lab** | An end-to-end IM/DD link simulator: OOK, Manchester, 4-PAM, DCO- and ACO-OFDM; LED bias, non-linearity and bandwidth; Lambertian channel with a diffuse tail; shot and amplifier noise; ZF, LMS, DFE and one-tap OFDM equalisers; eye diagrams, constellations, spectra, per-subcarrier SNR and BER |
| **Library** | 47 curated references (IEEE COMST surveys, tutorials, handbooks, landmark papers, IEEE 802.15.7 / 802.11bb / 802.15.13, ITU-T G.9991), each DOI checked |
| **Simulation engine** | Plain TypeScript in `src/sim/`, deterministic and unit-tested |

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # simulation unit tests
npm run build        # static site in dist/ (GitHub Pages or any static host)
npm run build:single # one self-contained HTML file in dist-single/
```

Requires Node.js 18 or newer.

## Project layout

```
src/
├─ content/                 ← everything a learner reads
│  ├─ tracks.ts             curriculum tracks (each tagged with a wavelength)
│  ├─ references.ts         bibliography (cited by id)
│  ├─ glossary.ts           terms and acronyms
│  ├─ registry.ts           auto-discovers lessons
│  └─ lessons/<track>/<lesson>/
│     ├─ meta.ts            title, level, prerequisites, objectives, references
│     └─ lesson.mdx         Markdown + LaTeX + interactive figures
├─ sim/                     physics & DSP (pure TS, unit-tested)
├─ widgets/                 interactive figures, registered in widgets/index.ts
├─ three/                   shared 3D stage, hero scene, colour maps
├─ viz/                     canvas plotting and controls
├─ mdx/                     components available inside lessons
├─ pages/ · shell/          app pages and chrome
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how the pieces fit and [CONTRIBUTING.md](CONTRIBUTING.md) to add a lesson, a figure or a reference.

## Adding a lesson in one minute

```bash
npm run new:lesson -- channel my-new-topic "My new topic"
```

Edit `src/content/lessons/channel/my-new-topic/lesson.mdx`. It appears in the curriculum, search and navigation automatically.

## Deploying

`.github/workflows/pages.yml` builds and publishes to GitHub Pages on every push to `main`. In the repository settings, set **Pages → Source** to **GitHub Actions**. Set the repository URL as `VITE_REPO_URL` (the workflow does this automatically) so the app links back to the source.

## Licence

- Code: [MIT](LICENSE)
- Lesson text and figures: [CC BY 4.0](CONTENT_LICENSE.md)

Cited works belong to their authors and publishers; Lumen Atlas links to them and quotes nothing beyond short attributed facts.
