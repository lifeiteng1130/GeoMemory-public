// Minimal contracts for the retained, currently unused legacy 3D components.
// These declarations do not install the runtime packages or enable the 3D scene.
declare module 'three' {
  export class Vector3 {
    constructor(x?: number, y?: number, z?: number);
    x: number;
    y: number;
    z: number;
    setScalar(scalar: number): this;
  }

  export class Mesh {
    scale: Vector3;
  }
}

declare module '@react-three/fiber/native' {
  export function useFrame(callback: (state: unknown, delta: number) => void): void;
}
