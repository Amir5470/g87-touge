import { Canvas } from '@react-three/fiber';
import { KeyboardControls } from '@react-three/drei';
import { Physics } from '@react-three/rapier';
import { AmmoVehicle } from './AmmoVehicle';
import { World } from './World';
import { Track } from './Track';
import { HUD } from './HUD';
import { DriftCam } from './DriftCam';
import { useStore } from './store';
import { DebugOverlay } from './DebugOverlay';

const map = [
  { name: 'forward', keys: ['ArrowUp', 'w', 'W'] },
  { name: 'backward', keys: ['ArrowDown', 's', 'S'] },
  { name: 'left', keys: ['ArrowLeft', 'a', 'A'] },
  { name: 'right', keys: ['ArrowRight', 'd', 'D'] },
];

export default function App() {
  const staticOverlay = useStore((s) => s.staticOverlay);
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000' }}>
      <KeyboardControls map={map}>
        <Canvas shadows camera={{ fov: 60 }}>
          <Physics gravity={[0, -9.81, 0]}>
            <AmmoVehicle />
            <Track />
            <World />
            <DriftCam />
          </Physics>
        </Canvas>
        <DebugOverlay />
        {staticOverlay && (
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'rgba(255,255,255,0.92)', mixBlendMode: 'screen' }} />
        )}
        <HUD />
      </KeyboardControls>
    </div>
  );
}
