import { useEffect, useState } from 'react';
import { Stage } from './Stage';
import { HeroScene } from './HeroScene';

const NARROW = '(max-width: 700px)';

/**
 * Landing-page 3D scene, split into its own chunk so the page shell paints before three.js loads.
 * On wide screens the copy sits on the left, so the camera frames the beam to the right. On phones
 * the scene gets its own band above the copy, so the beam is centred and pulled back to fit.
 */
export default function HeroStage() {
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia(NARROW).matches);
  useEffect(() => {
    const m = window.matchMedia(NARROW);
    const on = () => setNarrow(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return narrow ? (
    <Stage key="narrow" height="100%" camera={[-1.3, 0.6, 14.5]} target={[-1.3, 0.3, 0]} fov={50} bloom={1.1} hint={false} minDistance={6} maxDistance={22} flush>
      <HeroScene />
    </Stage>
  ) : (
    <Stage key="wide" height="100%" camera={[-3.4, 0.6, 12]} target={[-3.2, 0, 0]} fov={44} bloom={1.1} hint={false} minDistance={6} maxDistance={18} flush>
      <HeroScene />
    </Stage>
  );
}
