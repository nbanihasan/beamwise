import { Component, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { InteractHint } from './InteractHint';

/**
 * Shared 3D stage. Mounts a WebGL canvas only while the figure is near the viewport, so a lesson
 * with many scenes never exceeds the browser's WebGL-context limit.
 */
interface StageProps {
  children: ReactNode;
  height?: number | string;
  camera?: [number, number, number];
  target?: [number, number, number];
  fov?: number;
  bloom?: number;
  orbit?: boolean;
  autoRotate?: boolean;
  /** optional caption in the corner (what the scene shows); the gesture hint is automatic */
  hint?: string | false;
  flush?: boolean;
  minDistance?: number;
  maxDistance?: number;
  overlay?: ReactNode;
}

class GLBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) return <div className="scene-fallback">3D view unavailable in this browser. The plots and controls still work.</div>;
    return this.props.children;
  }
}

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export function Stage({
  children,
  height = 380,
  camera = [6, 4, 7],
  target = [0, 0, 0],
  fov = 40,
  bloom = 0.9,
  orbit = true,
  autoRotate = false,
  hint = false,
  flush,
  minDistance = 2,
  maxDistance = 40,
  overlay,
}: StageProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [gl] = useState(webglAvailable);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => setVisible(e[0].isIntersecting), { rootMargin: '300px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  return (
    <div className={`scene ${flush ? 'flush' : ''}`} ref={ref} style={{ height }}>
      {!gl && <div className="scene-fallback">This browser has WebGL turned off, so the 3D view is hidden. Everything else on the page still works.</div>}
      {gl && visible && (
        <GLBoundary>
          <Canvas dpr={[1, 2]} camera={{ position: camera, fov, near: 0.05, far: 400 }} gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}>
            <Suspense fallback={null}>
              {children}
              {bloom > 0 && (
                <EffectComposer multisampling={0}>
                  <Bloom intensity={bloom} luminanceThreshold={0.55} luminanceSmoothing={0.25} mipmapBlur radius={0.7} />
                  <Vignette eskil={false} offset={0.2} darkness={0.55} />
                </EffectComposer>
              )}
            </Suspense>
            {orbit && (
              <OrbitControls
                makeDefault
                target={target}
                enablePan={false}
                enableDamping
                dampingFactor={0.08}
                minDistance={minDistance}
                maxDistance={maxDistance}
                autoRotate={autoRotate && !reduced}
                autoRotateSpeed={0.5}
              />
            )}
          </Canvas>
        </GLBoundary>
      )}
      {overlay}
      {hint && gl && <div className="scene-hint">{hint}</div>}
      {orbit && gl && visible && <InteractHint target={ref} />}
    </div>
  );
}
