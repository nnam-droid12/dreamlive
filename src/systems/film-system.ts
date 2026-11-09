import { createSystem, Quaternion, Vector3, VisibilityState } from '@iwsdk/core';
import { DreamDirector } from '../components/dream.js';
import { Ritual, RitualPhase } from '../components/ritual.js';
import { Session } from '../components/session.js';
import { Director } from '../config/director.js';
import { Tuning } from '../config/tuning.js';
import { newBeatContext, readBeat } from '../dreams/beat-context.js';
import { END_CREDITS } from '../dreams/credits.js';
import { CardLine, makeTitleCard, TitleCard } from '../visuals/title-card.js';

const cfg = Tuning.film;
const GOLD = '#ffd38a';
const CREAM = '#fff3dd';

/** Chapter cards: the beat that opens each chapter, and its title. */
const CHAPTERS: Record<string, [string, string]> = {
  'to-window': ['Chapter One', 'The Leap'],
  arrive: ['Chapter Two', 'The Party'],
  'leap-back': ['Chapter Three', 'Home Across the Street'],
  gifts: ['Chapter Four', 'Gifts from the Sky'],
  'to-bed': ['Chapter Five', 'Goodnight'],
};

interface Showing {
  card: TitleCard;
  age: number;
  life: number;
}

/** Where a card sits relative to the player rig (so a viewpoint change carries it along). */
interface Anchor {
  pos: Vector3;
  yaw: number;
}

/**
 * The Rooftop Party told as a film: a title card as the dream opens, a chapter
 * card as each chapter begins (lower right, like a caption in a movie), and
 * end credits rolling after Bigfoot wakes. Cards are placed in the world where
 * you are looking when they appear (comfortable; never stuck to the head).
 */
export class FilmSystem extends createSystem({
  director: { required: [Ritual, DreamDirector, Session] },
}) {
  private title!: TitleCard;
  private chapter!: TitleCard;
  private credits!: TitleCard;
  private showing: Showing[] = [];
  private beat = newBeatContext();
  private lastBeat = '';
  private rolled = false;
  private rollAge = -1;
  private generation = -1;
  private head = new Vector3();
  private fwd = new Vector3();
  private right = new Vector3();
  private quat = new Quaternion();
  private anchors = new Map<TitleCard, Anchor>();
  private rigQuat = new Quaternion();

  init(): void {
    this.title = makeTitleCard(1600, 384, 2.1);
    this.title.draw([
      { text: 'a Dreamlive story', size: 46, style: 'italic', color: CREAM },
      { text: "Bigfoot's Rooftop Party", size: 104, style: 'italic bold', color: GOLD, gap: 10 },
    ]);
    this.chapter = makeTitleCard(1280, 320, 1.7);
    this.credits = makeTitleCard(1024, 2600, 1.9);
    this.credits.draw(END_CREDITS);
    // The roll shows a window of the tall credits texture, scrolling up.
    this.credits.texture.repeat.set(1, cfg.creditsWindow);
    this.credits.mesh.scale.y = cfg.creditsWindow;
    this.title.mesh.name = 'FilmTitle';
    this.chapter.mesh.name = 'FilmChapter';
    this.credits.mesh.name = 'FilmCredits';
    for (const c of [this.title, this.chapter, this.credits]) this.world.createTransformEntity(c.mesh);
  }

  update(realDelta: number): void {
    if (this.visibilityState.peek() !== VisibilityState.Visible) return;
    const d = this.queries.director.entities.values().next().value;
    if (!d) return;
    const gen = d.getValue(Session, 'generation') ?? 0;
    if (gen !== this.generation) {
      this.generation = gen;
      this.rolled = false;
      this.rollAge = -1;
    }
    const roof = d.getValue(DreamDirector, 'chapterId') === 'rooftop-party';
    const phase = d.getValue(Ritual, 'phase');
    if (roof && phase === RitualPhase.Asleep && readBeat(d, this.beat)) {
      const id = d.getValue(DreamDirector, 'beatId') ?? '';
      if (id !== this.lastBeat) {
        this.lastBeat = id;
        if (id === 'draw-window') {
          this.rolled = false;
          this.place(this.title, 0, 0.18, cfg.distance);
          this.show(this.title, cfg.titleSec);
        }
        const ch = CHAPTERS[id];
        if (ch) {
          const lines: CardLine[] = [
            { text: ch[0], size: 52, style: 'italic', color: CREAM },
            { text: ch[1], size: 104, style: 'italic bold', color: GOLD, gap: 4 },
          ];
          this.chapter.draw(lines, 'right');
          this.place(this.chapter, 0.45, -0.3, cfg.distance);
          this.show(this.chapter, cfg.chapterSec);
        }
      }
    }
    // End credits, a moment after he wakes from the Rooftop dream.
    // (The Director's film tours the rest first and rolls them over bedtime, at the very end.)
    const creditsDue = Director.enabled ? !!d.getValue(Session, 'bedtime') : (d.getValue(Ritual, 'phaseTime') ?? 0) > cfg.creditsAt;
    if (roof && phase === RitualPhase.Awake && !this.rolled && creditsDue && !d.getValue(Session, 'movie')) {
      this.rolled = true;
      this.rollAge = 0;
      this.place(this.credits, 0, 0.05, cfg.distance + 0.4);
      this.credits.mesh.visible = true;
    }
    // A movie starting clears the credits off the screen.
    if (this.rollAge >= 0 && d.getValue(Session, 'movie')) {
      this.rollAge = -1;
      this.credits.mesh.visible = false;
    }
    if (this.rollAge >= 0) this.roll(realDelta);
    for (const s of this.showing) this.fade(s, realDelta);
    for (const [card, a] of this.anchors) if (card.mesh.visible) this.follow(card, a);
  }

  private show(card: TitleCard, life: number): void {
    const s = this.showing.find((x) => x.card === card);
    if (s) {
      s.age = 0;
      s.life = life;
    } else this.showing.push({ card, age: 0, life });
    card.mesh.visible = true;
  }

  /** Fade in, hold, fade out. */
  private fade(s: Showing, dt: number): void {
    if (!s.card.mesh.visible) return;
    s.age += dt;
    const f = cfg.fadeSec;
    const a = Math.min(1, s.age / f, (s.life - s.age) / f);
    s.card.material.opacity = Math.max(0, a);
    if (s.age >= s.life) s.card.mesh.visible = false;
  }

  /** Scroll the credits up through their window; fade at both ends. */
  private roll(dt: number): void {
    this.rollAge += dt;
    const k = this.rollAge / cfg.creditsSec;
    const w = cfg.creditsWindow;
    // Texture offset runs from just below the first line to just past the last.
    this.credits.texture.offset.y = 1 - k * (1 + w);
    this.credits.material.opacity = Math.min(1, this.rollAge / cfg.fadeSec, (cfg.creditsSec - this.rollAge) / cfg.fadeSec);
    if (k >= 1) {
      this.credits.mesh.visible = false;
      this.rollAge = -1;
    }
  }

  /** Put a card in front of where the viewer looks now: x right, y up, at `dist` metres. */
  private place(card: TitleCard, x: number, y: number, dist: number): void {
    this.player.head.getWorldPosition(this.head);
    this.player.head.getWorldQuaternion(this.quat);
    this.fwd.set(0, 0, -1).applyQuaternion(this.quat).setY(0).normalize();
    this.right.set(-this.fwd.z, 0, this.fwd.x);
    const m = card.mesh;
    m.position.copy(this.head).addScaledVector(this.fwd, dist).addScaledVector(this.right, x);
    m.position.y += y;
    m.lookAt(this.head.x, m.position.y, this.head.z);
    // Remember it in rig space: if the view tour moves the viewer, the card comes along.
    const a = this.anchors.get(card) ?? { pos: new Vector3(), yaw: 0 };
    this.player.updateMatrixWorld();
    a.pos.copy(m.position);
    this.player.worldToLocal(a.pos);
    this.player.getWorldQuaternion(this.rigQuat);
    a.yaw = Math.atan2(this.head.x - m.position.x, this.head.z - m.position.z) - this.rigYaw();
    this.anchors.set(card, a);
  }

  private follow(card: TitleCard, a: Anchor): void {
    const m = card.mesh;
    this.player.updateMatrixWorld();
    m.position.copy(a.pos);
    this.player.localToWorld(m.position);
    m.rotation.set(0, a.yaw + this.rigYaw(), 0);
  }

  private rigYaw(): number {
    this.player.getWorldQuaternion(this.rigQuat);
    this.fwd.set(0, 0, 1).applyQuaternion(this.rigQuat);
    return Math.atan2(this.fwd.x, this.fwd.z);
  }
}
