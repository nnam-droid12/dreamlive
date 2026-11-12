import { createSystem, Entity, InputComponent, Quaternion, Vector3, VisibilityState } from '@iwsdk/core';
import { Sound } from '../audio/engine.js';
import { Timeline } from '../audio/timeline.js';
import { DreamDirector } from '../components/dream.js';
import { Caption, Ritual, RitualPhase } from '../components/ritual.js';
import { Session } from '../components/session.js';
import { Director } from '../config/director.js';
import { Tuning } from '../config/tuning.js';
import { newBeatContext, readBeat } from '../dreams/beat-context.js';
import { songOf } from '../dreams/chapter_rooftop.js';
import { HandSigns } from '../input/hand-signs.js';
import { ConsoleDial, GlassConsole } from '../visuals/glass-console.js';
import { PartyCue, PartyMix } from './lib/party-mix.js';
import type { EmulatedHand } from './real-hands.js';

const cfg = Tuning.seaConsole;
const DIALS: ConsoleDial[] = [
  { icon: 'volume', label: 'Volume' },
  { icon: 'lights', label: 'Lights' },
  { icon: 'instruments', label: 'Band' },
];
const START = [0.85, 0.85, 1];
/** The party's three songs (real tracks, CC BY; see CREDITS): the chips above the pills. */
const SONGS = ['disco', 'afro', 'house'];
const SONG_LABEL = ['Disco', 'Afrobeats', 'House'];

/** Where the console's knobs and button are (world), for the film's hand. */
export const PartyConsoleSpots = { ready: false, knob: DIALS.map(() => new Vector3()), button: new Vector3(), songs: SONGS.map(() => new Vector3()) };

/**
 * Mix the rooftop party with your hand. While the party is live, a
 * DreamSpace-style console floats on your LEFT for the whole party: the song
 * (Disco, Afrobeats or House: tap one), Volume (the song's level),
 * Lights (stage lights, lasers, the skyline's glow) and Band (how much of the
 * song plays: the beat and bass alone, then the chords and voices, then the
 * hats and shimmer). "Fireworks!" fires a volley over the city.
 */
export class PartyConsoleSystem extends createSystem({
  director: { required: [Session, Ritual, Caption, DreamDirector] },
}) {
  private console = new GlassConsole(DIALS, 'Fireworks!', 'PartyConsole', SONG_LABEL);
  /** The song this console put on (given back when the party ends); which chip a hand is pressing. */
  private songByConsole = false;
  private chipBy: Record<'left' | 'right', boolean> = { left: false, right: false };
  private chipGlow = SONGS.map(() => 0);
  private signs = new HandSigns();
  private beat = newBeatContext();
  private want = [...START];
  private shown = [...START];
  private active = false;
  private alpha = 0;
  private dragging: Record<'left' | 'right', number> = { left: -1, right: -1 };
  private pressedBy: Record<'left' | 'right', boolean> = { left: false, right: false };
  private pressGlow = 0;
  private head = new Vector3();
  private fwd = new Vector3();
  private left = new Vector3();
  private rightV = new Vector3();
  private local = new Vector3();
  private tmp = new Vector3();
  private tmp2 = new Vector3();
  private q = new Quaternion();

  init(): void {
    this.console.setOpacity(0);
    this.world.createTransformEntity(this.console.root);
  }

  update(realDelta: number): void {
    if (this.visibilityState.peek() === VisibilityState.NonImmersive) return;
    const d = this.queries.director.entities.values().next().value;
    if (!d) return;
    const dt = Math.min(realDelta, 0.1);
    const roof = d.getValue(DreamDirector, 'chapterId') === 'rooftop-party';
    const asleep = d.getValue(Ritual, 'phase') === RitualPhase.Asleep && readBeat(d, this.beat);
    const live = roof && asleep && this.beat.scene.startsWith('party-') && this.beat.scene !== 'party-wait';
    const want = live && (Director.enabled ? PartyCue.show : true);
    if (want && !this.active) {
      this.active = true;
      this.place();
    } else if (!want && this.active) this.active = false;
    this.alpha += ((this.active ? 1 : 0) - this.alpha) * Math.min(1, dt * 3);
    this.console.setOpacity(this.alpha);
    if (this.active) {
      if (Director.enabled) this.place();
      this.readInput(d, dt);
    }
    // Back to the full party when the console is gone (the next dream starts fresh).
    if (!live) {
      this.want = [...START];
      if (this.songByConsole) {
        this.songByConsole = false;
        d.setValue(Session, 'djSong', '');
      }
    }
    // The chosen song's chip is filled white.
    const playing = (d.getValue(Session, 'djSong') ?? '') || (live ? songOf(this.beat.scene) : '');
    for (let i = 0; i < SONGS.length; i++) {
      this.chipGlow[i] = Math.max(0, this.chipGlow[i] - dt * 2);
      this.console.setChip(i, this.chipGlow[i], SONGS[i] === playing ? 1 : 0);
    }
    const k = Math.min(1, dt * cfg.ease * 1.6);
    for (let i = 0; i < DIALS.length; i++) {
      this.shown[i] += (this.want[i] - this.shown[i]) * k;
      this.console.setValue(i, this.want[i]);
    }
    PartyMix.volume = this.shown[0];
    PartyMix.lights = this.shown[1];
    PartyMix.instruments = this.shown[2];
    Sound.setPartyMix(this.shown[0], this.shown[2]);
    this.pressGlow = Math.max(0, this.pressGlow - dt * 1.5);
    this.console.setButton(0, this.pressGlow);
    if (this.console.root.visible) {
      for (let i = 0; i < DIALS.length; i++) this.console.knobWorld(i, PartyConsoleSpots.knob[i]);
      this.console.buttonWorld(PartyConsoleSpots.button);
      for (let i = 0; i < SONGS.length; i++) this.console.chipWorld(i, PartyConsoleSpots.songs[i]);
      PartyConsoleSpots.ready = true;
    } else PartyConsoleSpots.ready = false;
  }

  /** On your left, a little ahead and below your eyes, turned to face you. */
  private place(): void {
    const head = this.player.head;
    head.getWorldPosition(this.head);
    this.fwd.set(0, 0, -1).applyQuaternion(head.getWorldQuaternion(this.q)).setY(0);
    if (this.fwd.lengthSq() < 1e-4) this.fwd.set(0, 0, -1);
    this.fwd.normalize();
    this.left.set(this.fwd.z, 0, -this.fwd.x);
    const film = Director.enabled;
    const c = this.console.root;
    c.position.copy(this.head).addScaledVector(this.fwd, film ? cfg.filmForward : cfg.forward).addScaledVector(this.left, film ? cfg.filmLeft : cfg.left);
    c.position.y -= (film ? cfg.filmBelow : cfg.below) + cfg.pillH * 0.5;
    c.lookAt(this.head.x, this.head.y, this.head.z);
    c.updateMatrixWorld(true);
  }

  /** Puts a song on the decks (the party's music, lights and dancers follow). */
  private pickSong(d: Entity, i: number): void {
    if ((d.getValue(Session, 'djSong') ?? '') === SONGS[i]) return;
    d.setValue(Session, 'djSong', SONGS[i]);
    this.songByConsole = true;
    this.chipGlow[i] = 1;
    Sound.play('catch', this.console.root.position, 0.4);
    d.setValue(Caption, 'text', `Now playing: ${SONG_LABEL[i]}`);
    d.setValue(Caption, 'ttl', 3);
  }

  private fireworks(d: Entity): void {
    // The same volley as the palm menu's Fireworks.
    d.setValue(Session, 'fireworkShots', (d.getValue(Session, 'fireworkShots') ?? 0) + 1);
    this.pressGlow = 1;
    Sound.play('bloom', this.console.root.position, 0.6);
    Timeline.log('sfx', 'bloom');
    d.setValue(Caption, 'text', 'Fireworks over New York!');
    d.setValue(Caption, 'ttl', 3);
  }

  /** Fingertips (or a controller's ray with the trigger held) drag the pills and press the button. */
  private readInput(d: Entity, dt: number): void {
    if (Director.enabled) {
      if (PartyCue.drive >= 0) this.want[PartyCue.drive] = PartyCue.value;
      if (PartyCue.press) this.fireworks(d);
      PartyCue.press = false;
      if (PartyCue.song >= 0) this.pickSong(d, PartyCue.song);
      PartyCue.song = -1;
      for (let i = 0; i < DIALS.length; i++) this.console.setHover(i, i === PartyCue.drive ? 1 : 0);
      return;
    }
    const dev = (window as unknown as { IWER_DEVICE?: { hands?: { left?: EmulatedHand; right?: EmulatedHand } } }).IWER_DEVICE;
    if (dev?.hands) this.signs.readEmulator(dev.hands, this.player);
    else this.signs.readFrame(this.xrFrame, this.xrManager.getReferenceSpace(), this.player);
    this.rightV.set(-this.fwd.z, 0, this.fwd.x);
    this.signs.update(dt, this.rightV);
    const c = this.console.root;
    const hover = DIALS.map(() => 0);
    for (const side of ['left', 'right'] as const) {
      const h = this.signs[side];
      let at: Vector3 | undefined;
      let held = false;
      if (h.tracked) {
        at = this.local.copy(h.indexTip);
        c.worldToLocal(at);
        held = Math.abs(at.z) < cfg.touchDepth;
      } else {
        const ray = this.player.raySpaces[side];
        const pad = this.input.xr.gamepads[side];
        if (ray && pad) {
          ray.getWorldPosition(this.tmp);
          c.worldToLocal(this.tmp);
          ray.getWorldQuaternion(this.q);
          this.tmp2.set(0, 0, -1).applyQuaternion(this.q).applyQuaternion(this.q.copy(c.quaternion).invert());
          if (this.tmp2.z < -1e-3 && this.tmp.z > 0) {
            at = this.local.copy(this.tmp).addScaledVector(this.tmp2, -this.tmp.z / this.tmp2.z);
            held = pad.getButtonPressed(InputComponent.Trigger);
          }
        }
      }
      if (!at) {
        this.dragging[side] = -1;
        this.pressedBy[side] = false;
        this.chipBy[side] = false;
        continue;
      }
      let i = this.dragging[side];
      if (i < 0) i = this.pillAt(at.x, at.y);
      if (i >= 0 && held) {
        this.dragging[side] = i;
        this.want[i] = Math.max(0, Math.min(1, at.y / cfg.pillH));
      } else this.dragging[side] = -1;
      if (i >= 0) hover[i] = Math.max(hover[i], held ? 1 : 0.5);
      const b = this.console.button;
      const onButton = Math.abs(at.x) < b.w / 2 && Math.abs(at.y - b.y) < b.h / 2 + 0.006;
      if (onButton && held && !this.pressedBy[side]) {
        this.pressedBy[side] = true;
        this.fireworks(d);
      } else if (!held) this.pressedBy[side] = false;
      // A song chip: tap it.
      const chip = this.console.chips.findIndex((ch) => Math.abs(at.x - ch.x) < ch.w / 2 + 0.003 && Math.abs(at.y - ch.y) < ch.h / 2 + 0.004);
      if (chip >= 0 && held && !this.chipBy[side]) {
        this.chipBy[side] = true;
        this.pickSong(d, chip);
      } else if (!held || chip < 0) this.chipBy[side] = false;
      if (chip >= 0) this.chipGlow[chip] = Math.max(this.chipGlow[chip], held ? 1 : 0.5);
    }
    for (let i = 0; i < DIALS.length; i++) this.console.setHover(i, hover[i]);
  }

  private pillAt(x: number, y: number): number {
    if (y < -0.015 || y > cfg.pillH + 0.015) return -1;
    for (let i = 0; i < DIALS.length; i++) if (Math.abs(x - this.console.pills[i].x) < cfg.pillW / 2 + 0.008) return i;
    return -1;
  }
}
