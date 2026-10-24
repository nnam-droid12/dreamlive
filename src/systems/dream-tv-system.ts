import {
  createSystem,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  SRGBColorSpace,
  Vector3,
  VisibilityState,
  WebGLRenderTarget,
} from '@iwsdk/core';
import { BigfootRig, createBigfoot } from '../characters/bigfoot.js';
import { DevControls } from '../components/dream.js';
import { Ritual, RitualPhase } from '../components/ritual.js';
import { RoomSlots } from '../components/stage.js';
import { Showcase } from '../config/showcase.js';
import { newBeatContext, readBeat } from '../dreams/beat-context.js';
import type { DreamTvScene } from '../dream-tv/common.js';
import { loadSkyline } from '../dream-tv/common.js';
import { djScene, introScene, skiScene, surfScene } from '../dream-tv/scenes.js';
import { bevelBox } from '../scene-assets/lib/hardsurface.js';

const SCREEN_W = 2.18;
const SCREEN_H = 1.226;
const RT_W = 1024;
const RT_H = 576;
const PARALLAX = 0.45;
const POWER_RATE = 1.6;
/** Beats whose scene plays inside the TV; 'finale' reuses the intro world. */
const SCENE_FOR: Record<string, string> = { intro: 'intro', finale: 'intro', surf: 'surf', dj: 'dj', ski: 'ski' };

/**
 * The TV portal. Bigfoot's dream is rendered into a texture on the TV screen
 * (the showcase bedroom's plasma, or a TV hung on the real wall in passthrough)
 * with head-coupled parallax so it reads as a window with depth. The active act
 * follows the dream director; Bigfoot performs inside it.
 */
export class DreamTvSystem extends createSystem({
  director: { required: [Ritual, RoomSlots, DevControls] },
}) {
  private rt!: WebGLRenderTarget;
  private cam!: PerspectiveCamera;
  private screen?: Mesh;
  private screenMat!: MeshBasicMaterial;
  private scenes = new Map<string, DreamTvScene>();
  private active?: DreamTvScene;
  private bigfoot?: BigfootRig;
  private loading = false;
  private power = 0;
  private time = 0;
  private beat = newBeatContext();
  private anchor = new Vector3();
  private normal = new Vector3();
  private right = new Vector3();
  private up = new Vector3(0, 1, 0);
  private head = new Vector3();
  private rel = new Vector3();

  init(): void {
    this.rt = new WebGLRenderTarget(RT_W, RT_H, { samples: 2 });
    this.rt.texture.colorSpace = SRGBColorSpace;
    this.cam = new PerspectiveCamera(40, RT_W / RT_H, 0.1, 200);
  }

  update(realDelta: number): void {
    if (this.visibilityState.peek() !== VisibilityState.Visible) return;
    const d = this.queries.director.entities.values().next().value;
    if (!d) return;
    if (!this.screen && d.getValue(RoomSlots, 'anchorReady')) this.buildScreen(d);
    if (!this.loading) {
      this.loading = true;
      void this.loadWorlds();
    }
    if (!this.screen) return;
    const delta = realDelta * (d.getValue(DevControls, 'timeScale') ?? 1);
    this.time += delta;

    const dreaming = d.getValue(Ritual, 'phase') === RitualPhase.Asleep && readBeat(d, this.beat);
    const key = dreaming ? SCENE_FOR[this.beat.scene] : undefined;
    const on = !!key || (dreaming && this.beat.scene === 'sleepwalk' && this.beat.progress > 0.86);
    this.power += Math.sign((on ? 1 : 0) - this.power) * Math.min(Math.abs((on ? 1 : 0) - this.power), delta * POWER_RATE);
    this.screen.visible = this.power > 0.01;
    if (!this.screen.visible) return;

    const next = this.scenes.get(key ?? 'intro');
    if (next && next !== this.active) this.enter(next);
    if (!this.active) return;
    if (this.beat.scene === 'finale') this.bigfoot?.play(this.beat.progress < 0.45 ? 'wave' : 'walk');
    this.bigfoot?.update(delta);
    this.active.update(this.time, delta);

    // Turning on: a soft flash of light that settles into the picture.
    const flash = Math.max(0, 1 - this.power) * 2;
    this.screenMat.color.setScalar(this.power + flash * this.power);
    this.parallax();
    this.renderDream();
  }

  private enter(s: DreamTvScene): void {
    this.active = s;
    if (this.bigfoot) {
      s.slot.add(this.bigfoot.root);
      this.bigfoot.root.rotation.y = 0;
      this.bigfoot.play(s.pose);
    }
  }

  private parallax(): void {
    const s = this.active!;
    this.player.head.getWorldPosition(this.head);
    this.rel.subVectors(this.head, this.anchor);
    const dx = this.rel.dot(this.right);
    const dy = this.rel.dot(this.up);
    this.cam.position.set(s.eye[0] - dx * PARALLAX, s.eye[1] - dy * PARALLAX, s.eye[2]);
    this.cam.lookAt(s.target[0], s.target[1], s.target[2]);
  }

  private renderDream(): void {
    const r = this.renderer;
    const target = r.getRenderTarget();
    const xr = r.xr.enabled;
    r.xr.enabled = false;
    r.setRenderTarget(this.rt);
    r.render(this.active!.scene, this.cam);
    r.setRenderTarget(target);
    r.xr.enabled = xr;
  }

  private buildScreen(d: import('@iwsdk/core').Entity): void {
    this.anchor.fromArray(d.getVectorView(RoomSlots, 'anchorPoint'));
    this.normal.fromArray(d.getVectorView(RoomSlots, 'anchorNormal'));
    this.right.crossVectors(this.up, this.normal).normalize();
    const tv = new Group();
    tv.name = 'DreamTv';
    tv.position.copy(this.anchor).addScaledVector(this.normal, 0.012);
    tv.lookAt(this.rel.copy(tv.position).add(this.normal));
    this.screenMat = new MeshBasicMaterial({ map: this.rt.texture, toneMapped: false });
    this.screen = new Mesh(new PlaneGeometry(SCREEN_W, SCREEN_H), this.screenMat);
    this.screen.name = 'DreamTvScreen';
    this.screen.visible = false;
    tv.add(this.screen);
    if (!Showcase.enabled) {
      // In passthrough there is no plasma on the wall: hang a slim one there.
      const frame = new Mesh(
        bevelBox(SCREEN_W + 0.04, SCREEN_H + 0.04, 0.03, 0.004),
        new MeshStandardMaterial({ color: 0x18191c, roughness: 0.35, metalness: 0.6 }),
      );
      frame.position.z = -0.018;
      const glass = new Mesh(new PlaneGeometry(SCREEN_W, SCREEN_H), new MeshStandardMaterial({ color: 0x050608, roughness: 0.08 }));
      glass.position.z = -0.002;
      tv.add(frame, glass);
    }
    this.world.createTransformEntity(tv);
  }

  private async loadWorlds(): Promise<void> {
    const skyline = await loadSkyline();
    for (const s of [introScene(skyline), surfScene(skyline), djScene(skyline), skiScene(skyline)]) {
      this.scenes.set(s.key, s);
    }
    this.bigfoot = await createBigfoot();
    if (this.active) this.enter(this.active);
  }
}
