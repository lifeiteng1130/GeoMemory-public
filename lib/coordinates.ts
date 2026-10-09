import * as THREE from 'three';

const DEG_TO_RAD = Math.PI / 180;

export function latLonToVector3(
  lat: number,
  lon: number,
  radius: number = 1
): THREE.Vector3 {
  const phi = (90 - lat) * DEG_TO_RAD;
  const theta = (lon + 180) * DEG_TO_RAD;

  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);

  return new THREE.Vector3(x, y, z);
}
