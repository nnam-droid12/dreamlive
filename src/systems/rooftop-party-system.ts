import {
  BoxGeometry,
  createSystem,
  DoubleSide,
  Entity,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Path,
  PlaneGeometry,
  Shape,
  ShapeGeometry,
  Vector3,
  VisibilityState,
} from '@iwsdk/core';
import { Sound } from '../audio/engine.js';
import { Bigfoot } from '../components/bigfoot.js';
import { DevControls, DreamDirector } from '../components/dream.js';
import { Ritual, RitualPhase } from '../components/ritual.js';
import { Session } from '../components/session.js';
import { RoomSlots } from '../components/stage.js';
import { Palette } from '../config/palette.js';
import { Showcase } from '../config/showcase.js';
import { Tuning } from '../config/tuning.js';
import { dreamDelta, newBeatContext, readBeat } from '../dreams/beat-context.js';
import { SONG_PALETTE, songOf } from '../dreams/chapter_rooftop.js';
import { buildRooftop, RooftopWorld } from '../showcase/rooftop.js';
import { Rooftop } from '../showcase/rooftop-layout.js';
import { buildParachuteGift } from '../visuals/goodies.js';

const cfg = Tuning.rooftop;
const GIFT_COLORS = [0xff5fb8, 0xffb45e, 0x35e0ff, 0x3dd68c, 0xb38bff];
type Faller = { obj: Object3D; age: number; from: Vector3; drift: Vector3; active: boolean };

/**
 * The Rooftop Party, outside the window: builds the neighbouring rooftop and the
 * street on the window frame, slides the bedroom glass open and shut on cue,
 * keeps the party going (quietly before Bigfoot arrives, full once he DJs), sets
 * the chosen song's colors, and floats his thrown goodies down to the street.
 */
export class RooftopPartySystem extends createSystem({
  director: { required: [Ritual, DreamDirector, DevControls, Session, RoomSlots] },
  bigfoot: { required: [Bigfoot] },
}) {
  private party?: RooftopWorld;
  private pane?: Object3D;
  private paneHome = new Vector3();
  private beat = newBeatContext();
  private time = 0;
  private energy = cfg.idleEnergy;
  private song = '';
  private fallers: Faller[] = [];
  private lastThrow = -1;
  private hand = new Vector3();
  private origin = new Vector3();
  private out = new Vector3();
  private along = new Vector3();

  update(realDelta: number): void {
    if (this.visibilityState.peek() !== VisibilityState.Visible) return;
    const d = this.queries.director.entities.values().next().value;
    if (!d || !d.getValue(RoomSlots, 'windowReady')) return;
    if (!this.party) this.build(d);
    const delta = dreamDelta(d, realDelta);
    this.time += delta;

    const dreaming = d.getValue(Ritual, 'phase') === RitualPhase.Asleep && readBeat(d, this.beat);
    const scene = dreaming ? this.beat.scene : '';
    const t = this.beat.time;
    // The glass: slides open as he reaches it, shut once he is back inside.
    let open = 0;
    if (scene === 'to-window') open = clamp01((t - 6.8) / 1.4);
    else if (scene === 'to-bed') open = 1 - clamp01((t - 1.2) / 1.4);
    else if (['leap-out', 'arrive', 'party-wait', 'leap-back'].includes(scene) || scene.startsWith('party-')) open = 1;
    d.setValue(RoomSlots, 'windowOpen', open);
    if (this.pane) this.pane.position.copy(this.paneHome).addScaledVector(this.along, -open * (Rooftop.bay.width - 0.1));

    // Party energy: the party is always on across the street; Bigfoot at the decks (or a replay) lifts it.
    const replay = d.getValue(Session, 'replay') ?? '';
    const live = scene === 'arrive' || scene === 'party-wait' || scene.startsWith('party-') || ['disco', 'afro', 'house'].includes(replay);
    this.energy += ((live ? 1 : cfg.idleEnergy) - this.energy) * Math.min(1, realDelta * 1.5);
    const song = scene.startsWith('party-') && scene !== 'party-wait' ? songOf(scene) : ['disco', 'afro', 'house'].includes(replay) ? replay : this.song || 'afro';
    if (song !== this.song) {
      this.song = song;
      this.party!.setPalette(SONG_PALETTE[song] ?? SONG_PALETTE.afro);
    }
    this.party!.update(this.time, 1 - Sound.beatPhase(this.time, 120), this.energy);

    // Throws: in step with Bigfoot's throwing arm (see BigfootSystem), toward the street.
    if (scene.startsWith('party-') && scene !== 'party-wait') {
      const n = Math.floor((t - 1 - cfg.throwRelease) / cfg.throwEvery);
      if (t > 1 + cfg.throwRelease && n !== this.lastThrow) {
        this.lastThrow = n;
        this.throwDown();
      }
    } else {
      this.lastThrow = -1;
    }
    for (const f of this.fallers) if (f.active) this.fall(f, delta);
  }

  private build(d: Entity): void {
    this.origin.fromArray(d.getVectorView(RoomSlots, 'windowOrigin'));
    this.out.fromArray(d.getVectorView(RoomSlots, 'windowOut'));
    this.along.fromArray(d.getVectorView(RoomSlots, 'windowAlong'));
    const party = buildRooftop();
    // Window-frame axes → world: local +x = out of the window, +z = along the wall.
    party.root.position.copy(this.origin);
    party.root.rotation.y = Math.atan2(-this.out.z, this.out.x);
    party.setPalette(SONG_PALETTE.afro);
    this.world.createTransformEntity(party.root);
    this.party = party;
    if (!Showcase.enabled) party.root.add(buildDreamWindow());
    this.pane = this.scene.getObjectByName('SlidingPane') ?? undefined;
    if (this.pane) this.paneHome.copy(this.pane.position);
  }

  /** A goodie leaves Bigfoot's hand, sails out over the street and parachutes down. */
  private throwDown(): void {
    const big = this.queries.bigfoot.entities.values().next().value;
    if (!big?.object3D) return;
    let f = this.fallers.find((x) => !x.active);
    if (!f) {
      if (this.fallers.length >= cfg.streetPool) return;
      const obj = buildParachuteGift(GIFT_COLORS[this.fallers.length % GIFT_COLORS.length]);
      this.world.createTransformEntity(obj);
      f = { obj, age: 0, from: new Vector3(), drift: new Vector3(), active: false };
      this.fallers.push(f);
    }
    big.object3D.getWorldPosition(this.hand);
    this.hand.y += 1.5;
    f.from.copy(this.hand);
    // Out over the street gap (toward the window side of the rooftop), with a little scatter.
    // Over the crowd and the near edge, out over the street gap.
    f.drift.copy(this.out).multiplyScalar(-(Rooftop.djSpot.x - (Rooftop.street.x0 + Rooftop.street.x1) / 2) * (0.9 + Math.random() * 0.2)).addScaledVector(this.along, (Math.random() - 0.5) * 5);
    f.age = 0;
    f.active = true;
    f.obj.visible = true;
    f.obj.position.copy(this.hand);
  }

  private fall(f: Faller, delta: number): void {
    f.age += delta;
    const k = Math.min(1, f.age / cfg.throwSec);
    // A thrown arc first, then a slow swaying parachute descent to the street.
    f.obj.position.copy(f.from).addScaledVector(f.drift, k);
    f.obj.position.y = f.from.y + Math.sin(Math.PI * Math.min(1, k * 1.2)) * 1.6 - Math.max(0, f.age - cfg.throwSec) * cfg.fallSpeed;
    f.obj.position.addScaledVector(this.along, Math.sin(f.age * 1.3) * 0.3 * Math.max(0, f.age - cfg.throwSec) * 0.2);
    f.obj.rotation.y += delta * 0.8;
    if (f.obj.position.y < this.origin.y + Rooftop.street.y + 1) {
      f.active = false;
      f.obj.visible = false;
    }
  }
}

const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

/**
 * Headset only. The real wall is passthrough, so an invisible depth-writing plane
 * spans the whole wall except the window opening: the rooftop world behind the
 * wall then shows only through the window. Plus a glowing frame and a glass pane
 * that slides open (named like the showcase room's, so the same code drives it).
 * Built in the window frame (x out of the wall, z along it).
 */
function buildDreamWindow(): Group {
  const g = new Group();
  g.name = 'DreamWindow';
  const w = Rooftop.bay.width;
  const sill = 0.15;
  const top = 2.45;
  // Occluder: a huge wall-plane rectangle with the window cut out.
  const shape = new Shape();
  shape.moveTo(-200, -100);
  shape.lineTo(200, -100);
  shape.lineTo(200, 100);
  shape.lineTo(-200, 100);
  shape.lineTo(-200, -100);
  const hole = new Path();
  hole.moveTo(-w / 2, sill);
  hole.lineTo(-w / 2, top);
  hole.lineTo(w / 2, top);
  hole.lineTo(w / 2, sill);
  hole.lineTo(-w / 2, sill);
  shape.holes.push(hole);
  const occluder = new Mesh(new ShapeGeometry(shape), new MeshBasicMaterial({ colorWrite: false, side: DoubleSide }));
  occluder.name = 'WallOccluder';
  occluder.renderOrder = -10;
  occluder.rotation.y = Math.PI / 2;
  occluder.position.x = 0.02;
  g.add(occluder);
  // A softly glowing frame around the opening.
  const glow = new MeshBasicMaterial({ color: Palette.lanternGlow });
  for (const [y, z, h, wd] of [[sill, 0, 0.05, w + 0.1], [top, 0, 0.05, w + 0.1], [(sill + top) / 2, -w / 2, top - sill, 0.05], [(sill + top) / 2, w / 2, top - sill, 0.05]] as const) {
    const bar = new Mesh(new BoxGeometry(0.06, h, wd), glow);
    bar.position.set(0, y, z);
    g.add(bar);
  }
  // The glass that slides open along the wall.
  const pane = new Group();
  pane.name = 'SlidingPane';
  const glass = new Mesh(
    new PlaneGeometry(w, top - sill),
    new MeshStandardMaterial({ color: 0x9fb8ff, transparent: true, opacity: 0.18, roughness: 0.05, metalness: 0.6, depthWrite: false, side: DoubleSide }),
  );
  glass.rotation.y = Math.PI / 2;
  pane.add(glass);
  pane.position.set(-0.02, (sill + top) / 2, 0);
  g.add(pane);
  return g;
}
