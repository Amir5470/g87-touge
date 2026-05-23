import { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, useRapier } from '@react-three/rapier';
import { useKeyboardControls } from '@react-three/drei';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from './store';
import { getProgressAtPosition, getPointAt } from './trackUtils';

// Suspension / vehicle constants (tweak these to taste)
const SUSPENSION_REST_LENGTH = 0.35; // meters of travel
const SPRING_STIFFNESS = 45000; // N/m
const SPRING_DAMPING = 2500; // Ns/m
const CAR_MASS = 1500; // kg
// local wheel offsets (x: right, y: up, z: forward)
const WHEEL_OFFSETS = [
  new THREE.Vector3(0.8, -0.35, 1.3), // FL
  new THREE.Vector3(-0.8, -0.35, 1.3), // FR
  new THREE.Vector3(0.8, -0.35, -1.3), // RL
  new THREE.Vector3(-0.8, -0.35, -1.3), // RR
];
const POWER_SCALE = 0.12; // global fallback scaling for engine impulse

export function Vehicle() {
  const carBody = useRef();
  const { rapier, world } = useRapier();
  const setStats = useStore((s) => s.setStats);
  const saveSafePoint = useStore((s) => s.saveSafePoint);
  const setCarPose = useStore((s) => s.setCarPose);
  const setCarVisualQuaternion = useStore((s) => s.setCarVisualQuaternion);
  const setLastVelocity = useStore((s) => s.setLastVelocity);
  const triggerStatic = useStore((s) => s.triggerStatic);
  const kbHook = useKeyboardControls();

  // fallback key state (in case KeyboardControls hook isn't available as expected)
  const keysRef = useRef({ forward: false, backward: false, left: false, right: false, space: false });

  const frameCounterRef = useRef(0);

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
      if (e.code === 'Space') keysRef.current.space = true;
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
      if (e.code === 'Space') keysRef.current.space = false;
      window.__g87_keys = keysRef.current;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    // once the RigidBody ref is available, log its available methods for debugging
    const checkRb = setInterval(() => {
      if (carBody.current) {
        try {
          const keys = Object.keys(carBody.current).sort();
          console.info('[vehicle] RigidBody API keys:', keys);
          try { window.__rb_keys = keys; } catch (e) {}
          try { window.__rb_has_applyImpulse = typeof carBody.current.applyImpulse === 'function'; } catch (e) {}
          try { window.__rb_has_setLinvel = typeof carBody.current.setLinvel === 'function'; } catch (e) {}
          // expose some rapier/world debug info
          try {
            const worldKeys = world ? Object.keys(world).sort() : null;
            const rapierInfo = {
              worldHasCastRay: world && typeof world.castRay === 'function',
              worldHasRaw: world && typeof world.raw === 'function',
              worldKeys,
              rapierHasVector3: rapier && typeof rapier.Vector3 === 'function',
              rapierHasRay: rapier && typeof rapier.Ray === 'function',
            };
            try { window.__rapier_debug = rapierInfo; } catch (e) {}
          } catch (e) {}
          clearInterval(checkRb);
        } catch (e) {}
      }
    }, 500);
    return () => {
      clearInterval(id);
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [saveSafePoint, gltf]);

  useFrame((state, delta) => {
    try {
      if (!carBody.current) return;

    // merge keyboard control sources
    let { forward, backward, left, right, space } = keysRef.current;
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
    } catch (e) {}

    // chassis kinematic state
    const t = carBody.current.translation();
    const r = carBody.current.rotation();
    const lin = carBody.current.linvel();
    const ang = carBody.current.angvel();

    const chassisPos = new THREE.Vector3(t.x, t.y, t.z);
    const chassisQuat = new THREE.Quaternion(r.x, r.y, r.z, r.w);
    const linVel = new THREE.Vector3(lin.x, lin.y, lin.z);
    const angVel = new THREE.Vector3(ang.x, ang.y, ang.z);

    // global axes from chassis
    const globalForward = new THREE.Vector3(0, 0, 1).applyQuaternion(chassisQuat).normalize();
    const globalRight = new THREE.Vector3(1, 0, 0).applyQuaternion(chassisQuat).normalize();
    const globalUp = new THREE.Vector3(0, 1, 0).applyQuaternion(chassisQuat).normalize();

    // publish pose/visual quaternion and velocity for camera/HUD
    setCarPose([chassisPos.x, chassisPos.y, chassisPos.z], [r.x, r.y, r.z, r.w]);
    try {
      if (gltf && gltf.scene && typeof gltf.scene.getWorldQuaternion === 'function') {
        const vq = new THREE.Quaternion();
        gltf.scene.getWorldQuaternion(vq);
        setCarVisualQuaternion([vq.x, vq.y, vq.z, vq.w]);
      } else {
        setCarVisualQuaternion([r.x, r.y, r.z, r.w]);
      }
    } catch (e) {}
    setLastVelocity([lin.x, lin.y, lin.z]);

    // steering angle
    let steerAngle = 0;
    if (left) steerAngle = 0.52; // ~30deg
    if (right) steerAngle = -0.52;

    // compute speed for mechanics
    const speedMps = new THREE.Vector3(lin.x, 0, lin.z).length();
    const speedMph = speedMps * 2.23694;

    // fallback global engine impulse so vehicle still moves if raycasts miss
    try {
      const throttle = forward ? 1 : backward ? -0.4 : 0;
      const baseAccel = 26.8224 / 3.8; // m/s^2 target
      const baseForce = CAR_MASS * baseAccel; // N
      const engineForce = baseForce * throttle * POWER_SCALE;
      carBody.current.applyImpulse(globalForward.clone().multiplyScalar(engineForce * delta), true);
    } catch (e) {}

    // stronger immediate fallback: if holding forward and speed is near-zero, directly set a small forward velocity
    try {
      if (forward) {
        const currentSpeed = new THREE.Vector3(lin.x, 0, lin.z).length();
        if (currentSpeed < 0.5) {
          const boost = 2.0; // m/s immediate boost
          const nvx = lin.x + globalForward.x * boost * delta * 60;
          const nvz = lin.z + globalForward.z * boost * delta * 60;
          if (carBody.current.setLinvel) carBody.current.setLinvel({ x: nvx, y: lin.y, z: nvz }, true);
        }
      }
    } catch (e) {}

    // per-wheel suspension and tire loop
    let totalSlipAngle = 0;
    for (let i = 0; i < WHEEL_OFFSETS.length; i++) {
      const offset = WHEEL_OFFSETS[i];
      const isFront = i < 2;

      const offsetWorld = offset.clone().applyQuaternion(chassisQuat);
      const wheelWorldPos = chassisPos.clone().add(offsetWorld);

      // raycast downwards with Rapier if available
      let hit = null;
      try {
        if (world && typeof world.castRay === 'function' && rapier) {
          // start the ray above the wheel so it intersects the ground even if chassis is low
          const originY = wheelWorldPos.y + (SUSPENSION_REST_LENGTH + 0.5);
          const origin = new rapier.Vector3(wheelWorldPos.x, originY, wheelWorldPos.z);
          const dir = new rapier.Vector3(0, -1, 0);
          const ray = new rapier.Ray(origin, dir);
          const maxToi = SUSPENSION_REST_LENGTH + 0.6;
          hit = world.castRay(ray, maxToi, true);
        }
      } catch (e) {
        hit = null;
      }

      if (hit && hit.collider) {
        const hitDistance = hit.toi || 0;
        const compression = Math.max(0, SUSPENSION_REST_LENGTH - hitDistance);

        // wheel velocity = chassis linear vel + (angVel x r)
        const wheelVel = linVel.clone().add(angVel.clone().cross(offsetWorld.clone()));
        const upwardVel = wheelVel.dot(globalUp);

        // suspension force via Hooke's law with damping
        const suspensionForceMag = (compression * SPRING_STIFFNESS) - (upwardVel * SPRING_DAMPING);
        const suspensionForce = globalUp.clone().multiplyScalar(Math.max(0, suspensionForceMag));

        // apply suspension impulse (force * dt)
        const suspensionImpulse = suspensionForce.clone().multiplyScalar(delta);
        try {
          carBody.current.applyImpulse(suspensionImpulse, true);
          const torqueImp = offsetWorld.clone().cross(suspensionImpulse);
          if (typeof carBody.current.applyTorqueImpulse === 'function') carBody.current.applyTorqueImpulse({ x: torqueImp.x, y: torqueImp.y, z: torqueImp.z }, true);
        } catch (e) {}

        // wheel heading and right vectors (front wheels steer)
        const wheelForward = globalForward.clone();
        if (isFront) {
          const steerQ = new THREE.Quaternion().setFromAxisAngle(globalUp, steerAngle);
          wheelForward.applyQuaternion(steerQ);
        }
        const wheelRight = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), wheelForward).normalize().negate();

        // slip components
        const forwardVel = wheelVel.dot(wheelForward);
        const lateralVel = wheelVel.dot(wheelRight);

        if (!isFront) {
          totalSlipAngle += Math.abs(Math.atan2(lateralVel, Math.abs(forwardVel))) * (180 / Math.PI);
        }

        // drive torque on rear wheels (simple RWD)
        if (!isFront) {
          let motorForce = 0;
          if (forward && speedMph < 140) motorForce = 4500;
          if (backward) motorForce = -3000;
          const motorImpulse = wheelForward.clone().multiplyScalar(motorForce * delta);
          try {
            carBody.current.applyImpulse(motorImpulse, true);
            const motorTorque = offsetWorld.clone().cross(motorImpulse);
            if (typeof carBody.current.applyTorqueImpulse === 'function') carBody.current.applyTorqueImpulse({ x: motorTorque.x, y: motorTorque.y, z: motorTorque.z }, true);
          } catch (e) {}
        }

        // lateral grip and counteracting impulse
        let gripFactor = 0.95;
        if (!isFront && space) gripFactor = 0.15; // handbrake lowers rear grip
        const lateralImpulseMag = -lateralVel * (CAR_MASS * 0.25) * gripFactor;
        const lateralImpulse = wheelRight.clone().multiplyScalar(lateralImpulseMag * delta);
        try {
          carBody.current.applyImpulse(lateralImpulse, true);
          const latTorque = offsetWorld.clone().cross(lateralImpulse);
          if (typeof carBody.current.applyTorqueImpulse === 'function') carBody.current.applyTorqueImpulse({ x: latTorque.x, y: latTorque.y, z: latTorque.z }, true);
        } catch (e) {}

        // rolling resistance (small brake/drag)
        const rollingImpulse = wheelForward.clone().multiplyScalar(-forwardVel * (CAR_MASS * 0.02) * delta);
        try {
          carBody.current.applyImpulse(rollingImpulse, true);
        } catch (e) {}
      }
    }

    // finalize drift detection and HUD
    const finalDriftAngle = (totalSlipAngle / 2) || 0;
    const drifting = finalDriftAngle > 12 && speedMph > 15;
    setStats(speedMph, drifting, delta);

    // publish debug object for page inspection
    try {
      window.__vehicle_debug = {
        chassisPos: [chassisPos.x, chassisPos.y, chassisPos.z],
        linVel: [lin.x, lin.y, lin.z],
        angVel: [ang.x, ang.y, ang.z],
        speedMph: speedMph,
        finalDriftAngle,
        keys: keysRef.current,
      };
    } catch (e) {}

    // looping portal (use track progress to reset seamlessly)
    try {
      if (getProgressAtPosition) {
        const prog = getProgressAtPosition(chassisPos);
        if (prog > 0.99) {
          const target = getPointAt(0.01);
          carBody.current.setTranslation({ x: target.x, y: target.y + 1, z: target.z }, true);
          if (carBody.current.setLinvel) carBody.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
          if (carBody.current.setAngvel) carBody.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
        }
      }
    } catch (e) {
      if (chassisPos.z > 400) carBody.current.setTranslation({ x: chassisPos.x, y: chassisPos.y, z: 0 }, true);
    }

    // recovery
    if (chassisPos.y < -10) {
      triggerStatic(true);
      const safe = useStore.getState().lastSafePoint;
      if (safe && safe.position) {
        carBody.current.setTranslation({ x: safe.position[0], y: safe.position[1] + 1, z: safe.position[2] }, true);
        if (carBody.current.setLinvel) carBody.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
        if (carBody.current.setAngvel) carBody.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
      }
      setTimeout(() => triggerStatic(false), 1000);
    }

    // publish debug sampling
    frameCounterRef.current = (frameCounterRef.current + 1) % 10;
    if (frameCounterRef.current === 0) window.__g87_lastVel = [lin.x, lin.y, lin.z];
    try { window.__g87_angvel = carBody.current.angvel().y || 0; } catch (e) {}
    } catch (err) {
      try {
        window.__vehicle_errors = window.__vehicle_errors || [];
        window.__vehicle_errors.push((err && err.message) ? err.message : String(err));
      } catch (e) {}
      console.error('[vehicle] uncaught frame error', err);
    }
  });

  return (
    <RigidBody ref={carBody} colliders="cuboid" mass={CAR_MASS} angularDamping={0.6}>
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
