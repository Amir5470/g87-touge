import React from 'react';
import { useGLTF } from '@react-three/drei';

export function CarModel(props) {
  const gltf = useGLTF('/assets/models/G87/model.glb');
  return <primitive object={gltf.scene} {...props} />;
}

useGLTF.preload('/assets/models/G87/model.glb');
