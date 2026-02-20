import { createRoot } from 'react-dom/client';
import App from './App';
import * as THREE from 'three';
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
import './ui/styles.css';

// Apply BVH extensions to Three.js globally
(THREE.BufferGeometry.prototype as any).computeBoundsTree = computeBoundsTree;
(THREE.BufferGeometry.prototype as any).disposeBoundsTree = disposeBoundsTree;
(THREE.Mesh.prototype as any).raycast = acceleratedRaycast;

createRoot(document.getElementById('root')!).render(<App />);
