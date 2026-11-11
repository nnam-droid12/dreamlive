import { AnimationAction, AnimationMixer, AssetManager, Color, Group, LoopOnce, LoopRepeat, Mesh, MeshStandardMaterial, Object3D, Quaternion, SkinnedMesh, Vector3 } from '@iwsdk/core';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { Palette } from '../config/palette.js';

export type BunnyMove = 'Idle' | 'Walk' | 'Run' | 'Jump' | 'Wave' | 'Yes';

/**
 * The cartoon bunny who steps out of the movie (Quaternius "Bunny", CC0, with
 * its carrot): white fur with pink ears and belly, like the film's star.
 * Clips: Idle, Walk, Run, Jump, Wave, Yes (a happy nod: munching). `sit` folds
 * its legs forward over a seat; `eat` (0..1) lifts the carrot to its mouth.
 */
export class MovieBunny {
  readonly root = new Group();
  private mixer?: AnimationMixer;
  private actions = new Map<string, AnimationAction>();
  private active?: AnimationAction;
  private bones: Record<string, Object3D | undefined> = {};
  private seated = false;
  private eat = 0;
  private tmpA = new Vector3();
  private tmpB = new Vector3();
  private dir = new Vector3();
  private mouth = new Vector3();
  private fwd = new Vector3();
  private qd = new Quaternion();
  private qw = new Quaternion();
  private qp = new Quaternion();
  private qr = new Quaternion();
  /** Hip height above its feet when seated (m), measured once posed. */
  sitHip = 0.3;
  ready = false;

  constructor(private height: number) {
    this.root.name = 'MovieBunny';
    this.root.visible = false;
  }

  async load(): Promise<void> {
    const gltf = await AssetManager.loadGLTF(`${import.meta.env.BASE_URL}models/bunny.glb`);
    const body = cloneSkinned(gltf.scene);
    body.traverse((o) => {
      const m = o as SkinnedMesh;
      if (!(m as Mesh).isMesh) return;
      m.frustumCulled = false;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      const next = mats.map((x) => {
        const c = (x as MeshStandardMaterial).clone();
        if (c.name === 'Bunny_Main') c.color = new Color(Palette.bunnyFur);
        if (c.name === 'Bunny_Secondary') c.color = new Color(Palette.bunnyPink);
        c.roughness = 0.8;
        return c;
      });
      m.material = Array.isArray(m.material) ? next : next[0];
    });
    // Size it from the skeleton (its skinned bounds are unreliable: the rig is scaled by 100):
    // the top of the head sits about 1.15 head-heights above the head bone; feet at the floor.
    body.updateMatrixWorld(true);
    const head = body.getObjectByName('Head');
    const footL = body.getObjectByName('Foot.L');
    const top = head ? head.getWorldPosition(new Vector3()).y : 1;
    const foot = footL ? footL.getWorldPosition(new Vector3()).y : 0;
    const tall = Math.max(1e-4, (top - foot) * 1.35);
    body.scale.multiplyScalar(this.height / tall);
    body.updateMatrixWorld(true);
    const foot2 = footL ? footL.getWorldPosition(new Vector3()).y : 0;
    body.position.y -= foot2;
    this.root.add(body);
    for (const n of ['Hips', 'UpperLeg.L', 'LowerLeg.L', 'LowerLeg.L_end', 'UpperLeg.R', 'LowerLeg.R', 'LowerLeg.R_end', 'UpperArm.R', 'LowerArm.R', 'Middle1.R', 'Head']) {
      // The glTF loader strips dots from node names ('UpperLeg.L' loads as 'UpperLegL').
      this.bones[n] = body.getObjectByName(n) ?? body.getObjectByName(n.replace(/\./g, '')) ?? undefined;
    }
    this.mixer = new AnimationMixer(body);
    for (const c of gltf.animations) this.actions.set(c.name.split('|').pop() ?? c.name, this.mixer.clipAction(c));
    this.play('Idle');
    this.ready = true;
  }

  /** Height of its hips above its root (m), in the current pose. */
  hipHeight(): number {
    const h = this.bones.Hips;
    if (!h) return this.sitHip;
    this.root.updateWorldMatrix(true, true);
    return h.getWorldPosition(this.tmpA).y - this.root.getWorldPosition(this.tmpB).y;
  }

  play(move: BunnyMove, once = false): void {
    const next = this.actions.get(move);
    if (!next || next === this.active) return;
    next.reset();
    next.setLoop(once ? LoopOnce : LoopRepeat, Infinity);
    next.clampWhenFinished = once;
    next.play();
    if (this.active) next.crossFadeFrom(this.active, 0.25, false);
    this.active = next;
  }

  setSeated(on: boolean, eat = 0): void {
    this.seated = on;
    this.eat = eat;
  }

  update(dt: number): void {
    if (!this.mixer) return;
    this.mixer.update(dt);
    if (this.seated) this.sit();
  }

  /** Legs straight out along the seat; right arm (with the carrot) lifted to the mouth to eat. */
  private sit(): void {
    this.root.updateWorldMatrix(true, true);
    this.root.getWorldQuaternion(this.qr);
    this.fwd.set(0, 0, 1).applyQuaternion(this.qr);
    const B = this.bones;
    this.aim(B['UpperLeg.L'], B['LowerLeg.L'], this.dir.copy(this.fwd).setY(-0.05).normalize());
    this.aim(B['UpperLeg.R'], B['LowerLeg.R'], this.dir.copy(this.fwd).setY(-0.05).normalize());
    // Short legs: straight out along the cushion (feet showing at the front), not bent down into it.
    this.aim(B['LowerLeg.L'], B['LowerLeg.L_end'], this.dir.copy(this.fwd).setY(-0.12).normalize());
    this.aim(B['LowerLeg.R'], B['LowerLeg.R_end'], this.dir.copy(this.fwd).setY(-0.12).normalize());
    if (this.eat > 0 && B['LowerArm.R'] && B.Head) {
      B.Head.getWorldPosition(this.tmpB).addScaledVector(this.fwd, 0.08);
      B['LowerArm.R'].getWorldPosition(this.tmpA);
      const toMouth = this.mouth.copy(this.tmpB.sub(this.tmpA)).normalize();
      this.aim(B['UpperArm.R'], B['LowerArm.R'], this.dir.set(0, -1, 0).lerp(this.fwd, 0.6).normalize());
      this.aim(B['LowerArm.R'], B['Middle1.R'], this.dir.copy(this.fwd).lerp(toMouth, this.eat).normalize());
    }
  }

  private aim(b: Object3D | undefined, child: Object3D | undefined, to: Vector3): void {
    if (!b || !child || !b.parent) return;
    b.updateWorldMatrix(true, false);
    child.updateWorldMatrix(false, false);
    const a = this.tmpA.setFromMatrixPosition(b.matrixWorld);
    const cur = this.tmpB.setFromMatrixPosition(child.matrixWorld).sub(a).normalize();
    if (cur.lengthSq() < 1e-6) return;
    this.qd.setFromUnitVectors(cur, to);
    b.getWorldQuaternion(this.qw).premultiply(this.qd);
    b.parent.getWorldQuaternion(this.qp);
    b.quaternion.copy(this.qp.invert().multiply(this.qw));
    b.updateMatrixWorld(true);
  }
}
