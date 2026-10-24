/**
 * Bigfoot — the hero. Loads the owner's Meshy model (`public/models/bigfoot.glb`,
 * CC BY 4.0) and drives its animation clips; until that file exists, a soft
 * stand-in with procedural motion keeps every system testable.
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
  Skeleton,
  SkinnedMesh,
  SphereGeometry,
  Vector3,
} from '@iwsdk/core';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

/** 'rest' = his straight modelling pose (lying face-up asleep), with gentle breathing. */
export type BigfootAnim = 'idle' | 'walk' | 'jump' | 'sleep' | 'dance' | 'wave' | 'stretch' | 'rest';

/** Name fragments that identify each clip in a Meshy export. */
const CLIP_HINTS: Record<Exclude<BigfootAnim, 'rest'>, RegExp> = {
  idle: /idle|breath|stand/i,
  walk: /walk/i,
  jump: /jump|hop/i,
  sleep: /sleep|lie|lying|lay/i,
  dance: /dance|danc/i,
  wave: /wave|greet|hello/i,
  stretch: /stretch|yawn|wake/i,
};
const HEIGHT = 1.9;
/** Lowest bone sits this far above the surface (ankle/hip joints are inside the body). */
const GROUND_PAD = 0.07;

export interface BigfootRig {
  root: Object3D;
  /** True when this is the real model (false = stand-in). */
  real: boolean;
  play(anim: BigfootAnim, opts?: { once?: boolean; fade?: number }): void;
  /** Whether the model has its own clip for this animation. */
  has(anim: BigfootAnim): boolean;
  /** World position of his head (for "z"s and gaze). */
  headPosition(out: Vector3): Vector3;
  /** Advance animation; also applies stand-in procedural motion. */
  update(delta: number): void;
  current: BigfootAnim;
}

let source: Promise<{ scene: Object3D; clips: AnimationClip[] } | null> | undefined;

function loadSource() {
  source ??= AssetManager.loadGLTF(`${import.meta.env.BASE_URL}models/bigfoot.glb`)
    .then((g) => ({ scene: g.scene, clips: g.animations }))
    .catch(() => null);
  return source;
}

/** A new, independent Bigfoot (each call clones the skeleton and its own mixer). */
export async function createBigfoot(): Promise<BigfootRig> {
  const src = await loadSource();
  return src ? realRig(src.scene, src.clips) : standInRig();
}

function realRig(scene: Object3D, clips: AnimationClip[]): BigfootRig {
  const model = cloneSkinned(scene);
  // Normalize to a ~1.9 m tall character standing on the origin.
  const box = new Box3().setFromObject(model);
  const size = box.getSize(new Vector3());
  model.scale.setScalar(HEIGHT / Math.max(size.y, 1e-3));
  const scaled = new Box3().setFromObject(model);
  model.position.y -= scaled.min.y;
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
  const headBone = bones.find((b) => /Head$/.test(b.name));
  const chest = bones.find((b) => /Spine2$/.test(b.name)) ?? bones.find((b) => /Spine1?$/.test(b.name));
  let breath = 0;
  const skeletons = new Set<Skeleton>();
  model.traverse((o) => {
    const sm = o as SkinnedMesh;
    if (sm.isSkinnedMesh) skeletons.add(sm.skeleton);
  });
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
      if (anim === 'rest') {
        if (rig.current !== 'rest') {
          mixer.stopAllAction();
          // Snap the skeleton back to its bind (modelling) pose: straight, arms relaxed.
          for (const s of skeletons) s.pose();
          active = undefined;
          rig.current = 'rest';
        }
        return;
      }
      const next = actions.get(anim) ?? fallback;
      rig.current = anim;
      if (!next || next === active) return;
      next.reset();
      next.setLoop(opts.once ? LoopOnce : LoopRepeat, Infinity);
      next.clampWhenFinished = !!opts.once;
      next.play();
      if (active) next.crossFadeFrom(active, opts.fade ?? 0.35, false);
      active = next;
    },
    update(delta) {
      mixer.update(delta);
      breath += delta;
      if (chest) chest.scale.setScalar(rig.current === 'rest' ? 1 + Math.sin(breath * 1.4) * 0.025 : 1);
      // Self-grounding: whatever height the caller placed him at is the surface his
      // lowest bone rests on (feet on the floor standing, back on the mattress lying,
      // the hop's height mid-jump). Mixamo's root heights don't survive the unit
      // conversion, so the pose alone can't be trusted. Measured in the parent's
      // frame, so it works lying down or upright, in the room or inside the TV.
      const parent = root.parent;
      if (!parent) return;
      parent.updateMatrixWorld(true);
      root.updateMatrixWorld(true);
      inv.copy(parent.matrixWorld).invert();
      let minY = Infinity;
      for (const b of bones) {
        p.setFromMatrixPosition(b.matrixWorld).applyMatrix4(inv);
        if (p.y < minY) minY = p.y;
      }
      if (!Number.isFinite(minY)) return;
      // Move the inner model (not the caller-owned root) along the parent's vertical.
      const lift = root.position.y + GROUND_PAD * root.scale.y - minY;
      p.set(0, lift / root.scale.y, 0).applyQuaternion(q.copy(root.quaternion).invert());
      model.position.add(p);
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

/** Soft brown stand-in with procedural motion (until the Meshy model arrives). */
function standInRig(): BigfootRig {
  const fur = new MeshStandardMaterial({ color: 0x7b4a2d, roughness: 0.95 });
  const face = new MeshStandardMaterial({ color: 0xc89a74, roughness: 0.9 });
  const eye = new MeshStandardMaterial({ color: 0x1b1408, roughness: 0.2 });
  const root = new Group();
  root.name = 'Bigfoot';
  const body = new Group();
  body.name = 'StandInBody';
  const torso = new Mesh(new CapsuleGeometry(0.42, 0.7, 8, 16), fur);
  torso.position.y = 0.95;
  const head = new Mesh(new SphereGeometry(0.3, 20, 14), fur);
  head.position.y = 1.62;
  const muzzle = new Mesh(new SphereGeometry(0.17, 16, 12), face);
  muzzle.position.set(0, 1.56, 0.22);
  muzzle.scale.set(1.2, 0.85, 0.8);
  for (const s of [-1, 1]) {
    const e = new Mesh(new SphereGeometry(0.04, 10, 8), eye);
    e.position.set(0.1 * s, 1.7, 0.26);
    body.add(e);
    const arm = new Mesh(new CapsuleGeometry(0.11, 0.55, 6, 10), fur);
    arm.name = s < 0 ? 'ArmL' : 'ArmR';
    arm.position.set(0.52 * s, 1.0, 0);
    arm.rotation.z = 0.35 * s;
    const leg = new Mesh(new CapsuleGeometry(0.14, 0.35, 6, 10), fur);
    leg.name = s < 0 ? 'LegL' : 'LegR';
    leg.position.set(0.2 * s, 0.32, 0);
    body.add(arm, leg);
  }
  body.add(torso, head, muzzle);
  body.traverse((o) => {
    if ((o as Mesh).isMesh) o.castShadow = o.receiveShadow = true;
  });
  root.add(body);
  let t = 0;
  const rig: BigfootRig = {
    root,
    real: false,
    current: 'idle',
    play(anim) {
      rig.current = anim;
    },
    has() {
      return false;
    },
    headPosition(out) {
      return root.localToWorld(out.set(0, 1.62, 0.1));
    },
    update(delta) {
      t += delta;
      const a = rig.current;
      const swing = a === 'walk' ? Math.sin(t * 6) : 0;
      body.position.y = a === 'walk' ? Math.abs(Math.sin(t * 6)) * 0.04 : a === 'dance' ? Math.abs(Math.sin(t * 5)) * 0.08 : a === 'jump' ? Math.max(0, Math.sin(t * 4)) * 0.3 : 0;
      body.rotation.y = a === 'dance' ? Math.sin(t * 2.5) * 0.4 : 0;
      body.rotation.z = a === 'walk' ? swing * 0.05 : 0;
      const arm = body.getObjectByName('ArmR');
      if (arm) arm.rotation.z = a === 'wave' ? -2.4 + Math.sin(t * 8) * 0.3 : a === 'dance' ? -1.2 + Math.sin(t * 5) * 0.6 : 0.35 + swing * 0.3;
      body.scale.y = a === 'stretch' ? 1 + Math.max(0, Math.sin(t * 1.5)) * 0.08 : 1 + (a === 'sleep' ? Math.sin(t * 1.4) * 0.02 : 0);
    },
  };
  return rig;
}

export const BIGFOOT_HEIGHT = HEIGHT;
export const BIGFOOT_FUR = new Color(0x7b4a2d);
