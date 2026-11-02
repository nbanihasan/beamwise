# Contributing to Lumen Atlas

Thank you for helping people learn optical wireless communications. Contributions of every size are welcome: a typo, a better explanation, a new figure, a missing reference, or a whole track.

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

## Add a track

Add an entry to `src/content/tracks.ts` (id, title, blurb, a wavelength for its colour, and order), then create `src/content/lessons/<track-id>/`.

## Before opening a pull request

```bash
npm run typecheck
npm test
npm run build
```

CI runs the same checks.
