import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from './store';

export function DriftCam({ positionLerp = 0.08, rotationLerp = 0.03, driftWeight = 0.65, driftSpeedThreshold = 4, baseDistance = 5.5, baseHeight = 1.8 }) {
  const camera = useThree((state) => state.camera);
  const carPose = useStore((s) => s.carPose);
  const carVisualQuaternion = useStore((s) => s.carVisualQuaternion);
  const lastVel = useStore((s) => s.lastVel);
  const speedMphStore = useStore((s) => s.speed);
  const isDrifting = useStore((s) => (s.continuousDriftTime || 0) > 0);

  useFrame(() => {
    if (!carPose || !carPose.position) return;

    const carPos = new THREE.Vector3(...carPose.position);

    // prefer the visual quaternion when available (accounts for visual yaw)
    const meshQuat = (carVisualQuaternion && carVisualQuaternion.length === 4)
      ? new THREE.Quaternion(...carVisualQuaternion)
      : new THREE.Quaternion(...carPose.quaternion);

    const meshForward = new THREE.Vector3(0, 0, 1).applyQuaternion(meshQuat).setY(0).normalize();

    // velocity vector from physics (m/s)
    const vel = new THREE.Vector3(...(lastVel || [0, 0, 0]));
    const horizontalVel = new THREE.Vector3(vel.x, 0, vel.z);
    const speedMps = horizontalVel.length();

    // base look direction is the mesh forward; blend toward velocity when drifting
    const lookDirection = meshForward.clone();
    if (isDrifting && speedMps > driftSpeedThreshold) {
      const velDir = horizontalVel.clone().normalize();
      if (velDir.lengthSq() > 0.0001) lookDirection.lerp(velDir, driftWeight).normalize();
    }

    // camera target position sits behind the blended look direction
    const targetCamPos = carPos.clone().addScaledVector(lookDirection, -baseDistance).add(new THREE.Vector3(0, baseHeight, 0));
    camera.position.lerp(targetCamPos, positionLerp);

    // look a bit ahead using the mesh forward to keep the track visible
    const targetLookAt = carPos.clone().addScaledVector(meshForward, 2.0).add(new THREE.Vector3(0, 1.2, 0));
    const targetRotation = new THREE.Matrix4().lookAt(camera.position, targetLookAt, new THREE.Vector3(0, 1, 0));
    const targetQuat = new THREE.Quaternion().setFromRotationMatrix(targetRotation);
    camera.quaternion.slerp(targetQuat, rotationLerp);

    // FOV stretch based on stored speed (mph)
    const fovTarget = 60 + Math.min(140, Math.max(0, speedMphStore || 0)) / 140 * 25; // 60 -> 85
    camera.fov += (fovTarget - camera.fov) * 0.06;
    camera.updateProjectionMatrix();
  });

  return null;
}
