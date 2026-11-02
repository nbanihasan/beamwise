import { useSyncExternalStore } from 'react';

/** Per-viewer lesson progress, kept in localStorage when available (never required). */
const KEY = 'lumen.progress.v1';
let state: Record<string, number> = load();
const listeners = new Set<() => void>();

function load(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage blocked: progress lives for this session only */
  }
}

export function setComplete(id: string, done: boolean) {
  state = { ...state };
  if (done) state[id] = Date.now();
  else delete state[id];
  save();
  listeners.forEach((l) => l());
}

export function useProgress(): Record<string, number> {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
  );
}
