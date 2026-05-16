import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from './store';

export function DriftCam({ lerpSpeed = 0.12 }) {
  const camera = useThree((state) => state.camera);
  const carPose = useStore((s) => s.carPose);
  const carVisualQuaternion = useStore((s) => s.carVisualQuaternion);
  const lastVel = useStore((s) => s.lastVel);

  useFrame(() => {
    if (!carPose || !carPose.position) return;
    const pos = new THREE.Vector3(...carPose.position);
    // prefer the visual quaternion (model) when available so camera follows the visible car
    const quat = (carVisualQuaternion && carVisualQuaternion.length === 4)
      ? new THREE.Quaternion(...carVisualQuaternion)
      : new THREE.Quaternion(...carPose.quaternion);
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(quat);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(quat);

    // Keep camera behind the car for a stable chase view
    const pivot = pos.clone().sub(forward.clone().multiplyScalar(4));
    const vel = new THREE.Vector3(...(lastVel || [0, 0, 0]));
    // minimal lateral offset so camera stays centered behind the car
    const offset = right.clone().multiplyScalar(0.0);

    const desiredPos = pivot.clone().add(offset).add(new THREE.Vector3(0, 1.6, 0));
    // location lerp (tight)
    camera.position.lerp(desiredPos, lerpSpeed);

    // rotation/look lerp
    const desiredLook = pos.clone().add(new THREE.Vector3(0, 1.2, 0));
    const curLook = camera.getWorldDirection(new THREE.Vector3()).add(camera.position);
    const newLook = curLook.lerp(desiredLook, 0.06);
    camera.lookAt(newLook);

    // FOV dynamics: base 60 -> 75 at 140 mph (less extreme)
    const speedMph = vel.length() * 2.237;
    const targetFov = 60 + (Math.min(140, speedMph) / 140) * (75 - 60);
    camera.fov += (targetFov - camera.fov) * 0.06;
    camera.updateProjectionMatrix();
  });

  return null;
}
