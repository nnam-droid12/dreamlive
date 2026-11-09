import {
  CanvasTexture,
  createSystem,
  Entity,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Quaternion,
  SRGBColorSpace,
  Vector3,
} from '@iwsdk/core';
import { Sound } from '../audio/engine.js';
import { Bigfoot } from '../components/bigfoot.js';
import { DevControls, DreamDirector, DreamSeed, GazeTarget } from '../components/dream.js';
import { MemoryOrb } from '../components/memory.js';
import { Ritual, RitualPhase } from '../components/ritual.js';
import { Session } from '../components/session.js';
import { RoomSlots } from '../components/stage.js';
import { Timeline } from '../audio/timeline.js';
import { Director, DirectorFrame } from '../config/director.js';
import { makeTitleCard, TitleCard } from '../visuals/title-card.js';
import { DirectorHands, HandShot } from './director-hands.js';
import { RealHands } from './real-hands.js';
import { newBeatContext, readBeat } from '../dreams/beat-context.js';
import { NycLayout } from '../showcase/nyc-bedroom.js';
import { WorldSpots } from './lib/world-kit.js';
import { frameToWorld, Rooftop } from '../showcase/rooftop-layout.js';

const UP = new Vector3(0, 1, 0);
const ONE = new Vector3(1, 1, 1);
const CAM_RATE = 1.4;
const CARD_W = 1.5;

// Hand shots for the trailer (head space: x right, y up, -z forward; identity = palm down, fingers forward).
const Q_ID = new Quaternion();
const Q_PALM_UP = new Quaternion(0, 0, 1, 0);
const Q_UP_FINGERS = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2);
const Q_DANCE_L = new Quaternion().setFromAxisAngle(UP, -Math.PI / 2).multiply(Q_UP_FINGERS);
const Q_DANCE_R = new Quaternion().setFromAxisAngle(UP, Math.PI / 2).multiply(Q_UP_FINGERS);
const REST_L: HandShot = { at: new Vector3(-0.22, -0.62, -0.2), rot: Q_ID, pose: 'default', pinch: 0 };
const REST_R: HandShot = { at: new Vector3(0.22, -0.62, -0.2), rot: Q_ID, pose: 'default', pinch: 0 };
const DRAW_R: HandShot = { at: new Vector3(0.1, -0.08, -0.38), rot: Q_ID, pose: 'point', pinch: 0 };
const DANCE_L: HandShot = { at: new Vector3(), rot: Q_DANCE_L, pose: 'open', pinch: 0 };
const DANCE_R: HandShot = { at: new Vector3(), rot: Q_DANCE_R, pose: 'open', pinch: 0 };
const PALM_UP_L: HandShot = { at: new Vector3(-0.09, -0.17, -0.38), rot: Q_PALM_UP, pose: 'open', pinch: 0 };
const POINT_R: HandShot = { at: new Vector3(0.12, -0.13, -0.34), rot: Q_ID, pose: 'point', pinch: 0 };
// Held out to catch: palms up, fingers tilted up toward the gift.
const Q_CUP = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), 0.55).multiply(Q_PALM_UP);
const CUP_L: HandShot = { at: new Vector3(-0.075, -0.15, -0.36), rot: Q_CUP, pose: 'cup', pinch: 0 };
const CUP_R: HandShot = { at: new Vector3(0.075, -0.15, -0.36), rot: Q_CUP, pose: 'cup', pinch: 0 };
/**
 * After the dream, the tour of everything else (seconds after waking): Movie
 * Night, a finger-frame photo, then the three dream worlds, then bedtime.
 */
const TOUR = { movie: 9, movieEnd: 30, photo: 31, snap: 34, clouds: 38, puff: 47, star: 53, winter: 61, fire: 70, shake: 76, sea: 84, whale: 94, flood: 102, bed: 110, end: 136 };
/** Resting hands for the tour, held lower so they stay out of the downward-looking world shots. */
const TOUR_REST_L: HandShot = { ...REST_L, at: new Vector3(-0.25, -0.95, -0.1) };
const TOUR_REST_R: HandShot = { ...REST_R, at: new Vector3(0.25, -0.95, -0.1) };
const FRAME_L: HandShot = { at: new Vector3(-0.15, -0.1, -0.42), rot: Q_UP_FINGERS, pose: 'open', pinch: 0 };
const FRAME_R: HandShot = { at: new Vector3(0.15, 0.04, -0.42), rot: Q_UP_FINGERS, pose: 'open', pinch: 0 };
/** Scratch objects for the hand script (no allocation per frame). */
const H_TMP = {
  origin: new Vector3(),
  out: new Vector3(),
  along: new Vector3(),
  a: new Vector3(),
  b: new Vector3(),
  aim: new Vector3(),
  off: new Vector3(),
  l: new Vector3(),
  r: new Vector3(),
  q: new Quaternion(),
};

/**
 * Director mode (dev only, `?director`): drives the camera through a scripted
 * shot list that follows the real dream (no faked state), lets the camera's
 * gaze make the choices, catches what flies out of the TV, shows a title and
 * an end card, and records the app's canvas + sound to a WebM download.
 */
export class DirectorSystem extends createSystem({
  director: { required: [Ritual, DreamDirector, DevControls, Session, RoomSlots] },
  bigfoot: { required: [Bigfoot] },
  heads: { required: [GazeTarget], excluded: [DreamSeed] },
  seeds: { required: [DreamSeed, GazeTarget] },
  orbs: { required: [MemoryOrb] },
}) {
  private beat = newBeatContext();
  private camPos = new Vector3();
  private camLook = new Vector3();
  private wantPos = new Vector3();
  private wantLook = new Vector3();
  private tmp = new Vector3();
  private placed = false;
  private clock = 0;
  private awakeAt = -1;
  private camMatrix = new Matrix4();
  private headMatrix = new Matrix4();
  private camQuat = new Quaternion();
  private card!: Mesh;
  private cardMat!: MeshBasicMaterial;
  private cardCanvas!: HTMLCanvasElement;
  private cardTexture!: CanvasTexture;
  private cardShown = '';
  private recorder?: MediaRecorder;
  private chunks: Blob[] = [];
  private done = false;
  /** Feature caption, lower right (DreamSpace-style), and what it says now. */
  private feature!: TitleCard;
  private featureText = '';
  private featureOpacity = 0;
  private cues = new Set<string>();
  private saveTimeline?: () => void;
  private hands?: DirectorHands;
  private realHands?: RealHands;
  private recording = false;

  init(): void {
    this.cardCanvas = document.createElement('canvas');
    this.cardCanvas.width = 1280;
    this.cardCanvas.height = 720;
    this.cardTexture = new CanvasTexture(this.cardCanvas);
    this.cardTexture.colorSpace = SRGBColorSpace;
    this.cardMat = new MeshBasicMaterial({ map: this.cardTexture, transparent: true, opacity: 0, depthTest: false, depthWrite: false });
    this.card = new Mesh(new PlaneGeometry(CARD_W, (CARD_W * 9) / 16), this.cardMat);
    this.card.renderOrder = 1000;
    this.card.visible = false;
    this.world.createTransformEntity(this.card);
    this.feature = makeTitleCard(1024, 150, 0.56);
    this.feature.mesh.renderOrder = 1001;
    this.world.createTransformEntity(this.feature.mesh);
    // Life-size articulated hands for the camera, following the emulated hands' joints.
    this.realHands = new RealHands();
    this.world.createTransformEntity(this.realHands.root);
    void this.realHands.load();
    this.hands = new DirectorHands();
  }

  update(realDelta: number): void {
    const d = this.queries.director.entities.values().next().value;
    if (!d || this.done) return;
    const phase = d.getValue(Ritual, 'phase');
    if (phase === RitualPhase.Idle) return;
    d.setValue(DevControls, 'autoCatch', true);
    if (Director.tour && this.cue('tour-jump')) {
      d.setValue(DreamDirector, 'chapterId', 'rooftop-party');
      d.setValue(Ritual, 'phase', RitualPhase.Awake);
    }
    this.clock += realDelta;
    // Offline renders mix their sound afterwards, so they need not wait for the audio context.
    if (Director.record && !this.recording && (Sound.ctx || Director.offline)) {
      this.recording = true;
      this.startRecording();
    }

    this.chooseShot(d, phase ?? '');
    const k = this.placed ? 1 - Math.exp(-CAM_RATE * realDelta) : 1;
    this.camPos.lerp(this.wantPos, k);
    this.camLook.lerp(this.wantLook, k);
    this.placed = true;
    this.placeCamera();
    this.updateCard(phase ?? '');
    this.script(d, phase ?? '');
    this.handScript(d, phase ?? '', realDelta);
    this.updateFeature(realDelta);
  }

  /** Where the camera wants to be and what it looks at, from the dream's real state. */
  private chooseShot(d: Entity, phase: string): void {
    const tv = this.tmp.fromArray(d.getVectorView(RoomSlots, 'anchorPoint')).clone();
    const n = new Vector3().fromArray(d.getVectorView(RoomSlots, 'anchorNormal'));
    const right = new Vector3().crossVectors(UP, n).normalize();
    const seat = new Vector3(NycLayout.seat.position.x, 1.25, NycLayout.seat.position.z);
    const middle = new Vector3().addVectors(NycLayout.bed.top, tv).multiplyScalar(0.5).setY(1.0);
    const tvCam = tv.clone().addScaledVector(n, 2.7).addScaledVector(right, 0.45).setY(1.4);
    const head = this.bigfootHead();
    const root = this.queries.bigfoot.entities.values().next().value?.object3D?.position;
    const t = d.getValue(Ritual, 'phaseTime') ?? 0;

    if (phase === RitualPhase.Arrival) {
      if (t < 4.5 || !head) this.aim(seat, middle);
      // Push in on sleeping Bigfoot; the camera's gaze resting on him starts the dream.
      else this.aim(head.clone().addScaledVector(this.toward(head, seat), 1.7).setY(1.35), head);
      return;
    }
    if (phase === RitualPhase.Asleep && readBeat(d, this.beat) && d.getValue(DreamDirector, 'chapterId') === 'rooftop-party' && d.getValue(RoomSlots, 'windowReady')) {
      this.rooftopShot(d, seat, root);
      return;
    }
    if (phase === RitualPhase.Asleep && readBeat(d, this.beat)) {
      const scene = this.beat.scene;
      if (scene === 'sleepwalk' && root) {
        const look = root.clone().setY(0.9);
        this.aim(look.clone().addScaledVector(this.toward(look, seat), 2.6).setY(1.45), look);
      } else if (scene === 'finale') {
        this.aim(seat.clone().setY(1.5), middle);
      } else if (this.beat.id.startsWith('choice')) {
        const pick = (Director.picks[d.getValue(DreamDirector, 'chapterId') ?? ''] ?? [])[this.beat.id === 'choice-1' ? 0 : 1] ?? '';
        const seed = this.seedPos(pick);
        this.aim(tvCam, this.beat.time > 1.8 && seed ? seed : tv);
      } else {
        const drift = Math.sin(this.clock * 0.12) * 0.25;
        this.aim(tvCam.clone().addScaledVector(right, drift), tv);
      }
      return;
    }
    // Waking and awake: Bigfoot, then the orb on its way to the shelf.
    if (phase === RitualPhase.Awake && this.awakeAt < 0) this.awakeAt = this.clock;
    const orb = this.flyingOrb();
    if (d.getValue(Session, 'bedtime')) {
      // Bedtime: the rain on the glass, the city at night, Bigfoot asleep in the corner of the shot.
      const o = new Vector3().fromArray(d.getVectorView(RoomSlots, 'windowOrigin'));
      this.aim(new Vector3(o.x - 3.4, 1.4, o.z + 2.2), new Vector3(o.x, 1.5, o.z - 0.3));
    } else if (this.tourShot(d, seat, head)) {
      // The tour after the dream chose the shot.
    } else if (orb) this.aim(seat.clone().setY(1.4), orb);
    else if (head) this.aim(seat.clone().setY(1.4), head);
  }

  /**
   * Rooftop Party shots, following the real dream: over his shoulder to the
   * glass; from the room as he leaps up to the taller roof; the VIP deck over the
   * party (Bigfoot dancing, then close on the Yeti DJ); the roof's edge looking
   * down at the street as he leaps home; the room as he catches gifts; bed.
   */
  private rooftopShot(d: Entity, seat: Vector3, root: Vector3 | undefined): void {
    const f = {
      origin: new Vector3().fromArray(d.getVectorView(RoomSlots, 'windowOrigin')),
      out: new Vector3().fromArray(d.getVectorView(RoomSlots, 'windowOut')),
      along: new Vector3().fromArray(d.getVectorView(RoomSlots, 'windowAlong')),
    };
    const at = (x: number, y: number, z: number) => frameToWorld(f, { x, y, z }, new Vector3());
    const scene = this.beat.scene;
    const t = this.beat.time;
    const him = root ? root.clone().setY(root.y + 1.1) : at(Rooftop.danceSpot.x, 7.1, Rooftop.danceSpot.z);
    const dj = at(Rooftop.djSpot.x, Rooftop.djSpot.y + 1.4, Rooftop.djSpot.z);
    const deck = Rooftop.views.party.at;
    if (scene === 'draw-window') {
      // The wall where Bigfoot's window is being drawn.
      this.aim(at(-3.6, 1.45, 0.4), at(0, 1.5, 0));
    } else if (scene === 'to-window') {
      this.aim(t < 6.8 ? him.clone().addScaledVector(this.toward(him, seat), 2.4).setY(1.6) : at(-2.4, 1.5, 1.4), t < 6.8 ? him : at(2, 2.2, -0.5));
    } else if (scene === 'leap-out') {
      // From the party roof as he flies up toward it.
      this.aim(at(9.5, 7.8, 3.8), him);
    } else if (scene === 'arrive') {
      // In the room as the window wall dissolves and the ceiling opens to the sky.
      this.aim(at(-3.2, 1.35, 1.9), at(0, 2.4, -0.6));
    } else if (scene === 'party-wait') {
      const pick = (Director.picks['rooftop-party'] ?? [])[0] ?? '';
      const seed = this.seedPos(pick);
      this.aim(at(deck.x, deck.y + 1.3, deck.z), scene === 'party-wait' && this.beat.time > 1.8 && seed ? seed : him);
    } else if (scene.startsWith('party-')) {
      if (t < 8) this.aim(at(deck.x - 1.0, deck.y + 1.4, deck.z - 0.4), him);
      // The skyline as a music visualizer, then the fireworks above it.
      else if (t < 12) this.aim(at(deck.x + 0.5, deck.y + 2.6, deck.z + 2.5), at(40, 16, -2));
      // The palm menu in hand, the party and skyline beyond; then the fireworks it launches.
      else if (t < 17) this.aim(at(deck.x, deck.y + 1.5, deck.z), at(24, 9, -1));
      else if (t < 21) this.aim(at(deck.x, deck.y + 1.6, deck.z), at(24, 17, 0));
      else this.aim(at(Rooftop.djSpot.x + 2.6, Rooftop.djSpot.y + 1.6, Rooftop.djSpot.z + 3.0), dj);
    } else if (scene === 'leap-back') {
      // From the party roof's edge: the street far below, his tower and window across.
      // From inside his room as he flies home toward the window.
      this.aim(at(-2.6, 1.5, 0.9), him);
    } else if (scene === 'gifts') {
      this.aim(at(-3.3, 1.5, 2.6), him.clone().lerp(at(Rooftop.insideSpot.x + 0.5, 1.3, 0), 0.5));
    } else if (scene === 'to-bed' && root) {
      const look = root.clone().setY(0.9);
      this.aim(look.clone().addScaledVector(this.toward(look, seat), 2.6).setY(1.45), look);
    } else {
      this.aim(seat, dj);
    }
  }

  /** Seconds since he woke (the tour's clock), or -1 before that. */
  private tourTime(): number {
    return this.awakeAt < 0 ? -1 : this.clock - this.awakeAt;
  }

  /** The tour's shots: the cinema screen, Bigfoot for the photo, then each world's best views. */
  private tourShot(d: Entity, seat: Vector3, head: Vector3 | undefined): boolean {
    const tt = this.tourTime();
    if (tt < 8 || tt >= TOUR.bed) return false;
    const f = {
      origin: new Vector3().fromArray(d.getVectorView(RoomSlots, 'windowOrigin')),
      out: new Vector3().fromArray(d.getVectorView(RoomSlots, 'windowOut')),
      along: new Vector3().fromArray(d.getVectorView(RoomSlots, 'windowAlong')),
    };
    const at = (x: number, y: number, z: number) => frameToWorld(f, { x, y, z }, new Vector3());
    const tv = new Vector3().fromArray(d.getVectorView(RoomSlots, 'anchorPoint'));
    if (tt < TOUR.movie) this.aim(seat.clone().setY(1.3), tv.clone().setY(1.5));
    else if (tt < TOUR.movieEnd) {
      // Behind the viewer's seat: the big screen, the film's light on the room, Bigfoot beside you.
      const screen = new Vector3().fromArray(d.getVectorView(Session, 'movieScreen'));
      const dir = this.toward(seat, screen);
      this.aim(seat.clone().addScaledVector(dir, -1.1).setY(1.55), screen);
    } else if (tt < TOUR.clouds) {
      if (head) this.aim(head.clone().addScaledVector(this.toward(head, seat), 2.2).setY(1.45), head);
    } else if (tt < TOUR.puff) this.aim(at(-1.0, 1.5, 0.3), WorldSpots.balloon.clone().setY(WorldSpots.balloon.y + 1.9));
    else if (tt < TOUR.star) {
      const p = WorldSpots.puff;
      this.aim(p.clone().addScaledVector(this.toward(p, seat), 0.6).setY(p.y + 0.12), p);
    } else if (tt < TOUR.winter) this.aim(at(-1.6, 1.4, 0.3), at(2, 2.0, 0.3));
    else if (tt < TOUR.fire) this.aim(at(-0.8, 1.55, 0.2), WorldSpots.rink.clone().setY(1.0));
    else if (tt < TOUR.shake) {
      const fire = WorldSpots.fire;
      this.aim(fire.clone().addScaledVector(this.toward(fire, seat), 2.3).setY(1.3), fire.clone().setY(0.6));
    } else if (tt < TOUR.sea) this.aim(at(-1.5, 1.4, 0.3), at(30, 26, 0));
    else if (tt < TOUR.whale) this.aim(at(-0.8, 1.5, 0.3), WorldSpots.board.clone().setY(WorldSpots.board.y + 1.0));
    else if (tt < TOUR.flood) this.aim(at(-0.6, 1.6, 0.3), WorldSpots.whale);
    else this.aim(at(-2.6, 1.35, 0.9), at(-1.8, 0, 0.8));
    return true;
  }

  private aim(pos: Vector3, look: Vector3): void {
    this.wantPos.copy(pos);
    this.wantLook.copy(look);
  }

  /** Horizontal unit vector from `from` toward `to`. */
  private toward(from: Vector3, to: Vector3): Vector3 {
    return new Vector3().subVectors(to, from).setY(0).normalize();
  }

  private bigfootHead(): Vector3 | undefined {
    for (const e of this.queries.heads.entities) if (e.object3D) return e.object3D.position.clone();
    return undefined;
  }

  private seedPos(id: string): Vector3 | undefined {
    for (const s of this.queries.seeds.entities) {
      if (s.getValue(DreamSeed, 'seedId') === id) return new Vector3().fromArray(s.getVectorView(GazeTarget, 'worldPos'));
    }
    return undefined;
  }

  private flyingOrb(): Vector3 | undefined {
    for (const o of this.queries.orbs.entities) {
      if ((o.getValue(MemoryOrb, 'slot') ?? -1) < 0 && o.object3D) return o.object3D.position.clone();
    }
    return undefined;
  }

  /** Moves the player rig so the emulated head (wherever it sits in the rig) sees the shot. */
  private placeCamera(): void {
    this.camMatrix.lookAt(this.camPos, this.camLook, UP);
    this.camQuat.setFromRotationMatrix(this.camMatrix);
    this.camMatrix.compose(this.camPos, this.camQuat, ONE);
    // The head's pose inside the rig, from world matrices (whatever sits between them).
    this.player.updateMatrixWorld(true);
    this.headMatrix.copy(this.player.matrixWorld).invert().multiply(this.player.head.matrixWorld).invert();
    this.camMatrix.multiply(this.headMatrix);
    this.camMatrix.decompose(this.player.position, this.player.quaternion, this.tmp);
  }

  /**
   * The trailer's script on top of the real dream: a caption naming each feature
   * as it happens, fireworks during the party, a shorter gifts beat, then bedtime.
   * Also chooses the shots the cinema screen appears in.
   */
  private script(d: Entity, phase: string): void {
    const roof = d.getValue(DreamDirector, 'chapterId') === 'rooftop-party';
    const asleep = phase === RitualPhase.Asleep && readBeat(d, this.beat);
    const scene = asleep ? this.beat.scene : '';
    const t = asleep ? this.beat.time : (d.getValue(Ritual, 'phaseTime') ?? 0);
    let text = '';
    DirectorFrame.cinema = false;
    if (phase === RitualPhase.Arrival) text = t > 4.5 ? 'A Bigfoot naps in your room' : '';
    else if (scene === 'draw-window') text = 'Draw him a window, with your hand';
    else if (scene === 'to-window') text = 'He tells you his dream, out loud';
    else if (scene === 'leap-out') text = 'One giant leap';
    else if (scene === 'arrive') text = 'Your room becomes a penthouse';
    else if (scene === 'party-wait') text = 'Your gaze picks the song';
    else if (scene.startsWith('party-')) {
      if (t < 8) {
        text = 'A live rooftop cam: spatial cinema';
        DirectorFrame.cinema = true;
      } else if (t < 12) text = 'The skyline dances to the music';
      else if (t < 17) text = "Turn your palm up: you're the DJ";
      else text = 'Fireworks, from your palm';
      if (t > 17.5 && this.cue('fireworks')) d.setValue(Session, 'fireworkShots', (d.getValue(Session, 'fireworkShots') ?? 0) + 1);
    } else if (scene === 'leap-back') text = 'Real music, in spatial audio';
    else if (scene === 'gifts') {
      text = 'Catch his gifts with your hands';
      // A shorter gifts beat for the trailer.
      if (t > 12 && this.cue('gifts-skip')) d.setValue(DreamDirector, 'beatTime', 20.5);
    } else if (scene === 'to-bed') text = 'Golden hour, starry night, sunrise';
    else if (phase === RitualPhase.Waking) text = 'Every dream leaves a memory';
    else if (phase === RitualPhase.Awake && roof) text = this.tourScript(d);
    if (!roof && phase === RitualPhase.Asleep) text = '';
    if (text !== this.featureText) {
      this.featureText = text;
      if (text) {
        this.feature.draw([{ text, size: 62, style: 'italic', color: '#ffd38a' }], 'right');
        this.backFeature();
      }
    }
  }

  /** The tour after the dream: what happens when, and its captions. */
  private tourScript(d: Entity): string {
    const tt = this.tourTime();
    if (tt < 0) return 'Every dream leaves a memory';
    const world = (name: string) => {
      d.setValue(Session, 'world', name);
      Timeline.log('world', name);
    };
    if (tt > TOUR.movie && this.cue('movie')) d.setValue(Session, 'movie', true);
    if (tt > TOUR.movieEnd && this.cue('movie-end')) d.setValue(Session, 'movie', false);
    if (tt > TOUR.snap && this.cue('snap')) d.setValue(Session, 'photoShots', (d.getValue(Session, 'photoShots') ?? 0) + 1);
    if (tt > TOUR.clouds && this.cue('clouds')) world('clouds');
    if (tt > TOUR.winter && this.cue('winter')) world('winter');
    if (tt > TOUR.sea && this.cue('sea')) world('sea');
    if (tt > TOUR.sea + 7 && this.cue('strike-1')) WorldSpots.strikeNow = true;
    if (tt > TOUR.whale && this.cue('breach')) WorldSpots.breachNow = true;
    if (tt > TOUR.flood + 2 && this.cue('strike-2')) WorldSpots.strikeNow = true;
    if (tt > TOUR.bed && this.cue('bedtime')) {
      world('');
      d.setValue(Session, 'bedtime', true);
    }
    if (tt < 8) return 'Every dream leaves a memory';
    if (tt < TOUR.movie + 10) return 'Movie night with Bigfoot';
    if (tt < TOUR.movieEnd) return 'The film lights up your room';
    if (tt < TOUR.clouds) return 'Frame a photo with your fingers';
    if (tt < TOUR.puff) return 'Fly above the clouds';
    if (tt < TOUR.star) return 'Wave the little clouds away';
    if (tt < TOUR.winter) return 'Catch a falling star';
    if (tt < TOUR.fire) return 'Skate under the northern lights';
    if (tt < TOUR.shake) return 'A crackling fire in your room';
    if (tt < TOUR.sea) return 'Shake your hands for a blizzard';
    if (tt < TOUR.whale) return 'Surf the storm with Bigfoot';
    if (tt < TOUR.flood) return 'Whales breach beside you';
    if (tt < TOUR.bed) return 'The storm floods in: touch the water';
    return tt < TOUR.bed + 8 ? 'Bedtime: rain on the glass' : 'The end credits roll';
  }

  /** A soft dark band behind the feature caption, so it reads over bright and busy shots. */
  private backFeature(): void {
    const c = this.feature.texture.image as HTMLCanvasElement;
    const g = c.getContext('2d');
    if (!g) return;
    g.globalCompositeOperation = 'destination-over';
    const grad = g.createLinearGradient(0, 0, c.width, 0);
    grad.addColorStop(0, 'rgba(15, 8, 4, 0)');
    grad.addColorStop(0.35, 'rgba(15, 8, 4, 0.55)');
    grad.addColorStop(1, 'rgba(15, 8, 4, 0.7)');
    g.fillStyle = grad;
    g.fillRect(0, 20, c.width, c.height - 40);
    g.globalCompositeOperation = 'source-over';
    this.feature.texture.needsUpdate = true;
  }

  /**
   * The viewer's hands in shot, doing what a person would: pointing and
   * pinch-dragging to draw the window, dancing at the party, turning the left
   * palm up for the palm menu and pinching Fireworks, cupping to catch gifts.
   */
  private handScript(d: Entity, phase: string, dt: number): void {
    if (!this.hands) return;
    const asleep = phase === RitualPhase.Asleep && readBeat(d, this.beat);
    const scene = asleep ? this.beat.scene : '';
    const t = asleep ? this.beat.time : 0;
    const f = {
      origin: H_TMP.origin.fromArray(d.getVectorView(RoomSlots, 'windowOrigin')),
      out: H_TMP.out.fromArray(d.getVectorView(RoomSlots, 'windowOut')),
      along: H_TMP.along.fromArray(d.getVectorView(RoomSlots, 'windowAlong')),
    };
    let left = REST_L;
    let right = REST_R;
    if (scene === 'draw-window' && t > 1.5 && t < 8.5) {
      // Point at the wall's lower corner, pinch, drag a big window up to the top corner, hold, release.
      const a = frameToWorld(f, { x: 0, y: 0.25, z: -0.8 }, H_TMP.a);
      const b = frameToWorld(f, { x: 0, y: 2.75, z: 0.8 }, H_TMP.b);
      const k = Math.min(1, Math.max(0, (t - 3) / 3));
      // The hand itself sweeps up and across as it drags (the pinch ray follows the hand).
      const hand = H_TMP.r.set(-0.04 + 0.2 * k, -0.24 + 0.46 * k, -0.42);
      right = { ...DRAW_R, at: hand, aim: H_TMP.aim.lerpVectors(a, b, k), pinch: t > 3 && t < 7.4 ? 1 : 0 };
    } else if (scene.startsWith('party-') && t < 8) {
      // Dancing: hands up, palms facing each other, swaying on the beat.
      const s = Math.sin(this.clock * 4.2);
      left = { ...DANCE_L, at: H_TMP.l.set(-0.2 + 0.04 * s, -0.02 + 0.07 * Math.abs(s), -0.42) };
      right = { ...DANCE_R, at: H_TMP.r.set(0.2 + 0.04 * s, -0.02 + 0.07 * Math.abs(Math.cos(this.clock * 4.2)), -0.42) };
    } else if (scene.startsWith('party-') && t >= 12 && t < 17) {
      // The palm menu: left palm up; the right hand points at Fireworks and pinches.
      left = PALM_UP_L;
      const panel = this.scene.getObjectByName('Palm Panel');
      if (panel && panel.position.y > -5 && t > 13) {
        panel.getWorldPosition(H_TMP.aim);
        panel.getWorldQuaternion(H_TMP.q);
        H_TMP.aim.add(H_TMP.off.set(0.058, 0.02, 0).applyQuaternion(H_TMP.q));
        right = { ...POINT_R, aim: H_TMP.aim, pinch: t > 14.3 && t < 15.1 ? 1 : 0 };
      }
    } else if (scene === 'gifts') {
      left = CUP_L;
      right = CUP_R;
    }
    let ease = Math.min(1, dt * 6);
    const tt = phase === RitualPhase.Awake ? this.tourTime() : -1;
    const head = this.player.head;
    if (tt >= 0) {
      left = TOUR_REST_L;
      right = TOUR_REST_R;
    }
    if (tt >= TOUR.photo && tt < TOUR.photo + 5.5) {
      // A finger frame around Bigfoot.
      left = FRAME_L;
      right = FRAME_R;
    } else if (tt >= TOUR.puff + 1.5 && tt < TOUR.puff + 3.5) {
      // A sweep of the right hand through the little cloud, and back.
      const k = tt - TOUR.puff - 1.5;
      const s = k < 1 ? k : 2 - k;
      right = { ...DANCE_R, at: H_TMP.r.set(0.35 - 0.65 * s, -0.1, -0.55) };
    } else if (tt >= TOUR.star && tt < TOUR.winter && WorldSpots.starOn) {
      // Reach for the falling star once it is within reach.
      head.updateMatrixWorld(true);
      const p = head.worldToLocal(H_TMP.aim.copy(WorldSpots.star));
      if (p.length() < 1.0) right = { at: H_TMP.r.copy(p).add(H_TMP.off.set(0.02, -0.06, 0.06)), rot: Q_UP_FINGERS, pose: 'open', pinch: 0 };
    } else if (tt >= TOUR.shake + 1 && tt < TOUR.shake + 5) {
      // Shaking both hands (fast, unsmoothed) for the blizzard.
      const s = Math.sin(this.clock * 12) * 0.14;
      const c = Math.cos(this.clock * 12) * 0.07;
      left = { ...DANCE_L, at: H_TMP.l.set(-0.2 + s, -0.08 + c, -0.42) };
      right = { ...DANCE_R, at: H_TMP.r.set(0.2 - s, -0.08 - c, -0.42) };
      ease = 1;
    } else if (tt >= TOUR.flood + 1 && tt < TOUR.flood + 6.5) {
      // A hand dipped into the floodwater, bobbing in and out.
      head.updateMatrixWorld(true);
      const dip = frameToWorld(f, { x: -1.8, y: 0.12 + Math.max(0, Math.sin(this.clock * 2.4)) * 0.18, z: 0.8 }, H_TMP.aim);
      right = { at: H_TMP.r.copy(head.worldToLocal(dip)), rot: Q_ID, pose: 'open', pinch: 0 };
    }
    this.hands.apply(this.player, left, right, ease);
    this.realHands?.updateFromEmulator(this.hands.deviceHands() as never, this.player);
  }

  /** True the first time a named cue is reached. */
  private cue(id: string): boolean {
    if (this.cues.has(id)) return false;
    this.cues.add(id);
    return true;
  }

  /** The feature caption sits lower right of the shot and fades between captions. */
  private updateFeature(dt: number): void {
    const want = this.featureText && this.cardMat.opacity < 0.2 ? 1 : 0;
    this.featureOpacity += (want - this.featureOpacity) * Math.min(1, dt * 3);
    const m = this.feature.mesh;
    m.visible = this.featureOpacity > 0.01;
    if (!m.visible) return;
    this.feature.material.opacity = this.featureOpacity;
    const head = this.player.head;
    head.getWorldPosition(m.position);
    head.getWorldQuaternion(m.quaternion);
    m.translateZ(-0.9);
    m.translateX(0.25);
    m.translateY(-0.3);
  }

  /** Title card at the start, end card once he's awake and the orb is shelved. */
  private updateCard(phase: string): void {
    let want = '';
    if (this.clock < 4.5) want = 'title';
    if (this.awakeAt >= 0 && this.clock - this.awakeAt > TOUR.end) want = 'end';
    if (want && want !== this.cardShown) this.drawCard(want);
    this.cardMat.opacity += ((want ? 1 : 0) - this.cardMat.opacity) * 0.08;
    this.card.visible = this.cardMat.opacity > 0.01;
    if (this.card.visible) {
      const head = this.player.head;
      head.getWorldPosition(this.card.position);
      head.getWorldQuaternion(this.card.quaternion);
      this.card.translateZ(-0.9);
    }
    if (phase === RitualPhase.Awake && want === 'end' && this.clock - this.awakeAt > TOUR.end + Director.endCardSec) this.finish();
  }

  private drawCard(kind: string): void {
    this.cardShown = kind;
    const g = this.cardCanvas.getContext('2d');
    if (!g) return;
    const W = 1280;
    g.clearRect(0, 0, W, 720);
    g.fillStyle = kind === 'end' ? 'rgba(20, 12, 8, 0.88)' : 'rgba(20, 12, 8, 0.5)';
    g.beginPath();
    g.roundRect(80, 150, W - 160, 420, 40);
    g.fill();
    g.textAlign = 'center';
    g.shadowColor = 'rgba(0, 0, 0, 0.6)';
    g.shadowBlur = 16;
    g.fillStyle = '#ffd38a';
    g.font = 'italic bold 128px Georgia, "Times New Roman", serif';
    g.fillText('Dreamlive', W / 2, 310);
    g.font = 'italic 46px Georgia, "Times New Roman", serif';
    g.fillStyle = '#fff3dd';
    g.fillText(kind === 'end' ? 'Every night, a new dream.' : 'Bigfoot is asleep in your room...', W / 2, 390);
    if (kind === 'end') {
      g.fillStyle = '#ffe2c0';
      g.font = 'italic 32px Georgia, "Times New Roman", serif';
      g.fillText('Built with Immersive Web SDK for Meta Quest and Meta VR Glasses', W / 2, 460);
      g.fillText('nnam-droid12.github.io/dreamlive', W / 2, 515);
    }
    this.cardTexture.needsUpdate = true;
  }

  private startRecording(): void {
    if (Director.offline) {
      this.startOffline();
      return;
    }
    const canvas = this.renderer.domElement as HTMLCanvasElement & { captureStream?: (fps: number) => MediaStream };
    if (!canvas.captureStream || typeof MediaRecorder === 'undefined') return;
    const stream = new MediaStream(canvas.captureStream(30).getVideoTracks());
    for (const track of Sound.recordStream()?.getAudioTracks() ?? []) stream.addTrack(track);
    const type = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((t) => MediaRecorder.isTypeSupported(t));
    this.recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 8_000_000 });
    this.recorder.ondataavailable = (e) => {
      if (e.data.size) this.chunks.push(e.data);
    };
    this.recorder.onstop = () => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob(this.chunks, { type: 'video/webm' }));
      a.download = Director.fileName;
      a.click();
    };
    this.recorder.start(1000);
  }

  /**
   * Offline render: right after each on-screen render (one per fixed story step)
   * the frame is read straight from the XR framebuffer, encoded as a JPEG and
   * saved by the dev server as artifacts/frames/frame-NNNNN.jpg. No live audio:
   * the sound is mixed afterwards from Timeline (scripts/trailer/mix.py).
   */
  private startOffline(): void {
    const start = Timeline.t;
    let n = 0;
    let pixels: Uint8Array | undefined;
    let canvas: OffscreenCanvas | undefined;
    DirectorFrame.onFrame = () => {
      const gl = this.renderer.getContext();
      const layer = this.renderer.xr.getSession()?.renderState.baseLayer;
      const w = layer?.framebufferWidth ?? gl.drawingBufferWidth;
      const h = layer?.framebufferHeight ?? gl.drawingBufferHeight;
      if (!pixels || pixels.length !== w * h * 4) {
        pixels = new Uint8Array(w * h * 4);
        canvas = new OffscreenCanvas(w, h);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, layer?.framebuffer ?? null);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      // WebGL rows run bottom-up; flip into an image.
      const img = new ImageData(w, h);
      const row = w * 4;
      for (let y = 0; y < h; y++) img.data.set(pixels.subarray((h - 1 - y) * row, (h - y) * row), y * row);
      const c = canvas!;
      c.getContext('2d')?.putImageData(img, 0, 0);
      const name = `frame-${String(n++).padStart(5, '0')}.jpg`;
      void c.convertToBlob({ type: 'image/jpeg', quality: 0.92 }).then((b) => fetch(`/__director-save?name=${name}`, { method: 'POST', body: b }));
    };
    this.saveTimeline = () => {
      const base = Director.fileName.replace(/\.webm$/, '');
      void fetch(`/__director-save?name=${base}-timeline.json`, {
        method: 'POST',
        body: JSON.stringify({ fps: Director.fps, start, end: Timeline.t, frames: n, events: Timeline.events }),
      });
    };
  }

  private finish(): void {
    this.done = true;
    DirectorFrame.onFrame = undefined;
    Timeline.on = false;
    this.saveTimeline?.();
    if (this.recorder?.state === 'recording') this.recorder.stop();
  }
}
