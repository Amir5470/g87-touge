import { Stars } from '@react-three/drei';
import { RigidBody } from '@react-three/rapier';
import { EffectComposer, Bloom, ChromaticAberration, Vignette, Scanline } from '@react-three/postprocessing';

export function World() {
  return (
    <>
      <color attach="background" args={["#081522"]} />
      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />

      {/* stronger ambient + hemisphere + directional for clear visibility */}
      <ambientLight intensity={0.5} />
      <hemisphereLight skyColor={0xffffff} groundColor={0x444444} intensity={0.6} />
      <directionalLight
        castShadow
        intensity={1.2}
        position={[30, 50, 10]}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-100}
        shadow-camera-right={100}
        shadow-camera-top={100}
        shadow-camera-bottom={-100}
      />

      <RigidBody type="fixed" friction={0.6}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
          <planeGeometry args={[800, 800]} />
          <meshStandardMaterial color="#0b0b0b" metalness={0.1} roughness={0.9} />
        </mesh>
        <gridHelper args={[800, 80, 0x444444, 0x222222]} position={[0, -0.49, 0]} />
      </RigidBody>

      <EffectComposer>
        <Bloom intensity={0.6} radius={0.25} mipmapBlur />
        <ChromaticAberration offset={[0.0015, 0.0015]} />
        <Scanline opacity={0.03} density={0.9} />
        <Vignette offset={0.08} darkness={0.32} />
      </EffectComposer>
    </>
  );
}
