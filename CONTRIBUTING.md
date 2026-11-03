# Contributing to Photonova

Thank you for helping people learn optical wireless communications. Contributions of every size are welcome: a typo, a better explanation, a new figure, a missing reference, or a whole track.

## Not a developer?

Use the guided form at **https://photonova.pages.dev/#/suggest**. It turns your correction, idea or bug report into a GitHub issue ready to send. Every lesson also has a *Suggest an edit* button at the bottom.

## The workflow

1. Fork the repository on GitHub.
2. Clone your fork, then run `npm install` and `npm run dev` (Node.js 20 or newer).
3. Create a branch: `git checkout -b my-change`.
4. Make your change (recipes below).
5. Run `npm run typecheck`, `npm test` and `npm run build`.
6. Commit, push to your fork, and open a pull request describing what changed and why, with sources for any physics.
7. A maintainer reviews it. Once merged, the live site updates within minutes.

A step-by-step version with copy-paste commands is at https://photonova.pages.dev/#/contribute.

## Ground rules

1. **Cite.** Every non-obvious claim and equation should point to a reference in `src/content/references.ts`. Prefer surveys, tutorials, textbooks and standards; give a DOI when one exists.
2. **Intuition first, then maths.** Explain what happens in plain language, then give the equation, then a figure the learner can change.
3. **Simulations are code under test.** Physics and DSP live in `src/sim/` as pure, seeded TypeScript, with a unit test against a known result in `src/sim/sim.test.ts`.
4. **Works everywhere.** Figures must work at phone width, in light and dark themes, and without WebGL (the 3D stage shows a message; plots and controls keep working).

## Add or edit a lesson

```bash
npm run new:lesson -- <track-id> <lesson-id> "Title"
```

- `meta.ts` holds the title, level (`foundation | core | advanced | frontier`), reading time, prerequisites (lesson ids), objectives and reference ids. Keep `draft: true` until it is ready.
- `lesson.mdx` is Markdown with `$inline$` and `$$display$$` LaTeX, plus components:

| Component | Use |
| --- | --- |
| `<KeyIdea>`, `<MathBox>`, `<Research>`, `<Callout type="note|warn">` | Highlighted boxes |
| `<Cite id="ref-id" />` | Numbered citation linked to the lesson's reference list |
| `<Quiz q options answer explain />` | Self-check question |
| `<Compare><Card title>…</Card></Compare>` | Side-by-side comparison cards |
| `<Steps><li>…</li></Steps>` | Numbered steps |
| `<LessonLink id="lesson-id" />` | Link to another lesson |
| `<AnyWidgetName />` | Any figure registered in `src/widgets/index.ts` |

MDX notes: write `\{` or avoid curly braces outside maths; avoid a bare `<` in prose (write "less than").

## Add a figure

1. Put the model in `src/sim/` and test it.
2. Create `src/widgets/MyFigure.tsx` with a default export. Use `Widget` (frame), `Slider` / `Segmented` / `Toggle` (controls), `Readouts`, `Plot` (2D) and `Stage` (3D) so it matches the rest of the atlas.
3. Register it in `src/widgets/index.ts`. It is then available in every lesson as `<MyFigure />`.

## Add an Optical Bench component or scenario

- **Component:** add a `Kind` in `src/bench/types.ts`, an entry in `src/bench/catalog.ts` (label, mount, defaults, editable props), its optical behaviour in `buildSurfaces` (`src/bench/tracer.ts`) or its detector model in `src/bench/link.ts`, and a 3D model in `src/bench/BenchModels.tsx` (local +Z is the optical axis).
- **Scenario:** add an entry to `SCENARIOS` in `src/bench/scenarios.ts` with an environment, seed objects, a camera and a challenge. The smoke test in `src/bench/bench.test.ts` runs every scenario end to end.

## Add a use case

Add an entry to `src/usecases/data.ts` and a scene with the same id in `src/usecases/scenes.tsx`, built from `src/three/kit`. Set `bench` to a scenario id to link it to the Optical Bench.

## Add a track

Add an entry to `src/content/tracks.ts` (id, title, blurb, a wavelength for its colour, and order), then create `src/content/lessons/<track-id>/`.

## Before opening a pull request

```bash
npm run typecheck
npm test
npm run build
```

CI runs the same checks.
