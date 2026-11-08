import { createSystem, Entity, InputComponent, UIKitMLAsset, Vector3, VisibilityState } from '@iwsdk/core';
import { Sound } from '../audio/engine.js';
import { onPress } from '../ui/press.js';
import { HandGestureState, Handedness } from '../components/hands.js';
import { Caption, Ritual, RitualPhase } from '../components/ritual.js';
import { Session } from '../components/session.js';
import { Tuning } from '../config/tuning.js';

const cfg = Tuning.palm;
const SONG_NAME: Record<string, string> = { disco: 'Disco', afro: 'Afrobeats', house: 'House' };

/**
 * The palm menu. Turn the left palm up (or press X on the left controller) and
 * a small panel floats above it: pick the song the Yeti plays, throw confetti,
 * launch fireworks over the city, change the weather (clear, rain, fog, snow)
 * and the time of night. Choices go on Session; the effect systems react.
 */
export class PalmMenuSystem extends createSystem({
  director: { required: [Session, Ritual, Caption] },
  hands: { required: [HandGestureState] },
}) {
  private ui?: UIKitMLAsset;
  private panel?: Entity;
  private bound = false;
  private open = false;
  private byPad = false;
  private upFor = 0;
  private downFor = 0;
  private head = new Vector3();
  private at = new Vector3();

  update(realDelta: number): void {
    const d = this.queries.director.entities.values().next().value;
    if (!d) return;
    if (!this.bound) this.bind(d);
    if (!this.panel?.object3D) return;
    if (this.visibilityState.peek() !== VisibilityState.Visible) return;

    const phase = d.getValue(Ritual, 'phase');
    const allowed = phase !== RitualPhase.Idle && !d.getValue(Session, 'paused');

    // Hands: left palm up (and the right not cupping beside it) for a moment.
    let left: Entity | undefined;
    let rightUp = false;
    for (const h of this.queries.hands.entities) {
      if (!h.getValue(HandGestureState, 'tracked')) continue;
      if (h.getValue(HandGestureState, 'hand') === Handedness.Left) left = h;
      else if (h.getValue(HandGestureState, 'palmUp')) rightUp = true;
    }
    const palmUp = !!left && !!left.getValue(HandGestureState, 'palmUp') && !rightUp;
    this.upFor = palmUp ? this.upFor + realDelta : 0;
    this.downFor = palmUp ? 0 : this.downFor + realDelta;

    const pad = this.input.xr.gamepads.left;
    if (pad?.getButtonDown(InputComponent.X_Button)) {
      this.byPad = !this.open;
      this.show(!this.open);
    }
    if (!allowed && this.open) this.show(false);
    if (allowed && !this.open && this.upFor >= cfg.openHoldSec) {
      this.byPad = false;
      this.show(true);
    }
    if (this.open && !this.byPad && this.downFor >= cfg.closeHoldSec) this.show(false);
    if (!this.open) return;

    // Float above the palm (or the controller), turned to face the eyes.
    if (left && !this.byPad) this.at.fromArray(left.getVectorView(HandGestureState, 'palmCenter'));
    else this.player.gripSpaces.left.getWorldPosition(this.at);
    this.at.y += cfg.above;
    const obj = this.panel.object3D;
    obj.position.copy(this.at);
    this.player.head.getWorldPosition(this.head);
    obj.rotation.set(0, Math.atan2(this.head.x - this.at.x, this.head.z - this.at.z), 0);
  }

  private show(on: boolean): void {
    this.open = on;
    const obj = this.panel?.object3D;
    if (!obj) return;
    obj.visible = on;
    if (!on) obj.position.set(0, -10, 0);
    else Sound.play('chime', undefined, 0.4);
  }

  private bind(d: Entity): void {
    this.panel = this.world.getSceneEntity?.('palm-panel');
    this.ui = this.world.getSceneObject<UIKitMLAsset>('palm-panel');
    if (!this.panel || !this.ui?.getElementById('song-disco')) return;
    this.bound = true;
    this.show(false);
    const say = (text: string) => {
      d.setValue(Caption, 'text', text);
      d.setValue(Caption, 'ttl', 3.5);
    };
    for (const song of ['disco', 'afro', 'house']) {
      this.on(`song-${song}`, () => {
        d.setValue(Session, 'djSong', song);
        say(`You're the DJ: ${SONG_NAME[song]} on the decks!`);
      });
    }
    this.on('fx-confetti', () => {
      d.setValue(Session, 'confettiShots', (d.getValue(Session, 'confettiShots') ?? 0) + 1);
    });
    this.on('fx-movie', () => d.setValue(Session, 'movie', !d.getValue(Session, 'movie')));
    this.on('fx-photo', () => d.setValue(Session, 'photoShots', (d.getValue(Session, 'photoShots') ?? 0) + 1));
    this.on('fx-fireworks', () => {
      d.setValue(Session, 'fireworkShots', (d.getValue(Session, 'fireworkShots') ?? 0) + 1);
      say('Fireworks over New York!');
    });
    const weather: Record<string, string> = { clear: 'Clear skies.', rain: 'Rain on the city.', fog: 'Fog rolls in.', snow: 'Snow over New York.' };
    for (const w of Object.keys(weather)) {
      this.on(`wx-${w}`, () => {
        d.setValue(Session, 'weather', w);
        say(weather[w]);
      });
    }
    this.on('tm-sunset', () => {
      d.setValue(Session, 'skyOverride', 'sunset');
      say('Golden hour.');
    });
    this.on('tm-night', () => {
      d.setValue(Session, 'skyOverride', 'night');
      say('Deep night.');
    });
    this.on('tm-bedtime', () => d.setValue(Session, 'bedtime', !d.getValue(Session, 'bedtime')));
    this.on('tm-dawn', () => {
      d.setValue(Session, 'skyOverride', 'dawn');
      say('Sunrise.');
    });
  }

  /** A pinch on the button (hands or controllers). */
  private on(id: string, fn: () => void): void {
    onPress(this.ui?.getElementById(id), fn, this.cleanupFuncs);
  }
}
