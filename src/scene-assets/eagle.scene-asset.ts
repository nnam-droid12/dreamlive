/**
 * A bald eagle in miniature (procedural, project-owned), small enough to stand
 * on a hand: about 0.27 m beak to tail with a 0.6 m wingspan. A lathed brown
 * body, white head and neck, a hooked yellow beak and yellow eyes, a white tail
 * fan, feathered thighs, yellow feet with dark talons, and two-part wings (a
 * layered covert row over the flight feathers, five spread "fingers" at the tip).
 * Origin at the feet (where it stands), +Z forward (beak), +Y up, +X the left wing.
 * Named parts for animation: `Torso` (pitch), `WingL`/`WingR` (shoulders) with
 * `WingLTip`/`WingRTip` (the outer wing), `Legs`. `buildEagleEgg()` is its egg.
 */
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  Vector2,
} from '@iwsdk/core';
import { Palette } from '../config/palette.js';

/** The torso's pivot height above the feet (m), and the shoulder joints in torso space. */
export const EAGLE = { torsoY: 0.118, shoulder: { x: 0.026, y: 0.022, z: 0.03 }, innerSpan: 0.13, outerSpan: 0.15 };

/** Merge parts into one non-indexed geometry with per-vertex colour (`shade` may vary it per vertex). */
function merge(parts: { g: BufferGeometry; color: number; shade?: (x: number, y: number, z: number, c: Color) => void }[]): BufferGeometry {
  const pos: number[] = [];
  const nor: number[] = [];
  const col: number[] = [];
  const c = new Color();
  for (const { g, color, shade } of parts) {
    // Smooth normals first (on the shared vertices), then split: flat-shaded facets otherwise.
    g.computeVertexNormals();
    const n = g.index ? g.toNonIndexed() : g;
    const p = n.getAttribute('position');
    const q = n.getAttribute('normal');
    for (let i = 0; i < p.count; i++) {
      c.setHex(color);
      shade?.(p.getX(i), p.getY(i), p.getZ(i), c);
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      nor.push(q.getX(i), q.getY(i), q.getZ(i));
      col.push(c.r, c.g, c.b);
    }
  }
  const out = new BufferGeometry();
  out.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  out.setAttribute('normal', new BufferAttribute(new Float32Array(nor), 3));
  out.setAttribute('color', new BufferAttribute(new Float32Array(col), 3));
  return out;
}

/** A tiny repeatable hash (0..1) for feather mottling; deterministic. */
function hash(x: number, y: number, z: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

/** The plumage: darker on the back, a touch warmer below, mottled feather by feather. */
const plumage = (x: number, y: number, z: number, c: Color): void => {
  const m = 0.86 + 0.22 * hash(Math.round(x * 90), Math.round(y * 90), Math.round(z * 90));
  const belly = y < 0 ? 1.12 : 0.92;
  c.multiplyScalar(m * belly);
};

/** Body (torso space: origin at the pivot, +Z forward): chest, back and the white head and neck. */
function bodyGeometry(): BufferGeometry {
  const profile = [
    [0.006, -0.08], [0.02, -0.07], [0.036, -0.045], [0.046, -0.012], [0.049, 0.015], [0.045, 0.04], [0.036, 0.058], [0.024, 0.07],
  ].map(([r, y]) => new Vector2(r, y));
  const body = new LatheGeometry(profile, 36);
  body.rotateX(Math.PI / 2);
  body.scale(1, 1.08, 1);
  // The white hood: neck into a slightly long head.
  const neckProfile = [[0.0, 0.045], [0.03, 0.05], [0.031, 0.066], [0.028, 0.08], [0.0, 0.082]].map(([r, y]) => new Vector2(r, y));
  const neck = new LatheGeometry(neckProfile, 32);
  neck.rotateX(Math.PI / 2);
  neck.translate(0, 0.014, 0);
  const head = new SphereGeometry(0.027, 32, 24);
  head.scale(0.95, 0.92, 1.18);
  head.translate(0, 0.026, 0.088);
  // A heavy brow over the eyes: the eagle's stern look.
  const brow = new SphereGeometry(0.012, 10, 8);
  brow.scale(2.1, 0.55, 1.1);
  brow.translate(0, 0.038, 0.098);
  return merge([
    { g: body, color: Palette.eagleBrown, shade: plumage },
    { g: neck, color: Palette.eagleWhite },
    { g: head, color: Palette.eagleWhite },
    { g: brow, color: Palette.eagleWhite },
  ]);
}

/** The hooked yellow beak: a slim side profile curving down to a sharp hooked point, narrowing toward the tip. Torso space. */
function beakGeometry(): BufferGeometry {
  const s = new Shape();
  s.moveTo(0, 0.009);
  s.quadraticCurveTo(0.02, 0.011, 0.031, 0.001);
  s.quadraticCurveTo(0.035, -0.006, 0.031, -0.014);
  s.quadraticCurveTo(0.028, -0.006, 0.022, -0.003);
  s.lineTo(0, -0.007);
  s.lineTo(0, 0.009);
  const g = new ExtrudeGeometry(s, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.0018, bevelSize: 0.0012, bevelSegments: 2, curveSegments: 14 });
  g.translate(0, 0, -0.004);
  // Narrow toward the point, like a real beak (full width at the face, a sliver at the hook).
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) * (1 - 0.8 * Math.min(1, Math.max(0, p.getX(i) / 0.034))));
  g.rotateY(-Math.PI / 2);
  g.translate(0, 0.021, 0.1);
  return g;
}

/** Yellow eyes with dark pupils, either side of the head. */
function eyes(): { iris: BufferGeometry; pupil: BufferGeometry } {
  const iris: BufferGeometry[] = [];
  const pupil: BufferGeometry[] = [];
  for (const sx of [1, -1]) {
    const e = new SphereGeometry(0.0052, 10, 8);
    e.translate(sx * 0.0215, 0.031, 0.099);
    iris.push(e);
    const p = new SphereGeometry(0.0031, 8, 6);
    p.translate(sx * 0.0252, 0.031, 0.1015);
    pupil.push(p);
  }
  return { iris: merge(iris.map((g) => ({ g, color: Palette.eagleEye }))), pupil: merge(pupil.map((g) => ({ g, color: Palette.eaglePupil }))) };
}

/** The white tail: a fan of broad feathers, slightly cupped, behind the body. */
function tailGeometry(): BufferGeometry {
  const s = new Shape();
  s.moveTo(-0.016, 0);
  s.lineTo(-0.036, -0.075);
  const feathers = 6;
  for (let i = 0; i < feathers; i++) {
    const x0 = -0.036 + (0.072 * i) / feathers;
    const x1 = -0.036 + (0.072 * (i + 1)) / feathers;
    s.quadraticCurveTo((x0 + x1) / 2, -0.088, x1, -0.075);
  }
  s.lineTo(0.016, 0);
  s.lineTo(-0.016, 0);
  const g = new ShapeGeometry(s, 4);
  g.rotateX(Math.PI / 2);
  // Cupped a little: the outer feathers lower than the middle.
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) p.setY(i, -Math.abs(p.getX(i)) * 0.18);
  g.translate(0, 0.004, -0.07);
  return g;
}

/** Feathered thighs, yellow scaled legs, three toes ahead and one behind, each with a dark curved talon. Feet at y = 0. */
function legParts(): { feather: BufferGeometry; foot: BufferGeometry; talon: BufferGeometry } {
  const feather: BufferGeometry[] = [];
  const foot: BufferGeometry[] = [];
  const talon: BufferGeometry[] = [];
  for (const sx of [1, -1]) {
    const x = sx * 0.017;
    const thigh = new SphereGeometry(0.016, 18, 14);
    thigh.scale(1, 1.9, 1.1);
    thigh.translate(x, 0.086, -0.004);
    feather.push(thigh);
    // Long yellow scaled legs, clearly visible below the feathered thighs.
    const shin = new CylinderGeometry(0.0052, 0.006, 0.072, 10);
    shin.translate(x, 0.04, 0);
    foot.push(shin);
    // Strong spread toes (three ahead, one behind), each with a big dark hooked talon.
    for (const [yaw, len] of [[-0.5, 0.03], [0, 0.034], [0.5, 0.03], [Math.PI, 0.024]] as const) {
      const toe = new CylinderGeometry(0.0042, 0.0048, len, 8);
      toe.rotateX(Math.PI / 2);
      toe.translate(0, 0.004, len / 2);
      toe.rotateY(yaw * sx);
      toe.translate(x, 0, 0.002);
      foot.push(toe);
      const claw = new ConeGeometry(0.0042, 0.016, 8);
      claw.rotateX(Math.PI / 2 + 0.9);
      claw.translate(0, 0.003, len + 0.004);
      claw.rotateY(yaw * sx);
      claw.translate(x, 0, 0.002);
      talon.push(claw);
    }
  }
  return {
    feather: merge(feather.map((g) => ({ g, color: Palette.eagleBrown, shade: plumage }))),
    foot: merge(foot.map((g) => ({ g, color: Palette.eagleFoot }))),
    talon: merge(talon.map((g) => ({ g, color: Palette.eagleTalon }))),
  };
}

/**
 * One wing panel lying flat (span along +X from its root, leading edge toward +Z):
 * a rounded leading edge and a feathered trailing edge (`feathers` scallops, or
 * long separated primaries when `fingers`). Mirror X for the right wing.
 */
function panel(span: number, chordRoot: number, chordTip: number, feathers: number, fingers: boolean, lead = 0.022): BufferGeometry {
  const s = new Shape();
  s.moveTo(0, lead);
  s.quadraticCurveTo(span * 0.55, lead + 0.01, span, lead * 0.6);
  const tipBack = lead * 0.6 - chordTip;
  if (fingers) {
    // Five long primaries, separated at their tips like fingers.
    for (let i = 0; i < 5; i++) {
      const a = span - i * 0.012;
      const len = 0.05 - i * 0.004;
      s.lineTo(a + 0.012, lead * 0.6 - 0.006 - i * 0.012);
      s.quadraticCurveTo(a + 0.03 + len * 0.4, lead * 0.2 - i * 0.014, a + len * 0.55, -0.01 - i * 0.016);
      s.lineTo(a - 0.004, -0.004 - i * 0.015);
    }
    s.lineTo(span * 0.62, tipBack);
  }
  for (let i = 1; i <= feathers; i++) {
    const t = i / feathers;
    const x = (fingers ? span * 0.62 : span) * (1 - t);
    const y = lead - (chordTip + (chordRoot - chordTip) * t);
    s.quadraticCurveTo(x + span / feathers / 2, y - 0.005, x, y);
  }
  s.lineTo(0, lead);
  const g = new ShapeGeometry(s, 5);
  g.rotateX(-Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

/** Feather by feather: each flight feather a slightly different brown, its shaft a fine light line, darker toward its tip. */
const featherShade = (count: number, span: number) => (x: number, _y: number, z: number, c: Color): void => {
  const f = (Math.abs(x) / span) * count;
  const k = Math.floor(f);
  const across = f - k;
  c.multiplyScalar(0.82 + 0.3 * hash(k, 3, 7));
  if (across < 0.07) c.multiplyScalar(1.45);
  // Feather tips (the trailing edge, -z) darker, as on a real eagle's wing.
  c.multiplyScalar(z < -0.03 ? 0.8 : 1);
};

/** A wing: flight feathers (individually shaded), a row of lighter coverts over them, and a third, smaller row near the leading edge. */
function wingGeometry(span: number, chordRoot: number, chordTip: number, feathers: number, fingers: boolean, mirror: boolean): BufferGeometry {
  const flight = panel(span, chordRoot, chordTip, feathers, fingers);
  const coverts = panel(span * (fingers ? 0.72 : 0.98), chordRoot * 0.58, chordTip * 0.58, feathers + 4, false, 0.024);
  coverts.translate(0, 0.0025, 0);
  const lesser = panel(span * (fingers ? 0.5 : 0.96), chordRoot * 0.3, chordTip * 0.3, feathers + 8, false, 0.025);
  lesser.translate(0, 0.0045, 0);
  const g = merge([
    { g: flight, color: Palette.eagleBrownDark, shade: featherShade(fingers ? 10 : feathers + 4, span) },
    { g: coverts, color: Palette.eagleCovert, shade: featherShade(feathers + 4, span) },
    { g: lesser, color: Palette.eagleBrown, shade: plumage },
  ]);
  if (mirror) {
    g.scale(-1, 1, 1);
    // (Mirroring flips the winding; double-sided drawing keeps it lit both ways.)
  }
  return g;
}

/** The eagle's plumage material: matte feathers, lit both sides (wings are thin), a little self-light so it reads in shade. */
export function eagleMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, side: DoubleSide, emissive: new Color(0x1a1208), emissiveIntensity: 0.25 });
}

/** The eagle, wings half spread (the manifest prototype / preview); the garden poses it. */
export function buildEagle(): Group {
  const root = new Group();
  root.name = 'Eagle';
  const mat = eagleMaterial();
  const gloss = new MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0 });
  const torso = new Group();
  torso.name = 'Torso';
  torso.position.y = EAGLE.torsoY;
  root.add(torso);
  const named = (g: BufferGeometry, m: MeshStandardMaterial, name: string, parent: Group) => {
    const mesh = new Mesh(g, m);
    mesh.name = name;
    parent.add(mesh);
    return mesh;
  };
  named(bodyGeometry(), mat, 'Body', torso);
  named(beakGeometry().translate(0, 0, 0), new MeshStandardMaterial({ color: Palette.eagleBeak, roughness: 0.45 }), 'Beak', torso);
  const e = eyes();
  named(e.iris, gloss, 'Eyes', torso);
  named(e.pupil, gloss, 'Pupils', torso);
  named(tailGeometry(), new MeshStandardMaterial({ color: Palette.eagleWhite, roughness: 0.9, side: DoubleSide, emissive: new Color(0x222018), emissiveIntensity: 0.2 }), 'Tail', torso);
  const legs = new Group();
  legs.name = 'Legs';
  root.add(legs);
  const l = legParts();
  named(l.feather, mat, 'Thighs', legs);
  named(l.foot, new MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }), 'Feet', legs);
  named(l.talon, gloss, 'Talons', legs);
  for (const side of ['L', 'R'] as const) {
    const sx = side === 'L' ? 1 : -1;
    const shoulder = new Group();
    shoulder.name = `Wing${side}`;
    shoulder.rotation.order = 'YZX';
    shoulder.position.set(sx * EAGLE.shoulder.x, EAGLE.shoulder.y, EAGLE.shoulder.z);
    torso.add(shoulder);
    named(wingGeometry(EAGLE.innerSpan, 0.085, 0.08, 6, false, side === 'R'), mat, `Wing${side}Inner`, shoulder);
    const tip = new Group();
    tip.name = `Wing${side}Tip`;
    tip.rotation.order = 'YZX';
    // The outer wing overlaps the inner one, so the wing stays one piece as it bends at the wrist.
    tip.position.x = sx * EAGLE.innerSpan * 0.86;
    shoulder.add(tip);
    named(wingGeometry(EAGLE.outerSpan, 0.08, 0.06, 4, true, side === 'R'), mat, `Wing${side}Outer`, tip);
  }
  // Standing, wings folded (as it stands on the mat or a palm).
  poseEagle(root, 0, 1, 0.5);
  return root;
}

/**
 * Pose an eagle built by `buildEagle` (or a clone of it).
 * - `flap`: the wings' angle at the shoulder (rad, + raised), the outer wing following with `tip` (rad).
 * - `fold`: 0 spread for flight .. 1 folded along the body (standing).
 * - `pitch`: the body's nose-up angle (rad): about 0.1 in flight, 0.5 standing.
 * In flight the feet tuck back under the tail.
 */
export function poseEagle(root: Group, flap: number, fold: number, pitch: number, tip = flap * 0.35): void {
  const torso = root.getObjectByName('Torso');
  const legs = root.getObjectByName('Legs');
  if (torso) torso.rotation.x = -pitch;
  if (legs) {
    // Tucked back under the tail in flight, turning at the hips (not at the feet).
    const a = (1 - fold) * 1.2;
    const h = 0.09;
    legs.rotation.x = a;
    legs.position.set(0, h * (1 - Math.cos(a)), -h * Math.sin(a));
  }
  const open = 1 - fold;
  for (const side of ['L', 'R'] as const) {
    const sx = side === 'L' ? 1 : -1;
    const sh = root.getObjectByName(`Wing${side}`);
    const t = root.getObjectByName(`Wing${side}Tip`);
    if (sh) {
      sh.rotation.y = sx * fold * 1.45;
      sh.rotation.z = sx * (flap * open + fold * 0.06);
      // (Rolled so the folded wing's feathers hang down along its side, tips toward the tail, not up.)
      sh.rotation.x = -fold * 1.25;
      // Folded, the arm and hand bones close up: the wing lies compact along the side, its tips at the tail.
      sh.scale.set(1 - fold * 0.45, 1, 1 - fold * 0.15);
    }
    if (t) {
      t.rotation.y = sx * fold * 0.35;
      t.rotation.z = sx * tip * open;
    }
  }
}

/** The eagle's egg (about 4.5 cm tall): cream, speckled brown; origin at its base. */
export function buildEagleEgg(): Mesh {
  const pts: Vector2[] = [];
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const a = t * Math.PI;
    // A true egg: blunter below, narrower above.
    const r = Math.sin(a) * 0.016 * (1 - 0.18 * Math.cos(a) * -1 * (t < 0.5 ? 0.6 : 1));
    pts.push(new Vector2(Math.max(0.0005, r * (t > 0.5 ? 1 - (t - 0.5) * 0.35 : 1)), 0.045 * (1 - Math.cos(a)) * 0.5));
  }
  const g = new LatheGeometry(pts, 24);
  const egg = merge([
    {
      g,
      color: Palette.eggShell,
      shade: (x, y, z, c) => {
        if (hash(Math.round(x * 400), Math.round(y * 400), Math.round(z * 400)) > 0.86) c.setHex(Palette.eggSpeck);
      },
    },
  ]);
  const mesh = new Mesh(egg, new MeshStandardMaterial({ vertexColors: true, roughness: 0.55 }));
  mesh.name = 'EagleEgg';
  return mesh;
}

export default buildEagle();
