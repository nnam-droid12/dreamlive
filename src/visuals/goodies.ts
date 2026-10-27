import { Color, ConeGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, SphereGeometry, BoxGeometry, CylinderGeometry } from '@iwsdk/core';

/** A wrapped gift box (0.24 m) with a ribbon cross and bow: the party goodie. */
export function buildGift(color: number): Object3D {
  const g = new Group();
  g.name = 'Gift';
  const box = new Mesh(new BoxGeometry(0.24, 0.2, 0.24), new MeshStandardMaterial({ color, roughness: 0.45, emissive: new Color(color), emissiveIntensity: 0.25 }));
  const ribbonMat = new MeshStandardMaterial({ color: 0xfff4d6, roughness: 0.3, metalness: 0.3, emissive: new Color(0xffd27a), emissiveIntensity: 0.3 });
  const r1 = new Mesh(new BoxGeometry(0.245, 0.205, 0.05), ribbonMat);
  const r2 = new Mesh(new BoxGeometry(0.05, 0.205, 0.245), ribbonMat);
  const bow = new Mesh(new SphereGeometry(0.045, 10, 8), ribbonMat);
  bow.scale.set(1.6, 0.7, 1);
  bow.position.y = 0.12;
  g.add(box, r1, r2, bow);
  return g;
}

/** A gift hanging under a small glowing parachute (for goodies floating down to the street). */
export function buildParachuteGift(color: number): Object3D {
  const g = new Group();
  g.name = 'ParachuteGift';
  const gift = buildGift(color);
  const canopy = new Mesh(new SphereGeometry(0.42, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), new MeshBasicMaterial({ color: new Color(color).lerp(new Color(0xffffff), 0.5) }));
  canopy.position.y = 0.95;
  const lineMat = new MeshBasicMaterial({ color: 0xffffff });
  for (const [x, z] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) {
    const line = new Mesh(new CylinderGeometry(0.004, 0.004, 0.85, 4), lineMat);
    line.position.set(x * 0.5, 0.55, z * 0.5);
    line.rotation.set(z * 0.6, 0, -x * 0.6);
    g.add(line);
  }
  const glow = new Mesh(new ConeGeometry(0.3, 0.3, 12), new MeshBasicMaterial({ color, transparent: true, opacity: 0.35 }));
  glow.position.y = -0.1;
  glow.rotation.x = Math.PI;
  g.add(gift, canopy, glow);
  return g;
}
