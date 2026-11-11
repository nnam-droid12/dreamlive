import { Journal, Tally } from '../memory/journal.js';
import {
  AdditiveBlending,
  CanvasTexture,
  createSystem,
  Entity,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Quaternion,
  Vector3,
  VisibilityState,
} from '@iwsdk/core';
import { Sound } from '../audio/engine.js';
import { Caption, Ritual, RitualPhase } from '../components/ritual.js';
import { Session } from '../components/session.js';
import { Director } from '../config/director.js';
import { Palette } from '../config/palette.js';
import { Tuning } from '../config/tuning.js';
import { HandReading, HandSigns } from '../input/hand-signs.js';
import { makeTitleCard, TitleCard } from '../visuals/title-card.js';
import { starTexture } from '../visuals/soft-sprites.js';
import { BigfootControl } from './lib/bigfoot-control.js';
import type { EmulatedHand } from './real-hands.js';

const cfg = Tuning.friend;
const UP = new Vector3(0, 1, 0);

type Moment = '' | 'wave' | 'highFive' | 'fistBump' | 'thumbs' | 'rock' | 'pat' | 'tickle' | 'point';

interface Fx {
  sprite: Sprite;
  age: number;
  life: number;
  vel: Vector3;
  size: number;
}

/**
 * Bigfoot, a living friend. After the dream he hangs out about a metre in
 * front of you, his eyes on you, and answers your hands (read from the tracked
 * finger joints by HandSigns):
 * - wave → he waves back; open palm held up to him → a high-five, his hand
 *   meeting yours exactly (IK), with a clap and sparkles;
 * - a fist held out → his fist bumps it; thumbs up → he cheers; rock sign → he dances;
 * - your hand on his head → he leans in, hearts float up; on his belly,
 *   wiggling → he laughs; point → he looks where you point.
 * Each moment has its voice line (first time), sound and light, and a cooldown.
 */
export class FriendSystem extends createSystem({
  director: { required: [Ritual, Session, Caption] },
}) {
  /** The head's orientation in the world (the rig may be turned, e.g. by the Director). */
  private headQ = new Quaternion();
  private signs = new HandSigns();
  private active = false;
  private spot = new Vector3();
  private target = new Vector3();
  private head = new Vector3();
  private fwd = new Vector3();
  private rightV = new Vector3();
  private chest = new Vector3();
  private top = new Vector3();
  private belly = new Vector3();
  private toMe = new Vector3();
  private hand = new Vector3();
  private tmp = new Vector3();
  private moment: Moment = '';
  private momentFor = 0;
  private cooldown = 0;
  private rubFor = 0;
  private said = new Set<string>();
  private fx: Fx[] = [];
  private hint!: TitleCard;
  private hintFor = 0;
  private idleFor = 0;
  private placed = false;
  private side: 'left' | 'right' = 'right';
  private greetAt = 0;
  private greeted = 0;

  init(): void {
    const star = starTexture();
    const heart = heartTexture();
    for (let i = 0; i < 40; i++) {
      const isHeart = i >= 28;
      const sprite = new Sprite(new SpriteMaterial({ map: isHeart ? heart : star, color: isHeart ? Palette.heartPink : Palette.sparkGold, transparent: true, depthWrite: false, blending: isHeart ? undefined : AdditiveBlending, opacity: 0 }));
      sprite.visible = false;
      sprite.userData.heart = isHeart;
      this.world.createTransformEntity(sprite);
      this.fx.push({ sprite, age: -1, life: 1, vel: new Vector3(), size: 0.1 });
    }
    this.hint = makeTitleCard(1024, 300, 0.7);
    this.hint.draw(
      [
        { text: 'Say hi with your hands', size: 64, style: 'italic', color: '#ffd38a' },
        { text: 'wave  ·  high-five  ·  fist bump  ·  thumbs up', size: 44, color: '#fff3dd' },
        { text: 'rock on  ·  pat his head  ·  tickle his belly  ·  point', size: 44, color: '#fff3dd' },
      ],
      'center',
    );
    this.hint.mesh.name = 'FriendHint';
    this.world.createTransformEntity(this.hint.mesh);
  }

  update(realDelta: number): void {
    if (this.visibilityState.peek() !== VisibilityState.Visible) return;
    const d = this.queries.director.entities.values().next().value;
    if (!d) return;
    const dt = Math.min(realDelta, 0.1);
    const awake = d.getValue(Ritual, 'phase') === RitualPhase.Awake;
    const free = !d.getValue(Session, 'movie') && !d.getValue(Session, 'world') && !d.getValue(Session, 'bedtime');
    const want = awake && free && (d.getValue(Ritual, 'phaseTime') ?? 0) > cfg.startAfter && this.allowed();
    if (want !== this.active) {
      this.active = want;
      this.placed = false;
      if (want) this.enter(d);
    }
    BigfootControl.active = this.active;
    BigfootControl.quietFor += dt;
    this.tickFx(dt);
    if (!this.active) {
      this.hint.mesh.visible = false;
      return;
    }
    this.player.head.getWorldPosition(this.head);
    this.fwd.set(0, 0, -1).applyQuaternion(this.player.head.getWorldQuaternion(this.headQ)).setY(0);
    if (this.fwd.lengthSq() < 1e-4) this.fwd.set(0, 0, -1);
    this.fwd.normalize();
    this.rightV.set(-this.fwd.z, 0, this.fwd.x);
    // Hands: the emulator's joints in Director films, the headset's tracked joints otherwise.
    // (The browser emulator's fillPoses reports one frozen hand, so with the emulator present its
    // joints are read directly; a real headset's hand tracking goes through the XR frame.)
    const dev = (window as unknown as { IWER_DEVICE?: { hands?: { left?: EmulatedHand; right?: EmulatedHand } } }).IWER_DEVICE;
    if (dev?.hands) this.signs.readEmulator(dev.hands, this.player);
    else this.signs.readFrame(this.xrFrame, this.xrManager.getReferenceSpace(), this.player);
    this.signs.update(dt, this.rightV);
    this.stand(dt);
    this.greet(d, dt);
    this.react(d, dt);
    if (import.meta.env.DEV) {
      const L = this.signs.left;
      const R = this.signs.right;
      const f = (h: typeof L) => `${h.tracked ? h.sign : '-'}:${h.held.toFixed(1)} d${h.palm.distanceTo(this.chest).toFixed(2)} n${h.normal.dot(this.tmp.subVectors(this.chest, h.palm).normalize()).toFixed(2)} y${(h.palm.y - this.head.y).toFixed(2)} e${h.ext.map((e) => e.toFixed(1)).join('')}`;
      const rawR = (window as unknown as { IWER_DEVICE?: { hands?: { right?: { poseId: string; position: { x: number; y: number; z: number } } } } }).IWER_DEVICE?.hands?.right;
      const tipR = this.signs.right.joints[9];
      d.setValue(Session, 'debug', `raw:${rawR?.poseId} rp(${rawR?.position.x.toFixed(2)},${rawR?.position.y.toFixed(2)},${rawR?.position.z.toFixed(2)}) tip(${tipR.x.toFixed(2)},${tipR.y.toFixed(2)},${tipR.z.toFixed(2)}) trk${this.signs.right.tracked} ${this.moment || 'none'} ${this.momentFor.toFixed(1)} cd${this.cooldown.toFixed(1)} anim:${BigfootControl.anim} rig:${BigfootControl.info} | L ${f(L)} | R ${f(R)}`);
    }
    this.showHint(dt);
  }

  /** Only after the story's own waking beat (the Director's film asks for this hangout explicitly). */
  private allowed(): boolean {
    return !Director.enabled || !!FriendCue.on;
  }

  private enter(d: Entity): void {
    this.greetAt = Tuning.memory.greetGap;
    this.greeted = 0;
    this.hintFor = cfg.hintSec;
    this.idleFor = 0;
    this.moment = '';
    this.cooldown = 1;
    void d;
  }

  /** He stands about a metre in front of you, facing you; he follows if you move away. */
  private stand(dt: number): void {
    // (The Director's camera stands him a little further off, so both his hands are in the shot.)
    // Reach out flat, palm down, and he steps in so you can pat his head.
    const close = FriendCue.close || this.moment === 'pat' || (!Director.enabled && this.reachingToPat());
    const dist = close ? (Director.enabled ? cfg.filmCloseDistance : cfg.closeDistance) : Director.enabled ? cfg.filmDistance : cfg.distance;
    this.target.copy(this.head).addScaledVector(this.fwd, dist).setY(0);
    if (!this.placed) {
      this.spot.copy(this.target);
      this.placed = true;
    }
    const far = this.spot.distanceTo(this.target);
    // He keeps his place in front of you: small drifts he takes in a step, bigger ones he walks.
    const moving = far > 0.35;
    if (far > 0.02) this.spot.addScaledVector(this.tmp.subVectors(this.target, this.spot).normalize(), Math.min(far, (moving ? cfg.walkSpeed : 0.5) * dt));
    BigfootControl.spot.copy(this.spot);
    BigfootControl.yaw = Math.atan2(this.head.x - this.spot.x, this.head.z - this.spot.z);
    BigfootControl.looking = true;
    BigfootControl.look.copy(this.head);
    if (moving && !this.moment) BigfootControl.anim = 'walk';
    // Landmarks on his body for touches.
    this.toMe.subVectors(this.head, this.spot).setY(0).normalize();
    this.chest.copy(this.spot).addScaledVector(UP, 1.1).addScaledVector(this.toMe, 0.2);
    // The top of his real head (he stands tall, leans and hops), else an estimate over his spot.
    if (BigfootControl.head.lengthSq() > 0) this.top.copy(BigfootControl.head).addScaledVector(UP, cfg.headTop);
    else this.top.copy(this.spot).addScaledVector(UP, 1.62);
    this.belly.copy(this.spot).addScaledVector(UP, 0.85).addScaledVector(this.toMe, 0.28);
  }

  /** An open hand held out flat, palm down, in front of you at head height or above: about to pat him. */
  private reachingToPat(): boolean {
    for (const h of [this.signs.left, this.signs.right]) {
      if (!h.tracked || h.sign !== 'open' || h.normal.y > -0.6) continue;
      const ahead = this.tmp.subVectors(h.palm, this.head).dot(this.fwd);
      if (ahead > 0.25 && h.palm.y > this.head.y - 0.3) return true;
    }
    return false;
  }

  /** Read your hands and play the moment they ask for. */
  private react(d: Entity, dt: number): void {
    this.cooldown -= dt;
    BigfootControl.shake = Math.max(0, BigfootControl.shake - dt * 1.5);
    const L = this.signs.left;
    const R = this.signs.right;
    if (this.moment) {
      this.momentFor += dt;
      // Dev only: hold a moment at a given time to inspect it (window.__friendHold = seconds).
      const hold = import.meta.env.DEV ? (window as unknown as { __friendHold?: number }).__friendHold : undefined;
      if (hold !== undefined && this.momentFor > hold) this.momentFor = hold;
      this.playMoment(d, dt, L, R);
      return;
    }
    BigfootControl.reach.left = BigfootControl.reach.right = false;
    BigfootControl.anim = 'idle';
    if (this.cooldown > 0) return;
    // In priority order: touches first, then gestures held out to him.
    for (const h of [R, L]) {
      if (!h.tracked) continue;
      const which = h === R ? 'right' : 'left';
      if (h.palm.distanceTo(this.top) < cfg.patReach) return this.start('pat', which);
      if (h.palm.distanceTo(this.belly) < cfg.tickleReach) {
        this.rubFor += dt * Math.min(1, h.speed / 0.25);
        if (this.rubFor > 0.35) return this.start('tickle', which);
      }
      if (h.waving) return this.start('wave', which);
      const toward = this.tmp.subVectors(this.chest, h.palm);
      const dist = toward.length();
      const facing = h.normal.dot(toward.normalize());
      if (h.sign === 'open' && h.held > 0.5 && facing > 0.45 && dist < cfg.reach && h.palm.y > this.head.y - 0.55 && h.speed < 0.35 && !h.waving) return this.start('highFive', which);
      if (h.sign === 'fist' && h.held > 0.25 && dist < cfg.reach && h.palm.y > this.head.y - 0.75) return this.start('fistBump', which);
      if (h.sign === 'thumbsUp' && h.held > 0.35) return this.start('thumbs', which);
      if (h.sign === 'rock' && h.held > 0.35) return this.start('rock', which);
      if (h.sign === 'point' && h.held > 0.5) return this.start('point', which);
    }
    this.rubFor = Math.max(0, this.rubFor - dt);
    this.idleFor += dt;
    if (this.idleFor > cfg.hintAgainSec) {
      this.idleFor = 0;
      this.hintFor = cfg.hintSec;
    }
  }

  private start(m: Moment, which: 'left' | 'right'): void {
    const tally: Partial<Record<Moment, Tally>> = { wave: 'wave', highFive: 'highFive', fistBump: 'fistBump', thumbs: 'thumbs', rock: 'rock', pat: 'pat', tickle: 'tickle' };
    const t = tally[m];
    if (t) Journal.add(t);
    this.moment = m;
    this.momentFor = 0;
    this.side = which;
    BigfootControl.quietFor = 0;
    this.idleFor = 0;
    this.hintFor = Math.min(this.hintFor, 0.6);
  }

  /** Play the current moment; finish with a cooldown. */
  private playMoment(d: Entity, dt: number, L: HandReading, R: HandReading): void {
    const h = this.side === 'right' ? R : L;
    // His hand mirrors yours: your right meets his left (you face each other).
    const his: 'left' | 'right' = this.side === 'right' ? 'left' : 'right';
    const t = this.momentFor;
    const done = (cool: number = cfg.cooldown) => {
      this.moment = '';
      BigfootControl.hop = 0;
      this.cooldown = cool;
      BigfootControl.reach.left = BigfootControl.reach.right = false;
    };
    switch (this.moment) {
      case 'wave':
        BigfootControl.anim = 'wave';
        this.say(d, 'friend-hi', 'Hey, buddy! Good morning!');
        if (t > 2.6) done();
        break;
      case 'highFive':
      case 'fistBump': {
        const five = this.moment === 'highFive';
        // His hand rises to meet yours, right where it is.
        BigfootControl.reach[his] = true;
        BigfootControl.shape[his] = five ? 'palm' : 'fist';
        BigfootControl.reachAt[his].copy(h.palm).addScaledVector(this.toMe, five ? 0.05 : 0.07);
        const his3 = this.hand.copy(BigfootControl.hand[his]);
        // His hand rises (about half a second) and meets yours: contact when it arrives.
        const touching = t < 10 && t > 0.5 && his3.distanceTo(BigfootControl.reachAt[his]) < cfg.contact;
        if (t < 10 && (touching || t > 1.6)) {
          this.burst(this.tmp.lerpVectors(his3, h.palm, 0.5), five ? 14 : 10, false);
          Sound.play(five ? 'clap' : 'bump', h.palm, 1);
          if (five) this.say(d, 'friend-highfive', 'Up top! Yeah!');
          else this.say(d, 'friend-fist', 'Boom! Fist bump!');
          this.momentFor = 10; // on to the follow-through below
        }
        if (this.momentFor >= 10) {
          // Contact made: his hand lingers a beat, then drops; a happy little hop.
          BigfootControl.reach[his] = this.momentFor < 10.6;
          BigfootControl.anim = 'idle';
          BigfootControl.hop = this.momentFor < 10.6 ? 0 : Math.min(1, (this.momentFor - 10.6) / 0.5);
          if (this.momentFor > 11.6) done();
        } else if (t > 1.6) done(0.6);
        break;
      }
      case 'thumbs':
        BigfootControl.anim = t < 0.6 ? 'idle' : 'wave';
        BigfootControl.hop = t < 0.6 ? t / 0.6 : 0;
        if (t < dt * 1.5) this.burst(this.top, 8, false);
        this.say(d, 'friend-thumbs', "Aww, you're the best!");
        if (t > 2.2) done();
        break;
      case 'rock':
        BigfootControl.anim = 'dance2';
        if (t < dt * 1.5) Sound.play('bump', this.chest, 0.6);
        this.say(d, 'friend-rock', "Let's rock!");
        if (t > 4) done();
        break;
      case 'pat':
        BigfootControl.anim = 'idle';
        // He keeps his eyes on you, smiling, while you pat him.
        if (Math.floor(t * 3) !== Math.floor((t - dt) * 3)) {
          this.burst(this.top, 1, true);
          Sound.play('giggle', this.top, 0.5);
        }
        this.say(d, 'friend-pat', "Aww... that's nice.");
        if (t > 2.4 || h.palm.distanceTo(this.top) > cfg.patReach * 1.8) done();
        break;
      case 'tickle':
        BigfootControl.anim = 'idle';
        BigfootControl.shake = 1;
        if (t < dt * 1.5) Sound.play('giggle', this.belly, 0.8);
        this.say(d, 'friend-tickle', 'Hahaha! Stop, stop, that tickles!');
        if (t > 2.6) {
          this.rubFor = 0;
          done();
        }
        break;
      case 'point': {
        // He looks along your finger, at the floor or 4 m away.
        const dir = h.pointDir;
        const k = dir.y < -0.1 ? Math.min(4, -h.indexTip.y / dir.y) : 4;
        BigfootControl.look.copy(h.indexTip).addScaledVector(dir, k);
        this.say(d, 'friend-point', "Ooh, what's over there?");
        if (h.sign !== 'point' || t > 4) done(0.5);
        break;
      }
    }
  }

  /**
   * He remembers you: on a first visit a warm hello; coming back, "You came back!"
   * and then one thing from last time (your song, your photo, the bunny, high-fives).
   */
  private greet(d: Entity, dt: number): void {
    if (this.greeted >= 2 || this.moment) return;
    this.greetAt -= dt;
    if (this.greetAt > 0) return;
    const b = Journal.before();
    if (this.greeted === 0) {
      if (b.visits === 0) {
        this.say(d, 'mem-first', "So this is your room. I think we're going to be good friends.");
        this.greeted = 2;
        return;
      }
      this.say(d, 'mem-back', 'You came back! I knew you would.');
      this.greeted = 1;
      this.greetAt = Tuning.memory.greetGap;
      return;
    }
    this.greeted = 2;
    const songs: Record<string, [string, string]> = {
      afro: ['mem-song-afro', "Last time you picked the afrobeat. I've been dancing to it all week!"],
      disco: ['mem-song-disco', "Last time you picked the disco. I've been grooving to it all week!"],
      house: ['mem-song-house', "Last time you picked the house music. It's still stuck in my head!"],
    };
    const song = songs[b.lastSong];
    if (song) this.say(d, song[0], song[1]);
    else if (b.counts.photos > 0) this.say(d, 'mem-photo', 'I put our photo up on the wall. See?');
    else if (b.bunny) this.say(d, 'mem-bunny', 'Oh, and Buck the bunny says hi.');
    else if (b.counts.highFive > 0) this.say(d, 'mem-highfive', 'Our high-five count keeps growing. Up top!');
    else if (b.counts.movies > 0) this.say(d, 'mem-movie', 'Movie night again soon? I saved you some popcorn.');
  }

  private say(d: Entity, id: string, text: string): void {
    if (this.said.has(id)) return;
    this.said.add(id);
    Sound.speak(id, this.chest);
    d.setValue(Caption, 'text', `Bigfoot: ${text}`);
    d.setValue(Caption, 'ttl', Math.max(3, text.split(' ').length * 0.42));
  }

  /** Sparkles (or a heart) where something lovely happened. */
  private burst(at: Vector3, n: number, heart: boolean): void {
    let made = 0;
    for (const f of this.fx) {
      if (f.age >= 0 || !!f.sprite.userData.heart !== heart) continue;
      f.age = 0;
      f.life = heart ? 1.6 : 0.7 + Math.random() * 0.4;
      f.size = heart ? 0.09 : 0.05 + Math.random() * 0.06;
      f.sprite.position.copy(at);
      f.vel.set((Math.random() - 0.5) * (heart ? 0.15 : 1.4), heart ? 0.35 : 0.3 + Math.random() * 1.2, (Math.random() - 0.5) * (heart ? 0.15 : 1.4));
      f.sprite.visible = true;
      if (++made >= n) break;
    }
  }

  private tickFx(dt: number): void {
    for (const f of this.fx) {
      if (f.age < 0) continue;
      f.age += dt;
      const k = f.age / f.life;
      if (k >= 1) {
        f.age = -1;
        f.sprite.visible = false;
        continue;
      }
      f.sprite.position.addScaledVector(f.vel, dt);
      if (!f.sprite.userData.heart) f.vel.y -= 1.2 * dt;
      f.sprite.scale.setScalar(f.size * (f.sprite.userData.heart ? 0.6 + k : 1 - k * 0.4));
      f.sprite.material.opacity = Math.sin(Math.PI * Math.min(1, k * 1.2));
    }
  }

  /** The hint card floats beside him for a few seconds when the hangout starts (and again if you go quiet). */
  private showHint(dt: number): void {
    this.hintFor = Math.max(0, this.hintFor - dt);
    const m = this.hint.mesh;
    const a = Math.min(1, this.hintFor, (cfg.hintSec - this.hintFor) * 2);
    m.visible = a > 0.01;
    if (!m.visible) return;
    this.hint.material.opacity = a;
    m.position.copy(this.spot).addScaledVector(UP, 1.95).addScaledVector(this.rightV, -0.15);
    m.lookAt(this.head);
  }
}

/** The Director's film turns the hangout on at its moment (a real session has it whenever he is awake). */
/** The Director's film: turn the hangout on, and bring him in close for the pat. */
export const FriendCue = { on: false, close: false };

function heartTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.moveTo(64, 112);
  g.bezierCurveTo(10, 72, 8, 30, 38, 22);
  g.bezierCurveTo(54, 18, 64, 32, 64, 40);
  g.bezierCurveTo(64, 32, 74, 18, 90, 22);
  g.bezierCurveTo(120, 30, 118, 72, 64, 112);
  g.fill();
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}
