/**
 * Bigfoot — the hero. Loads the owner's Meshy model (`public/models/bigfoot.glb`,
 * CC BY 4.0) and drives its animation clips. Only that model is ever shown: a
 * failed load is retried until it succeeds (there is no stand-in).
 *
 * Origin = between the feet, facing +Z, Y up, ~1.9 m tall.
 */
import {
  AnimationAction,
  AnimationClip,
  AnimationMixer,
  AssetManager,
  Bone,
  Box3,
  CapsuleGeometry,
  Color,
  Group,
  LoopOnce,
  LoopRepeat,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  SkinnedMesh,
  SphereGeometry,
  Vector3,
} from '@iwsdk/core';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

/** 'rest' = his straight modelling pose (lying face-up asleep), with gentle breathing. */
export type BigfootAnim =
  | 'idle' | 'walk' | 'jump' | 'sleep' | 'dance' | 'wave' | 'stretch' | 'rest'
  /** Night variants: house dance, happy bounce, big leap. */
  | 'dance2' | 'cheer' | 'leap';

/** Name fragments that identify each clip in a Meshy export. */
/** Talking motion (radians at full voice): chin nod, side tilt, a little turn; chest lift (scale). */
const TALK = { nod: 0.13, tilt: 0.06, turn: 0.05, chest: 0.018 };
const CLIP_HINTS: Record<Exclude<BigfootAnim, 'rest'>, RegExp> = {
  idle: /idle|breath|stand/i,
  walk: /walk/i,
  jump: /jump|hop/i,
  sleep: /sleep|lie|lying|lay/i,
  dance: /dance|danc/i,
  wave: /wave|greet|hello/i,
  stretch: /stretch|yawn|wake/i,
  dance2: /house/i,
  cheer: /happy/i,
  leap: /big/i,
};
const HEIGHT = 1.6;
/** How far he bows at most (rad), bringing his head down within a seated arm's reach. */
const BOW_MAX = 0.9;
/** Starting guess for how far his skin reaches below his lowest bone (meters at scale 1). */
const GROUND_PAD = 0.07;
/** The skin is re-measured this often (and on every new animation); bones carry it between. */
const SKIN_MEASURE_SEC = 0.25;
/** Every Nth vertex is sampled when measuring the skin. */
const SKIN_STRIDE = 12;

export interface BigfootRig {
  root: Object3D;
  /** Always true: only the real model is used.  */
  real: boolean;
  play(anim: BigfootAnim, opts?: { once?: boolean; fade?: number; rate?: number }): void;
  /** Whether the model has its own clip for this animation. */
  has(anim: BigfootAnim): boolean;
  /** World position of his head (for "z"s and gaze). */
  headPosition(out: Vector3): Vector3;
  /** Advance animation; also applies stand-in procedural motion. */
  update(delta: number): void;
  /**
   * A pose on top of the animation: 'sit' (seated, thighs forward, shins down)
   * with `eat` 0..1 lifting his right hand (the popcorn) to his mouth. '' = none.
   */
  setPose(pose: '' | 'sit', eat?: number): void;
  /** Height of his hips above his root, in metres (where a seat must be for 'sit'). */
  hipHeight(): number;
  /** Bow toward the way he faces, 0..1 (to be patted by someone sitting down). */
  setBow(a: number): void;
  /**
   * Turn his head toward a world point (null = let the animation lead). `face`: aim his face
   * straight at it whatever the animation does with his head (posing for a photo).
   */
  setLook(target: Vector3 | null, face?: boolean): void;
  /**
   * Reach a hand to a world point exactly (two-bone IK on top of the animation),
   * the hand open with fingers up ('palm', a high-five) or a fist forward ('fist').
   * null releases it.
   */
  setReach(hand: 'left' | 'right', target: Vector3 | null, shape?: 'palm' | 'fist'): void;
  /** World position of a hand (for contact checks). */
  handPosition(hand: 'left' | 'right', out: Vector3): Vector3;
  /** Stand tall: straighten his spine toward vertical (0..1) on top of the animation. */
  setUpright(amount: number): void;
  /** Talking: how loud his voice is right now (0..1); his head nods and tilts and his chest lifts with it. */
  setTalk(level: number): void;
  current: BigfootAnim;
}

let source: Promise<{ scene: Object3D; clips: AnimationClip[] }> | undefined;

/**
 * Bigfoot's model (the owner's Meshy Bigfoot), and only that model: a load that
 * fails on a passing hiccup (a cold dev server reloading its dependencies, a slow
 * disk or network) is simply tried again, as long as it takes. There is no
 * stand-in: until the real Bigfoot has loaded, he is not shown.
 */
function loadSource() {
  source ??= (async () => {
    for (let attempt = 0; ; attempt++) {
      try {
        const url = `${import.meta.env.BASE_URL}models/bigfoot.glb${attempt ? `?retry=${attempt}` : ''}`;
        const g = await AssetManager.loadGLTF(url);
        return { scene: g.scene, clips: g.animations };
      } catch (err) {
        console.warn(`Bigfoot's model did not load (attempt ${attempt + 1}); trying again.`, err);
        await new Promise((r) => setTimeout(r, Math.min(5000, 1000 * (attempt + 1))));
      }
    }
  })();
  return source;
}

/** A new, independent Bigfoot (each call clones the skeleton and its own mixer). */
export async function createBigfoot(): Promise<BigfootRig> {
  const src = await loadSource();
  return realRig(src.scene, src.clips);
}

const DOWN = new Vector3(0, -1, 0);
/** Scratch for the posing helpers (no allocation per frame). */
const AIM = { a: new Vector3(), c: new Vector3(), delta: new Quaternion(), world: new Quaternion(), parent: new Quaternion(), rootQ: new Quaternion() };
/** Scratch for the arm IK and head look. */
const IK = {
  s: new Vector3(),
  e: new Vector3(),
  e2: new Vector3(),
  w: new Vector3(),
  t: new Vector3(),
  t2: new Vector3(),
  u: new Vector3(),
  n: new Vector3(),
  q: new Quaternion(),
  q2: new Quaternion(),
  yAxis: new Vector3(0, 1, 0),
};

function realRig(scene: Object3D, clips: AnimationClip[]): BigfootRig {
  const model = cloneSkinned(scene);
  // Normalize to a ~1.9 m tall character standing on the origin.
  const box = new Box3().setFromObject(model);
  const size = box.getSize(new Vector3());
  model.scale.setScalar(HEIGHT / Math.max(size.y, 1e-3));
  const scaled = new Box3().setFromObject(model);
  model.position.y -= scaled.min.y;
  const modelBase = model.position.clone();
  model.traverse((o) => {
    if ((o as Mesh).isMesh) o.castShadow = o.receiveShadow = true;
  });
  const root = new Group();
  root.name = 'Bigfoot';
  root.add(model);
  const mixer = new AnimationMixer(model);
  const bones: Object3D[] = [];
  model.traverse((o) => {
    if ((o as Bone).isBone) bones.push(o);
  });
  // Each bone's local rest transform as authored (= the bind pose). Restored for 'rest';
  // Skeleton.pose() can't be used: it rebuilds from inverse binds and drops the parents' scale.
  const restPose = bones.map((b) => ({ p: b.position.clone(), q: b.quaternion.clone(), s: b.scale.clone() }));
  const headBone = bones.find((b) => /Head$/.test(b.name));
  // Which way his face points in the head bone's own frame (measured in the bind pose, where he faces +Z).
  const faceLocal = new Vector3(0, 0, 1);
  if (headBone) {
    root.updateMatrixWorld(true);
    const hq = headBone.getWorldQuaternion(new Quaternion());
    const rq = root.getWorldQuaternion(new Quaternion());
    faceLocal.applyQuaternion(rq).applyQuaternion(hq.invert()).normalize();
  }
  const bone = (re: RegExp) => bones.find((b) => re.test(b.name));
  const limb = {
    hips: bone(/Hips$/),
    lUp: bone(/LeftUpLeg$/),
    lLeg: bone(/LeftLeg$/),
    lFoot: bone(/LeftFoot$/),
    lToe: bone(/LeftToeBase$/),
    rUp: bone(/RightUpLeg$/),
    rLeg: bone(/RightLeg$/),
    rFoot: bone(/RightFoot$/),
    rToe: bone(/RightToeBase$/),
    lArm: bone(/LeftArm$/),
    lFore: bone(/LeftForeArm$/),
    lHand: bone(/LeftHand$/),
    rArm: bone(/RightArm$/),
    rFore: bone(/RightForeArm$/),
    rHand: bone(/RightHand$/),
  };
  let pose: '' | 'sit' = '';
  const look = { on: false, face: false, target: new Vector3(), weight: 0, cur: new Vector3(), q: new Quaternion() };
  const upright = { want: 0, weight: 0 };
  const bow = { want: 0, weight: 0, fwd: new Vector3(), dir: new Vector3(), q: new Quaternion() };
  const talk = { want: 0, level: 0, time: 0, applied: false, before: new Quaternion() };
  const spine = bone(/Spine$/);
  const neck = bone(/Neck$/);
  const reach = {
    left: { on: false, target: new Vector3(), weight: 0, shape: 'palm' as 'palm' | 'fist' },
    right: { on: false, target: new Vector3(), weight: 0, shape: 'palm' as 'palm' | 'fist' },
  };
  const index1 = { left: bone(/LeftHandIndex1$/), right: bone(/RightHandIndex1$/) };
  /** Two-bone IK: shoulder → elbow → wrist reaches `target`, elbow bending down and out. */
  const ikArm = (sideName: 'left' | 'right', target: Vector3, w: number, shape: 'palm' | 'fist') => {
    const arm = sideName === 'left' ? limb.lArm : limb.rArm;
    const fore = sideName === 'left' ? limb.lFore : limb.rFore;
    const hand = sideName === 'left' ? limb.lHand : limb.rHand;
    if (!arm || !fore || !hand) return;
    root.updateWorldMatrix(true, false);
    root.getWorldQuaternion(AIM.rootQ);
    fwd.set(0, 0, 1).applyQuaternion(AIM.rootQ);
    side.set(1, 0, 0).applyQuaternion(AIM.rootQ);
    model.updateWorldMatrix(true, true);
    const S = IK.s.setFromMatrixPosition(arm.matrixWorld);
    const E0 = IK.e.setFromMatrixPosition(fore.matrixWorld);
    const W0 = IK.w.setFromMatrixPosition(hand.matrixWorld);
    const a = S.distanceTo(E0);
    const b = E0.distanceTo(W0);
    // Blend the goal from where the hand is now toward the target (weight 0..1).
    const T = IK.t.copy(W0).lerp(target, w);
    const u = IK.u.subVectors(T, S);
    const d = Math.min(Math.max(u.length(), 1e-3), a + b - 1e-3);
    u.normalize();
    const x = (a * a - b * b + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, a * a - x * x));
    const pole = IK.n.copy(DOWN).addScaledVector(side, sideName === 'left' ? 0.6 : -0.6).addScaledVector(fwd, -0.3);
    pole.addScaledVector(u, -pole.dot(u)).normalize();
    const E = IK.e2.copy(S).addScaledVector(u, x).addScaledVector(pole, h);
    aim(arm, fore, dir.subVectors(E, S).normalize());
    const Tr = IK.t2.copy(S).addScaledVector(u, d);
    aim(fore, hand, dir.subVectors(Tr, E).normalize());
    // The hand: fingers up for a high-five, forward for a fist bump.
    const idx = index1[sideName];
    if (idx) aim(hand, idx, shape === 'palm' ? dir.set(0, 1, 0).addScaledVector(fwd, 0.25).normalize() : dir.subVectors(target, E).normalize());
  };
  /** Turn the head toward the look target (clamped, so it never twists unnaturally). */
  const applyLook = () => {
    if (!headBone || !headBone.parent || look.weight < 0.01) return;
    root.getWorldQuaternion(AIM.rootQ);
    fwd.set(0, 0, 1).applyQuaternion(AIM.rootQ);
    headBone.updateWorldMatrix(true, false);
    const want = IK.u.subVectors(look.target, IK.s.setFromMatrixPosition(headBone.matrixWorld)).normalize();
    if (look.face) {
      // Face straight at the target: turn the face direction the animation gives onto the line to it.
      headBone.getWorldQuaternion(AIM.world);
      look.cur.copy(faceLocal).applyQuaternion(AIM.world).normalize();
      look.q.setFromUnitVectors(look.cur, want);
      // (At most ~75 degrees, so a target behind him never wrings his neck.)
      const ang = look.cur.angleTo(want);
      look.q.slerp(IK.q.identity(), 1 - look.weight * Math.min(1, 1.3 / Math.max(1e-4, ang)));
      AIM.world.premultiply(look.q);
      headBone.parent.getWorldQuaternion(AIM.parent);
      headBone.quaternion.copy(AIM.parent.invert().multiply(AIM.world));
      headBone.updateMatrixWorld(true);
      return;
    }
    // Clamp: at most ~70° to either side and ~35° up or down from straight ahead.
    const yawTo = Math.atan2(want.x, want.z) - Math.atan2(fwd.x, fwd.z);
    const yaw = Math.max(-1.2, Math.min(1.2, Math.atan2(Math.sin(yawTo), Math.cos(yawTo))));
    const pitch = Math.max(-0.6, Math.min(0.6, Math.asin(Math.max(-1, Math.min(1, want.y)))));
    IK.q.setFromAxisAngle(IK.yAxis, yaw * look.weight);
    IK.n.set(fwd.z, 0, -fwd.x).applyAxisAngle(IK.yAxis, yaw * look.weight);
    IK.q2.setFromAxisAngle(IK.n, -pitch * look.weight);
    headBone.getWorldQuaternion(AIM.world).premultiply(IK.q).premultiply(IK.q2);
    headBone.parent.getWorldQuaternion(AIM.parent);
    headBone.quaternion.copy(AIM.parent.invert().multiply(AIM.world));
    headBone.updateMatrixWorld(true);
  };
  let eat = 0;
  const fwd = new Vector3();
  const side = new Vector3();
  const dir = new Vector3();
  const mouth = new Vector3();
  /** Turn `b` (in world space) so the line from it to `child` points along `to` (unit). */
  const aim = (b: Object3D | undefined, child: Object3D | undefined, to: Vector3) => {
    if (!b || !child || !b.parent) return;
    b.updateWorldMatrix(true, false);
    child.updateWorldMatrix(false, false);
    const a = AIM.a.setFromMatrixPosition(b.matrixWorld);
    const c = AIM.c.setFromMatrixPosition(child.matrixWorld);
    const cur = c.sub(a).normalize();
    if (cur.lengthSq() < 1e-6) return;
    AIM.delta.setFromUnitVectors(cur, to);
    b.getWorldQuaternion(AIM.world);
    AIM.world.premultiply(AIM.delta);
    b.parent.getWorldQuaternion(AIM.parent);
    b.quaternion.copy(AIM.parent.invert().multiply(AIM.world));
    b.updateMatrixWorld(true);
  };
  /** Seated: thighs forward, shins down, feet flat; arms in the lap, the right one lifting to eat. */
  const applySit = () => {
    root.updateWorldMatrix(true, false);
    root.getWorldQuaternion(AIM.rootQ);
    fwd.set(0, 0, 1).applyQuaternion(AIM.rootQ);
    side.set(1, 0, 0).applyQuaternion(AIM.rootQ);
    model.updateWorldMatrix(true, true);
    // Thighs level (a touch up) along the seat, both on top of the cushion; knees a little apart.
    aim(limb.lUp, limb.lLeg, dir.copy(fwd).addScaledVector(side, 0.12).addScaledVector(DOWN, -0.16).normalize());
    aim(limb.rUp, limb.rLeg, dir.copy(fwd).addScaledVector(side, -0.12).addScaledVector(DOWN, -0.16).normalize());
    aim(limb.lLeg, limb.lFoot, dir.copy(DOWN).addScaledVector(fwd, 0.18).normalize());
    aim(limb.rLeg, limb.rFoot, dir.copy(DOWN).addScaledVector(fwd, 0.18).normalize());
    aim(limb.lFoot, limb.lToe, fwd);
    aim(limb.rFoot, limb.rToe, fwd);
    // Left arm rests on the left thigh.
    aim(limb.lArm, limb.lFore, dir.copy(DOWN).addScaledVector(fwd, 0.55).addScaledVector(side, 0.2).normalize());
    aim(limb.lFore, limb.lHand, dir.copy(fwd).addScaledVector(side, -0.25).addScaledVector(DOWN, 0.25).normalize());
    // Right arm: popcorn in the lap, lifted to the mouth as he eats.
    aim(limb.rArm, limb.rFore, dir.copy(DOWN).addScaledVector(fwd, 0.5 + eat * 0.4).addScaledVector(side, -0.15).normalize());
    if (limb.rFore && headBone) {
      limb.rFore.updateWorldMatrix(true, false);
      headBone.updateWorldMatrix(true, false);
      mouth.setFromMatrixPosition(headBone.matrixWorld).addScaledVector(fwd, 0.12).addScaledVector(DOWN, 0.06);
      const toMouth = AIM.c.copy(mouth).sub(AIM.a.setFromMatrixPosition(limb.rFore.matrixWorld)).normalize();
      dir.copy(fwd).addScaledVector(side, 0.25).addScaledVector(DOWN, 0.15).normalize().lerp(toMouth, eat).normalize();
      aim(limb.rFore, limb.rHand, dir);
    }
  };
  const chest = bones.find((b) => /Spine2$/.test(b.name)) ?? bones.find((b) => /Spine1?$/.test(b.name));
  let breath = 0;
  const skinned: SkinnedMesh[] = [];
  model.traverse((o) => {
    if ((o as SkinnedMesh).isSkinnedMesh) skinned.push(o as SkinnedMesh);
  });
  // How far the skin reaches below the lowest bone, per unit of root scale (pose-dependent).
  let skinGap = GROUND_PAD;
  /** Grounding correction along the parent's vertical (parent units). */
  let groundLift = 0;
  let measureIn = 0;
  const v = new Vector3();
  const inv = new Matrix4();
  const q = new Quaternion();
  const p = new Vector3();
  const actions = new Map<BigfootAnim, AnimationAction>();
  for (const anim of Object.keys(CLIP_HINTS) as Array<keyof typeof CLIP_HINTS>) {
    const clip = clips.find((c) => CLIP_HINTS[anim].test(c.name));
    if (clip) actions.set(anim, mixer.clipAction(clip));
  }
  const fallback = actions.get('idle') ?? actions.values().next().value;
  let active: AnimationAction | undefined;
  const rig: BigfootRig = {
    root,
    real: true,
    current: 'idle',
    play(anim, opts = {}) {
      measureIn = 0;
      if (anim === 'rest') {
        if (rig.current !== 'rest') {
          mixer.stopAllAction();
          // Snap back to the modelling pose: straight, arms relaxed.
          bones.forEach((b, i) => {
            b.position.copy(restPose[i].p);
            b.quaternion.copy(restPose[i].q);
            b.scale.copy(restPose[i].s);
          });
          active = undefined;
          rig.current = 'rest';
        }
        return;
      }
      const next = actions.get(anim) ?? fallback;
      rig.current = anim;
      if (next) next.timeScale = opts.rate ?? 1;
      if (!next || next === active) return;
      next.reset();
      next.setLoop(opts.once ? LoopOnce : LoopRepeat, Infinity);
      next.clampWhenFinished = !!opts.once;
      next.play();
      if (active) next.crossFadeFrom(active, opts.fade ?? 0.35, false);
      active = next;
    },
    setUpright(a) {
      upright.want = Math.max(0, Math.min(1, a));
    },
    setBow(a) {
      bow.want = Math.max(0, Math.min(1, a));
    },
    setTalk(a) {
      talk.want = Math.max(0, Math.min(1, a));
    },
    setLook(target, face = false) {
      look.on = !!target;
      look.face = face;
      if (target) look.target.copy(target);
    },
    setReach(h, target, shape = 'palm') {
      reach[h].on = !!target;
      reach[h].shape = shape;
      if (target) reach[h].target.copy(target);
    },
    handPosition(h, out) {
      const hb = h === 'left' ? limb.lHand : limb.rHand;
      return hb ? hb.getWorldPosition(out) : root.localToWorld(out.set(h === 'left' ? 0.4 : -0.4, 1.0, 0.2));
    },
    setPose(next, e = 0) {
      if (next !== pose) measureIn = 0;
      pose = next;
      eat = Math.min(1, Math.max(0, e));
    },
    hipHeight() {
      if (!limb.hips) return HEIGHT * 0.3;
      root.updateWorldMatrix(true, true);
      return root.worldToLocal(AIM.a.setFromMatrixPosition(limb.hips.matrixWorld)).y * root.scale.y;
    },
    update(delta) {
      // (Undo last frame's talking nod first, in case the animation leaves the head alone.)
      if (talk.applied && headBone) headBone.quaternion.copy(talk.before);
      talk.applied = false;
      mixer.update(delta);
      if (pose === 'sit') applySit();
      // Standing tall: the line from his lower spine to his neck turned toward vertical.
      upright.weight += (upright.want - upright.weight) * Math.min(1, delta * 3);
      if (upright.weight > 0.01 && spine && neck) {
        spine.updateWorldMatrix(true, false);
        neck.updateWorldMatrix(false, false);
        const cur = IK.u.setFromMatrixPosition(neck.matrixWorld).sub(IK.s.setFromMatrixPosition(spine.matrixWorld)).normalize();
        aim(spine, neck, cur.lerp(IK.yAxis, upright.weight).normalize());
      }
      // Bowing toward you (to be patted): the spine-to-neck line leans forward, bringing his head down.
      bow.weight += (bow.want - bow.weight) * Math.min(1, delta * 2.5);
      if (bow.weight > 0.01 && spine && neck) {
        root.getWorldQuaternion(bow.q);
        bow.fwd.set(0, 0, 1).applyQuaternion(bow.q).setY(0).normalize();
        const a = bow.weight * BOW_MAX;
        bow.dir.set(0, Math.cos(a), 0).addScaledVector(bow.fwd, Math.sin(a));
        aim(spine, neck, bow.dir);
      }
      // Reaching and looking ease in and out (no snapping).
      for (const h of ['left', 'right'] as const) {
        const r = reach[h];
        r.weight += ((r.on ? 1 : 0) - r.weight) * Math.min(1, delta * 6);
        if (r.weight > 0.01) ikArm(h, r.target, r.weight, r.shape);
      }
      look.weight += ((look.on ? 1 : 0) - look.weight) * Math.min(1, delta * 4);
      applyLook();
      // Talking: with each loud syllable his chin dips a little and his head tilts side to side;
      // between phrases it settles (quick to rise, a little slower to fall).
      talk.level += (talk.want - talk.level) * Math.min(1, delta * (talk.want > talk.level ? 18 : 9));
      talk.time += delta;
      if (headBone && talk.level > 0.01) {
        talk.before.copy(headBone.quaternion);
        talk.applied = true;
        headBone.rotateX(TALK.nod * talk.level);
        headBone.rotateZ(TALK.tilt * talk.level * Math.sin(talk.time * 3.1));
        headBone.rotateY(TALK.turn * talk.level * Math.sin(talk.time * 1.7 + 1));
        headBone.updateMatrixWorld(true);
      }
      breath += delta;
      if (chest) chest.scale.setScalar((rig.current === 'rest' ? 1 + Math.sin(breath * 1.4) * 0.025 : 1) + TALK.chest * talk.level);
      // Self-grounding: whatever height the caller placed him at is the surface his
      // skin rests on (soles on the floor standing, back on the mattress lying, the
      // hop's height mid-jump). Mixamo's root heights don't survive the unit
      // conversion, so the pose alone can't be trusted. Bones are cheap to read every
      // frame; the true skin below them is sampled a few times a second. Measured in
      // the parent's frame, so it works lying down or upright, in the room or the TV.
      const parent = root.parent;
      if (!parent) return;
      root.updateWorldMatrix(true, true);
      inv.copy(parent.matrixWorld).invert();
      let minY = Infinity;
      for (const b of bones) {
        p.setFromMatrixPosition(b.matrixWorld).applyMatrix4(inv);
        if (p.y < minY) minY = p.y;
      }
      if (!Number.isFinite(minY)) return;
      measureIn -= delta;
      if (measureIn <= 0 && skinned.length) {
        measureIn = SKIN_MEASURE_SEC;
        let minSkin = Infinity;
        for (const sm of skinned) {
          const count = sm.geometry.getAttribute('position').count;
          for (let i = 0; i < count; i += SKIN_STRIDE) {
            sm.getVertexPosition(i, v).applyMatrix4(sm.matrixWorld).applyMatrix4(inv);
            if (v.y < minSkin) minSkin = v.y;
          }
        }
        if (Number.isFinite(minSkin)) skinGap = (minY - minSkin) / Math.max(1e-3, root.scale.y);
      }
      // Move the inner model (not the caller-owned root) along the parent's vertical.
      // Rebuilt from one scalar every frame, so it never drifts sideways when he
      // lies down and stands up again (the parent's vertical turns with him).
      groundLift += root.position.y - (minY - skinGap * root.scale.y);
      p.set(0, groundLift / root.scale.y, 0).applyQuaternion(q.copy(root.quaternion).invert());
      model.position.copy(modelBase).add(p);
    },
    has(anim) {
      return actions.has(anim);
    },
    headPosition(out) {
      return headBone ? headBone.getWorldPosition(out) : root.localToWorld(out.set(0, HEIGHT * 0.85, 0));
    },
  };
  rig.play('idle');
  return rig;
}


export const BIGFOOT_HEIGHT = HEIGHT;
export const BIGFOOT_FUR = new Color(0x7b4a2d);
