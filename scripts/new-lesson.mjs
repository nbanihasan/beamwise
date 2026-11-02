#!/usr/bin/env node
// Scaffold a new lesson:  npm run new:lesson -- <track-id> <lesson-id> ["Lesson title"]
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [track, id, title = 'New lesson'] = process.argv.slice(2);
if (!track || !id || !/^[a-z0-9-]+$/.test(id)) {
  console.error('Usage: npm run new:lesson -- <track-id> <lesson-id> ["Title"]   (ids: lowercase, digits, hyphens)');
  process.exit(1);
}
const tracks = readFileSync(join(root, 'src/content/tracks.ts'), 'utf8');
if (!tracks.includes(`id: '${track}'`)) {
  console.error(`Unknown track "${track}". Add it to src/content/tracks.ts first.`);
  process.exit(1);
}
const dir = join(root, 'src/content/lessons', track, id);
if (existsSync(dir)) {
  console.error(`${dir} already exists.`);
  process.exit(1);
}
mkdirSync(dir, { recursive: true });
const today = new Date().toISOString().slice(0, 10);
writeFileSync(
  join(dir, 'meta.ts'),
  `import type { LessonMeta } from '@/content/types';

export const meta: LessonMeta = {
  id: '${id}',
  track: '${track}',
  order: 99,
  title: ${JSON.stringify(title)},
  subtitle: 'One sentence that tells a learner why this lesson matters.',
  level: 'core',
  minutes: 15,
  tags: [],
  prerequisites: [],
  references: [],
  objectives: ['First thing the learner will be able to do'],
  updated: '${today}',
  draft: true,
};
`,
);
writeFileSync(
  join(dir, 'lesson.mdx'),
  `## Start with the intuition

Explain the idea in plain words first. Inline maths like $H(0)$ and display maths:

$$
P_r = H(0)\\,P_t
$$

<KeyIdea>
State the one thing to remember.
</KeyIdea>

Drop in any registered figure by name, for example:

<BerCurves />

<Quiz q="A question that checks understanding?" options={['Option A', 'Option B']} answer={0} explain="Why A is right." />
`,
);
console.log(`Created ${dir}\nRun "npm run dev" and open #/learn/${id}`);
