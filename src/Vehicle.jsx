import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, vec3 } from '@react-three/rapier';
import { useKeyboardControls } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from './store';

export function Vehicle() {
  const carBody = useRef();
  const setStats = useStore((s) => s.setStats);
  const [, getKeys] = useKeyboardControls();
  const vPos = new THREE.Vector3();
  const vLook = new THREE.Vector3();

  useFrame((state, delta) => {
    if (!carBody.current) return;
    const { forward, backward, left, right } = getKeys();
    const curVel = carBody.current.linvel();
    const curRot = carBody.current.rotation();
    const forwardVec = new THREE.Vector3(0, 0, 1).applyQuaternion(curRot);

    const engineForce = forward ? 60 : backward ? -30 : 0;
    carBody.current.applyImpulse(forwardVec.multiplyScalar(engineForce * delta * 600), true);

    if (left) carBody.current.setAngvel({ x: 0, y: 2.5, z: 0 }, true);
    if (right) carBody.current.setAngvel({ x: 0, y: -2.5, z: 0 }, true);

    const velocity = new THREE.Vector3(curVel.x, 0, curVel.z);
    const slipAngle = velocity.clone().normalize().angleTo(forwardVec);
    const isDrifting = slipAngle > 0.3 && velocity.length() > 5;

    const carPos = vec3(carBody.current.translation());
    vPos.lerp(carPos.clone().add(new THREE.Vector3(0, 2, -6).applyQuaternion(curRot)), 0.1);
    vLook.lerp(carPos.clone().add(new THREE.Vector3(0, 0, 5).applyQuaternion(curRot)), 0.15);
    state.camera.position.copy(vPos);
    state.camera.lookAt(vLook);

    if (carPos.z > 400) carBody.current.setTranslation({ x: carPos.x, y: carPos.y, z: 0 }, true);
    setStats(velocity.length(), isDrifting);
  });

  return (
    <RigidBody ref={carBody} colliders="cuboid" mass={1500} angularDamping={5}>
      <mesh castShadow>
        <boxGeometry args={[1.8, 0.8, 4]} />
        <meshStandardMaterial color="#111" roughness={0.1} metalness={0.9} />
      </mesh>
      <spotLight position={[0, 0, 2.1]} angle={0.6} intensity={100} distance={60} castShadow color="#fffaee" />
    </RigidBody>
  );
}
