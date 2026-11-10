import {
  createSystem,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  SRGBColorSpace,
  Vector3,
  VideoTexture,
  VisibilityState,
} from '@iwsdk/core';
import { Ritual } from '../components/ritual.js';
import { Session } from '../components/session.js';
import { RoomSlots } from '../components/stage.js';
import { Director } from '../config/director.js';
import { Tuning } from '../config/tuning.js';
import { seekForRender } from '../visuals/offline-video.js';

const cfg = Tuning.tvCartoon;

/**
 * The bedroom TV is never a dead black rectangle: a cartoon plays on it,
 * quietly, whenever nothing else needs the screen ("Caminandes 2: Gran
 * Dillama", Blender Foundation, CC BY). It steps aside for the dream TV, Movie
 * Night (the big screen takes over) and bedtime. Offline Director renders step
 * the cartoon with the story clock.
 */
export class TvCartoonSystem extends createSystem({
  director: { required: [Ritual, Session, RoomSlots] },
}) {
  private screen?: Mesh;
  private mat?: MeshBasicMaterial;
  private video?: HTMLVideoElement;
  private texture?: VideoTexture;
  private dreamTv?: Object3D;
  private amount = 0;
  private clock = 0;
  private normal = new Vector3();

  update(realDelta: number): void {
    if (this.visibilityState.peek() !== VisibilityState.Visible) return;
    const d = this.queries.director.entities.values().next().value;
    if (!d || !d.getValue(RoomSlots, 'windowReady')) return;
    if (!this.screen) this.build(d);
    if (!this.dreamTv) this.dreamTv = this.scene.getObjectByName('DreamTvScreen') ?? undefined;
    const dreamTvOn = !!this.dreamTv?.visible;
    const want = !dreamTvOn && !d.getValue(Session, 'movie') && !d.getValue(Session, 'bedtime');
    this.amount += ((want ? 1 : 0) - this.amount) * Math.min(1, realDelta * 2);
    const on = this.amount > 0.01;
    this.screen!.visible = on;
    this.mat!.color.setScalar(this.amount * cfg.brightness);
    const v = this.video!;
    if (!on) {
      if (!v.paused) v.pause();
      return;
    }
    this.clock += realDelta;
    if (Director.offline) {
      // Step the picture with the story clock (the render is slower than real time).
      seekForRender(v, this.texture, this.clock);
    } else if (v.paused) void v.play().catch(() => undefined);
  }

  private build(d: import('@iwsdk/core').Entity): void {
    const anchor = new Vector3().fromArray(d.getVectorView(RoomSlots, 'anchorPoint'));
    this.normal.fromArray(d.getVectorView(RoomSlots, 'anchorNormal'));
    const w = d.getValue(RoomSlots, 'anchorWidth') ?? 2.18;
    const v = document.createElement('video');
    v.src = `${import.meta.env.BASE_URL}video/${Director.offline ? 'intra/' : ''}caminandes.mp4`;
    v.crossOrigin = 'anonymous';
    v.muted = true;
    v.loop = true;
    v.playsInline = true;
    v.preload = 'auto';
    this.video = v;
    this.texture = new VideoTexture(v);
    this.texture.colorSpace = SRGBColorSpace;
    this.texture.minFilter = LinearFilter;
    this.mat = new MeshBasicMaterial({ map: this.texture, toneMapped: false });
    this.screen = new Mesh(new PlaneGeometry(w, (w * 9) / 16), this.mat);
    this.screen.name = 'TvCartoon';
    this.screen.position.copy(anchor).addScaledVector(this.normal, 0.006);
    this.screen.lookAt(anchor.addScaledVector(this.normal, 1));
    this.world.createTransformEntity(this.screen);
  }
}
