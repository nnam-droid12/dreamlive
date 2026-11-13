import { createSystem, Quaternion, Vector3, VisibilityState } from '@iwsdk/core';
import { ActName, Sound, SOUND_CAPTIONS } from '../audio/engine.js';
import { songOf } from '../dreams/chapter_rooftop.js';
import { Rooftop } from '../showcase/rooftop-layout.js';
import { Caption, Ritual, RitualPhase } from '../components/ritual.js';
import { Session } from '../components/session.js';
import { Tuning } from '../config/tuning.js';
import { DreamDirector } from '../components/dream.js';
import { RoomSlots } from '../components/stage.js';
import { newBeatContext, readBeat } from '../dreams/beat-context.js';

const SOUND_CAPTION_SEC = 3.5;
/** Rooftop Party beats where the party music is heard. */
/** Party songs play only at the party; every other scene has its own score (scoreFor). */
const ROOFTOP_MUSIC = new Set(['arrive', 'party-wait']);

/** Each scene's music: the opening, the bedroom, the leaps, gifts at night, the ending, bedtime. */
function scoreFor(phase: string, scene: string, roof: boolean, bedtime: boolean, world = ''): string {
  if (world === 'clouds') return 'clouds';
  if (world === 'sea') return 'sea';
  if (world === 'garden') return 'music-box';
  if (phase === RitualPhase.Waking || phase === RitualPhase.Awake) return bedtime ? 'lullaby' : 'ending';
  if (phase !== RitualPhase.Asleep || !roof) return 'dream';
  if (scene === 'draw-window' || scene === 'to-window') return 'bedroom';
  if (scene === 'leap-out' || scene === 'leap-back') return 'leap';
  if (scene === 'gifts') return 'gifts';
  if (scene === 'to-bed') return 'ending';
  return '';
}
const SOUND_TEXTS = new Set<string>(Object.values(SOUND_CAPTIONS));

/**
 * Bridges the procedural audio engine to the session: starts sound when XR is
 * visible and suspends it when the headset comes off or the dream is paused, keeps the HRTF listener
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
  private beat = newBeatContext();
  private tv = new Vector3();
  private lastAct = '';
  /** The song playing on the rooftop before the first choice, and between beats. */
  private lastSong: ActName = 'house';
  private bed = false;

  update(): void {
    const d0 = this.queries.director.entities.values().next().value;
    const paused = !!d0?.hasComponent(Session) && !!d0.getValue(Session, 'paused');
    if (this.visibilityState.peek() !== VisibilityState.Visible || paused) {
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
    // The act on the TV plays its own music from the TV; the music box steps back.
    // The act on the TV plays from the TV; the rooftop songs play from the rooftop.
    let act: ActName = '';
    let rooftop = false;
    if (phase === RitualPhase.Asleep && readBeat(d, this.beat)) {
      const s = this.beat.scene;
      if (s === 'surf' || s === 'dj' || s === 'ski') act = s;
      else if (ROOFTOP_MUSIC.has(s) || s.startsWith('party-')) {
        rooftop = true;
        const song = songOf(s);
        act = song === 'disco' || song === 'afro' || song === 'house' ? song : this.lastSong;
      }
    } else if (d.hasComponent(Session)) {
      const r = d.getValue(Session, 'replay') ?? '';
      if (r === 'surf' || r === 'dj' || r === 'ski') act = r;
      if (r === 'disco' || r === 'afro' || r === 'house') {
        act = r;
        rooftop = true;
      }
    }
    // The user DJs from the palm menu: their song plays from the decks for the rest of the Rooftop night.
    const dj = d.hasComponent(Session) ? (d.getValue(Session, 'djSong') ?? '') : '';
    if (dj && act !== 'surf' && act !== 'dj' && act !== 'ski' && (rooftop || (phase === RitualPhase.Asleep && d.getValue(DreamDirector, 'chapterId') === 'rooftop-party'))) {
      act = dj as ActName;
      rooftop = true;
    }
    if (act === 'disco' || act === 'afro' || act === 'house') this.lastSong = act;
    if (act !== this.lastAct && d.hasComponent(RoomSlots) && d.getValue(RoomSlots, 'anchorReady')) {
      this.lastAct = act;
      if (rooftop && d.getValue(RoomSlots, 'windowReady')) {
        // From the Yeti's decks up on the party roof.
        const o = d.getVectorView(RoomSlots, 'windowOrigin');
        const out = d.getVectorView(RoomSlots, 'windowOut');
        const along = d.getVectorView(RoomSlots, 'windowAlong');
        const dj = Rooftop.djSpot;
        this.tv.set(o[0] + out[0] * dj.x + along[0] * dj.z, o[1] + dj.y + 1, o[2] + out[2] * dj.x + along[2] * dj.z);
      } else {
        this.tv.fromArray(d.getVectorView(RoomSlots, 'anchorPoint'));
      }
      Sound.setAct(act, this.tv);
      if (phase === RitualPhase.Asleep) Sound.setMusic(act ? 0.15 : 0.6);
    }
    if (d.hasComponent(RoomSlots)) {
      const outside = !!d.getValue(RoomSlots, 'viewOutside');
      Sound.setActOpenness(rooftop && !outside ? (d.getValue(RoomSlots, 'windowOpen') ?? 0) : 1);
    }
    // Bedtime: the music box nearly silent, so the rain and the snoring carry the room.
    const bed = d.hasComponent(Session) && !!d.getValue(Session, 'bedtime');
    if (bed !== this.bed) {
      this.bed = bed;
      Sound.setMusic(bed ? Tuning.bedtime.music : phase === RitualPhase.Awake ? 0.45 : 0.6);
    }
    const roofNight = d.getValue(DreamDirector, 'chapterId') === 'rooftop-party';
    const sceneNow = phase === RitualPhase.Asleep && readBeat(d, this.beat) ? this.beat.scene : '';
    Sound.setScore(d.getValue(Session, 'movie') ? '' : scoreFor(phase ?? '', sceneNow, roofNight, bed, d.getValue(Session, 'world') ?? ''));
    Sound.tick();
    if (d.hasComponent(Session)) {
      const b = Sound.bands;
      d.setValue(Session, 'musicBass', b.bass);
      d.setValue(Session, 'musicMid', b.mid);
      d.setValue(Session, 'musicHigh', b.high);
      d.setValue(Session, 'musicLevel', b.level);
      d.setValue(Session, 'musicKick', b.kick);
    }

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
