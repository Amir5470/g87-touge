import { Canvas } from '@react-three/fiber';
import { KeyboardControls } from '@react-three/drei';
import { Physics } from '@react-three/rapier';
import { Vehicle } from './Vehicle';
import { World } from './World';
import { HUD } from './HUD';

const map = [
  { name: 'forward', keys: ['ArrowUp', 'w', 'W'] },
  { name: 'backward', keys: ['ArrowDown', 's', 'S'] },
  { name: 'left', keys: ['ArrowLeft', 'a', 'A'] },
  { name: 'right', keys: ['ArrowRight', 'd', 'D'] },
];

export default function App() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000' }}>
      <KeyboardControls map={map}>
        <Canvas shadows camera={{ fov: 45 }}>
          <Physics gravity={[0, -9.81, 0]}>
            <Vehicle />
            <World />
          </Physics>
        </Canvas>
        <HUD />
      </KeyboardControls>
    </div>
  );
}
