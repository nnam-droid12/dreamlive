import {
  AdditiveBlending,
  Color,
  createSystem,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
  VisibilityState,
} from '@iwsdk/core';
import { Sound } from '../audio/engine.js';
import { Ritual } from '../components/ritual.js';
import { Session } from '../components/session.js';
import { RoomSlots } from '../components/stage.js';
import { Palette } from '../config/palette.js';
import { Tuning } from '../config/tuning.js';
import { buildBalloon } from '../scene-assets/balloon.scene-asset.js';
import { CloudSea } from '../visuals/cloud-sea.js';
import { cloudTexture, starTexture } from '../visuals/soft-sprites.js';
import { WorldKit } from './lib/world-kit.js';

const cfg = Tuning.clouds;

interface Puff {
  sprite: Sprite;
  home: Vector3;
  vel: Vector3;
  /** 1 = whole; falls to 0 when scattered, then grows back. */
  life: number;
  wait: number;
  size: number;
}

interface Star {
  sprite: Sprite;
  active: boolean;
  wait: number;
  caught: number;
  phase: number;
}

/**
 * Dream world B, Above the Clouds. The walls fall away and the room is
 * floating over a sea of clouds at sunrise: a rolling cumulus floor lit gold
 * from the low sun, towering clouds far off, hot-air balloons drifting on the
 * wind and Bigfoot waving from his own balloon as it circles you. Little clouds
 * float through the room; wave a hand through one and it scatters into wisps.
 * Stars fall slowly within reach; touch one to catch it (a chime and a burst of
 * light; Bigfoot cheers). Hands only.
 */
export class CloudWorldSystem extends createSystem({
  director: { required: [Ritual, Session, RoomSlots] },
}) {
  private kit = new WorldKit('clouds');
  private root!: Group;
  private sea!: CloudSea;
  private far: Puff[] = [];
  private near: Puff[] = [];
  private stars: Star[] = [];
  private streak!: Mesh;
  private streakMat!: MeshBasicMaterial;
  private streakT = -1;
  private streakIn = 2;
  private balloon!: Object3D;
  private flame?: Object3D;
  private basket?: Object3D;
  private others: { obj: Object3D; angle: number; radius: number; y: number; speed: number }[] = [];
  private center = new Vector3();
  private windowAt = new Vector3();
  private out = new Vector3(1, 0, 0);
  private along = new Vector3(0, 0, 1);
  private sunDir = new Vector3(0.8, 0.12, -0.6).normalize();
  private head = new Vector3();
  private fwd = new Vector3();
  private tmp = new Vector3();
  private tmp2 = new Vector3();
  private near2 = { hand: 0, dist: 0 };
  private time = 0;
  private caught = 0;
  private cheer = 0;
  private wind?: ReturnType<typeof Sound.loop>;
  private puffTint = new Color(Palette.cloudPuff);

  init(): void {
    this.root = new Group();
    this.root.name = 'CloudWorld';
    this.root.visible = false;
    this.sea = new CloudSea(cfg.seaRadius, Palette.cloudLit, Palette.cloudShade, Palette.cloudHaze);
    this.root.add(this.sea.mesh);

    // Towering cumulus far off, and little clouds in the room.
    const textures = [0, 1, 2, 3].map((i) => cloudTexture(i + 1));
    for (let i = 0; i < cfg.puffs; i++) {
      const a = (i / cfg.puffs) * Math.PI * 2 + Math.sin(i * 12.9) * 0.3;
      const r = cfg.puffNear + ((Math.sin(i * 78.2) + 1) / 2) * (cfg.puffFar - cfg.puffNear);
      const size = 18 + ((Math.sin(i * 3.7) + 1) / 2) * 40 * (r / cfg.puffFar + 0.4);
      const home = new Vector3(Math.cos(a) * r, cfg.seaY + size * 0.28, Math.sin(a) * r);
      this.far.push(this.puff(textures[i % 4], home, size, 0.95));
    }
    for (let i = 0; i < cfg.roomPuffs; i++) {
      this.near.push(this.puff(textures[(i + 2) % 4], new Vector3(), cfg.roomPuffSize * (0.8 + (i % 3) * 0.15), 0.9));
    }

    // Catchable falling stars, and a shooting star streak.
    const glow = starTexture();
    for (let i = 0; i < cfg.stars; i++) {
      const mat = new SpriteMaterial({ map: glow, color: Palette.starGlow, transparent: true, blending: AdditiveBlending, depthWrite: false, opacity: 0 });
      const sprite = new Sprite(mat);
      sprite.visible = false;
      this.root.add(sprite);
      this.stars.push({ sprite, active: false, wait: 1.5 + i * cfg.starGap, caught: 0, phase: i * 2.1 });
    }
    this.streakMat = new MeshBasicMaterial({ map: glow, color: Palette.starGlow, transparent: true, blending: AdditiveBlending, depthWrite: false, opacity: 0 });
    this.streak = new Mesh(new PlaneGeometry(14, 0.35), this.streakMat);
    this.streak.visible = false;
    this.root.add(this.streak);

    // Bigfoot's balloon, and others on the wind far away (tinted copies).
    this.balloon = buildBalloon();
    this.balloon.scale.setScalar(cfg.balloonScale);
    this.balloon.traverse((o) => {
      if (o.name === 'Flame') this.flame = o;
      if (o.name === 'Basket') this.basket = o;
    });
    this.root.add(this.balloon);
    const tints = [0xffffff, 0x9fd6ff, 0xffb0d0, 0xc6ffb0, 0xffe0a0, 0xd8c0ff];
    for (let i = 0; i < cfg.farBalloons; i++) {
      const b = buildBalloon();
      b.traverse((o) => {
        if (o.name === 'Envelope' && o instanceof Mesh) {
          const m = (o.material as MeshStandardMaterial).clone();
          m.color.setHex(tints[i % tints.length]);
          o.material = m;
        }
      });
      const s = 0.9 + (i % 3) * 0.3;
      b.scale.setScalar(s);
      this.root.add(b);
      this.others.push({ obj: b, angle: (i / cfg.farBalloons) * Math.PI * 2 + 0.4, radius: 40 + i * 17, y: -4 + (i % 4) * 5, speed: 0.004 + (i % 3) * 0.002 });
    }
    this.world.createTransformEntity(this.root);
  }

  private puff(map: SpriteMaterial['map'], home: Vector3, size: number, opacity: number): Puff {
    const mat = new SpriteMaterial({ map, color: this.puffTint, transparent: true, depthWrite: false, opacity: 0 });
    mat.userData.base = opacity;
    const sprite = new Sprite(mat);
    sprite.scale.setScalar(size);
    sprite.position.copy(home);
    this.root.add(sprite);
    return { sprite, home: home.clone(), vel: new Vector3(), life: 1, wait: 0, size };
  }

  update(realDelta: number): void {
    if (this.visibilityState.peek() !== VisibilityState.Visible) return;
    const d = this.queries.director.entities.values().next().value;
    if (!d) return;
    const dt = Math.min(realDelta, 0.1);
    if (this.kit.step(d, dt, 0.5)) this.begin(d);
    const k = this.kit.amount;
    this.root.visible = k > 0;
    this.wind?.setGain(k * 0.35);
    if (!this.root.visible) return;
    this.time += dt;
    this.player.head.getWorldPosition(this.head);
    this.kit.readHands(this.player.gripSpaces.left, this.player.gripSpaces.right, dt);

    // The floor of cloud follows you (it is endless), the sunrise lights it.
    this.sea.uniforms.uTime.value = this.time;
    this.sea.uniforms.uOpacity.value = k;
    this.sea.uniforms.uSun.value.copy(this.sunDir);
    this.sea.uniforms.uCenter.value.copy(this.center);
    this.sea.mesh.position.set(this.center.x, cfg.seaY, this.center.z);

    for (const p of this.far) {
      // Drift with the wind and fade in with the world.
      p.sprite.position.set(this.center.x + p.home.x + Math.sin(this.time * 0.01 + p.size) * 6, p.home.y, this.center.z + p.home.z);
      p.sprite.material.opacity = k * (p.sprite.material.userData.base as number);
    }
    this.roomPuffs(dt, k);
    this.fallingStars(d, dt, k);
    this.shootingStar(dt, k);
    this.balloons(d, dt);
    if (this.cheer > 0) this.cheer -= dt;
  }

  private begin(d: import('@iwsdk/core').Entity): void {
    this.player.head.getWorldPosition(this.center);
    this.center.y = 0;
    this.caught = 0;
    // The sun rises where the room's sunrise does (beyond the window, a little to the left).
    const out = d.getVectorView(RoomSlots, 'windowOut');
    const al = d.getVectorView(RoomSlots, 'windowAlong');
    const o = d.getVectorView(RoomSlots, 'windowOrigin');
    this.windowAt.set(o[0], 0, o[2]);
    if (out[0] || out[2]) this.out.set(out[0], 0, out[2]).normalize();
    if (al[0] || al[2]) this.along.set(al[0], 0, al[2]).normalize();
    const az = (Tuning.transform.sunAzimuthDeg * Math.PI) / 180;
    if (out[0] || out[2]) this.sunDir.set(out[0] * Math.cos(az) - al[0] * Math.sin(az), 0.12, out[2] * Math.cos(az) - al[2] * Math.sin(az)).normalize();
    for (let i = 0; i < this.near.length; i++) this.placeRoomPuff(this.near[i], i);
    for (const s of this.stars) {
      s.active = false;
      s.wait = 2 + this.stars.indexOf(s) * cfg.starGap;
    }
    if (!this.wind) this.wind = Sound.loop('wind', this.center, 0);
    this.kit.preload(['clouds-hello', 'clouds-star', 'clouds-three']);
    this.kit.caption(d, 'Above the Clouds');
  }

  /** A little cloud somewhere around you at chest height, within reach. */
  private placeRoomPuff(p: Puff, i: number): void {
    const a = (i / this.near.length) * Math.PI * 2 + this.time * 0.1;
    const r = 0.7 + (i % 3) * 0.35;
    p.home.set(this.head.x + Math.cos(a) * r, 0.9 + (i % 4) * 0.25, this.head.z + Math.sin(a) * r);
    p.sprite.position.copy(p.home);
    p.vel.set(0, 0, 0);
    p.life = 0.01;
    p.wait = 0;
  }

  private roomPuffs(dt: number, k: number): void {
    for (let i = 0; i < this.near.length; i++) {
      const p = this.near[i];
      const scattered = p.wait > 0;
      if (scattered) {
        // Blown apart: it swells, thins out and drifts off, then re-forms elsewhere.
        p.wait -= dt;
        p.life = Math.max(0, p.life - dt * 1.6);
        p.sprite.position.addScaledVector(p.vel, dt);
        p.vel.multiplyScalar(1 - dt * 0.8);
        p.sprite.scale.setScalar(p.size * (1 + (1 - p.life) * 1.4));
        if (p.wait <= 0) this.placeRoomPuff(p, i);
      } else {
        p.life = Math.min(1, p.life + dt * 0.25);
        // A lazy bob on the breeze.
        p.sprite.position.set(p.home.x + Math.sin(this.time * 0.3 + i) * 0.06, p.home.y + Math.sin(this.time * 0.5 + i * 1.7) * 0.04, p.home.z + Math.cos(this.time * 0.27 + i) * 0.06);
        p.sprite.scale.setScalar(p.size * (0.6 + p.life * 0.4));
        this.kit.nearest(p.sprite.position, this.near2);
        if (p.life > 0.5 && this.near2.dist < cfg.waveReach && this.kit.handSpeed[this.near2.hand] > cfg.waveSpeed) {
          // Pushed along the hand's direction away from it.
          p.vel.subVectors(p.sprite.position, this.kit.hands[this.near2.hand]).setY(0.15).normalize().multiplyScalar(0.6 + this.kit.handSpeed[this.near2.hand] * 0.6);
          p.wait = cfg.reformSec;
          Sound.play('hush', p.sprite.position, 0.5);
        }
      }
      p.sprite.material.opacity = k * p.life * (p.sprite.material.userData.base as number);
    }
  }

  private fallingStars(d: import('@iwsdk/core').Entity, dt: number, k: number): void {
    this.fwd.set(0, 0, -1).applyQuaternion(this.player.head.quaternion).setY(0);
    if (this.fwd.lengthSq() < 1e-4) this.fwd.set(0, 0, -1);
    this.fwd.normalize();
    for (const s of this.stars) {
      const m = s.sprite.material;
      if (s.caught > 0) {
        // The catch: a burst of light that fades.
        s.caught -= dt;
        const t = 1 - s.caught / 0.8;
        s.sprite.scale.setScalar(0.15 + t * 0.9);
        m.opacity = k * (1 - t);
        if (s.caught <= 0) {
          s.sprite.visible = false;
          s.wait = cfg.starGap;
        }
        continue;
      }
      if (!s.active) {
        s.wait -= dt;
        if (s.wait > 0 || k < 0.6) continue;
        // A star appears overhead, ahead of you, and drifts down within reach.
        s.active = true;
        s.phase = Math.random() * 6.28;
        const side = (Math.random() - 0.5) * 0.9;
        s.sprite.position.copy(this.head).addScaledVector(this.fwd, 0.55 + Math.random() * 0.25);
        s.sprite.position.x += -this.fwd.z * side;
        s.sprite.position.z += this.fwd.x * side;
        s.sprite.position.y = this.head.y + 1.2;
        s.sprite.visible = true;
        Sound.play('chime', s.sprite.position, 0.25);
      }
      s.sprite.position.y -= cfg.starFall * dt;
      s.sprite.position.x += Math.sin(this.time * 1.3 + s.phase) * 0.05 * dt;
      const twinkle = 0.75 + Math.sin(this.time * 9 + s.phase) * 0.25;
      s.sprite.scale.setScalar(0.12 + twinkle * 0.05);
      m.opacity = k * Math.min(1, (this.head.y + 1.2 - s.sprite.position.y) * 2) * twinkle;
      this.kit.nearest(s.sprite.position, this.near2);
      if (this.near2.dist < cfg.starReach) {
        s.active = false;
        s.caught = 0.8;
        this.caught++;
        this.cheer = 2.5;
        Sound.play('catch', s.sprite.position, 0.9);
        if (this.caught === 1) this.kit.say(d, 'clouds-star', 'You caught a star! Make a wish.', this.balloon.position);
        if (this.caught === 3) this.kit.say(d, 'clouds-three', 'Three stars! That is a dreamer record.', this.balloon.position);
      } else if (s.sprite.position.y < 0.3) {
        s.active = false;
        s.sprite.visible = false;
        s.wait = cfg.starGap;
      }
    }
  }

  private shootingStar(dt: number, k: number): void {
    if (this.streakT < 0) {
      this.streakIn -= dt;
      if (this.streakIn > 0) return;
      this.streakIn = cfg.streakEvery * (0.6 + Math.random() * 0.8);
      this.streakT = 0;
      const a = Math.random() * Math.PI * 2;
      this.streak.position.set(this.center.x + Math.cos(a) * 90, 45 + Math.random() * 30, this.center.z + Math.sin(a) * 90);
      this.streak.lookAt(this.head);
      this.streak.rotateZ(-0.5 - Math.random() * 0.4);
      this.streak.visible = true;
    }
    this.streakT += dt;
    const t = this.streakT / 0.9;
    this.streak.translateX(-60 * dt);
    this.streakMat.opacity = k * Math.sin(Math.PI * Math.min(1, t)) * 0.9;
    if (t >= 1) {
      this.streakT = -1;
      this.streak.visible = false;
    }
  }

  private balloons(d: import('@iwsdk/core').Entity, dt: number): void {
    // His balloon drifts to and fro beyond the window, gently rising and falling, turning slowly.
    const sway = Math.sin((this.time / cfg.balloonLap) * Math.PI * 2);
    const b = this.balloon;
    b.position.copy(this.windowAt).addScaledVector(this.out, cfg.balloonOut).addScaledVector(this.along, sway * cfg.balloonSwing);
    b.position.y = cfg.balloonY + Math.sin(this.time * 0.35) * 0.4;
    const a = this.time * 0.05;
    b.rotation.y = -a + Math.sin(this.time * 0.2) * 0.1;
    if (this.flame) {
      const burn = Math.max(0, Math.sin(this.time * 0.7)) ** 6;
      this.flame.scale.set(1, 0.4 + burn * 1.4 + Math.sin(this.time * 31) * 0.05, 1);
      this.flame.visible = burn > 0.05;
      if (burn > 0.9 && Math.random() < dt * 2) Sound.play('hush', b.position, 0.35);
    }
    // Bigfoot stands in the basket, facing you.
    const floor = this.tmp2.copy(b.position);
    if (this.basket) this.basket.getWorldPosition(floor);
    floor.y += cfg.basketStep * cfg.balloonScale;
    const yaw = Math.atan2(this.head.x - floor.x, this.head.z - floor.z);
    this.tmp.subVectors(floor, this.head).setY(0).normalize();
    const facing = this.tmp.dot(this.fwd) > 0.75;
    const anim = this.cheer > 0 ? 'cheer' : facing ? 'wave' : 'idle';
    this.kit.placeBigfoot(d, floor, yaw, anim);
    if (this.time > 3 && facing) this.kit.say(d, 'clouds-hello', 'Good morning, up here! Wave the little clouds away, and catch a falling star.', b.position);
    for (const o of this.others) {
      o.angle += o.speed * dt;
      o.obj.position.set(this.center.x + Math.cos(o.angle) * o.radius, o.y + Math.sin(this.time * 0.2 + o.radius) * 0.8, this.center.z + Math.sin(o.angle) * o.radius);
    }
  }
}
