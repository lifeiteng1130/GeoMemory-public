import type { ReactNode, Ref } from 'react';
import type { Mesh, Vector3 } from 'three';

// React 19 JSX contracts for the retained legacy GlowPoint component only.
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      mesh: { ref?: Ref<Mesh>; position?: Vector3; onClick?: () => void; children?: ReactNode };
      sphereGeometry: { args?: [number, number, number] };
      meshBasicMaterial: { color?: string; transparent?: boolean; opacity?: number };
    }
  }
}
