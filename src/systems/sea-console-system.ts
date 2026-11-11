import { createSystem, Entity, InputComponent, Quaternion, Vector3, VisibilityState } from '@iwsdk/core';
import { Sound } from '../audio/engine.js';
import { Timeline } from '../audio/timeline.js';
import { Caption, Ritual } from '../components/ritual.js';
import { Session } from '../components/session.js';
import { Director } from '../config/director.js';
import { Tuning } from '../config/tuning.js';
import { HandSigns } from '../input/hand-signs.js';
import { DIALS, GoodnightConsole } from '../visuals/goodnight-console.js';
import { SeaCue, SeaWeather } from './lib/sea-weather.js';
import type { EmulatedHand } from './real-hands.js';

const cfg = Tuning.seaConsole;
/** Storm high, no sun, no whales: how the storm at sea begins. */
const START = [0.85, 0, 0];
/** Goodnight settles it: the storm spent, full sunshine, the whales close and singing. */
const SETTLED = [0.06, 1, 0.8];

/** Where the console's knobs and button are (world), for the film's hand. */
export const SeaConsoleSpots = { ready: false, knob: DIALS.map(() => new Vector3()), button: new Vector3() };

/**
 * Storm and sunshine at sea, in your hands. In the Storm at Sea world a
 * DreamSpace-style console floats on your LEFT: drag Storm, Sun and Whales
 * with a fingertip (or point a controller and hold the trigger). Two gestures
 * work anywhere: clench a fist to call a thunderbolt; raise an open palm to the
 * sky to bring the sun on. "Goodnight" settles a sunny calm sea, then carries
 * you home to bed. The sea itself (SeaWorldSystem) reads SeaWeather.
 */
export class SeaConsoleSystem extends createSystem({
  director: { required: [Session, Ritual, Caption] },
}) {
  private console = new GoodnightConsole();
  private signs = new HandSigns();
  private want = [...START];
  private shown = [...START];
  private active = false;
  private alpha = 0;
  private seaTime = 0;
  private settleFor = -1;
  private settleFrom = [...START];
  private homeIn = -1;
  private dragging: Record<'left' | 'right', number> = { left: -1, right: -1 };
  private pressedBy: Record<'left' | 'right', boolean> = { left: false, right: false };
  private fistWas: Record<'left' | 'right', boolean> = { left: false, right: false };
  private thunderCool = 0;
  private sunCheered = false;
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
    const atSea = d.getValue(Session, 'world') === 'sea';
    this.seaTime = atSea ? this.seaTime + dt : 0;
    const want = atSea && (Director.enabled ? SeaCue.show : this.seaTime > cfg.appearAfter);
    if (want && !this.active) {
      this.active = true;
      this.want = [...START];
      this.settleFor = -1;
      this.homeIn = -1;
      this.sunCheered = false;
      this.place();
    } else if (!want && this.active) this.active = false;
    if (!atSea) this.want = [...START];
    this.alpha += ((this.active ? 1 : 0) - this.alpha) * Math.min(1, dt * 3);
    this.console.setOpacity(this.alpha);
    if (this.active) {
      // The film's camera moves: keep the console by its left hand.
      if (Director.enabled) this.place();
      this.readInput(d, dt);
      this.settle(d, dt);
    }
    const k = Math.min(1, dt * cfg.ease);
    for (let i = 0; i < DIALS.length; i++) {
      this.shown[i] += (this.want[i] - this.shown[i]) * k;
      this.console.setValue(i, this.want[i]);
    }
    SeaWeather.storm = this.shown[0];
    SeaWeather.sun = this.shown[1];
    SeaWeather.whales = this.shown[2];
    Sound.setLullaby(atSea ? this.shown[2] * 0.7 : 0);
    if (this.shown[1] > 0.7 && !this.sunCheered && atSea) {
      this.sunCheered = true;
      d.setValue(Caption, 'text', 'The sun breaks through. The storm is over.');
      d.setValue(Caption, 'ttl', 4);
    }
    if (this.console.root.visible) {
      for (let i = 0; i < DIALS.length; i++) this.console.knobWorld(i, SeaConsoleSpots.knob[i]);
      this.console.buttonWorld(SeaConsoleSpots.button);
      SeaConsoleSpots.ready = true;
    } else SeaConsoleSpots.ready = false;
    // Goodnight: once the calm has settled, home to bed (the film's Director does this itself).
    if (this.homeIn > 0) {
      this.homeIn -= dt;
      if (this.homeIn <= 0 && !Director.enabled) {
        d.setValue(Session, 'world', '');
        d.setValue(Session, 'bedtime', true);
      }
    }
  }

  /** On your left, a little ahead and below your eyes, turned to face you (like DreamSpace's controls). */
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

  /** Fingertips (or a controller's ray with the trigger held) drag the pills; a fist calls thunder; a raised palm calls the sun. */
  private readInput(d: Entity, dt: number): void {
    this.thunderCool -= dt;
    if (Director.enabled) {
      // The film: the Director drives the dials and the gestures (its hands act them out).
      if (SeaCue.drive >= 0) this.want[SeaCue.drive] = SeaCue.value;
      if (SeaCue.palmUp) this.want[1] = Math.min(1, this.want[1] + dt * cfg.palmSunRate);
      if (SeaCue.press && this.settleFor < 0) this.pressGoodnight(d);
      SeaCue.press = false;
      for (let i = 0; i < DIALS.length; i++) this.console.setHover(i, i === SeaCue.drive ? 1 : 0);
      return;
    }
    const dev = (window as unknown as { IWER_DEVICE?: { hands?: { left?: EmulatedHand; right?: EmulatedHand } } }).IWER_DEVICE;
    if (dev?.hands) this.signs.readEmulator(dev.hands, this.player);
    else this.signs.readFrame(this.xrFrame, this.xrManager.getReferenceSpace(), this.player);
    this.rightV.set(-this.fwd.z, 0, this.fwd.x);
    this.signs.update(dt, this.rightV);
    const c = this.console.root;
    const hover = DIALS.map(() => 0);
    let buttonHover = 0;
    this.player.head.getWorldPosition(this.head);
    for (const side of ['left', 'right'] as const) {
      const h = this.signs[side];
      // Gestures: a clenched fist calls a thunderbolt; an open palm raised to the sky brings the sun.
      const fist = h.tracked && h.sign === 'fist' && h.held > 0.15;
      if (fist && !this.fistWas[side] && this.thunderCool <= 0 && this.want[0] > 0.2) {
        SeaWeather.thunderNow = true;
        this.thunderCool = cfg.thunderCooldown;
        this.want[0] = Math.min(1, this.want[0] + 0.1);
      }
      this.fistWas[side] = fist;
      if (h.tracked && h.sign === 'open' && h.normal.y > 0.6 && h.palm.y > this.head.y - 0.05) this.want[1] = Math.min(1, this.want[1] + dt * cfg.palmSunRate);
      let at: Vector3 | undefined;
      let held = false;
      if (h.tracked) {
        at = this.local.copy(h.indexTip);
        c.worldToLocal(at);
        held = Math.abs(at.z) < cfg.touchDepth;
      } else {
        // A controller: its ray meets the console's plane; the trigger drags.
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
        continue;
      }
      // Keep dragging the pill you started on, even if the finger drifts sideways.
      let i = this.dragging[side];
      if (i < 0) i = this.pillAt(at.x, at.y);
      if (i >= 0 && held) {
        this.dragging[side] = i;
        this.want[i] = Math.max(0, Math.min(1, at.y / cfg.pillH));
        this.settleFor = -1;
      } else this.dragging[side] = -1;
      if (i >= 0) hover[i] = Math.max(hover[i], held ? 1 : 0.5);
      const b = this.console.button;
      const onButton = Math.abs(at.x) < b.w / 2 && Math.abs(at.y - b.y) < b.h / 2 + 0.006;
      if (onButton) buttonHover = 0.6;
      if (onButton && held && !this.pressedBy[side]) {
        this.pressedBy[side] = true;
        this.pressGoodnight(d);
      } else if (!held) this.pressedBy[side] = false;
    }
    for (let i = 0; i < DIALS.length; i++) this.console.setHover(i, hover[i]);
    this.console.setButton(buttonHover, this.settleFor >= 0 ? Math.max(0, 1 - this.settleFor / 0.6) : 0);
  }

  private pillAt(x: number, y: number): number {
    if (y < -0.015 || y > cfg.pillH + 0.015) return -1;
    for (let i = 0; i < DIALS.length; i++) if (Math.abs(x - this.console.pills[i].x) < cfg.pillW / 2 + 0.008) return i;
    return -1;
  }

  private pressGoodnight(d: Entity): void {
    this.settleFor = 0;
    this.settleFrom = [...this.want];
    this.homeIn = cfg.settleSec + cfg.homeAfter;
    Sound.play('bloom', this.console.root.position, 0.6);
    Timeline.log('sfx', 'bloom');
    d.setValue(Caption, 'text', 'Goodnight, sea. Time to sail home.');
    d.setValue(Caption, 'ttl', 5);
  }

  /** Goodnight glides every dial to the sunny calm. */
  private settle(_d: Entity, dt: number): void {
    if (this.settleFor < 0) return;
    this.settleFor += dt;
    const e = Math.min(1, this.settleFor / cfg.settleSec);
    const s = e * e * (3 - 2 * e);
    for (let i = 0; i < DIALS.length; i++) this.want[i] = this.settleFrom[i] + (SETTLED[i] - this.settleFrom[i]) * s;
    if (e >= 1) this.settleFor = -1;
  }
}
