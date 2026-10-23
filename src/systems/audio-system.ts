import { createSystem, Quaternion, Vector3, VisibilityState } from '@iwsdk/core';
import { Sound, SOUND_CAPTIONS } from '../audio/engine.js';
import { Caption, Ritual, RitualPhase } from '../components/ritual.js';

const SOUND_CAPTION_SEC = 3.5;
const SOUND_TEXTS = new Set<string>(Object.values(SOUND_CAPTIONS));

/**
 * Bridges the procedural audio engine to the session: starts sound when XR is
 * visible and suspends it when the headset comes off, keeps the HRTF listener
 * on the head, scores each ritual phase (hum → music box + pad → waking swell)
 * and shows captions for story-relevant sounds.
 */
export class AudioSystem extends createSystem({
  director: { required: [Ritual, Caption] },
}) {
  private pos = new Vector3();
  private quat = new Quaternion();
  private fwd = new Vector3();
  private up = new Vector3();
  private lastPhase = '';
  private gestureHooked = false;

  update(): void {
    if (this.visibilityState.peek() !== VisibilityState.Visible) {
      Sound.suspend();
      return;
    }
    // XR selects (pinches) are user gestures: use the first one to unlock audio if needed.
    const session = this.xrManager.getSession();
    if (session && !this.gestureHooked) {
      this.gestureHooked = true;
      session.addEventListener('selectstart', () => Sound.ensure());
      session.addEventListener('end', () => (this.gestureHooked = false), { once: true });
    }
    if (!Sound.ensure()) return;
    this.player.head.getWorldPosition(this.pos);
    this.player.head.getWorldQuaternion(this.quat);
    this.fwd.set(0, 0, -1).applyQuaternion(this.quat);
    this.up.set(0, 1, 0).applyQuaternion(this.quat);
    Sound.setListener(this.pos, this.fwd, this.up);

    const d = this.queries.director.entities.values().next().value;
    if (!d) return;
    const phase = d.getValue(Ritual, 'phase') ?? '';
    if (phase !== this.lastPhase) {
      this.lastPhase = phase;
      Sound.setHum(phase === RitualPhase.Arrival || phase === RitualPhase.Rings);
      if (phase === RitualPhase.Asleep) Sound.setMusic(0.6);
      if (phase === RitualPhase.Waking) {
        Sound.setMusic(0.9);
        Sound.play('wake');
      }
      if (phase === RitualPhase.Awake) Sound.setMusic(0.45);
    }
    Sound.tick();

    // Story captions (teaching, closing) outrank sound captions: never interrupt them.
    const current = d.getValue(Caption, 'text') ?? '';
    const storyCaption = current !== '' && !SOUND_TEXTS.has(current);
    if (Sound.pendingCaption && (phase === RitualPhase.Arrival || storyCaption)) {
      Sound.pendingCaption = '';
    }
    if (Sound.pendingCaption) {
      d.setValue(Caption, 'text', Sound.pendingCaption);
      d.setValue(Caption, 'ttl', SOUND_CAPTION_SEC);
      Sound.pendingCaption = '';
    }
  }
}
