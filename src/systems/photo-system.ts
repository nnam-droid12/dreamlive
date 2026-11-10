import { Journal } from '../memory/journal.js';
import {
  CanvasTexture,
  createSystem,
  Entity,
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
import { Sound } from '../audio/engine.js';
import { Bigfoot, BigfootState } from '../components/bigfoot.js';
import { Caption, Ritual, RitualPhase } from '../components/ritual.js';
import { Session } from '../components/session.js';
import { RoomSlots } from '../components/stage.js';
import { DirectorFrame } from '../config/director.js';
import { Tuning } from '../config/tuning.js';
import { MemoryStore } from '../memory/store.js';

const cfg = Tuning.photo;
/** Fingertips that make the frame: thumb and index on each hand. */
const TIPS: XRHandJoint[] = ['thumb-tip', 'index-finger-tip'];
const SIDES = ['left', 'right'] as const;
const UP = new Vector3(0, 1, 0);
type FillPosesFrame = XRFrame & { fillPoses?: (spaces: XRSpace[], base: XRSpace, out: Float32Array) => boolean };
/** Overlays never in the photo. */
const HIDE = ['DreamCinema', 'Caption', 'FilmTitle', 'FilmChapter', 'FilmCredits', 'NightVignette', 'ResumeFade', 'TourFade', 'WindowOutline', 'GhostHandLeft', 'GhostHandRight', 'PhotoGuide', 'PhotoFlash', 'Palm Panel', 'MusicMotes'];

interface Print {
  mesh: Mesh;
  age: number;
  from: Vector3;
  to: Vector3;
  toQ: Quaternion;
}

/**
 * "Snap a photo with Bigfoot": make a frame with both hands (each an L of thumb
 * and index finger) and hold it. A glowing outline confirms the frame, Bigfoot
 * waves if he's in the room, and after a short hold the shutter fires: a flash,
 * and exactly what was inside your fingers becomes a polaroid that pops out in
 * front of you, then flies to a little gallery above the TV. The last four
 * photos are kept between visits. The palm menu's Photo button frames the
 * middle of your view instead.
 */
export class PhotoSystem extends createSystem({
  director: { required: [Ritual, Session, RoomSlots, Caption] },
  bigfoot: { required: [Bigfoot] },
}) {
  private poses = new Float32Array(16 * 2);
  private spaces = new WeakMap<XRHand, XRJointSpace[]>();
  private tips = { left: [new Vector3(), new Vector3()], right: [new Vector3(), new Vector3()] };
  private hold = 0;
  private cool = 0;
  private seenShots = 0;
  private rt!: WebGLRenderTarget;
  private cam!: PerspectiveCamera;
  private guide!: Group;
  private guideBars: Mesh[] = [];
  private flash!: Mesh;
  private flashMat!: MeshBasicMaterial;
  private flashAge = 1;
  private prints: Print[] = [];
  private hidden: Object3D[] = [];
  private head = new Vector3();
  private headQ = new Quaternion();
  private center = new Vector3();
  private a = new Vector3();
  private b = new Vector3();
  private loaded = false;
  private inv = new Quaternion();
  private slotN = new Vector3();
  private slotAlong = new Vector3();
  private slotTarget = new Vector3();
  private slotObj = new Object3D();

  init(): void {
    this.rt = new WebGLRenderTarget(cfg.px, Math.round(cfg.px / cfg.aspect));
    this.cam = new PerspectiveCamera(40, cfg.aspect, 0.05, 300);
    // The guide: four soft bars along the framed rectangle.
    this.guide = new Group();
    this.guide.name = 'PhotoGuide';
    const bar = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthTest: false });
    for (let i = 0; i < 4; i++) {
      const m = new Mesh(new PlaneGeometry(1, 1), bar);
      m.renderOrder = 70;
      this.guideBars.push(m);
      this.guide.add(m);
    }
    this.guide.visible = false;
    this.world.createTransformEntity(this.guide);
    this.flashMat = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthTest: false, depthWrite: false });
    this.flash = new Mesh(new PlaneGeometry(4, 4), this.flashMat);
    this.flash.name = 'PhotoFlash';
    this.flash.renderOrder = 2100;
    this.flash.visible = false;
    this.world.createTransformEntity(this.flash);
  }

  update(realDelta: number): void {
    if (this.visibilityState.peek() !== VisibilityState.Visible) return;
    const d = this.queries.director.entities.values().next().value;
    if (!d) return;
    if (!this.loaded && d.getValue(RoomSlots, 'anchorReady')) this.restore(d);
    this.player.head.getWorldPosition(this.head);
    this.player.head.getWorldQuaternion(this.headQ);
    this.cool = Math.max(0, this.cool - realDelta);

    // The finger frame (or the palm menu's button, which frames the middle of the view).
    const framed = this.cool <= 0 && d.getValue(Ritual, 'phase') !== RitualPhase.Idle && this.readFrame();
    const shots = d.getValue(Session, 'photoShots') ?? 0;
    if (shots !== this.seenShots) {
      this.seenShots = shots;
      this.centerFrame();
      this.snap(d);
    } else if (framed) {
      this.hold += realDelta;
      this.showGuide();
      if (this.hold > cfg.poseAfter) this.pose();
      if (this.hold >= cfg.holdSec) this.snap(d);
    } else {
      this.hold = 0;
      this.guide.visible = false;
    }
    this.tickFlash(realDelta);
    for (const p of this.prints) this.tickPrint(p, realDelta);
  }

  /** Fingertips of both hands → is it a frame? Sets this.a / this.b (head-space corners). */
  private readFrame(): boolean {
    const frame = this.xrFrame as FillPosesFrame | undefined;
    const ref = this.xrManager.getReferenceSpace();
    const sources = frame?.session.inputSources;
    if (!frame?.fillPoses || !ref || !sources) return false;
    let got = 0;
    for (let i = 0; i < sources.length; i++) {
      const s = sources[i];
      if (!s.hand || (s.handedness !== 'left' && s.handedness !== 'right')) continue;
      let sp = this.spaces.get(s.hand);
      if (!sp) {
        const hand = s.hand;
        sp = TIPS.map((n) => hand.get(n)).filter((x): x is XRJointSpace => !!x);
        if (sp.length !== TIPS.length) return false;
        this.spaces.set(hand, sp);
      }
      if (!frame.fillPoses(sp, ref, this.poses)) return false;
      const out = this.tips[s.handedness];
      for (let k = 0; k < 2; k++) {
        out[k].set(this.poses[k * 16 + 12], this.poses[k * 16 + 13], this.poses[k * 16 + 14]).applyMatrix4(this.player.matrixWorld);
      }
      got++;
    }
    if (got < 2) return false;
    // Each hand an open L (thumb and index apart).
    for (const side of SIDES) if (this.tips[side][0].distanceTo(this.tips[side][1]) < cfg.openMin) return false;
    // The four tips in head space: in front of the eyes, spanning a sensible rectangle.
    this.inv.copy(this.headQ).invert();
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    let z = 0;
    // A director's frame: one L upright, the other upside down (index above thumb on one hand,
    // below it on the other), so relaxed hands held up together never take a photo.
    let flip = 0;
    for (const side of SIDES) {
      const dy = this.a.copy(this.tips[side][1]).sub(this.tips[side][0]).applyQuaternion(this.inv).y;
      if (Math.abs(dy) < cfg.minLift) return false;
      flip += Math.sign(dy);
    }
    if (flip !== 0) return false;
    for (const side of SIDES) {
      for (const t of this.tips[side]) {
        const p = this.a.copy(t).sub(this.head).applyQuaternion(this.inv);
        if (-p.z < cfg.minReach) return false;
        x0 = Math.min(x0, p.x);
        x1 = Math.max(x1, p.x);
        y0 = Math.min(y0, p.y);
        y1 = Math.max(y1, p.y);
        z += p.z / 4;
      }
    }
    const w = x1 - x0;
    const h = y1 - y0;
    if (w < cfg.minWidth || w > cfg.maxWidth || h < cfg.minHeight) return false;
    this.a.set(x0, y0, z);
    this.b.set(x1, y1, z);
    return true;
  }

  /** The palm-menu shot: a frame in the middle of the view. */
  private centerFrame(): void {
    this.a.set(-0.13, -0.098, -0.42);
    this.b.set(0.13, 0.098, -0.42);
  }

  /** The glowing rectangle between the fingers, so you can see what you're framing. */
  private showGuide(): void {
    const g = this.guide;
    g.visible = true;
    g.position.copy(this.head);
    g.quaternion.copy(this.headQ);
    const w = this.b.x - this.a.x;
    const h = this.b.y - this.a.y;
    const cx = (this.a.x + this.b.x) / 2;
    const cy = (this.a.y + this.b.y) / 2;
    const z = this.a.z;
    const t = 0.004;
    const set = (m: Mesh, x: number, y: number, sx: number, sy: number) => {
      m.position.set(x, y, z);
      m.scale.set(sx, sy, 1);
    };
    set(this.guideBars[0], cx, this.a.y, w, t);
    set(this.guideBars[1], cx, this.b.y, w, t);
    set(this.guideBars[2], this.a.x, cy, t, h);
    set(this.guideBars[3], this.b.x, cy, t, h);
  }

  /** Bigfoot strikes a pose for the camera (if he's up and about in the room). */
  private pose(): void {
    const big = this.queries.bigfoot.entities.values().next().value;
    if (!big) return;
    if (big.getValue(Bigfoot, 'state') === BigfootState.Awake) big.setValue(Bigfoot, 'pose', cfg.poseSec);
  }

  private snap(d: Entity): void {
    this.cool = cfg.cooldownSec;
    this.hold = 0;
    this.guide.visible = false;
    this.pose();
    // A camera at the eyes, aimed through the framed rectangle, matching its height.
    const cx = (this.a.x + this.b.x) / 2;
    const cy = (this.a.y + this.b.y) / 2;
    const depth = -this.a.z;
    const h = Math.max(this.b.y - this.a.y, (this.b.x - this.a.x) / cfg.aspect);
    this.cam.fov = (2 * Math.atan(h / 2 / depth) * 180) / Math.PI;
    this.cam.aspect = cfg.aspect;
    this.cam.updateProjectionMatrix();
    this.cam.position.copy(this.head);
    this.center.set(cx, cy, this.a.z).applyQuaternion(this.headQ).add(this.head);
    this.cam.up.set(0, 1, 0).applyQuaternion(this.headQ);
    this.cam.lookAt(this.center);
    this.cam.updateMatrixWorld();
    const card = this.render();
    if (!card) return;
    this.print(d, card, false);
    Sound.play('shutter', this.head, 0.9);
    this.flashAge = 0;
    d.setValue(Caption, 'text', 'Click! A photo with Bigfoot, saved to your gallery.');
    d.setValue(Caption, 'ttl', 3.5);
  }

  /** Render the shot off-screen and turn it into a polaroid canvas. */
  private render(): HTMLCanvasElement | undefined {
    const r = this.renderer;
    if (!this.hidden.length) {
      for (const n of HIDE) {
        const o = this.scene.getObjectByName(n);
        if (o) this.hidden.push(o);
      }
    }
    const was = this.hidden.map((o) => o.visible);
    this.hidden.forEach((o) => (o.visible = false));
    const xr = r.xr.enabled;
    r.xr.enabled = false;
    DirectorFrame.offscreen = true;
    r.setRenderTarget(this.rt);
    r.render(this.scene, this.cam);
    const w = this.rt.width;
    const h = this.rt.height;
    const px = new Uint8Array(w * h * 4);
    r.readRenderTargetPixels(this.rt, 0, 0, w, h, px);
    r.setRenderTarget(null);
    DirectorFrame.offscreen = false;
    r.xr.enabled = xr;
    this.hidden.forEach((o, i) => (o.visible = was[i]));
    // Polaroid: a white card, the photo on top, a handwritten-style caption below.
    const pad = 18;
    const card = document.createElement('canvas');
    card.width = w + pad * 2;
    card.height = h + pad * 2 + 70;
    const g = card.getContext('2d');
    if (!g) return undefined;
    g.fillStyle = '#fbf8f1';
    g.fillRect(0, 0, card.width, card.height);
    const img = new ImageData(w, h);
    for (let y = 0; y < h; y++) img.data.set(px.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
    // Render targets hold linear light: lift to display gamma for a natural print.
    for (let i = 0; i < img.data.length; i += 4) {
      for (let c = 0; c < 3; c++) img.data[i + c] = Math.round(255 * Math.pow(img.data[i + c] / 255, 1 / 2.2));
    }
    g.putImageData(img, pad, pad);
    g.fillStyle = '#3a3530';
    g.font = 'italic 30px Georgia, serif';
    g.textAlign = 'center';
    g.fillText(`Me & Bigfoot · ${new Date().toLocaleDateString()}`, card.width / 2, h + pad + 48);
    return card;
  }

  /** The polaroid appears where you framed it, then flies to the gallery above the TV. */
  private print(d: Entity, card: HTMLCanvasElement, restored: boolean): void {
    const tex = new CanvasTexture(card);
    tex.colorSpace = SRGBColorSpace;
    const wM = cfg.printWidth;
    const mesh = new Mesh(new PlaneGeometry(wM, (wM * card.height) / card.width), new MeshBasicMaterial({ map: tex, toneMapped: false }));
    mesh.name = 'Polaroid';
    this.world.createTransformEntity(mesh);
    if (this.prints.length >= cfg.gallery) {
      const old = this.prints.shift();
      old?.mesh.removeFromParent();
    }
    this.prints.forEach((p, i) => this.gallerySlot(d, i, p.to, p.toQ));
    const to = new Vector3();
    const toQ = new Quaternion();
    this.gallerySlot(d, this.prints.length, to, toQ);
    const p: Print = { mesh, age: restored ? 99 : 0, from: this.center.clone(), to, toQ };
    if (restored) {
      mesh.position.copy(to);
      mesh.quaternion.copy(toQ);
    } else {
      mesh.position.copy(this.center);
      mesh.lookAt(this.head);
      mesh.scale.setScalar(0.01);
      try {
        // A small JPEG keeps the gallery between visits.
        const small = document.createElement('canvas');
        small.width = 240;
        small.height = Math.round((240 * card.height) / card.width);
        small.getContext('2d')?.drawImage(card, 0, 0, small.width, small.height);
        MemoryStore.addPhoto(small.toDataURL('image/jpeg', 0.8));
    Journal.add('photos');
      } catch {
        // Not saved; it still shows this session.
      }
    }
    this.prints.push(p);
  }

  /** Gallery slot i: a row of prints above the TV, facing the room, each a little askew. */
  private gallerySlot(d: Entity, i: number, out: Vector3, outQ: Quaternion): void {
    this.slotN.fromArray(d.getVectorView(RoomSlots, 'anchorNormal'));
    this.slotAlong.crossVectors(UP, this.slotN).normalize();
    out
      .fromArray(d.getVectorView(RoomSlots, 'anchorPoint'))
      .addScaledVector(this.slotAlong, (i - (cfg.gallery - 1) / 2) * cfg.gallerySpacing)
      .addScaledVector(this.slotN, 0.03);
    out.y += cfg.galleryUp;
    this.slotObj.position.copy(out);
    this.slotObj.lookAt(this.slotTarget.copy(out).add(this.slotN));
    this.slotObj.rotateZ((((i * 37) % 7) - 3) * 0.012);
    outQ.copy(this.slotObj.quaternion);
  }

  private tickPrint(p: Print, dt: number): void {
    if (p.age >= 99) return;
    p.age += dt;
    const m = p.mesh;
    if (p.age < cfg.popSec) {
      const k = p.age / cfg.popSec;
      m.scale.setScalar(Math.max(0.01, k * (1.15 - 0.15 * k)));
    } else if (p.age < cfg.popSec + cfg.showSec) {
      m.scale.setScalar(1);
      m.position.y = p.from.y + Math.sin((p.age - cfg.popSec) * 2) * 0.01;
    } else {
      const k = Math.min(1, (p.age - cfg.popSec - cfg.showSec) / cfg.flySec);
      const e = k * k * (3 - 2 * k);
      m.position.lerpVectors(p.from, p.to, e);
      m.position.y += Math.sin(Math.PI * e) * 0.25;
      m.quaternion.slerp(p.toQ, e * 0.3 + 0.05);
      if (k >= 1) {
        m.position.copy(p.to);
        m.quaternion.copy(p.toQ);
        p.age = 99;
      }
    }
  }

  private tickFlash(dt: number): void {
    if (this.flashAge >= 1) {
      this.flash.visible = false;
      return;
    }
    this.flashAge += dt / cfg.flashSec;
    this.flash.visible = true;
    this.flash.position.copy(this.head).add(this.slotTarget.set(0, 0, -0.3).applyQuaternion(this.headQ));
    this.flash.quaternion.copy(this.headQ);
    this.flashMat.opacity = 0.9 * Math.max(0, 1 - this.flashAge);
  }

  /** Last visits' photos back on the wall. */
  private restore(d: Entity): void {
    this.loaded = true;
    for (const url of MemoryStore.photos()) {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        c.getContext('2d')?.drawImage(img, 0, 0);
        this.print(d, c, true);
      };
      img.src = url;
    }
  }
}
