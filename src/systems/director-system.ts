import { Journal } from '../memory/journal.js';
import {
  Object3D,
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
import { Tuning } from '../config/tuning.js';
import { makeTitleCard, TitleCard } from '../visuals/title-card.js';
import { DirectorHands, HandShot } from './director-hands.js';
import { RealHands } from './real-hands.js';
import { newBeatContext, readBeat } from '../dreams/beat-context.js';
import { NycLayout } from '../showcase/nyc-bedroom.js';
import { WorldSpots } from './lib/world-kit.js';
import { BigfootControl } from './lib/bigfoot-control.js';
import { FriendCue } from './friend-system.js';
import { SeaConsoleSpots } from './sea-console-system.js';
import { GardenSpots } from './garden-world-system.js';
import { GiftHold } from './catch-system.js';
import { PartyConsoleSpots } from './party-console-system.js';
import { PartyCue } from './lib/party-mix.js';
import { SeaCue, SeaWeather } from './lib/sea-weather.js';
import { MovieSpots } from './movie-night-system.js';
import { frameToWorld, Rooftop } from '../showcase/rooftop-layout.js';

const UP = new Vector3(0, 1, 0);
const ONE = new Vector3(1, 1, 1);
const CAM_RATE = 1.4;
/** The wanted camera position jumping more than this (m) in one frame is a cut. */
const CUT_JUMP = 2.5;
/** How long (s) each scene's caption shows at its start. */
const FEATURE_HOLD = 3.5;
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
/** A left palm held out wide open: fingers forward, the palm tipped up toward your eyes. */
const Q_OFFER_L = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), 0.75).multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -0.15)).multiply(Q_PALM_UP);
/** The right index finger pointing forward and in to the left (reaching across from the right). */
const Q_POINT_IN_R = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 0.6);
/** The right palm held out the same way (mirrored). */
const Q_OFFER_R = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), 0.75).multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 0.15)).multiply(Q_PALM_UP);
/** Both palms tipped forward and over, so a gift slides off them to the floor. */
const Q_TIP_L = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -1.9).multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -0.15)).multiply(Q_PALM_UP);
const Q_TIP_R = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -1.9).multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 0.15)).multiply(Q_PALM_UP);
const Q_CUP = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), 0.55).multiply(Q_PALM_UP);
const CUP_L: HandShot = { at: new Vector3(-0.075, -0.15, -0.36), rot: Q_CUP, pose: 'cup', pinch: 0 };
const CUP_R: HandShot = { at: new Vector3(0.075, -0.15, -0.36), rot: Q_CUP, pose: 'cup', pinch: 0 };
/**
 * After the dream, the tour of everything else (seconds after waking): Movie
 * Night, a finger-frame photo, then the three dream worlds, then bedtime.
 */
const TOUR = { friend: 6, friendEnd: 38, movie: 41, bunny: 46, sofa: 56, movieEnd: 68, photo: 69, snap: 72, street: 76, streetLow: 86, clouds: 94, puff: 102, star: 107, garden: 113, sea: 129, whale: 154, flood: 159, bed: 159, end: 185 };
/** The garden (seconds into it): the right palm opens for a butterfly, the left finger points for the ladybug. */
const GARDEN = { palm: 2.5, palmEnd: 11, touch: 7.6, touchEnd: 10 };
/**
 * Storm and sunshine at sea (seconds after the sea begins): the console shows,
 * each dial the left hand drags [index, from, to, start, end], the right hand's
 * fist (thunder) and raised palm (sunshine), and the Goodnight button.
 */
const SEA = { console: 5, fist: 10.5, palm: 18.5, palmEnd: 22, press: 28 };
/** The party console in the film (seconds into a party scene, after the palm menu): [dial, from, to, start, end]. */
const PARTY_DIALS: [number, number, number, number, number][] = [
  [0, 0.85, 0.3, 17.6, 18.9],
  [0, 0.3, 1, 19.1, 20.2],
  [1, 0.85, 0.2, 20.6, 21.8],
  [1, 0.2, 1, 22.0, 23.3],
];
/** The film's song change on the party console (seconds into a party scene): reach, tap (Afrobeats), back to dancing. */
const PARTY_SONG = { reach: 3.8, tap: 5.6, done: 7.2, chip: 0 };
/** The film presses the console's Fireworks! button (seconds into a party scene): reach, press, done. */
const PARTY_FW = { reach: 12.6, press: 14, done: 15.2 };
const SEA_DIALS: [number, number, number, number, number][] = [
  [0, 0.85, 1, 6.5, 9.5],
  [0, 1, 0.2, 14, 18],
  [2, 0, 0.9, 23.5, 26.5],
];
/** Thumb pointing up for a right-hand thumbs-up (palm turned inward). */
const Q_THUMB_R = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), -Math.PI / 2);
/** The hangout's hand moments, in seconds after it starts. */
const FRIEND = { wave: 2, five: 6, bump: 10, thumbs: 14, rock: 17, tickle: 22, pat: 26, end: 30 };
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
  private lastWant = new Vector3();
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
  private featureKey = '';
  private featureAt = -99;
  /** The in-scene subtitles and chapter cards, hidden in the film (one short caption per scene instead). */
  private quiet: Object3D[] = [];
  private featureOpacity = 0;
  private cues = new Set<string>();
  private saveTimeline?: () => void;
  private hands?: DirectorHands;
  private realHands?: RealHands;
  private debugEvery = 0;
  private recording = false;

  init(): void {
    // The film is a returning visitor's night (so Bigfoot remembers, and the board has a story).
    Journal.seedDemo();
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

    this.lastWant.copy(this.wantPos);
    this.chooseShot(d, phase ?? '');
    // A new shot far from the last one is a cut, not a glide (gliding would pass through walls and buildings).
    const cut = this.wantPos.distanceTo(this.lastWant) > CUT_JUMP;
    const k = this.placed && !cut ? 1 - Math.exp(-CAM_RATE * realDelta) : 1;
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
      // Bedtime: the city at night through the glass, Bigfoot asleep in the corner of the shot.
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
      // From the party roof as he flies up toward it (high, over the dancers' heads).
      this.aim(at(9.5, 9.4, 3.8), him);
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
      // Mixing the party by hand: the dancers and Bigfoot ahead, the glass console by your left hand.
      else this.aim(at(deck.x - 1.0, deck.y + 1.4, deck.z - 0.4), him);
    } else if (scene === 'leap-back') {
      // From the party roof's edge: the street far below, his tower and window across.
      // From inside his room as he flies home toward the window.
      this.aim(at(-2.6, 1.5, 0.9), him);
    } else if (scene === 'gifts') {
      const cam = at(-3.3, 1.5, 2.6);
      const ahead = him.clone().lerp(at(Rooftop.insideSpot.x + 0.5, 1.3, 0), 0.5);
      // While a gift is set down (and a moment after it lands): look down at the floor in front.
      const down = (GiftHold.holding && GiftHold.holdFor > 1.1) || GiftHold.placing || GiftHold.sincePlaced < 1.0;
      if (down) ahead.copy(cam).addScaledVector(this.toward(cam, ahead), 0.9).setY(0.05);
      this.aim(cam, ahead);
    } else if (scene === 'to-bed' && root) {
      const look = root.clone().setY(0.9);
      this.aim(look.clone().addScaledVector(this.toward(look, seat), 2.6).setY(1.45), look);
    } else {
      this.aim(seat, dj);
    }
  }

  /** Seconds since he woke (the tour's clock), or -1 before that. */
  private tourTime(): number {
    return this.awakeAt < 0 ? -1 : this.clock - this.awakeAt + Director.at;
  }

  /** The tour's shots: the cinema screen, Bigfoot for the photo, then each world's best views. */
  private tourShot(d: Entity, seat: Vector3, head: Vector3 | undefined): boolean {
    const tt = this.tourTime();
    if (tt < TOUR.friend || tt >= TOUR.bed) return false;
    const f = {
      origin: new Vector3().fromArray(d.getVectorView(RoomSlots, 'windowOrigin')),
      out: new Vector3().fromArray(d.getVectorView(RoomSlots, 'windowOut')),
      along: new Vector3().fromArray(d.getVectorView(RoomSlots, 'windowAlong')),
    };
    const at = (x: number, y: number, z: number) => frameToWorld(f, { x, y, z }, new Vector3());
    const tv = new Vector3().fromArray(d.getVectorView(RoomSlots, 'anchorPoint'));
    const screen = new Vector3().fromArray(d.getVectorView(Session, 'movieScreen'));
    if (tt >= TOUR.friend && tt < TOUR.friendEnd) {
      // The hangout: from your seat, across the open floor toward the window; he comes to you.
      // For the pat he stands close, so the shot tilts up to keep his head in frame.
      const fr = tt - TOUR.friend;
      // (He bows for the pat, so his head comes down: the shot stays level with it.)
      const up = !FriendCue.close ? 1.05 : fr < FRIEND.pat - 0.5 ? 0.85 : 1.1;
      this.aim(seat.clone().setY(1.5), seat.clone().add(new Vector3(0.94, 0, -0.34).multiplyScalar(2)).setY(up));
      return true;
    }
    if (tt < TOUR.movie) {
      // He remembers you: the friendship board on his wall, the tally of your visits.
      const b = Tuning.memory.board;
      const face = new Vector3(Math.sin(b.yaw), 0, Math.cos(b.yaw));
      this.aim(new Vector3(b.x, b.y - 0.05, b.z).addScaledVector(face, 1.15), new Vector3(b.x, b.y - 0.05, b.z));
    }
    else if (tt < TOUR.movieEnd && MovieSpots.ready) {
      const sofa = new Vector3().addVectors(MovieSpots.bigfoot, MovieSpots.bunny).multiplyScalar(0.5);
      const toScreen = this.toward(sofa, screen);
      const side = new Vector3(toScreen.z, 0, -toScreen.x);
      if (tt < TOUR.bunny) {
        // Behind the loveseat: Bigfoot and the viewer's seat in the foreground, the big screen beyond.
        this.aim(this.inRoom(sofa.clone().addScaledVector(toScreen, -1.9).addScaledVector(side, -0.6).setY(1.75)), screen.clone().setY(screen.y - 0.2));
      } else if (tt < TOUR.sofa) {
        // The bunny steps out of the picture, hops down and walks over: watch it from the side.
        const b = MovieSpots.bunnyNow;
        const mid = new Vector3().addVectors(screen, sofa).multiplyScalar(0.5).setY(0);
        this.aim(this.inRoom(mid.addScaledVector(side, -2.4).setY(1.35)), b.clone().setY(b.y + 0.45));
      } else {
        // On the loveseat together, lit by the film: from just in front of them.
        this.aim(this.inRoom(sofa.clone().addScaledVector(toScreen, 1.9).addScaledVector(side, 0.35).setY(1.1)), sofa.clone().setY(0.85));
      }
    } else if (tt < TOUR.clouds) {
      // In the room with him (the street walk is gone; this stretch is cut from the film).
      if (head) this.aim(this.inRoom(head.clone().addScaledVector(this.toward(head, seat), 2.2).setY(1.45)), head);
    } else if (tt < TOUR.puff) this.aim(at(-1.0, 1.5, 0.3), WorldSpots.balloon.clone().setY(WorldSpots.balloon.y + 1.9));
    else if (tt < TOUR.star) {
      const p = WorldSpots.puff;
      this.aim(p.clone().addScaledVector(this.toward(p, seat), 0.6).setY(p.y + 0.12), p);
    } else if (tt < TOUR.garden) this.aim(at(-1.6, 1.4, 0.3), at(2, 2.0, 0.3));
    else if (tt < TOUR.sea) {
      // The garden: the lawn and the trees far ahead; then your open left palm and the butterfly on it.
      const gg = tt - TOUR.garden;
      const c = GardenSpots.center;
      const dir = H_TMP.off.subVectors(GardenSpots.bigfoot, c).setY(0).normalize();
      const leftV = H_TMP.a.set(dir.z, 0, -dir.x);
      if (gg < GARDEN.palm || gg > GARDEN.palmEnd + 1) this.aim(c.clone().addScaledVector(dir, -0.4).setY(1.3), c.clone().addScaledVector(dir, 3).setY(0.45));
      else this.aim(c.clone().setY(1.25), c.clone().addScaledVector(dir, 1.3).addScaledVector(leftV, 0.1).setY(0.72));
    }
    // The boat, from just inside the window: low enough to see into it, with sky enough for the sunbreak.
    // (High enough that the storm's biggest swells pass below the lens, never through it.)
    else if (tt < TOUR.sea + SEA.press + 2) this.aim(at(-0.3, 1.85, 0.3), WorldSpots.board.clone().setY(WorldSpots.board.y + 1.3));
    else if (tt < TOUR.flood) this.aim(at(-0.6, 1.6, 0.3), WorldSpots.whale);
    else this.aim(at(-2.6, 1.35, 0.9), at(-1.8, 0, 0.8));
    return true;
  }

  /** Keeps an indoor camera inside the bedroom (never behind a wall, where the room shows its open back). */
  private inRoom(p: Vector3): Vector3 {
    const r = NycLayout.room;
    const m = 0.35;
    p.x = Math.min(r.maxX - m, Math.max(r.minX + m, p.x));
    p.z = Math.min(r.maxZ - m, Math.max(r.minZ + m, p.z));
    return p;
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
      if (t < PARTY_SONG.reach) {
        text = 'A live rooftop cam: spatial cinema';
        DirectorFrame.cinema = true;
      } else if (t < 8) text = 'Change the song with your hand';
      else if (t < 12) text = 'The skyline dances to the music';
      else if (t < 17.4) text = 'Fireworks! at your fingertip';
      else if (t < 20.4) text = 'Volume: slide it down... and back up';
      else text = 'Lights: dim the party... and bring them back';
    } else if (scene === 'leap-back') text = 'Real music, in spatial audio';
    else if (scene === 'gifts') {
      text = 'Catch his gifts with your hands';
      // A shorter gifts beat for the trailer.
      if (t > 15 && this.cue('gifts-skip')) d.setValue(DreamDirector, 'beatTime', 20.5);
    } else if (scene === 'to-bed') text = 'Golden hour, starry night, sunrise';
    else if (phase === RitualPhase.Waking) text = 'Every dream leaves a memory';
    else if (phase === RitualPhase.Awake && roof) text = this.tourScript(d);
    if (!roof && phase === RitualPhase.Asleep) text = '';
    // One short caption at the start of each scene (like DreamSpace), shown briefly, then none
    // until the next scene.
    const key = asleep ? scene : phase === RitualPhase.Awake && roof ? `tour-${this.tourSection()}` : phase;
    if (text && key !== this.featureKey && !Director.debug) {
      this.featureKey = key;
      this.featureText = text;
      this.featureAt = this.clock;
      this.feature.draw([{ text, size: 62, style: 'italic', color: '#ffd38a' }], 'right');
      this.backFeature();
    }
  }

  /** Which part of the tour this is (one caption each). */
  private tourSection(): string {
    const tt = this.tourTime();
    if (tt < TOUR.friendEnd) return 'friend';
    if (tt < TOUR.movie) return 'board';
    if (tt < TOUR.movieEnd) return 'movie';
    if (tt < TOUR.street) return 'photo';
    if (tt < TOUR.clouds) return 'street';
    if (tt < TOUR.garden) return 'clouds';
    if (tt < TOUR.sea) return 'garden';
    if (tt < TOUR.bed) return 'sea';
    return 'bed';
  }

  /** The tour after the dream: what happens when, and its captions. */
  private tourScript(d: Entity): string {
    const tt = this.tourTime();
    if (tt < 0) return 'Every dream leaves a memory';
    const world = (name: string) => {
      d.setValue(Session, 'world', name);
      Timeline.log('world', name);
    };
    FriendCue.on = tt >= TOUR.friend && tt < TOUR.friendEnd;
    // He steps in close for the tickle and the pat, so a real arm's reach finds him (and your hand is big in the shot).
    FriendCue.close = FriendCue.on && tt - TOUR.friend >= FRIEND.tickle - 1.2;
    FriendCue.pat = FriendCue.on && tt - TOUR.friend >= FRIEND.pat - 1.5;
    if (tt > TOUR.movie && this.cue('movie')) d.setValue(Session, 'movie', true);
    if (tt > TOUR.movieEnd && this.cue('movie-end')) d.setValue(Session, 'movie', false);
    if (tt > TOUR.snap && this.cue('snap')) d.setValue(Session, 'photoShots', (d.getValue(Session, 'photoShots') ?? 0) + 1);
    if (tt > TOUR.clouds && this.cue('clouds')) world('clouds');
    if (tt > TOUR.garden && this.cue('garden')) world('garden');
    if (tt > TOUR.sea && this.cue('sea')) world('sea');
    if (tt > TOUR.sea + 7 && this.cue('strike-1')) WorldSpots.strikeNow = true;
    if (tt > TOUR.whale && this.cue('breach')) WorldSpots.breachNow = true;
    // Storm and sunshine at sea: the left hand works the console, the right hand calls thunder and the sun.
    const g = tt - TOUR.sea;
    SeaCue.show = tt >= TOUR.sea + SEA.console && tt < TOUR.bed;
    SeaCue.drive = -1;
    for (const [i, from, to, a, b] of SEA_DIALS) {
      if (g < a || g > b + 0.7) continue;
      const e = Math.min(1, (g - a) / (b - a));
      SeaCue.drive = i;
      SeaCue.value = from + (to - from) * e * e * (3 - 2 * e);
    }
    SeaCue.palmUp = g >= SEA.palm + 0.6 && g < SEA.palmEnd;
    if (g > SEA.fist + 0.5 && this.cue('sea-fist')) SeaWeather.thunderNow = true;
    if (g > SEA.press && this.cue('sea-goodnight')) SeaCue.press = true;
    if (tt > TOUR.bed && this.cue('bedtime')) {
      world('');
      d.setValue(Session, 'bedtime', true);
    }
    if (tt < TOUR.friend) return 'Every dream leaves a memory';
    if (tt < TOUR.friendEnd) {
      const f = tt - TOUR.friend;
      if (f < FRIEND.wave) return 'Bigfoot, your friend: talk with your hands';
      if (f < FRIEND.five) return 'Wave, and he waves back';
      if (f < FRIEND.bump) return 'High-five: his hand meets yours';
      if (f < FRIEND.thumbs) return 'Fist bump';
      if (f < FRIEND.rock) return 'Thumbs up';
      if (f < FRIEND.tickle) return 'Rock on, and he dances';
      if (f < FRIEND.pat) return 'Tickle him';
      return 'Pat his head';
    }
    if (tt < TOUR.movie) return 'He remembers every night with you';
    if (tt < TOUR.bunny) return 'Movie night with Bigfoot';
    if (tt < TOUR.sofa) return 'A movie star walks out to join you';
    if (tt < TOUR.movieEnd) return 'Popcorn on the sofa, lit by the film';
    if (tt < TOUR.street) return 'Frame a photo with your fingers';
    if (tt < TOUR.clouds) return 'Fly above the clouds';
    if (tt < TOUR.puff) return 'Fly above the clouds';
    if (tt < TOUR.star) return 'Wave the little clouds away';
    if (tt < TOUR.garden) return 'Catch a falling star';
    if (tt < TOUR.sea) {
      const gg = tt - TOUR.garden;
      if (gg < GARDEN.palm) return 'A garden grows in your room';
      if (gg < GARDEN.touch) return 'Open your palm: a butterfly lands on it';
      if (gg < GARDEN.palmEnd + 1) return 'Touch it gently, and it flies away';
      return 'A summer garden, all yours';
    }
    const gs = tt - TOUR.sea;
    if (gs < SEA.console) return 'Storm at sea: Bigfoot rides it out in his rowboat';
    if (gs < SEA.fist) return 'The storm is in your hands';
    if (gs < 14) return 'Clench your fist: thunder';
    if (gs < SEA.palm) return 'Calm the sea';
    if (gs < 23.5) return 'Raise your palm to the sky: sunshine';
    if (gs < SEA.press) return 'Call the whales';
    if (tt < TOUR.bed) return 'Goodnight, sea';
    if (tt < TOUR.bed + 8) return 'Bedtime: a quiet night in New York';
    return 'The end credits roll';
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
  /** The film's fingertip touch (garden): a correction toward the butterfly, built up while touching. */
  private touchFix = new Vector3();
  private touchSteer = false;
  /** When (s into the garden) the butterfly was touched away; -1 until then. */
  private touchedAt = -1;
  private touchedSeen = 0;

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
    // The party console, on your left for the whole party: a song tapped early on; later the band stripped
    // to the beat, the lights down, then the drop and the lights back up.
    PartyCue.show = scene.startsWith('party-') && scene !== 'party-wait' && t > 0.3;
    PartyCue.drive = -1;
    if (PartyCue.show && t > PARTY_SONG.tap && this.cue('party-song')) PartyCue.song = PARTY_SONG.chip;
    if (PartyCue.show && t > PARTY_FW.press && this.cue('party-fireworks')) PartyCue.press = true;
    if (PartyCue.show && t > 17.2) {
      for (const [i, from, to, a, b] of PARTY_DIALS) {
        if (t < a || t > b + 0.3) continue;
        const e = Math.min(1, (t - a) / (b - a));
        PartyCue.drive = i;
        PartyCue.value = from + (to - from) * e * e * (3 - 2 * e);
      }
    }
    if (scene === 'draw-window' && t > 1.5 && t < 8.5) {
      // Point at the wall's lower corner, pinch, drag a big window up to the top corner, hold, release.
      const a = frameToWorld(f, { x: 0, y: 0.25, z: -0.8 }, H_TMP.a);
      const b = frameToWorld(f, { x: 0, y: 2.75, z: 0.8 }, H_TMP.b);
      const k = Math.min(1, Math.max(0, (t - 3) / 3));
      // The hand itself sweeps up and across as it drags (the pinch ray follows the hand).
      const hand = H_TMP.r.set(-0.04 + 0.2 * k, -0.24 + 0.46 * k, -0.42);
      right = { ...DRAW_R, at: hand, aim: H_TMP.aim.lerpVectors(a, b, k), pinch: t > 3 && t < 7.4 ? 1 : 0 };
    } else if (scene.startsWith('party-') && t >= PARTY_SONG.reach && t < PARTY_SONG.done && PartyConsoleSpots.ready) {
      // The left fingertip reaches to the console's song chips and taps Afrobeats.
      this.player.head.updateMatrixWorld(true);
      const p = this.player.head.worldToLocal(H_TMP.aim.copy(PartyConsoleSpots.songs[PARTY_SONG.chip]));
      const press = t > PARTY_SONG.tap - 0.4 && t < PARTY_SONG.tap + 0.5 ? -0.012 : 0.03;
      left = { at: H_TMP.l.copy(p).add(H_TMP.off.set(0.02, -0.05, 0.08 + press)), rot: Q_ID, pose: 'point', pinch: 0 };
    } else if (scene.startsWith('party-') && t < 8) {
      // Dancing: hands up, palms facing each other, swaying on the beat.
      const s = Math.sin(this.clock * 4.2);
      left = { ...DANCE_L, at: H_TMP.l.set(-0.2 + 0.04 * s, -0.02 + 0.07 * Math.abs(s), -0.42) };
      right = { ...DANCE_R, at: H_TMP.r.set(0.2 + 0.04 * s, -0.02 + 0.07 * Math.abs(Math.cos(this.clock * 4.2)), -0.42) };
    } else if (scene.startsWith('party-') && t >= PARTY_FW.reach && t < PARTY_FW.done && PartyConsoleSpots.ready) {
      // The left fingertip presses the console's Fireworks! button.
      this.player.head.updateMatrixWorld(true);
      const p = this.player.head.worldToLocal(H_TMP.aim.copy(PartyConsoleSpots.button));
      const press = t > PARTY_FW.press - 0.4 && t < PARTY_FW.press + 0.5 ? -0.012 : 0.03;
      left = { at: H_TMP.l.copy(p).add(H_TMP.off.set(0.02, -0.05, 0.08 + press)), rot: Q_ID, pose: 'point', pinch: 0 };
    } else if (PartyCue.show && t > 17.2 && PartyConsoleSpots.ready) {
      // The left fingertip on the party console's knob it drags (or the next one).
      this.player.head.updateMatrixWorld(true);
      const k = PartyCue.drive >= 0 ? PartyCue.drive : t < 20.4 ? 0 : 1;
      const p = this.player.head.worldToLocal(H_TMP.aim.copy(PartyConsoleSpots.knob[k]));
      left = { at: H_TMP.l.copy(p).add(H_TMP.off.set(0.02, -0.05, 0.11)), rot: Q_ID, pose: 'point', pinch: 0 };
    } else if (scene === 'gifts') {
      // One gift at a time: both palms held out together, open and up, for it; once it rests
      // there a moment, both hands lower together to set it on the floor.
      // (Cupped with the fingers a little apart and tipped up toward you, like the garden's palm.)
      // Setting it down: the camera looks down at the floor, the hands lower and tip forward, and
      // the gift slides off and drops to the floor in view.
      const lower = (GiftHold.holding && GiftHold.holdFor > 1.3) || GiftHold.placing;
      const y = lower ? -0.3 : -0.16;
      const z = lower ? -0.44 : -0.38;
      left = { at: H_TMP.l.set(-0.07, y, z), rot: lower ? Q_TIP_L : Q_OFFER_L, pose: 'cupSpread', pinch: 0 };
      right = { at: H_TMP.r.set(0.07, y, z), rot: lower ? Q_TIP_R : Q_OFFER_R, pose: 'cupSpread', pinch: 0 };
    }
    let ease = Math.min(1, dt * 6);
    const tt = phase === RitualPhase.Awake ? this.tourTime() : -1;
    const head = this.player.head;
    if (tt >= 0) {
      left = TOUR_REST_L;
      right = TOUR_REST_R;
    }
    if (tt >= TOUR.friend && tt < TOUR.friendEnd) {
      const f = tt - TOUR.friend;
      const sp = BigfootControl.spot;
      head.updateMatrixWorld(true);
      const local = (x: number, y: number, z: number) => head.worldToLocal(H_TMP.aim.set(x, y, z));
      if (f >= FRIEND.wave && f < FRIEND.wave + 3) {
        // A wave: open hand up by the shoulder, swinging side to side.
        right = { at: H_TMP.r.set(0.2 + Math.sin(f * Math.PI * 4) * 0.13, -0.02, -0.42), rot: Q_UP_FINGERS, pose: 'open', pinch: 0 };
      } else if (f >= FRIEND.five && f < FRIEND.five + 3) {
        // A high-five held up to him.
        right = { at: H_TMP.r.set(0.08, 0.02, -0.5), rot: Q_UP_FINGERS, pose: 'open', pinch: 0 };
      } else if (f >= FRIEND.bump && f < FRIEND.bump + 3) {
        right = { at: H_TMP.r.set(0.05, -0.08, -0.46), rot: Q_ID, pose: 'fist', pinch: 0 };
      } else if (f >= FRIEND.thumbs && f < FRIEND.thumbs + 2.5) {
        right = { at: H_TMP.r.set(0.1, -0.04, -0.34), rot: Q_THUMB_R, pose: 'thumbs-up', pinch: 0 };
      } else if (f >= FRIEND.rock && f < FRIEND.rock + 4) {
        right = { at: H_TMP.r.set(0.16, 0.04, -0.42), rot: Q_UP_FINGERS, pose: 'rock', pinch: 0 };
      } else if (f >= FRIEND.tickle && f < FRIEND.tickle + 3.5) {
        // Fingers wiggling on his belly.
        const to = H_TMP.off.subVectors(this.camPos, sp).setY(0).normalize();
        const p = local(sp.x + to.x * 0.3 + Math.sin(f * 30) * 0.04, 0.85 + Math.cos(f * 26) * 0.03, sp.z + to.z * 0.3);
        right = { at: H_TMP.r.copy(p), rot: Q_UP_FINGERS, pose: 'open', pinch: 0 };
      } else if (f >= FRIEND.pat && f < FRIEND.pat + 3.5) {
        // Patting the top of his real head (wherever he is standing, however tall).
        const hd = BigfootControl.head;
        const bob = Math.abs(Math.sin(f * Math.PI * 2.5)) * 0.06;
        // On the front of the crown, toward the camera (he bows his head to you, so the very top is hidden).
        const tc = H_TMP.off.subVectors(this.camPos, hd).setY(0).normalize();
        const p = hd.lengthSq() > 0 ? local(hd.x + tc.x * 0.14, hd.y + Tuning.friend.headTop * 0.85 + bob, hd.z + tc.z * 0.14) : local(sp.x, 1.66 + bob, sp.z);
        right = { at: H_TMP.r.copy(p), rot: Q_ID, pose: 'flat', pinch: 0 };
      }
    } else if (tt >= TOUR.photo && tt < TOUR.photo + 5.5) {
      // A finger frame around Bigfoot.
      left = FRAME_L;
      right = FRAME_R;
    } else if (tt >= TOUR.puff + 1.5 && tt < TOUR.puff + 3.5) {
      // A sweep of the right hand through the little cloud, and back.
      const k = tt - TOUR.puff - 1.5;
      const s = k < 1 ? k : 2 - k;
      right = { ...DANCE_R, at: H_TMP.r.set(0.35 - 0.65 * s, -0.1, -0.55) };
    } else if (tt >= TOUR.garden && tt < TOUR.sea) {
      // The garden: the left palm open and up for a butterfly; then the right index finger touches it.
      const gg = tt - TOUR.garden;
      // (In the middle of the shot, palm up toward you, cupped with the fingers a little apart, ready to receive.)
      // Once the butterfly has flown off your palm, both hands come down a moment later.
      if (GardenSpots.touched !== this.touchedSeen) {
        this.touchedSeen = GardenSpots.touched;
        this.touchedAt = gg;
      }
      const flown = this.touchedAt >= 0 && gg > this.touchedAt + 0.8;
      if (gg >= GARDEN.palm && gg < GARDEN.palmEnd && !flown) left = { at: H_TMP.l.set(0, -0.15, -0.36), rot: Q_OFFER_L, pose: 'cupSpread', pinch: 0 };
      // The right hand comes in from the right, index finger out, angled in toward the palm...
      if (gg >= GARDEN.touch - 1.2 && gg < GARDEN.touch && GardenSpots.perched && !flown) right = { at: H_TMP.r.set(0.3, -0.17, -0.36), rot: Q_POINT_IN_R, pose: 'point', pinch: 0 };
      // ...and its fingertip touches the butterfly.
      if (gg >= GARDEN.touch && gg < GARDEN.touchEnd && !flown) {
        const p = GardenSpots.perched;
        if (p) {
          // The fingertip reaches the butterfly: the hand is placed by its wrist, so steer by
          // where the fingertip actually is until it touches (a little more each frame).
          const tip = GardenSpots.rightTip;
          if (tip && this.touchSteer) this.touchFix.addScaledVector(H_TMP.aim.subVectors(p, tip), Math.min(1, dt * 3));
          this.touchSteer = true;
          head.updateMatrixWorld(true);
          const local = head.worldToLocal(H_TMP.aim.copy(p).add(this.touchFix));
          right = { at: H_TMP.r.copy(local).add(H_TMP.off.set(0.08, -0.04, 0.08)), rot: Q_POINT_IN_R, pose: 'point', pinch: 0 };
        } else if (this.touchedAt < 0) right = { at: H_TMP.r.set(0.3, -0.17, -0.36), rot: Q_POINT_IN_R, pose: 'point', pinch: 0 };
      } else {
        this.touchSteer = false;
        this.touchFix.set(0, 0, 0);
      }
    } else if (tt >= TOUR.star && tt < TOUR.garden && WorldSpots.starOn) {
      // Reach for the falling star once it is within reach.
      head.updateMatrixWorld(true);
      const p = head.worldToLocal(H_TMP.aim.copy(WorldSpots.star));
      if (p.length() < 1.0) right = { at: H_TMP.r.copy(p).add(H_TMP.off.set(0.02, -0.06, 0.06)), rot: Q_UP_FINGERS, pose: 'open', pinch: 0 };
    } else if (tt >= TOUR.sea + SEA.console + 0.8 && tt < TOUR.sea + SEA.press + 1.2 && SeaConsoleSpots.ready) {
      head.updateMatrixWorld(true);
      const g = tt - TOUR.sea;
      // The left fingertip on the knob it drags (or the next one), then on Goodnight.
      const i = SeaCue.drive;
      const next = g < SEA_DIALS[0][3] ? 0 : g < SEA_DIALS[1][3] ? 0 : g < SEA.palmEnd ? 1 : 2;
      const target = g > SEA.press - 1.2 ? SeaConsoleSpots.button : SeaConsoleSpots.knob[i >= 0 ? i : next];
      const p = head.worldToLocal(H_TMP.aim.copy(target));
      // (The emulator's hand sits at its wrist: the fingertip reaches a hand's length ahead.)
      left = { at: H_TMP.l.copy(p).add(H_TMP.off.set(0.02, -0.05, 0.11)), rot: Q_ID, pose: 'point', pinch: 0 };
      if (g >= SEA.fist - 0.6 && g < SEA.fist + 2.4) right = { at: H_TMP.r.set(0.16, -0.02, -0.4), rot: Q_ID, pose: 'fist', pinch: 0 };
      else if (g >= SEA.palm && g < SEA.palmEnd + 0.5) right = { at: H_TMP.r.set(0.2, 0.16, -0.42), rot: Q_UP_FINGERS, pose: 'open', pinch: 0 };
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
    // Test renders: the diagnostics instead of the caption (refreshed a few times a second).
    if (Director.debug && ++this.debugEvery % 8 === 0) {
      const dq = this.queries.director.entities.values().next().value;
      const txt = dq?.getValue(Session, 'debug') ?? '';
      if (txt) {
        this.featureText = txt;
        const parts = txt.split(' | ');
        this.feature.draw(parts.map((p: string) => ({ text: p, size: 22, color: '#ffffff' })), 'right');
      }
    }
    const want = this.featureText && this.cardMat.opacity < 0.2 && (Director.debug || this.clock - this.featureAt < FEATURE_HOLD) ? 1 : 0;
    // No running text in the film: the in-scene subtitles, hints and chapter cards stay hidden.
    if (!this.quiet.length) for (const n of ['Caption', 'FilmChapter']) { const o = this.scene.getObjectByName(n); if (o) this.quiet.push(o); }
    for (const o of this.quiet) o.visible = false;
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
    // Low in the frame, below the experience's own captions.
    m.translateY(-0.355);
  }

  /** The end card once he's awake and the orb is shelved. */
  private updateCard(phase: string): void {
    let want = '';
    // (No title card over the opening: the film starts straight in the room.)
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
      // Resuming a stopped render: these frames are already on disk.
      if (n < Director.skip || (Director.until > 0 && n >= Director.until)) {
        n++;
        return;
      }
      if (Director.only.length) {
        const tt = this.tourTime();
        if (!Director.only.some(([a, b]) => tt >= a && tt <= b)) return;
      }
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
      // Test renders: the diagnostics as text beside the frames (every 5th frame).
      if (Director.debug && n % 5 === 0) {
        const dq = this.queries.director.entities.values().next().value;
        void fetch(`/__director-save?name=debug-${String(n).padStart(5, '0')}.txt`, { method: 'POST', body: dq?.getValue(Session, 'debug') ?? '' });
      }
      // At most two frames in flight: the render waits for the saves (no dropped frames).
      DirectorFrame.busy++;
      void c
        .convertToBlob({ type: 'image/jpeg', quality: 0.92 })
        .then((b) => fetch(`/__director-save?name=${name}`, { method: 'POST', body: b }))
        .catch(() => undefined)
        .finally(() => DirectorFrame.busy--);
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
