import {
  Color,
  createSystem,
  Entity,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Quaternion,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  VisibilityState,
} from '@iwsdk/core';
import { Sound } from '../audio/engine.js';
import { DevControls, DreamDirector } from '../components/dream.js';
import { Dreamer, DreamerState } from '../components/dreamer.js';
import { MemoryOrb } from '../components/memory.js';
import { Caption, Ritual, RitualPhase } from '../components/ritual.js';
import { RoomSlots } from '../components/stage.js';
import { Palette, type PaletteKey } from '../config/palette.js';
import { Tuning } from '../config/tuning.js';
import { createDreamFish } from '../scene-assets/dream-fish.scene-asset.js';
import { createLighthouse } from '../scene-assets/lighthouse.scene-asset.js';
import { createStorybookDoor } from '../scene-assets/storybook-door.scene-asset.js';
import { makeDiscMaterial } from '../visuals/glow-materials.js';

const ORB_RADIUS = 0.04;
const HOVER_FORWARD = 0.42;
const HOVER_DROP = 0.1;
const ease = (t: number) => t * t * (3 - 2 * t);
const MOMENT_COLOR: Record<string, PaletteKey> = {
  lighthouse: 'lanternAmber',
  fish: 'moonBlueSoft',
  star: 'starWhite',
  door: 'pinkSoft',
};

/** The moment the orb keeps: the first choice the user made, else the last. */
export function keptMoment(choices: string): string {
  const list = choices.split(',').filter(Boolean).map((c) => c.split(':'));
  return (list.find(([, how]) => how !== 'leanBack') ?? list[list.length - 1] ?? ['star'])[0];
}

/**
 * Waking: once the Dreamer is up, a memory orb of the kept moment forms at its
 * chest and floats to hover just below the center of view. Then the session is
 * awake (the Memory Shelf takes over in Phase 4).
 */
export class WakingSystem extends createSystem({
  director: { required: [Ritual, DreamDirector, DevControls, RoomSlots, Caption] },
  dreamers: { required: [Dreamer] },
}) {
  private orb?: Object3D;
  private orbAge = 0;
  private arrived = false;
  private start = new Vector3();
  private hover = new Vector3();
  private head = new Vector3();
  private quat = new Quaternion();
  private fwd = new Vector3();
  private shelf = new Vector3();
  private fromHover = new Vector3();
  private shelfAge = -1;
  private landed = false;

  update(realDelta: number): void {
    if (this.visibilityState.peek() !== VisibilityState.Visible) return;
    const d = this.queries.director.entities.values().next().value;
    if (!d) return;
    const phase = d.getValue(Ritual, 'phase');
    if (phase !== RitualPhase.Waking && phase !== RitualPhase.Awake) return;
    const delta = realDelta * (d.getValue(DevControls, 'timeScale') ?? 1);
    const dreamer = this.queries.dreamers.entities.values().next().value;
    if (!this.orb) {
      if (!dreamer || dreamer.getValue(Dreamer, 'state') !== DreamerState.Awake) return;
      this.spawn(d, dreamer);
      return;
    }
    this.orbAge += delta;
    if (phase === RitualPhase.Awake) {
      this.settleOnWall(d, delta);
      return;
    }
    this.player.head.getWorldPosition(this.head);
    this.player.head.getWorldQuaternion(this.quat);
    this.fwd.set(0, 0, -1).applyQuaternion(this.quat).setY(0).normalize();
    this.hover.copy(this.head).addScaledVector(this.fwd, HOVER_FORWARD);
    this.hover.y -= HOVER_DROP;
    const k = Math.min(1, this.orbAge / Tuning.waking.orbRiseSec);
    this.orb.position.lerpVectors(this.start, this.hover, ease(k));
    this.orb.position.y += Math.sin(Math.PI * k) * 0.06 + Math.sin(this.orbAge * 1.6) * 0.006 * k;
    this.orb.scale.setScalar(0.3 + 0.7 * ease(Math.min(1, this.orbAge / 0.8)));
    const inner = this.orb.getObjectByName('Moment');
    if (inner) inner.rotation.y += delta * 0.6;
    if (k >= 1 && !this.arrived) {
      this.arrived = true;
      Sound.play('bloom', this.orb.position, 0.7);
    }
    if (this.arrived && phase === RitualPhase.Waking && this.orbAge >= Tuning.waking.orbRiseSec + Tuning.waking.settleSec) {
      d.setValue(Ritual, 'phase', RitualPhase.Awake);
      d.setValue(Ritual, 'phaseTime', 0);
    }
  }

  /** After waking, the orb drifts to the wall and stays there: the session's closing image. */
  private settleOnWall(d: Entity, delta: number): void {
    const orb = this.orb!;
    if (this.shelfAge < 0) {
      this.shelfAge = 0;
      this.fromHover.copy(orb.position);
      this.shelf.copy(orb.position);
      if (d.getValue(RoomSlots, 'anchorReady')) {
        const a = d.getVectorView(RoomSlots, 'anchorPoint');
        const n = d.getVectorView(RoomSlots, 'anchorNormal');
        this.shelf.set(a[0] + n[0] * 0.06, a[1] - 0.22, a[2] + n[2] * 0.06);
      }
    }
    this.shelfAge += delta;
    const k = Math.min(1, this.shelfAge / 3);
    orb.position.lerpVectors(this.fromHover, this.shelf, ease(k));
    orb.position.y += Math.sin(this.orbAge * 1.6) * 0.004 + Math.sin(Math.PI * k) * 0.05;
    const inner = orb.getObjectByName('Moment');
    if (inner) inner.rotation.y += delta * 0.6;
    if (k >= 1 && !this.landed) {
      this.landed = true;
      Sound.play('chime', this.shelf, 0.7);
      d.setValue(Caption, 'text', 'Tomorrow night, a new dream.');
      d.setValue(Caption, 'ttl', 8);
    }
  }

  private spawn(d: Entity, dreamer: Entity): void {
    const moment = keptMoment(d.getValue(DreamDirector, 'choices') ?? '');
    const color = Palette[MOMENT_COLOR[moment] ?? 'starWhite'];
    dreamer.object3D?.getWorldPosition(this.start);
    this.start.y += 0.09;
    const orb = new Group();
    orb.name = 'MemoryOrb';
    const shell = new Mesh(
      new SphereGeometry(ORB_RADIUS, 24, 16),
      new MeshStandardMaterial({
        color,
        emissive: new Color(color),
        emissiveIntensity: 0.35,
        roughness: 0.15,
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
      }),
    );
    const halo = new Mesh(new PlaneGeometry(ORB_RADIUS * 5, ORB_RADIUS * 5), makeDiscMaterial(color));
    (halo.material as ShaderMaterial).uniforms.opacity.value = 0.6;
    halo.onBeforeRender = (_r, _s, camera) => halo.quaternion.copy(camera.quaternion);
    orb.add(halo, shell, momentMiniature(moment));
    orb.position.copy(this.start);
    const entity = this.world.createTransformEntity(orb);
    entity.addComponent(MemoryOrb, {
      chapterId: d.getValue(DreamDirector, 'chapterId') ?? '',
      momentId: moment,
      createdAt: new Date().toISOString(),
    });
    this.orb = orb;
    this.orbAge = 0;
  }
}

/** A tiny model of the kept moment, centered inside the orb. */
function momentMiniature(moment: string): Object3D {
  let m: Object3D;
  if (moment === 'lighthouse') {
    m = createLighthouse();
    m.scale.setScalar(0.24);
    m.position.y = -0.026;
  } else if (moment === 'fish') {
    m = createDreamFish();
    m.scale.setScalar(0.32);
  } else if (moment === 'door') {
    m = createStorybookDoor();
    m.scale.setScalar(0.13);
    m.position.y = -0.028;
  } else {
    m = new Mesh(new SphereGeometry(0.01, 12, 8), new MeshBasicMaterial({ color: Palette.starWhite }));
  }
  const wrap = new Group();
  wrap.name = 'Moment';
  wrap.add(m);
  return wrap;
}
