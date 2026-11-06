import {
  CanvasTexture,
  createSystem,
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  SRGBColorSpace,
  Vector3,
  VisibilityState,
  WebGLRenderTarget,
} from '@iwsdk/core';
import { Bigfoot } from '../components/bigfoot.js';
import { DreamDirector } from '../components/dream.js';
import { Ritual, RitualPhase } from '../components/ritual.js';
import { Session } from '../components/session.js';
import { RoomSlots } from '../components/stage.js';
import { Director, DirectorFrame } from '../config/director.js';
import { Palette } from '../config/palette.js';
import { Tuning } from '../config/tuning.js';
import { newBeatContext, readBeat } from '../dreams/beat-context.js';
import { frameToWorld, Rooftop, WindowFrame } from '../showcase/rooftop-layout.js';

const cfg = Tuning.cinema;
/** Beats with something worth a close-up; the screen shows during these. */
const LIVE = new Set(['leap-out', 'arrive', 'party-wait', 'leap-back', 'gifts']);
/** Overlays that must not appear in the shot (head-locked, or the screen itself). */
const HIDE = ['DreamCinema', 'Caption', 'FilmTitle', 'FilmChapter', 'FilmCredits', 'NightVignette', 'ResumeFade', 'TourFade', 'WindowOutline'];

/**
 * Spatial cinema: a floating screen shows a live, director-style cut of
 * Bigfoot's night (close-ups of him dancing, the Yeti at the decks, a crane
 * over the crowd, his leap home, the catch) while the real thing plays out of
 * the window. A second camera renders the scene into a small texture every few
 * frames (XR rendering paused for that pass). The screen is anchored to the
 * player rig, front-left, so the view tour carries it along.
 */
export class CinemaSystem extends createSystem({
  director: { required: [Ritual, DreamDirector, RoomSlots] },
  bigfoot: { required: [Bigfoot] },
}) {
  private rt!: WebGLRenderTarget;
  private cam!: PerspectiveCamera;
  private screen!: Group;
  private screenMat!: MeshBasicMaterial;
  private beat = newBeatContext();
  private amount = 0;
  private frame = 0;
  private shotAge = 0;
  private shot = 0;
  private lastScene = '';
  private hidden: Object3D[] = [];
  private found = false;
  private win: WindowFrame = { origin: new Vector3(), out: new Vector3(), along: new Vector3() };
  private big = new Vector3();
  private bigFwd = new Vector3();
  private eye = new Vector3();
  private look = new Vector3();
  private head = new Vector3();
  private q = new Quaternion();
  private p = { x: 0, y: 0, z: 0 };

  init(): void {
    this.rt = new WebGLRenderTarget(cfg.texWidth, cfg.texHeight);
    this.cam = new PerspectiveCamera(cfg.fov, cfg.texWidth / cfg.texHeight, 0.05, 300);
    this.screen = new Group();
    this.screen.name = 'DreamCinema';
    const w = cfg.width;
    const h = (w * cfg.texHeight) / cfg.texWidth;
    this.screenMat = new MeshBasicMaterial({ map: this.rt.texture, transparent: true, opacity: 0, toneMapped: false });
    const picture = new Mesh(new PlaneGeometry(w, h), this.screenMat);
    const bezel = new Mesh(new PlaneGeometry(w + 0.06, h + 0.06), new MeshBasicMaterial({ color: Palette.cinemaBezel, transparent: true, opacity: 0 }));
    bezel.position.z = -0.005;
    const label = new Mesh(new PlaneGeometry(0.42, 0.07), new MeshBasicMaterial({ map: this.labelTexture(), transparent: true, opacity: 0, depthWrite: false }));
    label.position.set(-w / 2 + 0.23, h / 2 + 0.07, 0);
    this.screen.add(bezel, picture, label);
    this.screen.visible = false;
    this.world.createTransformEntity(this.screen);
  }

  update(realDelta: number): void {
    if (this.visibilityState.peek() !== VisibilityState.Visible) return;
    const d = this.queries.director.entities.values().next().value;
    if (!d || !d.getValue(RoomSlots, 'windowReady')) return;
    if (!this.found) this.findHidden();
    const roof = d.getValue(DreamDirector, 'chapterId') === 'rooftop-party';
    const scene = roof && d.getValue(Ritual, 'phase') === RitualPhase.Asleep && readBeat(d, this.beat) ? this.beat.scene : '';
    const on = (LIVE.has(scene) || scene.startsWith('party-')) && (!Director.enabled || DirectorFrame.cinema);
    this.amount += ((on ? 1 : 0) - this.amount) * Math.min(1, realDelta * 1.5);
    this.screen.visible = this.amount > 0.01;
    if (!this.screen.visible) return;
    for (const c of this.screen.children) ((c as Mesh).material as MeshBasicMaterial).opacity = this.amount * (c === this.screen.children[0] ? 0.85 : 1);
    this.place();
    if (scene !== this.lastScene) {
      this.lastScene = scene;
      this.shot = 0;
      this.shotAge = 0;
    }
    this.shotAge += realDelta;
    if (this.shotAge > cfg.shotSec) {
      this.shotAge = 0;
      this.shot++;
    }
    // Lower quality (slow frames) refreshes the picture less often.
    const q = d.hasComponent(Session) ? (d.getValue(Session, 'quality') ?? 0) : 0;
    if (++this.frame % (cfg.every * (1 + q)) !== 0) return;
    this.win.origin.fromArray(d.getVectorView(RoomSlots, 'windowOrigin'));
    this.win.out.fromArray(d.getVectorView(RoomSlots, 'windowOut'));
    this.win.along.fromArray(d.getVectorView(RoomSlots, 'windowAlong'));
    this.aim(scene);
    this.render();
  }

  /** The director's cut: which shot, from where, looking at what. */
  private aim(scene: string): void {
    const b = this.queries.bigfoot.entities.values().next().value?.object3D;
    if (!b) return;
    b.getWorldPosition(this.big);
    b.getWorldQuaternion(this.q);
    this.bigFwd.set(0, 0, 1).applyQuaternion(this.q).setY(0);
    if (this.bigFwd.lengthSq() < 1e-4) this.bigFwd.copy(this.win.out);
    this.bigFwd.normalize();
    const al = this.win.along;
    if (scene === 'gifts') {
      // In his room: alternate a shot from beside the bed and one looking in through the window.
      if (this.shot % 2 === 0) this.framePoint(-2.3, 1.45, 1.3, this.eye);
      else this.framePoint(1.4, 1.7, 0.7, this.eye);
      this.look.copy(this.big).setY(this.big.y + 1.2);
    } else if (scene === 'leap-out' || scene === 'leap-back') {
      // Tracking from the side as he flies across the street.
      this.eye.copy(this.big).addScaledVector(al, 6).addScaledVector(this.win.out, -1);
      this.eye.y += 1.2;
      this.look.copy(this.big).setY(this.big.y + 1);
    } else {
      const s = this.shot % 4;
      if (s === 0) {
        // Close on Bigfoot dancing.
        this.eye.copy(this.big).addScaledVector(this.bigFwd, 2.4);
        this.eye.y += 1.5;
        this.look.copy(this.big).setY(this.big.y + 1.3);
      } else if (s === 1) {
        // The Yeti at the decks (the booth faces +along).
        frameToWorld(this.win, Rooftop.djSpot, this.look);
        this.eye.copy(this.look).addScaledVector(al, 3.2).addScaledVector(this.win.out, 0.8);
        this.eye.y += 0.9;
        this.look.y += 1.1;
      } else if (s === 2) {
        // A crane shot over the crowd.
        this.framePoint(10.3, 6, 2, this.look);
        this.eye.copy(this.look).addScaledVector(this.win.out, 6).addScaledVector(al, 5);
        this.eye.y += 8;
      } else {
        // A low hero angle on Bigfoot.
        this.eye.copy(this.big).addScaledVector(this.bigFwd, 1.7).addScaledVector(al, 0.6);
        this.eye.y += 0.35;
        this.look.copy(this.big).setY(this.big.y + 1.7);
      }
    }
    this.cam.position.copy(this.eye);
    this.cam.lookAt(this.look);
    this.cam.updateMatrixWorld();
  }

  private framePoint(x: number, y: number, z: number, out: Vector3): Vector3 {
    this.p.x = x;
    this.p.y = y;
    this.p.z = z;
    return frameToWorld(this.win, this.p, out);
  }

  /** One pass of the scene from the director's camera into the screen's texture. */
  private render(): void {
    const r = this.renderer;
    const xr = r.xr.enabled;
    const shadows = r.shadowMap.autoUpdate;
    for (const o of this.hidden) o.userData.cinemaWasVisible = o.visible;
    for (const o of this.hidden) o.visible = false;
    r.xr.enabled = false;
    r.shadowMap.autoUpdate = false;
    // Mark this pass so the trailer's frame capture skips it.
    DirectorFrame.offscreen = true;
    r.setRenderTarget(this.rt);
    r.render(this.scene, this.cam);
    r.setRenderTarget(null);
    DirectorFrame.offscreen = false;
    r.xr.enabled = xr;
    r.shadowMap.autoUpdate = shadows;
    for (const o of this.hidden) o.visible = !!o.userData.cinemaWasVisible;
  }

  /** Front-left of the viewer, in rig space (the tour carries it), turned to face them. */
  private place(): void {
    this.player.updateMatrixWorld();
    this.screen.position.set(cfg.x, cfg.y, cfg.z);
    this.player.localToWorld(this.screen.position);
    this.player.head.getWorldPosition(this.head);
    this.screen.rotation.set(0, Math.atan2(this.head.x - this.screen.position.x, this.head.z - this.screen.position.z), 0);
  }

  private findHidden(): void {
    this.hidden.length = 0;
    for (const n of HIDE) {
      const o = this.scene.getObjectByName(n);
      if (o) this.hidden.push(o);
    }
    this.found = this.hidden.length >= HIDE.length - 1;
  }

  /** "● LIVE · Rooftop cam" above the picture. */
  private labelTexture(): CanvasTexture {
    const c = document.createElement('canvas');
    c.width = 384;
    c.height = 64;
    const g = c.getContext('2d');
    if (g) {
      g.fillStyle = 'rgba(10, 8, 12, 0.7)';
      g.fillRect(0, 0, 384, 64);
      g.fillStyle = '#ff3b3b';
      g.beginPath();
      g.arc(30, 32, 11, 0, Math.PI * 2);
      g.fill();
      g.font = 'bold 30px Georgia, serif';
      g.fillStyle = '#fff3dd';
      g.textBaseline = 'middle';
      g.fillText('LIVE  ·  Rooftop cam', 52, 33);
    }
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    return t;
  }
}
