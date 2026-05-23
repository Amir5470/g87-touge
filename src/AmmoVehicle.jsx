import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from './store';

// Ammo vehicle constants (inspired by the car-explorer-sandbox defaults)
const CAR_MASS = 1500;
const SUSPENSION_REST_LENGTH = 0.6;
const WHEEL_RADIUS_FRONT = 0.35;
const WHEEL_RADIUS_BACK = 0.4;
const SUSPENSION_STIFFNESS = 20.0;
const SUSPENSION_DAMPING = 2.3;
const SUSPENSION_COMPRESSION = 4.4;
const FRICTION = 1000;

export function AmmoVehicle() {
  const gltf = useGLTF('/assets/models/G87/model.glb');
  const modelScale = useMemo(() => {
    try {
      if (!gltf || !gltf.scene) return 1;
      const box = new THREE.Box3().setFromObject(gltf.scene);
      const size = new THREE.Vector3();
      box.getSize(size);
      const desiredLength = 4.0;
      if (size.z > 0.001) return desiredLength / size.z;
      return 1;
    } catch (e) {
      return 1;
    }
  }, [gltf]);

  const meshRef = useRef();
  const worldRef = useRef(null);
  const vehicleRef = useRef(null);
  const chassisBodyRef = useRef(null);
  const keysRef = useRef({ forward: false, backward: false, left: false, right: false, space: false });

  // keyboard fallback
  useEffect(() => {
    const down = (e) => {
      const k = (e.key || '').toLowerCase();
      if (k === 'w' || k === 'arrowup') keysRef.current.forward = true;
      if (k === 's' || k === 'arrowdown') keysRef.current.backward = true;
      if (k === 'a' || k === 'arrowleft') keysRef.current.left = true;
      if (k === 'd' || k === 'arrowright') keysRef.current.right = true;
      if (e.code === 'Space') keysRef.current.space = true;
      window.__ammo_keys = keysRef.current;
    };
    const up = (e) => {
      const k = (e.key || '').toLowerCase();
      if (k === 'w' || k === 'arrowup') keysRef.current.forward = false;
      if (k === 's' || k === 'arrowdown') keysRef.current.backward = false;
      if (k === 'a' || k === 'arrowleft') keysRef.current.left = false;
      if (k === 'd' || k === 'arrowright') keysRef.current.right = false;
      if (e.code === 'Space') keysRef.current.space = false;
      window.__ammo_keys = keysRef.current;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  // init Ammo world and raycast vehicle
  useEffect(() => {
    let mounted = true;
    let localRefs = {};

    const initAmmo = async () => {
      try {
        // prefer global `window.Ammo` (CDN). If absent, try dynamic import from the `ammo.js` package.
        let AmmoLib = window.Ammo;
        if (!AmmoLib) {
          try {
            const mod = await import(/* @vite-ignore */ 'ammo.js');
            AmmoLib = (mod && (mod.default || mod)) || null;
          } catch (err) {
            console.warn('[AmmoVehicle] ammo not available via dynamic import', err);
            // give up early — Ammo isn't available in this environment
            return;
          }
        }
        const Ammo = typeof AmmoLib === 'function' ? await AmmoLib() : AmmoLib;

        // physics world
        const collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
        const dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration);
        const overlappingPairCache = new Ammo.btDbvtBroadphase();
        const solver = new Ammo.btSequentialImpulseConstraintSolver();
        const dynamicsWorld = new Ammo.btDiscreteDynamicsWorld(dispatcher, overlappingPairCache, solver, collisionConfiguration);
        dynamicsWorld.setGravity(new Ammo.btVector3(0, -9.82, 0));

        // compute chassis box from model bounds
        const box = new THREE.Box3().setFromObject(gltf.scene || new THREE.Object3D());
        const size = new THREE.Vector3();
        box.getSize(size);
        const hx = (size.x * modelScale) * 0.5 || 1;
        const hy = (size.y * modelScale) * 0.5 || 0.5;
        const hz = (size.z * modelScale) * 0.5 || 2;

        const transform = new Ammo.btTransform();
        transform.setIdentity();
        transform.setOrigin(new Ammo.btVector3(0, 1.2, 0));

        const chassisShape = new Ammo.btBoxShape(new Ammo.btVector3(hx, hy, hz));
        chassisShape.setMargin(0.05);

        const localInertia = new Ammo.btVector3(0, 0, 0);
        chassisShape.calculateLocalInertia(CAR_MASS, localInertia);

        const motionState = new Ammo.btDefaultMotionState(transform);
        const rbInfo = new Ammo.btRigidBodyConstructionInfo(CAR_MASS, motionState, chassisShape, localInertia);
        const chassisBody = new Ammo.btRigidBody(rbInfo);
        dynamicsWorld.addRigidBody(chassisBody);

        // vehicle and tuning
        const tuning = new Ammo.btVehicleTuning();
        const rayCaster = new Ammo.btDefaultVehicleRaycaster(dynamicsWorld);
        const vehicle = new Ammo.btRaycastVehicle(tuning, chassisBody, rayCaster);
        vehicle.setCoordinateSystem(0, 1, 2);
        dynamicsWorld.addAction(vehicle);

        // wheel geometry positions (relative to chassis)
        const wheelPositions = [
          { x: 0.8, y: 0.0, z: 1.3, front: true },
          { x: -0.8, y: 0.0, z: 1.3, front: true },
          { x: -0.8, y: 0.0, z: -1.3, front: false },
          { x: 0.8, y: 0.0, z: -1.3, front: false },
        ];

        const wheelDirectionCS0 = new Ammo.btVector3(0, -1, 0);
        const wheelAxleCS = new Ammo.btVector3(-1, 0, 0);

        for (let i = 0; i < wheelPositions.length; i++) {
          const wp = wheelPositions[i];
          const pos = new Ammo.btVector3(wp.x * modelScale, wp.y * modelScale, wp.z * modelScale);
          const radius = wp.front ? WHEEL_RADIUS_FRONT : WHEEL_RADIUS_BACK;
          const wheelInfo = vehicle.addWheel(pos, wheelDirectionCS0, wheelAxleCS, SUSPENSION_REST_LENGTH, radius, tuning, wp.front);

          wheelInfo.set_m_suspensionStiffness(SUSPENSION_STIFFNESS);
          wheelInfo.set_m_wheelsDampingRelaxation(SUSPENSION_DAMPING);
          wheelInfo.set_m_wheelsDampingCompression(SUSPENSION_COMPRESSION);
          wheelInfo.set_m_frictionSlip(FRICTION);
          wheelInfo.set_m_rollInfluence(0.2);
        }

        // store refs
        worldRef.current = { Ammo, dynamicsWorld };
        vehicleRef.current = vehicle;
        chassisBodyRef.current = chassisBody;
        localRefs = { Ammo, dynamicsWorld, vehicle, chassisBody };

        console.info('[AmmoVehicle] initialized');
      } catch (err) {
        console.error('[AmmoVehicle] init error', err);
      }
    };

    initAmmo();

    return () => {
      mounted = false;
      // note: not freeing WASM memory here for brevity; page reload will reclaim it
      worldRef.current = null;
      vehicleRef.current = null;
      chassisBodyRef.current = null;
    };
  }, [gltf, modelScale]);

  useFrame((state, delta) => {
    try {
      if (!worldRef.current || !vehicleRef.current || !chassisBodyRef.current) return;
      const { Ammo, dynamicsWorld } = worldRef.current;

      // merge controls: `window.actions` (if present) and local keys fallback
      const actions = Object.assign({}, keysRef.current, (window.actions || {}));

      // steering and engine tuning (conservative defaults)
      let steering = 0;
      if (actions.left) steering = 0.45;
      if (actions.right) steering = -0.45;

      const vehicle = vehicleRef.current;
      vehicle.setSteeringValue(steering, 0);
      vehicle.setSteeringValue(steering, 1);

      let engineForce = 0;
      let breakingForce = 0;
      if (actions.forward || actions.acceleration) engineForce = 1500;
      if (actions.backward || actions.braking) engineForce = -800;
      if (actions.space) breakingForce = 150;

      // apply engine/brake to rear wheels (2 and 3)
      vehicle.applyEngineForce(engineForce, 2);
      vehicle.applyEngineForce(engineForce, 3);
      vehicle.setBrake(breakingForce, 0);
      vehicle.setBrake(breakingForce, 1);
      vehicle.setBrake(breakingForce, 2);
      vehicle.setBrake(breakingForce, 3);

      // step the simulation
      dynamicsWorld.stepSimulation(delta, 10);

      // update chassis transform to mesh
      const tm = vehicle.getChassisWorldTransform();
      const origin = tm.getOrigin();
      const rotation = tm.getRotation();
      if (meshRef.current) {
        meshRef.current.position.set(origin.x(), origin.y(), origin.z());
        meshRef.current.quaternion.set(rotation.x(), rotation.y(), rotation.z(), rotation.w());
      }

      // publish debug info
      try {
        const linVel = chassisBodyRef.current.getLinearVelocity();
        const speedMps = Math.sqrt(linVel.x() * linVel.x() + linVel.y() * linVel.y() + linVel.z() * linVel.z());
        window.__ammo_vehicle_debug = { pos: [origin.x(), origin.y(), origin.z()], speedMps, keys: keysRef.current };
      } catch (e) {}
    } catch (err) {
      console.error('[AmmoVehicle] frame error', err);
    }
  });

  return (
    <group ref={meshRef} scale={[modelScale, modelScale, modelScale]}>
      {gltf && gltf.scene ? (
        <primitive object={gltf.scene} />
      ) : (
        <mesh>
          <boxGeometry args={[1.8, 0.8, 4]} />
          <meshStandardMaterial color="#111" />
        </mesh>
      )}
    </group>
  );
}

export default AmmoVehicle;
