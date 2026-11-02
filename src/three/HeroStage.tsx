import { Stage } from './Stage';
import { HeroScene } from './HeroScene';

/** Landing-page 3D scene, split into its own chunk so the page shell paints before three.js loads. */
export default function HeroStage() {
  return (
    <Stage height="100%" camera={[0.4, 0.8, 12.5]} fov={44} bloom={1.1} autoRotate hint={false} minDistance={6} maxDistance={18}>
      <HeroScene />
    </Stage>
  );
}
