import { CylinderGeometry, Group, Mesh, MeshStandardMaterial, Object3D, TorusGeometry, Vector3 } from '@iwsdk/core';
import { BigfootRig, createBigfoot } from './bigfoot.js';

/**
 * Bigfoot's cousin the Yeti, the rooftop DJ: the same rigged model with snow-white
 * fur (the fur texture is turned to brightened grey so its detail survives) and
 * a pair of DJ headphones on his head.
 */
export async function createYeti(): Promise<BigfootRig> {
  const rig = await createBigfoot();
  rig.root.name = 'Yeti';
  rig.root.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    const mat = (mesh.material as MeshStandardMaterial).clone();
    mat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        float fur = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
        diffuseColor.rgb = vec3(fur) * vec3(2.3, 2.4, 2.6);`,
      );
    };
    mat.customProgramCacheKey = () => 'yeti-fur';
    mesh.material = mat;
  });
  const head = findHead(rig.root);
  if (head) {
    const phones = headphones();
    // Bones carry the rig's unit scale; undo it so the headphones keep real size.
    rig.root.updateMatrixWorld(true);
    const s = head.getWorldScale(new Vector3());
    phones.scale.setScalar(1 / Math.max(1e-4, s.x));
    head.add(phones);
  }
  return rig;
}

function findHead(root: Object3D): Object3D | undefined {
  let head: Object3D | undefined;
  root.traverse((o) => {
    if (!head && /Head$/.test(o.name)) head = o;
  });
  return head;
}

/** Over-ear DJ headphones, sized for a 1.6 m Yeti (band over the crown, cups at the ears). */
function headphones(): Group {
  const g = new Group();
  g.name = 'Headphones';
  const black = new MeshStandardMaterial({ color: 0x15151a, roughness: 0.4, metalness: 0.3 });
  const accent = new MeshStandardMaterial({ color: 0xff5fb8, roughness: 0.3, emissive: 0xff5fb8, emissiveIntensity: 0.6 });
  const band = new Mesh(new TorusGeometry(0.115, 0.012, 8, 24, Math.PI), black);
  band.position.y = 0.1;
  g.add(band);
  for (const side of [-1, 1]) {
    const cup = new Mesh(new CylinderGeometry(0.045, 0.045, 0.035, 18), black);
    cup.rotation.z = Math.PI / 2;
    cup.position.set(side * 0.115, 0.1, 0);
    const ring = new Mesh(new CylinderGeometry(0.047, 0.047, 0.006, 18), accent);
    ring.rotation.z = Math.PI / 2;
    ring.position.set(side * 0.135, 0.1, 0);
    g.add(cup, ring);
  }
  return g;
}
