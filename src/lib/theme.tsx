import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type ThemeChoice = 'system' | 'light' | 'dark';
interface ThemeCtx {
  choice: ThemeChoice;
  resolved: 'light' | 'dark';
  setChoice: (c: ThemeChoice) => void;
  /** increments whenever resolved colours may have changed (for canvas redraws) */
  version: number;
}

const Ctx = createContext<ThemeCtx>({ choice: 'system', resolved: 'dark', setChoice: () => {}, version: 0 });

function readStored(): ThemeChoice {
  try {
    const v = localStorage.getItem('lumen.theme');
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    /* storage unavailable */
  }
  // Photonova is designed dark-first: first-time visitors get dark; the toggle still offers light and system
  return 'dark';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoiceState] = useState<ThemeChoice>(readStored);
  const [systemLight, setSystemLight] = useState(() => window.matchMedia?.('(prefers-color-scheme: light)').matches ?? false);
  const [hostTheme, setHostTheme] = useState<string | null>(() => document.documentElement.getAttribute('data-theme'));
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: light)');
    const on = () => setSystemLight(mq.matches);
    mq?.addEventListener?.('change', on);
    // a host page (or another script) may set data-theme on <html>; follow it
    const mo = new MutationObserver(() => setHostTheme(document.documentElement.getAttribute('data-theme')));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      mq?.removeEventListener?.('change', on);
      mo.disconnect();
    };
  }, []);

  useEffect(() => {
    const el = document.documentElement;
    if (choice === 'system') {
      if (el.getAttribute('data-theme') && el.dataset.lumenSet) {
        el.removeAttribute('data-theme');
        delete el.dataset.lumenSet;
      }
    } else {
      el.setAttribute('data-theme', choice);
      el.dataset.lumenSet = '1';
    }
    setVersion((v) => v + 1);
  }, [choice, systemLight, hostTheme]);

  const setChoice = useCallback((c: ThemeChoice) => {
    setChoiceState(c);
    try {
      localStorage.setItem('lumen.theme', c);
    } catch {
      /* ignore */
    }
  }, []);

  const resolved: 'light' | 'dark' =
    choice !== 'system' ? choice : hostTheme === 'light' || hostTheme === 'dark' ? hostTheme : systemLight ? 'light' : 'dark';

  const value = useMemo(() => ({ choice, resolved, setChoice, version }), [choice, resolved, setChoice, version]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);

/** Resolve a CSS colour that may be a var(--token) reference. */
export function cssColor(c: string, el: Element = document.documentElement): string {
  const m = /^var\((--[\w-]+)\)$/.exec(c.trim());
  if (!m) return c;
  return getComputedStyle(el).getPropertyValue(m[1]).trim() || '#888';
}
