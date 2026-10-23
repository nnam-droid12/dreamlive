import { createSystem, Entity, Matrix4, Mesh, PlaneGeometry, Quaternion, Vector3, VisibilityState } from '@iwsdk/core';
import { GazeMode, GazeRay, GazeTarget } from '../components/dream.js';
import { Palette } from '../config/palette.js';
import { Tuning } from '../config/tuning.js';
import { makeRingMaterial } from '../visuals/glow-materials.js';

const DEG = 180 / Math.PI;
const g = Tuning.gaze;

/** XRFrame.fillPoses is missing from the bundled DOM typings. */
type FillPosesFrame = XRFrame & {
  fillPoses?: (spaces: XRSpace[], base: XRSpace, out: Float32Array) => boolean;
};

/**
 * "Attention": one ray per frame — true eye gaze when the runtime exposes a
 * `gaze` input source (Meta VR Glasses, emulator gaze mode), otherwise head
 * gaze from the center of view (Quest 3/3S). Marks the single GazeTarget the
 * user is looking at; in head mode a subtle reticle appears only near targets.
 */
export class AttentionSystem extends createSystem({
  rays: { required: [GazeRay] },
  targets: { required: [GazeTarget] },
}) {
  private gazeSpace: XRSpace[] = [];
  private pose = new Float32Array(16);
  private matrix = new Matrix4();
  private origin = new Vector3();
  private dir = new Vector3();
  private quat = new Quaternion();
  private toTarget = new Vector3();
  private reticle!: Mesh;
  private reticleMat = makeRingMaterial(Palette.starWhite);

  init(): void {
    this.reticleMat.uniforms.thickness.value = 0.12;
    this.reticleMat.uniforms.fill.value = 0;
    this.reticle = new Mesh(new PlaneGeometry(0.02, 0.02), this.reticleMat);
    this.reticle.name = 'GazeReticle';
    this.reticle.renderOrder = 9;
    this.reticle.visible = false;
    this.world.createTransformEntity(this.reticle);
  }

  update(): void {
    const ray = this.queries.rays.entities.values().next().value;
    if (!ray) return;
    const mode = this.readRay();
    ray.setValue(GazeRay, 'mode', mode);
    this.origin.toArray(ray.getVectorView(GazeRay, 'origin'));
    this.dir.toArray(ray.getVectorView(GazeRay, 'direction'));

    let best: Entity | undefined;
    let bestAngle = Infinity;
    let nearest = Infinity;
    let nearestDist = 0;
    for (const t of this.queries.targets.entities) {
      const obj = t.object3D;
      if (!obj) continue;
      obj.getWorldPosition(this.toTarget);
      this.toTarget.toArray(t.getVectorView(GazeTarget, 'worldPos'));
      this.toTarget.sub(this.origin);
      const dist = this.toTarget.length();
      const angle = this.dir.angleTo(this.toTarget) * DEG;
      t.setValue(GazeTarget, 'angleDeg', angle);
      t.setValue(GazeTarget, 'focused', false);
      const radius = t.getValue(GazeTarget, 'radius') ?? 0.03;
      const cone = g.seedHitAngleDeg + Math.atan2(radius, Math.max(dist, 0.05)) * DEG;
      if (mode !== GazeMode.None && angle < cone && angle < bestAngle) {
        best = t;
        bestAngle = angle;
      }
      if (angle < nearest) {
        nearest = angle;
        nearestDist = dist;
      }
    }
    best?.setValue(GazeTarget, 'focused', true);

    // Head-gaze reticle: shown whenever a choice is waiting (dim when far from a seed),
    // so Quest 3/3S users see what "looking" is doing.
    const showReticle = mode === GazeMode.Head && nearest < Infinity;
    this.reticle.visible = showReticle;
    if (showReticle) {
      const near = nearest < g.reticleShowAngleDeg;
      this.reticle.position.copy(this.origin).addScaledVector(this.dir, near ? nearestDist * 0.97 : 0.7);
      this.reticle.quaternion.copy(this.quat);
      this.reticleMat.uniforms.opacity.value = best ? 1 : near ? 0.35 + 0.65 * (1 - nearest / g.reticleShowAngleDeg) : 0.3;
    }
  }

  /** Fills this.origin / this.dir / this.quat in world space. */
  private readRay(): (typeof GazeMode)[keyof typeof GazeMode] {
    const frame = this.xrFrame as FillPosesFrame | undefined;
    const refSpace = this.xrManager.getReferenceSpace();
    const sources = frame?.session.inputSources;
    if (frame && refSpace && sources) {
      for (let i = 0; i < sources.length; i++) {
        const s = sources[i];
        if (s.targetRayMode !== 'gaze') continue;
        this.gazeSpace[0] = s.targetRaySpace;
        let ok = false;
        if (frame.fillPoses) ok = frame.fillPoses(this.gazeSpace, refSpace, this.pose);
        else {
          const p = frame.getPose(s.targetRaySpace, refSpace);
          if (p) {
            this.pose.set(p.transform.matrix);
            ok = true;
          }
        }
        if (!ok) break;
        this.matrix.fromArray(this.pose).premultiply(this.player.matrixWorld);
        this.matrix.decompose(this.origin, this.quat, this.toTarget);
        this.dir.set(0, 0, -1).applyQuaternion(this.quat);
        return GazeMode.Eye;
      }
    }
    if (this.visibilityState.peek() === VisibilityState.NonImmersive) return GazeMode.None;
    this.player.head.getWorldPosition(this.origin);
    this.player.head.getWorldQuaternion(this.quat);
    this.dir.set(0, 0, -1).applyQuaternion(this.quat);
    return GazeMode.Head;
  }
}
