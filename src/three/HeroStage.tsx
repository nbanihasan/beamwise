import { useEffect, useRef, useState } from 'react';
import { Stage } from './Stage';
import { HeroScene } from './HeroScene';

const NARROW = '(max-width: 700px)';

/**
 * Landing-page 3D scene, split into its own chunk so the page shell paints before three.js loads.
 * On wide screens the copy sits on the left, so the camera frames the beam to the right. On phones
 * the scene gets its own band below the copy, so the beam is centred and pulled back to fit.
 *
 * Wide screens: the copy lets pointer events through so the scene can be dragged from anywhere, but
 * the mouse wheel only zooms over the graphic itself (right of the text); over the text it scrolls
 * the page as normal.
 */
export default function HeroStage() {
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia(NARROW).matches);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const m = window.matchMedia(NARROW);
    const on = () => setNarrow(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);

  useEffect(() => {
    const el = wrap.current;
    if (!el || narrow) return;
    const onWheel = (e: WheelEvent) => {
      const hero = el.closest('.h-hero');
      const parts = hero ? hero.querySelectorAll<HTMLElement>('.h-hero-copy > *, .h-stats') : [];
      let textRight = 0;
      let overText = false;
      parts.forEach((p) => {
        // measure the visible text/buttons, not the full-width block box that contains them
        const range = document.createRange();
        range.selectNodeContents(p);
        const r = range.getBoundingClientRect();
        // the stats row spans the full width, so only the headline block sets the left/right boundary
        if (!p.classList.contains('h-stats')) textRight = Math.max(textRight, r.right);
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) overText = true;
      });
      // only the area to the right of the text counts as "the graphic"; anywhere else, let the page scroll
      if (overText || e.clientX < textRight + 24) e.stopPropagation();
    };
    // capture phase on the wrapper runs before the 3D controls' own listener on the canvas
    el.addEventListener('wheel', onWheel, { capture: true, passive: true });
    return () => el.removeEventListener('wheel', onWheel, { capture: true });
  }, [narrow]);

  return (
    <div ref={wrap} style={{ height: '100%' }}>
      {narrow ? (
        <Stage key="narrow" height="100%" camera={[-1.3, 0.6, 14.5]} target={[-1.3, 0.3, 0]} fov={50} bloom={1.1} hint={false} minDistance={6} maxDistance={22} flush>
          <HeroScene />
        </Stage>
      ) : (
        <Stage key="wide" height="100%" camera={[-3.4, 0.6, 12]} target={[-3.2, 0, 0]} fov={44} bloom={1.1} hint={false} minDistance={6} maxDistance={18} flush>
          <HeroScene />
        </Stage>
      )}
    </div>
  );
}
