import { BackSide, createSystem, Mesh, MeshBasicMaterial, Quaternion, SphereGeometry, Vector3, VisibilityState } from '@iwsdk/core';
import { DreamDirector } from '../components/dream.js';
import { Ritual, RitualPhase } from '../components/ritual.js';
import { RoomSlots } from '../components/stage.js';
import { Director } from '../config/director.js';
import { Tuning } from '../config/tuning.js';
import { newBeatContext, readBeat } from '../dreams/beat-context.js';
import { frameToWorld, Rooftop } from '../showcase/rooftop-layout.js';

type View = 'home' | 'party' | 'edge';
const UP = new Vector3(0, 1, 0);

/**
 * The comfortable viewpoint tour of the Rooftop Party. The view never glides:
 * it fades to black, the viewer reappears at the next spot, and fades back in.
 * Home (the seat in Bigfoot's room) → up among the party crowd for the dancing
 * and the song choice → the party roof's edge, looking down at the street and
 * across at his tower as he leaps home → back home for the gift catching.
 * (Director mode moves its own camera, so the tour stays off there.)
 */
export class ViewTourSystem extends createSystem({
  director: { required: [Ritual, DreamDirector, RoomSlots] },
}) {
  private beat = newBeatContext();
  private current: View = 'home';
  private pending: View = 'home';
  private stage: 'idle' | 'out' | 'in' = 'idle';
  private fadeT = 0;
  private homePos = new Vector3();
  private homeQuat = new Quaternion();
  private homeSaved = false;
  private fade!: Mesh;
  private fadeMat!: MeshBasicMaterial;
  private frame = { origin: new Vector3(), out: new Vector3(), along: new Vector3() };
  private at = new Vector3();
  private look = new Vector3();

  init(): void {
    this.fadeMat = new MeshBasicMaterial({ color: 0x000000, side: BackSide, transparent: true, opacity: 0, depthTest: false, depthWrite: false });
    this.fade = new Mesh(new SphereGeometry(0.35, 16, 8), this.fadeMat);
    this.fade.renderOrder = 2000;
    this.fade.visible = false;
    this.world.createTransformEntity(this.fade);
  }

  update(realDelta: number): void {
    if (Director.enabled || this.visibilityState.peek() !== VisibilityState.Visible) return;
    const d = this.queries.director.entities.values().next().value;
    if (!d || !d.getValue(RoomSlots, 'windowReady')) return;
    this.pending = this.wanted(d);
    const cfg = Tuning.tour;
    if (this.stage === 'idle' && this.pending !== this.current) {
      this.stage = 'out';
      this.fadeT = 0;
    }
    if (this.stage === 'out') {
      this.fadeT += realDelta;
      this.fadeMat.opacity = Math.min(1, this.fadeT / cfg.fadeOutSec);
      if (this.fadeT >= cfg.fadeOutSec) {
        this.moveTo(d, this.pending);
        this.stage = 'in';
        this.fadeT = 0;
      }
    } else if (this.stage === 'in') {
      this.fadeT += realDelta;
      this.fadeMat.opacity = 1 - Math.min(1, this.fadeT / cfg.fadeInSec);
      if (this.fadeT >= cfg.fadeInSec) this.stage = 'idle';
    }
    this.fade.visible = this.fadeMat.opacity > 0.01;
    if (this.fade.visible) this.player.head.getWorldPosition(this.fade.position);
  }

  private wanted(d: import('@iwsdk/core').Entity): View {
    if (d.getValue(Ritual, 'phase') !== RitualPhase.Asleep || d.getValue(DreamDirector, 'chapterId') !== 'rooftop-party') return 'home';
    if (!readBeat(d, this.beat)) return 'home';
    const s = this.beat.scene;
    if (s === 'arrive' || s === 'party-wait' || s.startsWith('party-')) return 'party';
    if (s === 'leap-back') return 'edge';
    return 'home';
  }

  private moveTo(d: import('@iwsdk/core').Entity, view: View): void {
    if (!this.homeSaved) {
      this.homePos.copy(this.player.position);
      this.homeQuat.copy(this.player.quaternion);
      this.homeSaved = true;
    }
    this.current = view;
    d.setValue(RoomSlots, 'viewOutside', view !== 'home');
    if (view === 'home') {
      this.player.position.copy(this.homePos);
      this.player.quaternion.copy(this.homeQuat);
      return;
    }
    const f = this.frame;
    f.origin.fromArray(d.getVectorView(RoomSlots, 'windowOrigin'));
    f.out.fromArray(d.getVectorView(RoomSlots, 'windowOut'));
    f.along.fromArray(d.getVectorView(RoomSlots, 'windowAlong'));
    const v = Rooftop.views[view];
    frameToWorld(f, v.at, this.at);
    frameToWorld(f, v.look, this.look);
    // Stand there facing the look point (level: no pitch, for comfort).
    this.player.position.copy(this.at);
    this.player.quaternion.setFromAxisAngle(UP, Math.atan2(-(this.look.x - this.at.x), -(this.look.z - this.at.z)));
  }
}
