import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber/native';
import * as THREE from 'three';
import { latLonToVector3 } from '../lib/coordinates';

interface GlowPointProps {
  lat: number;
  lon: number;
  radius?: number;
  color?: string;
  memoryId: string;
  onPress: (id: string) => void;
}

export default function GlowPoint({
  lat,
  lon,
  radius = 1.02,
  color = '#00ffaa',
  memoryId,
  onPress,
}: GlowPointProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const position = latLonToVector3(lat, lon, radius);

  useFrame((_, delta) => {
    if (meshRef.current) {
      const scale = 1 + 0.3 * Math.sin(Date.now() * 0.003);
      meshRef.current.scale.setScalar(scale);
    }
  });

  return (
    <mesh
      ref={meshRef}
      position={position}
      onClick={() => onPress(memoryId)}
    >
      <sphereGeometry args={[0.02, 16, 16]} />
      <meshBasicMaterial color={color} transparent opacity={0.9} />
    </mesh>
  );
}
