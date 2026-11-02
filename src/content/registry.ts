/**
 * Auto-discovery of lessons. Drop a folder into src/content/lessons/<track>/<lesson>/ with
 *   meta.ts    -> export const meta: LessonMeta
 *   lesson.mdx -> the lesson body (Markdown + math + interactive components)
 * and it appears in the curriculum, the search palette and the navigation. No other edits needed.
 */
import type { ComponentType } from 'react';
import type { LessonMeta } from './types';
import { TRACKS } from './tracks';
import { refById } from './references';

const metaModules = import.meta.glob<LessonMeta>('./lessons/*/*/meta.ts', { eager: true, import: 'meta' });
const bodyModules = import.meta.glob<{ default: ComponentType<Record<string, unknown>> }>('./lessons/*/*/lesson.mdx');

export interface Lesson extends LessonMeta {
  load: () => Promise<{ default: ComponentType<Record<string, unknown>> }>;
}

function build(): Lesson[] {
  const out: Lesson[] = [];
  for (const [path, meta] of Object.entries(metaModules)) {
    const bodyPath = path.replace(/meta\.ts$/, 'lesson.mdx');
    const load = bodyModules[bodyPath];
    if (!load) {
      console.warn(`[lumen] ${path} has no lesson.mdx next to it; skipped.`);
      continue;
    }
    out.push({ ...meta, load });
  }
  const trackOrder = (id: string) => TRACKS.find((t) => t.id === id)?.order ?? 99;
  out.sort((a, b) => trackOrder(a.track) - trackOrder(b.track) || a.order - b.order);

  if (import.meta.env.DEV) {
    const ids = new Set(out.map((l) => l.id));
    for (const l of out) {
      if (!TRACKS.some((t) => t.id === l.track)) console.warn(`[lumen] lesson ${l.id}: unknown track "${l.track}"`);
      for (const p of l.prerequisites) if (!ids.has(p)) console.warn(`[lumen] lesson ${l.id}: unknown prerequisite "${p}"`);
      for (const r of l.references) if (!refById(r)) console.warn(`[lumen] lesson ${l.id}: unknown reference "${r}"`);
    }
  }
  return out;
}

export const LESSONS: Lesson[] = build();
export const lessonById = (id: string) => LESSONS.find((l) => l.id === id);
export const lessonsInTrack = (track: string) => LESSONS.filter((l) => l.track === track);

export function neighbours(id: string): { prev?: Lesson; next?: Lesson } {
  const i = LESSONS.findIndex((l) => l.id === id);
  return { prev: i > 0 ? LESSONS[i - 1] : undefined, next: i >= 0 && i < LESSONS.length - 1 ? LESSONS[i + 1] : undefined };
}
