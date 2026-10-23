/**
 * The Dreamer: a small moth-cloud creature, ~8 cm tall on a real table.
 * Origin = feet contact point, face looks down +Z, Y up. Named parts are
 * animated by DreamerSystem: Body (squash/curl), Lid* (rotation.x: -1.1 open,
 * 0 sleepy, 1.45 closed), Mouth (scale.y for yawns), Wing* (rotation.y: 0.5*side swept back, lower = wrap forward).
 */
import {
  CatmullRomCurve3,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  ShaderMaterial,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  TubeGeometry,
  Vector3,
} from '@iwsdk/core';
import { Palette } from '../config/palette.js';
import { ADDITIVE_LIGHT } from '../visuals/glow-materials.js';

const CORE_RADIUS = 0.032;
const CORE_Y = 0.04;

const fur = new MeshStandardMaterial({
  color: Palette.dreamerFur,
  roughness: 1,
  metalness: 0,
  emissive: new Color(Palette.moonBlue),
  emissiveIntensity: 0.12,
});
const eyeWhite = new MeshStandardMaterial({ color: Palette.dreamerEye, roughness: 0.4 });
const pupil = new MeshStandardMaterial({ color: Palette.dreamerPupil, roughness: 0.2 });
const sparkle = new MeshBasicMaterial({ color: Palette.starWhite });
const blush = new MeshStandardMaterial({
  color: Palette.pinkSoft,
  roughness: 1,
  transparent: true,
  opacity: 0.85,
});
const wingMat = new MeshStandardMaterial({
  color: Palette.pinkSoft,
  emissive: new Color(Palette.pinkSoft),
  emissiveIntensity: 0.25,
  roughness: 0.9,
  side: DoubleSide,
  transparent: true,
  opacity: 0.78,
});
const wingSpotMat = new MeshBasicMaterial({
  color: Palette.moonBlue,
  side: DoubleSide,
  transparent: true,
  opacity: 0.9,
});
const antennaMat = new MeshStandardMaterial({ color: Palette.paperShade, roughness: 1 });
const glowTip = new MeshBasicMaterial({ color: Palette.lanternGlow });
const rimGlow = new ShaderMaterial({
  uniforms: { glowColor: { value: new Color(Palette.moonBlueSoft) }, strength: { value: 1.1 } },
  vertexShader: /* glsl */ `
    varying vec3 vNormal;
    varying vec3 vView;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vNormal = normalize(normalMatrix * normal);
      vView = normalize(-mv.xyz);
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 glowColor;
    uniform float strength;
    varying vec3 vNormal;
    varying vec3 vView;
    void main() {
      float facing = abs(dot(vNormal, vView));
      // Peaks just inside the silhouette and fades to zero at it: a fuzzy halo, not a glass edge.
      float rim = pow(1.0 - facing, 2.0) * smoothstep(0.0, 0.45, facing);
      gl_FragColor = vec4(glowColor * rim * strength, rim * strength);
    }`,
  transparent: true,
  depthWrite: false,
  ...ADDITIVE_LIGHT,
});

const sphere = (r: number, w = 16, h = 12) => new SphereGeometry(r, w, h);
const coreGeo = sphere(CORE_RADIUS, 20, 14);
const puffGeo = sphere(1, 12, 9);
const eyeGeo = sphere(0.0095);
const pupilGeo = sphere(0.0058, 12, 9);
const sparkleGeo = sphere(0.0017, 6, 4);
const lidGeo = new SphereGeometry(0.0104, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2);
const smallGeo = sphere(1, 10, 7);
const rimGeo = sphere(CORE_RADIUS * 1.25, 20, 14);

/** Cloud puffs bulging out of the core: [dirX, dirY, dirZ, radius]. */
const PUFFS: ReadonlyArray<readonly [number, number, number, number]> = [
  [0, 1, -0.15, 0.017],
  [0.55, 0.75, -0.2, 0.015],
  [-0.55, 0.75, -0.2, 0.015],
  [0.9, 0.15, -0.1, 0.016],
  [-0.9, 0.15, -0.1, 0.016],
  [0.6, -0.35, -0.45, 0.014],
  [-0.6, -0.35, -0.45, 0.014],
  [0, 0.45, -0.9, 0.017],
  [0.35, 0.95, 0.35, 0.012],
  [-0.35, 0.95, 0.35, 0.012],
];

function mesh(name: string, geo: Mesh['geometry'], mat: Mesh['material'], shadow = false): Mesh {
  const m = new Mesh(geo, mat);
  m.name = name;
  m.castShadow = shadow;
  return m;
}

function buildEye(side: 1 | -1): Group {
  const eye = new Group();
  eye.name = side > 0 ? 'EyeR' : 'EyeL';
  eye.position.set(0.0125 * side, 0.008, CORE_RADIUS * 0.82);
  eye.add(mesh('Eyeball', eyeGeo, eyeWhite));
  const p = mesh('Pupil', pupilGeo, pupil);
  p.position.set(0, -0.0006, 0.0052);
  eye.add(p);
  const s = mesh('Sparkle', sparkleGeo, sparkle);
  s.position.set(0.0022 * side, 0.0022, 0.0105);
  eye.add(s);
  const lid = mesh('Lid', lidGeo, fur);
  lid.rotation.x = 0;
  eye.add(lid);
  return eye;
}

function wingGeometry(): ShapeGeometry {
  const s = new Shape();
  s.moveTo(0, 0.002);
  s.bezierCurveTo(0.008, 0.026, 0.034, 0.03, 0.036, 0.012);
  s.bezierCurveTo(0.037, 0, 0.026, -0.004, 0.016, -0.003);
  s.bezierCurveTo(0.024, -0.012, 0.02, -0.024, 0.01, -0.02);
  s.bezierCurveTo(0.003, -0.017, 0, -0.008, 0, 0.002);
  return new ShapeGeometry(s, 10).scale(1.35, 1.35, 1);
}
const wingGeo = wingGeometry();
const wingSpotGeo = sphere(0.0045, 10, 6);

function buildWing(side: 1 | -1): Group {
  const pivot = new Group();
  pivot.name = side > 0 ? 'WingR' : 'WingL';
  pivot.position.set(0.009 * side, 0.006, -CORE_RADIUS * 0.85);
  pivot.rotation.y = 0.5 * side;
  pivot.scale.x = side;
  const w = mesh('Membrane', wingGeo, wingMat, true);
  pivot.add(w);
  const spot = mesh('Spot', wingSpotGeo, wingSpotMat);
  spot.position.set(0.032, 0.019, 0.0004);
  spot.scale.set(1, 1, 0.15);
  pivot.add(spot);
  return pivot;
}

function buildAntenna(side: 1 | -1): Group {
  const root = new Group();
  root.name = side > 0 ? 'AntennaR' : 'AntennaL';
  const curve = new CatmullRomCurve3([
    new Vector3(0.007 * side, CORE_RADIUS * 0.92, 0.006),
    new Vector3(0.011 * side, CORE_RADIUS + 0.014, 0.012),
    new Vector3(0.019 * side, CORE_RADIUS + 0.024, 0.016),
  ]);
  root.add(mesh('Stalk', new TubeGeometry(curve, 8, 0.0011, 5, false), antennaMat));
  const tip = mesh('Tip', smallGeo, glowTip);
  tip.position.copy(curve.getPoint(1));
  tip.scale.setScalar(0.0034);
  root.add(tip);
  return root;
}

/** Builds a fresh Dreamer. Geometry and materials are shared across instances. */
export function createDreamer(): Object3D {
  const root = new Group();
  root.name = 'Dreamer';

  const body = new Group();
  body.name = 'Body';
  body.position.y = CORE_Y;
  root.add(body);

  body.add(mesh('Core', coreGeo, fur, true));
  const puffs = new Group();
  puffs.name = 'Puffs';
  const dir = new Vector3();
  PUFFS.forEach(([x, y, z, r], i) => {
    dir.set(x, y, z).normalize();
    const p = mesh(`Puff${i}`, puffGeo, fur, true);
    p.position.copy(dir).multiplyScalar(CORE_RADIUS * 0.82);
    p.scale.setScalar(r);
    puffs.add(p);
  });
  body.add(puffs);

  const rim = mesh('RimGlow', rimGeo, rimGlow);
  rim.renderOrder = 2;
  rim.userData.iwsdkPreviewBounds = 'exclude';
  body.add(rim);

  const face = new Group();
  face.name = 'Face';
  face.add(buildEye(-1), buildEye(1));
  const mouth = mesh('Mouth', smallGeo, pupil);
  mouth.position.set(0, -0.007, CORE_RADIUS * 0.97);
  mouth.scale.set(0.0042, 0.0016, 0.0015);
  face.add(mouth);
  for (const side of [-1, 1] as const) {
    const cheek = mesh(side > 0 ? 'CheekR' : 'CheekL', smallGeo, blush);
    cheek.position.set(0.021 * side, -0.003, CORE_RADIUS * 0.83);
    cheek.scale.set(0.0052, 0.0032, 0.0016);
    cheek.lookAt(cheek.position.clone().multiplyScalar(2));
    face.add(cheek);
  }
  body.add(face);

  body.add(buildWing(-1), buildWing(1));
  body.add(buildAntenna(-1), buildAntenna(1));

  const feet = new Group();
  feet.name = 'Feet';
  for (const side of [-1, 1] as const) {
    const foot = mesh(side > 0 ? 'FootR' : 'FootL', smallGeo, fur, true);
    foot.position.set(0.013 * side, 0.0045, 0.012);
    foot.scale.set(0.0085, 0.0048, 0.011);
    feet.add(foot);
  }
  root.add(feet);
  return root;
}

const dreamerPrototype = createDreamer();
export default dreamerPrototype;
