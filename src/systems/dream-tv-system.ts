import {
  createSystem,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  SRGBColorSpace,
  Vector3,
  VisibilityState,
  WebGLRenderTarget,
} from '@iwsdk/core';
import { BigfootAnim, BigfootRig, createBigfoot } from '../characters/bigfoot.js';
import { DevControls } from '../components/dream.js';
import { Ritual, RitualPhase } from '../components/ritual.js';
import { Session } from '../components/session.js';
import { RoomSlots } from '../components/stage.js';
import { Showcase } from '../config/showcase.js';
import { Tuning } from '../config/tuning.js';
import { dreamDelta, newBeatContext, readBeat } from '../dreams/beat-context.js';
import type { DreamTvScene } from '../dream-tv/common.js';
import { gradientTexture, loadSkyline } from '../dream-tv/common.js';
import { dreamNight } from '../dreams/nights.js';
import { djScene } from '../dream-tv/dj.js';
import { introScene } from '../dream-tv/scenes.js';
import { skiScene } from '../dream-tv/ski.js';
import { surfScene } from '../dream-tv/surf.js';
import { bevelBox } from '../scene-assets/lib/hardsurface.js';

const RT_W = 1024;
const RT_H = 576;
const PARALLAX = 0.45;
const POWER_RATE = 1.6;
/** Render the dream only while the screen is within ~70° of where the user looks. */
const COS_VIEW = Math.cos((70 * Math.PI) / 180);
/** Beats whose scene plays inside the TV; 'finale' reuses the intro world. */
const SCENE_FOR: Record<string, string> = { intro: 'intro', finale: 'intro', surf: 'surf', dj: 'dj', ski: 'ski' };

/**
 * The TV portal. Bigfoot's dream is rendered into a texture on the TV screen
 * (the showcase bedroom's plasma, or a TV hung on the real wall in passthrough)
 * with head-coupled parallax so it reads as a window with depth. The active act
 * follows the dream director; Bigfoot performs inside it.
 */
export class DreamTvSystem extends createSystem({
  director: { required: [Ritual, RoomSlots, DevControls, Session] },
}) {
  private rt!: WebGLRenderTarget;
  private cam!: PerspectiveCamera;
  private screen?: Mesh;
  private screenMat!: MeshBasicMaterial;
  private scenes = new Map<string, DreamTvScene>();
  private active?: DreamTvScene;
  private bigfoot?: BigfootRig;
  /** Tonight's Bigfoot moves per act (dream nights). */
  private moves: Partial<Record<string, BigfootAnim>> = {};
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
  /** Reduced motion: no parallax, no flash. */
  private calm = false;
  private reducedRes = false;
  private fwd = new Vector3();
  private headQuat = new Quaternion();

  init(): void {
    this.rt = new WebGLRenderTarget(RT_W, RT_H);
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
      void this.loadWorlds(d.getValue(Session, 'night') ?? 1);
    }
    if (!this.screen) return;
    const delta = dreamDelta(d, realDelta);
    this.time += delta;

    const dreaming = d.getValue(Ritual, 'phase') === RitualPhase.Asleep && readBeat(d, this.beat);
    // Outside a dream, a memory pinched on the shelf replays its act.
    const replay = dreaming ? '' : (d.getValue(Session, 'replay') ?? '');
    const key = dreaming ? SCENE_FOR[this.beat.scene] : replay ? SCENE_FOR[replay] : undefined;
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
    this.calm = !!d.getValue(Session, 'reducedMotion');
    const reduced = (d.getValue(Session, 'quality') ?? 0) >= 1;
    if (reduced !== this.reducedRes) {
      this.reducedRes = reduced;
      const [w, h] = reduced ? Tuning.performance.tvReduced : Tuning.performance.tvFull;
      this.rt.setSize(w, h);
    }
    const flash = this.calm ? 0 : Math.max(0, 1 - this.power) * 2;
    this.screenMat.color.setScalar(this.power + flash * this.power);
    this.parallax();
    // Looking away: keep the last picture instead of paying for a second scene render.
    if (this.facingScreen()) this.renderDream();
  }

  private enter(s: DreamTvScene): void {
    this.active = s;
    if (this.bigfoot) {
      s.slot.add(this.bigfoot.root);
      this.bigfoot.root.rotation.y = 0;
      this.bigfoot.play(this.moves[s.key as 'surf'] ?? s.pose);
    }
  }

  private parallax(): void {
    const s = this.active!;
    this.player.head.getWorldPosition(this.head);
    this.rel.subVectors(this.head, this.anchor);
    const dx = this.rel.dot(this.right);
    const dy = this.rel.dot(this.up);
    const k = this.calm ? 0 : PARALLAX;
    this.cam.position.set(s.eye[0] - dx * k, s.eye[1] - dy * k, s.eye[2]);
    this.cam.lookAt(s.target[0], s.target[1], s.target[2]);
  }

  private facingScreen(): boolean {
    this.player.head.getWorldQuaternion(this.headQuat);
    this.fwd.set(0, 0, -1).applyQuaternion(this.headQuat);
    this.rel.subVectors(this.anchor, this.head).normalize();
    return this.fwd.dot(this.rel) > COS_VIEW;
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
    // 16:9 at the anchor's width: the showcase plasma, the user's real TV, or a hung one.
    const w = d.getValue(RoomSlots, 'anchorWidth') ?? 2.18;
    const h = (w * 9) / 16;
    this.screen = new Mesh(new PlaneGeometry(w, h), this.screenMat);
    this.screen.name = 'DreamTvScreen';
    this.screen.visible = false;
    tv.add(this.screen);
    if (!Showcase.enabled && !d.getValue(RoomSlots, 'anchorIsScreen')) {
      // In passthrough with no real TV found: hang a slim one on the wall.
      const frame = new Mesh(
        bevelBox(w + 0.04, h + 0.04, 0.03, 0.004),
        new MeshStandardMaterial({ color: 0x18191c, roughness: 0.35, metalness: 0.6 }),
      );
      frame.position.z = -0.018;
      const glass = new Mesh(new PlaneGeometry(w, h), new MeshStandardMaterial({ color: 0x050608, roughness: 0.08 }));
      glass.position.z = -0.002;
      tv.add(frame, glass);
    }
    this.world.createTransformEntity(tv);
  }

  private async loadWorlds(night: number): Promise<void> {
    const skyline = await loadSkyline();
    const tonight = dreamNight(night);
    this.moves = tonight.moves;
    for (const s of [introScene(skyline), surfScene(skyline), djScene(skyline), skiScene(skyline)]) {
      const sky = tonight.sky[s.key as 'surf'];
      if (sky) s.scene.background = gradientTexture(sky[0], sky[1]);
      this.scenes.set(s.key, s);
    }
    this.bigfoot = await createBigfoot();
    if (this.active) this.enter(this.active);
  }
}
