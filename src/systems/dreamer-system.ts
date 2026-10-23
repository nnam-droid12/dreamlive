import {
  CanvasTexture,
  createSystem,
  Entity,
  Mesh,
  Object3D,
  PlaneGeometry,
  ShaderMaterial,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
} from '@iwsdk/core';
import { Dreamer, DreamerState } from '../components/dreamer.js';
import { Ritual, RitualPhase } from '../components/ritual.js';
import { StageAnchor } from '../components/stage.js';
import { Palette } from '../config/palette.js';
import { Tuning } from '../config/tuning.js';
import { createDreamer } from '../scene-assets/dreamer.scene-asset.js';
import { makeDiscMaterial } from '../visuals/glow-materials.js';

const r = Tuning.ritual;
const ZZZ_COUNT = 3;
const ZZZ_LIFE_SEC = 3.2;
const LID_SLEEPY = 0;
const LID_CLOSED = 1.45;
const ease = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

interface Rig {
  root: Object3D;
  body: Object3D;
  lids: Object3D[];
  mouth: Object3D;
  wings: Object3D[];
  antennae: Object3D[];
  feet: Object3D[];
  bodyY: number;
  mouthX: number;
  mouthY: number;
  wingYaw: number[];
  footY: number;
  glow: ShaderMaterial;
  zzz: { sprite: Sprite; age: number }[];
}

/**
 * The Dreamer's tuck-in performance: walks out of the merged ring toward the
 * user, yawns, curls up and sleeps (breathing, rising "z"s). Ends the opening
 * ritual by setting the phase to Asleep.
 */
export class DreamerSystem extends createSystem({
  director: { required: [Ritual] },
  stage: { required: [StageAnchor] },
  dreamers: { required: [Dreamer] },
}) {
  private rig?: Rig;
  private zzzTimer = 0;

  update(delta: number): void {
    const d = this.queries.director.entities.values().next().value;
    if (!d) return;
    if (!this.rig) {
      if (d.getValue(Ritual, 'phase') !== RitualPhase.DreamerEnter) return;
      this.spawn();
    }
    const e = this.queries.dreamers.entities.values().next().value;
    if (!e || !this.rig) return;
    const t = (e.getValue(Dreamer, 'stateTime') ?? 0) + delta;
    e.setValue(Dreamer, 'stateTime', t);
    switch (e.getValue(Dreamer, 'state')) {
      case DreamerState.Walking:
        this.walk(t);
        if (t >= r.dreamerWalkSec) this.next(e, DreamerState.Yawning);
        break;
      case DreamerState.Yawning:
        this.yawn(t);
        if (t >= r.dreamerYawnSec) this.next(e, DreamerState.Curling);
        break;
      case DreamerState.Curling:
        this.curl(ease(clamp01(t / r.dreamerCurlSec)));
        if (t >= r.dreamerCurlSec) {
          this.next(e, DreamerState.Sleeping);
          d.setValue(Ritual, 'phase', RitualPhase.Asleep);
          d.setValue(Ritual, 'phaseTime', 0);
        }
        break;
      default:
        this.sleep(t, delta);
    }
  }

  private next(e: Entity, state: (typeof DreamerState)[keyof typeof DreamerState]): void {
    e.setValue(Dreamer, 'state', state);
    e.setValue(Dreamer, 'stateTime', 0);
  }

  private spawn(): void {
    const stageEntity = this.queries.stage.entities.values().next().value;
    if (!stageEntity) return;
    const root = createDreamer();
    root.position.set(0, 0, -r.dreamerWalkDistance * 0.35);
    root.scale.setScalar(r.dreamerScale * 0.3);
    const glow = makeDiscMaterial(Palette.lanternGlow);
    glow.uniforms.opacity.value = 0.35;
    const contact = new Mesh(new PlaneGeometry(0.11, 0.11), glow);
    contact.name = 'ContactGlow';
    contact.rotation.x = -Math.PI / 2;
    contact.position.y = 0.001;
    root.add(contact);
    this.world.createTransformEntity(root, { parent: stageEntity }).addComponent(Dreamer, {
      state: DreamerState.Walking,
      stateTime: 0,
    });
    const named = (n: string) => root.getObjectByName(n) ?? new Object3D();
    const lids: Object3D[] = [];
    root.traverse((o) => o.name === 'Lid' && lids.push(o));
    const wings = [named('WingL'), named('WingR')];
    const mouth = named('Mouth');
    const body = named('Body');
    const feet = [named('FootL'), named('FootR')];
    const zzzMat = new SpriteMaterial({ map: zzzTexture(), transparent: true, depthWrite: false });
    const zzz = [];
    for (let i = 0; i < ZZZ_COUNT; i++) {
      const sprite = new Sprite(zzzMat.clone());
      sprite.visible = false;
      root.add(sprite);
      zzz.push({ sprite, age: -1 });
    }
    this.rig = {
      root, body, lids, mouth, wings, feet, zzz,
      antennae: [named('AntennaL'), named('AntennaR')],
      bodyY: body.position.y,
      mouthX: mouth.scale.x,
      mouthY: mouth.scale.y,
      wingYaw: wings.map((w) => w.rotation.y),
      footY: feet[0].position.y,
      glow,
    };
  }

  private walk(t: number): void {
    const g = this.rig!;
    const p = ease(clamp01(t / r.dreamerWalkSec));
    const dist = r.dreamerWalkDistance;
    g.root.position.z = -dist * 0.35 + dist * p;
    g.root.scale.setScalar(r.dreamerScale * (0.3 + 0.7 * ease(clamp01(t / 0.5))));
    const step = t * 9;
    const settle = 1 - clamp01((t - r.dreamerWalkSec + 0.3) / 0.3);
    g.body.position.y = g.bodyY + Math.abs(Math.sin(step)) * 0.005 * settle;
    g.body.rotation.z = Math.sin(step) * 0.07 * settle;
    g.feet.forEach((f, i) => {
      f.position.y = g.footY + Math.max(0, Math.sin(step + i * Math.PI)) * 0.004 * settle;
    });
    g.wings.forEach((w, i) => {
      w.rotation.y = g.wingYaw[i] + (i ? 1 : -1) * Math.sin(t * 16) * 0.12 * settle;
    });
    for (const lid of g.lids) lid.rotation.x = -0.35 * settle + LID_SLEEPY;
  }

  private yawn(t: number): void {
    const g = this.rig!;
    const s = Math.sin(Math.PI * clamp01(t / r.dreamerYawnSec));
    g.mouth.scale.set(g.mouthX * (1 + 0.5 * s), g.mouthY * (1 + 3.2 * s), g.mouth.scale.z);
    g.body.scale.set(1 - 0.02 * s, 1 + 0.07 * s, 1 - 0.02 * s);
    for (const lid of g.lids) lid.rotation.x = LID_SLEEPY + 0.9 * s;
    g.wings.forEach((w, i) => (w.rotation.y = g.wingYaw[i] - (i ? 1 : -1) * 0.35 * s));
    for (const a of g.antennae) a.rotation.x = -0.25 * s;
  }

  private curl(e: number): void {
    const g = this.rig!;
    g.body.scale.set(1 + 0.07 * e, 1 - 0.18 * e, 1 + 0.07 * e);
    g.body.position.y = g.bodyY - 0.007 * e;
    for (const lid of g.lids) lid.rotation.x = LID_SLEEPY + (LID_CLOSED - LID_SLEEPY) * e;
    g.wings.forEach((w, i) => (w.rotation.y = g.wingYaw[i] - (i ? 1 : -1) * 1.3 * e));
    for (const a of g.antennae) a.rotation.x = 0.45 * e;
    g.root.rotation.y = 0.35 * e;
  }

  private sleep(t: number, delta: number): void {
    const g = this.rig!;
    const breath = Math.sin(t * 1.7);
    g.body.scale.set(1.07 * (1 - 0.01 * breath), 0.82 * (1 + 0.035 * breath), 1.07 * (1 - 0.01 * breath));
    g.glow.uniforms.opacity.value = 0.3 + 0.08 * breath;
    this.zzzTimer -= delta;
    if (this.zzzTimer <= 0) {
      this.zzzTimer = r.zzzIntervalSec;
      const free = g.zzz.find((z) => z.age < 0) ?? g.zzz[0];
      free.age = 0;
    }
    for (const z of g.zzz) {
      if (z.age < 0) continue;
      z.age += delta;
      const k = z.age / ZZZ_LIFE_SEC;
      if (k >= 1) {
        z.age = -1;
        z.sprite.visible = false;
        continue;
      }
      z.sprite.visible = true;
      z.sprite.position.set(0.018 + Math.sin(z.age * 2.4) * 0.008, 0.07 + k * 0.06, 0.005);
      z.sprite.scale.setScalar(0.012 + k * 0.012);
      z.sprite.material.opacity = Math.sin(Math.PI * k);
    }
  }
}

function zzzTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  if (g) {
    g.font = 'italic 700 52px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowColor = '#ffd89a';
    g.shadowBlur = 8;
    g.fillStyle = '#fff8e8';
    g.fillText('z', 32, 34);
  }
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}
