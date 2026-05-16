import { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody } from '@react-three/rapier';
import { useKeyboardControls } from '@react-three/drei';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from './store';
import { getProgressAtPosition, getPointAt } from './trackUtils';

export function Vehicle() {
  const carBody = useRef();
  const setStats = useStore((s) => s.setStats);
  const saveSafePoint = useStore((s) => s.saveSafePoint);
  const setCarPose = useStore((s) => s.setCarPose);
  const setCarVisualQuaternion = useStore((s) => s.setCarVisualQuaternion);
  const setLastVelocity = useStore((s) => s.setLastVelocity);
  const triggerStatic = useStore((s) => s.triggerStatic);
  const kbHook = useKeyboardControls();

  // fallback key state (in case KeyboardControls hook isn't available as expected)
  const keysRef = useRef({ forward: false, backward: false, left: false, right: false });

  const gearRef = useRef(1);
  const isShiftingRef = useRef(false);
  const shiftTimeoutRef = useRef();
  const mass = 1500;
  const POWER_SCALE = 0.12; // tune: increase so car actually accelerates
  const frameCounterRef = useRef(0);
  const stagnationRef = useRef(0);

  // load car GLB and compute a scale to roughly match a 4m chassis
  const gltf = useGLTF('/assets/models/G87/model.glb');
  const modelScale = useMemo(() => {
    try {
      if (!gltf || !gltf.scene) return 1;
      const box = new THREE.Box3().setFromObject(gltf.scene);
      const size = new THREE.Vector3();
      box.getSize(size);
      const desiredLength = 4.0; // meters
      if (size.z > 0.001) return desiredLength / size.z;
      return 1;
    } catch (e) {
      return 1;
    }
  }, [gltf]);

  useEffect(() => {
    // save a safe point every 5 seconds
    const id = setInterval(() => {
      if (!carBody.current) return;
      const t = carBody.current.translation();
      const r = carBody.current.rotation();
      saveSafePoint([t.x, t.y, t.z], [r.x, r.y, r.z, r.w]);
    }, 5000);

    // basic global key handlers so WASD works even if KeyboardControls setup differs
    const down = (e) => {
      const k = (e.key || '').toLowerCase();
      if (k === 'w' || k === 'arrowup') keysRef.current.forward = true;
      if (k === 's' || k === 'arrowdown') keysRef.current.backward = true;
      if (k === 'a' || k === 'arrowleft') keysRef.current.left = true;
      if (k === 'd' || k === 'arrowright') keysRef.current.right = true;
      // expose for debug overlay
      window.__g87_keys = keysRef.current;
      // debug nudge: press 'k' to apply a forward impulse for testing
      if (k === 'k' && carBody.current) {
        try {
          // prefer the visual/world quaternion (accounts for visual yaw tweaks)
          let fquat;
          if (gltf && gltf.scene && typeof gltf.scene.getWorldQuaternion === 'function') {
            fquat = new THREE.Quaternion();
            gltf.scene.getWorldQuaternion(fquat);
          } else {
            const r = carBody.current.rotation();
            fquat = new THREE.Quaternion(r.x || 0, r.y || 0, r.z || 0, r.w || 1);
          }
          const fv = new THREE.Vector3(0, 0, 1).applyQuaternion(fquat);
          // strong test impulse
          const impulse = fv.multiplyScalar(120);
          console.log('[debug] applying nudge impulse', impulse);
          carBody.current.applyImpulse(impulse, true);
        } catch (err) {
          console.warn('debug nudge failed', err);
        }
      }
    };
    const up = (e) => {
      const k = (e.key || '').toLowerCase();
      if (k === 'w' || k === 'arrowup') keysRef.current.forward = false;
      if (k === 's' || k === 'arrowdown') keysRef.current.backward = false;
      if (k === 'a' || k === 'arrowleft') keysRef.current.left = false;
      if (k === 'd' || k === 'arrowright') keysRef.current.right = false;
      window.__g87_keys = keysRef.current;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    // once the RigidBody ref is available, log its available methods for debugging
    const checkRb = setInterval(() => {
      if (carBody.current) {
        try {
          console.info('[vehicle] RigidBody API keys:', Object.keys(carBody.current).sort());
          clearInterval(checkRb);
        } catch (e) {}
      }
    }, 500);
    return () => {
      clearInterval(id);
      clearTimeout(shiftTimeoutRef.current);
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [saveSafePoint]);

  useFrame((state, delta) => {
    if (!carBody.current) return;
    // prefer the fallback captured keys (robust), optionally merge KeyboardControls
    let { forward, backward, left, right } = keysRef.current;
    try {
      const kb = kbHook;
      if (kb) {
        if (Array.isArray(kb) && typeof kb[1] === 'function') {
          const s = kb[1](); if (s) ({ forward = forward || s.forward, backward = backward || s.backward, left = left || s.left, right = right || s.right } = s);
        } else if (typeof kb === 'function') {
          const s = kb(); if (s) ({ forward = forward || s.forward, backward = backward || s.backward, left = left || s.left, right = right || s.right } = s);
        } else if (kb && typeof kb.get === 'function') {
          const s = kb.get(); if (s) ({ forward = forward || s.forward, backward = backward || s.backward, left = left || s.left, right = right || s.right } = s);
        }
      }
    } catch (e) {
      // ignore and use fallback keys
    }
    const curVel = carBody.current.linvel();
    const curRot = carBody.current.rotation();

    // compute a forward/right vector from the model's world quaternion when available
    let forwardQuat;
    try {
      if (gltf && gltf.scene && typeof gltf.scene.getWorldQuaternion === 'function') {
        forwardQuat = new THREE.Quaternion();
        gltf.scene.getWorldQuaternion(forwardQuat);
      } else {
        forwardQuat = new THREE.Quaternion(curRot.x || 0, curRot.y || 0, curRot.z || 0, curRot.w || 1);
      }
    } catch (e) {
      forwardQuat = new THREE.Quaternion(curRot.x || 0, curRot.y || 0, curRot.z || 0, curRot.w || 1);
    }
    // publish visual quaternion for camera use (keeps camera behind visual model)
    try {
      if (typeof setCarVisualQuaternion === 'function') setCarVisualQuaternion([forwardQuat.x, forwardQuat.y, forwardQuat.z, forwardQuat.w]);
    } catch (e) {}
    const forwardVec = new THREE.Vector3(0, 0, 1).applyQuaternion(forwardQuat);
    const rightVec = new THREE.Vector3(1, 0, 0).applyQuaternion(forwardQuat);

    const velocity = new THREE.Vector3(curVel.x, curVel.y, curVel.z);
    const speed = velocity.length();
    const speedMph = speed * 2.237;

    // torque map approximation so 0->60mph feels brisk (~3.8s)
    const baseAccel = 26.8224 / 3.8; // m/s^2 target
    const baseForce = mass * baseAccel; // N
    let throttle = forward ? 1 : backward ? -0.4 : 0;
    let engineForce = baseForce * throttle;

    if (isShiftingRef.current) engineForce *= 0.2; // shift shock (80% reduction)

    // apply forward/backwards impulse (scaled down by POWER_SCALE)
    engineForce = engineForce * POWER_SCALE;
    carBody.current.applyImpulse(forwardVec.clone().multiplyScalar(engineForce * delta), true);

    // fallback: if user is holding forward but velocity stays near zero for many frames, nudge via setLinvel
    if (forward) {
      if (speed < 0.02) {
        stagnationRef.current += 1;
      } else {
        stagnationRef.current = 0;
      }
      if (stagnationRef.current > 20) {
        try {
          const add = 1.2; // m/s nudge
          carBody.current.setLinvel({ x: curVel.x + forwardVec.x * add, y: curVel.y, z: curVel.z + forwardVec.z * add }, true);
          console.warn('[vehicle] stagnation nudge applied');
        } catch (e) {}
        stagnationRef.current = 0;
      }
    } else {
      stagnationRef.current = 0;
    }

    // steering: apply torque impulse for turning rather than overriding angvel
      const steerDir = left ? 1 : right ? -1 : 0;
      if (steerDir !== 0) {
        // steering: apply torque impulse for turning, with a stronger fallback to setAngvel
        const speedFactor = Math.min(1.6, Math.max(0.2, speed / 6));
        const torqueBase = 3.0; // stronger base torque
        const torque = torqueBase * steerDir * speedFactor;
        try {
          if (typeof carBody.current.applyTorqueImpulse === 'function') {
            carBody.current.applyTorqueImpulse({ x: 0, y: torque * delta * 60, z: 0 }, true);
          } else if (typeof carBody.current.applyTorque === 'function') {
            carBody.current.applyTorque({ x: 0, y: torque * delta * 60, z: 0 }, true);
          } else {
            throw new Error('no torque API');
          }
          console.debug('[vehicle] applyTorqueImpulse', torque, 'speedFactor', speedFactor);
        } catch (e) {
          // stronger fallback: directly add to angular velocity
          try {
            const ang = carBody.current.angvel();
            const extra = steerDir * (0.6 + speedFactor * 1.2);
            carBody.current.setAngvel({ x: ang.x, y: ang.y + extra, z: ang.z }, true);
            console.debug('[vehicle] fallback setAngvel applied', extra);
          } catch (err) {
            console.warn('[vehicle] steering fallback failed', err);
          }
        }
      }
      // Visual and lateral impulse steering fallback: rotate the visual model and nudge lateral velocity
      if (steerDir !== 0 && gltf && gltf.scene) {
        try {
          // visual yaw so driver sees car turning
          const visualYawSpeed = 1.6; // radians per second when steering
          gltf.scene.rotation.y += steerDir * visualYawSpeed * delta;
        } catch (e) {}
        try {
          // small lateral impulse to change trajectory
          const lateralImpulse = rightVec.clone().multiplyScalar(steerDir * 6 * POWER_SCALE * Math.max(1, speed));
          carBody.current.applyImpulse(lateralImpulse, true);
        } catch (e) {}
      }

    // slip / drift detection (threshold ~= 15 degrees)
    const velFlat = velocity.clone().setY(0);
    const forwardFlat = forwardVec.clone().setY(0).normalize();
    const velDir = velFlat.length() > 0 ? velFlat.clone().normalize() : new THREE.Vector3(0, 0, 1);
    const slipAngle = velDir.angleTo(forwardFlat);
    const isDrifting = slipAngle > (15 * Math.PI / 180) && velFlat.length() > 5;

    // Drift hack: reduce lateral correction / friction on rear by 35%
    const lateralSpeed = velFlat.dot(rightVec);
    const lateralVec = rightVec.clone().multiplyScalar(lateralSpeed);
    const lateralCorrectionMag = mass * (isDrifting ? 0.35 : 1) * delta * 0.02;
    const lateralCorrection = lateralVec.clone().multiplyScalar(-lateralCorrectionMag);
    carBody.current.applyImpulse(lateralCorrection, true);

    // Increased angular damping while drifting (approximate by scaling angvel)
    const ang = carBody.current.angvel();
    if (isDrifting) {
      const damp = 4.0;
      carBody.current.setAngvel({ x: ang.x * (1 - Math.min(damp * delta, 0.99)), y: ang.y * (1 - Math.min(damp * delta, 0.99)), z: ang.z * (1 - Math.min(damp * delta, 0.99)) }, true);
    }

    // Simple automatic transmission (gear thresholds in mph)
    const thresholds = [0, 15, 30, 45, 60];
    const gear = gearRef.current;
    if (!isShiftingRef.current && gear < thresholds.length - 1 && speedMph > thresholds[gear]) {
      isShiftingRef.current = true;
      clearTimeout(shiftTimeoutRef.current);
      shiftTimeoutRef.current = setTimeout(() => {
        gearRef.current = Math.min(thresholds.length - 1, gearRef.current + 1);
        isShiftingRef.current = false;
      }, 150);
    }

    // Camera handled by `DriftCam`; update pose for camera/other systems
    const t = carBody.current.translation();
    const carPos = new THREE.Vector3(t.x, t.y, t.z);

    // Looping portal (use track progress to reset seamlessly)
    try {
      const prog = getProgressAtPosition(carPos);
      if (prog > 0.99) {
        const target = getPointAt(0.01);
        carBody.current.setTranslation({ x: target.x, y: target.y + 1, z: target.z }, true);
        if (carBody.current.setLinvel) carBody.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
        if (carBody.current.setAngvel) carBody.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
      }
    } catch (e) {
      // fall back to Z-reset if track utilities aren't ready
      if (carPos.z > 400) carBody.current.setTranslation({ x: carPos.x, y: carPos.y, z: 0 }, true);
    }

    // Fall / recovery (Mario Kart style)
    if (carPos.y < -10) {
      triggerStatic(true);
      const safe = useStore.getState().lastSafePoint;
      if (safe && safe.position) {
        carBody.current.setTranslation({ x: safe.position[0], y: safe.position[1] + 1, z: safe.position[2] }, true);
        if (carBody.current.setLinvel) carBody.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
        if (carBody.current.setAngvel) carBody.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
      }
      setTimeout(() => triggerStatic(false), 1000);
    }

    // update HUD/store with speed, drift and pose
    setStats(speed, isDrifting, delta);
    setCarPose([carPos.x, carPos.y, carPos.z], [curRot.x, curRot.y, curRot.z, curRot.w]);
    setLastVelocity([curVel.x, curVel.y, curVel.z]);

    // publish a sampled lastVel for debug overlay
    frameCounterRef.current = (frameCounterRef.current + 1) % 10;
    if (frameCounterRef.current === 0) window.__g87_lastVel = [curVel.x, curVel.y, curVel.z];
      // angular velocity for debug
      try {
        const av = carBody.current.angvel();
        window.__g87_angvel = av.y || 0;
      } catch (e) {}
    // occasional console debug for forward input
    if (frameCounterRef.current === 0 && forward) {
      try {
        console.debug('[vehicle] throttle', throttle, 'engineForce', engineForce, 'impulse', engineForce * delta, 'speed', speed);
      } catch (e) {}
    }
  });

  return (
    <RigidBody ref={carBody} colliders="cuboid" mass={1500} angularDamping={0.6}>
      <group castShadow receiveShadow scale={[modelScale, modelScale, modelScale]}> 
        {gltf && gltf.scene ? <primitive object={gltf.scene} /> : (
          <mesh>
            <boxGeometry args={[1.8, 0.8, 4]} />
            <meshStandardMaterial color="#111" />
          </mesh>
        )}
      </group>
      <spotLight position={[0, 0.6, 2.4]} angle={0.5} intensity={2.5} distance={30} castShadow color="#fffaee" />
      <pointLight position={[0, -0.3, -1.9]} color="red" intensity={0.5} distance={5} />
    </RigidBody>
  );
}
