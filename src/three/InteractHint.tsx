import { useEffect, useState, type RefObject } from 'react';

/**
 * A centred "you can move this" pill over a 3D view. It reads the device (touch vs mouse), shows the
 * right gestures, and fades out for good the moment the user presses, touches or scrolls the view.
 */
export interface HintText {
  touch: string;
  mouse: string;
}

export const ORBIT_HINT: HintText = {
  touch: 'Drag to rotate · pinch to zoom',
  mouse: 'Drag to rotate · scroll to zoom',
};

export function InteractHint({ target, text = ORBIT_HINT, delayMs = 600 }: { target: RefObject<HTMLElement>; text?: HintText; delayMs?: number }) {
  const [shown, setShown] = useState(false);
  const [gone, setGone] = useState(false);
  const [touch] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches);

  useEffect(() => {
    const t = window.setTimeout(() => setShown(true), delayMs);
    return () => window.clearTimeout(t);
  }, [delayMs]);

  useEffect(() => {
    const el = target.current;
    if (!el || gone) return;
    const dismiss = () => setGone(true);
    const opts = { passive: true, capture: true } as const;
    el.addEventListener('pointerdown', dismiss, opts);
    el.addEventListener('touchstart', dismiss, opts);
    el.addEventListener('wheel', dismiss, opts);
    return () => {
      el.removeEventListener('pointerdown', dismiss, opts);
      el.removeEventListener('touchstart', dismiss, opts);
      el.removeEventListener('wheel', dismiss, opts);
    };
  }, [target, gone]);

  return (
    <div className={`ix-hint ${shown && !gone ? 'on' : ''}`} aria-hidden={gone} role="note">
      <svg viewBox="0 0 24 24" className="ix-icon" aria-hidden>
        {touch ? (
          <>
            <path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10m0-1.5a1.5 1.5 0 0 1 3 0V11m0-1a1.5 1.5 0 0 1 3 0v4.5a6 6 0 0 1-6 6h-1a6 6 0 0 1-4.6-2.2L4 15.5a1.5 1.5 0 0 1 2.3-1.9L9 16" />
          </>
        ) : (
          <>
            <path d="M12 3a5 5 0 0 1 5 5v8a5 5 0 0 1-10 0V8a5 5 0 0 1 5-5zM12 3v6" />
          </>
        )}
        <path className="ix-orbit" d="M2.5 12c0-2.2 4.3-4 9.5-4s9.5 1.8 9.5 4" />
      </svg>
      <span>{touch ? text.touch : text.mouse}</span>
    </div>
  );
}
