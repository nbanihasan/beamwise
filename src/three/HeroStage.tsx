import { Stage } from './Stage';
import { HeroScene } from './HeroScene';

/** Landing-page 3D scene, split into its own chunk so the page shell paints before three.js loads. */
export default function HeroStage() {
  return (
    <Stage height="100%" camera={[-3.4, 0.6, 12]} target={[-3.2, 0, 0]} fov={44} bloom={1.1} hint={false} minDistance={6} maxDistance={18} flush>
      <HeroScene />
    </Stage>
  );
}
