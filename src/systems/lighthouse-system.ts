import {
  ConeGeometry,
  createSystem,
  Entity,
  Group,
  Mesh,
  Object3D,
  PlaneGeometry,
  ShaderMaterial,
  Vector3,
  VisibilityState,
} from '@iwsdk/core';
import { Sound } from '../audio/engine.js';
import { DevControls, DreamDirector } from '../components/dream.js';
import { Ritual } from '../components/ritual.js';
import { RoomSlots, StageAnchor, StageSurface } from '../components/stage.js';
import { Palette } from '../config/palette.js';
import { Tuning } from '../config/tuning.js';
import { foldAmount, newBeatContext, readBeat } from '../dreams/beat-context.js';
import { PaperSeaLayout } from '../dreams/chapter1_paperSea.js';
import { createLighthouse } from '../scene-assets/lighthouse.scene-asset.js';
import { makeBeamMaterial, makeDiscMaterial } from '../visuals/glow-materials.js';

const BELL_EVERY_SEC = 9;
const SWEEP_METERS = 0.9;
const MAX_BEAM = 3;
const ease = (t: number) => t * t * (3 - 2 * t);

/**
 * The lighthouse pops up at the far corner of the table as the boat drifts.
 * On the lighthouse branch its beam sweeps the room and a soft spot of light
 * travels across the real wall (or paper backdrop) while a bell rings from it.
 */
export class LighthouseSystem extends createSystem({
  director: { required: [DreamDirector, Ritual, DevControls, StageSurface, RoomSlots] },
  stage: { required: [StageAnchor] },
}) {
  private root?: Object3D;
  private beam?: Mesh;
  private beamMat?: ShaderMaterial;
  private spot?: Mesh;
  private spotMat?: ShaderMaterial;
  private beat = newBeatContext();
  private appear = 0;
  private beamLevel = 0;
  private bellTimer = 1;
  private time = 0;
  private lantern = new Vector3();
  private anchor = new Vector3();
  private normal = new Vector3();
  private right = new Vector3();
  private target = new Vector3();
  private up = new Vector3(0, 1, 0);

  update(realDelta: number): void {
    if (this.visibilityState.peek() !== VisibilityState.Visible) return;
    const d = this.queries.director.entities.values().next().value;
    if (!d || !readBeat(d, this.beat)) return;
    const delta = realDelta * (d.getValue(DevControls, 'timeScale') ?? 1);
    if (!this.root) {
      if (this.beat.scene === 'sea-rise') return;
      if (!this.build(d)) return;
    }
    this.time += delta;
    const fold = foldAmount(
      d.getValue(Ritual, 'phase') ?? '',
      d.getValue(Ritual, 'phaseTime') ?? 0,
      Tuning.waking.foldSec,
    );
    this.appear = Math.min(1, this.appear + delta / 1.5);
    const pop = ease(this.appear) * (1 - ease(fold));
    this.root!.scale.set(1, Math.max(0.001, pop), 1);
    this.root!.rotation.x = -(1 - pop) * 0.6;

    const on = this.beat.scene === 'lighthouse' && fold === 0;
    this.beamLevel += ((on ? 1 : 0) - this.beamLevel) * Math.min(1, delta * 1.5);
    this.updateBeam();
    if (on) {
      this.bellTimer -= delta;
      if (this.bellTimer <= 0) {
        this.bellTimer = BELL_EVERY_SEC;
        Sound.play('bell', this.anchor, 0.8);
      }
    }
  }

  private updateBeam(): void {
    const visible = this.beamLevel > 0.01;
    this.beam!.visible = this.spot!.visible = visible;
    if (!visible) return;
    this.root!.getObjectByName('Lantern')?.getWorldPosition(this.lantern);
    this.target
      .copy(this.anchor)
      .addScaledVector(this.right, Math.sin(this.time * 0.7) * SWEEP_METERS)
      .addScaledVector(this.up, -0.15);
    const length = Math.min(MAX_BEAM, this.lantern.distanceTo(this.target));
    this.beam!.position.copy(this.lantern);
    this.beam!.lookAt(this.target);
    this.beam!.scale.set(length * 0.16, length * 0.16, length);
    this.beamMat!.uniforms.opacity.value = this.beamLevel;
    this.spot!.position.copy(this.target).addScaledVector(this.normal, 0.01);
    this.spot!.lookAt(this.target.addScaledVector(this.normal, 1));
    this.spotMat!.uniforms.opacity.value = this.beamLevel * 0.85;
  }

  private build(d: Entity): boolean {
    const stage = this.queries.stage.entities.values().next().value;
    if (!stage || !d.getValue(RoomSlots, 'anchorReady')) return false;
    const width = d.getValue(StageSurface, 'width') ?? 0.6;
    const depth = d.getValue(StageSurface, 'depth') ?? 0.4;
    const [u, v] = PaperSeaLayout.lighthouse;
    this.root = createLighthouse();
    this.root.position.set((u * width) / 2, 0, (v * depth) / 2);
    this.root.scale.set(1, 0.001, 1);
    this.world.createTransformEntity(this.root, { parent: stage });

    this.anchor.fromArray(d.getVectorView(RoomSlots, 'anchorPoint'));
    this.normal.fromArray(d.getVectorView(RoomSlots, 'anchorNormal'));
    this.right.crossVectors(this.up, this.normal).normalize();

    const cone = new ConeGeometry(1, 1, 18, 1, true);
    cone.rotateX(-Math.PI / 2).translate(0, 0, 0.5);
    this.beamMat = makeBeamMaterial(Palette.lanternGlow);
    this.beam = new Mesh(cone, this.beamMat);
    this.beam.name = 'LighthouseBeam';
    this.beam.renderOrder = 4;
    this.beam.frustumCulled = false;
    this.beam.visible = false;
    this.spotMat = makeDiscMaterial(Palette.lanternGlow);
    this.spot = new Mesh(new PlaneGeometry(0.6, 0.6), this.spotMat);
    this.spot.name = 'WallLightSpot';
    this.spot.visible = false;
    const group = new Group();
    group.name = 'LighthouseLight';
    group.add(this.beam, this.spot);
    this.world.createTransformEntity(group);
    return true;
  }
}
