import { Stars } from '@react-three/drei';
import { RigidBody } from '@react-three/rapier';
import { EffectComposer, Bloom, ChromaticAberration, Vignette, Scanline } from '@react-three/postprocessing';

export function World() {
  return (
    <>
      <color attach="background" args={["#010101"]} />
      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
      <ambientLight intensity={0.05} />
      <RigidBody type="fixed" friction={2}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 200]}>
          <planeGeometry args={[30, 1000]} />
          <meshStandardMaterial color="#050505" />
        </mesh>
        <gridHelper args={[30, 100, 0x440000, 0x111111]} position={[0, -0.49, 200]} />
      </RigidBody>
      <EffectComposer>
        <Bloom luminanceThreshold={1} intensity={1.5} mipmapBlur />
        <ChromaticAberration offset={[0.002, 0.002]} />
        <Scanline opacity={0.15} density={1.2} />
        <Vignette offset={0.1} darkness={0.9} />
      </EffectComposer>
    </>
  );
}
