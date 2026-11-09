import {
  AdditiveBlending,
  Color,
  createSystem,
  Entity,
  Group,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  PointLight,
  RayInteractable,
  SRGBColorSpace,
  Vector3,
  VideoTexture,
  VisibilityState,
} from '@iwsdk/core';
import { Sound } from '../audio/engine.js';
import { Caption, Ritual } from '../components/ritual.js';
import { Session } from '../components/session.js';
import { RoomSlots } from '../components/stage.js';
import { Palette } from '../config/palette.js';
import { Timeline } from '../audio/timeline.js';
import { Director } from '../config/director.js';
import { Tuning } from '../config/tuning.js';
import { onPress } from '../ui/press.js';

const cfg = Tuning.movie;

/** A film the viewer picked on the start page (blob URL), if any; otherwise Big Buck Bunny. */
export const MovieChoice = { url: '' };

/**
 * Movie Night with Bigfoot (spatial cinema you actually use). From the palm
 * menu the room dims into a private cinema: a 3 m screen appears in front of
 * you, fixed in the room, playing Big Buck Bunny (Blender Foundation, CC BY)
 * or a video you chose on the start page. Its sound comes from the screen;
 * its colours light the room (a light in front of the screen follows the
 * picture's average colour). Pinch the screen to pause or play. Bigfoot
 * watches beside you with popcorn, cheers at the fun bits and turns in near
 * the end (BigfootSystem reads Session.movie / movieTime / movieLaugh).
 */
export class MovieNightSystem extends createSystem({
  director: { required: [Ritual, Session, RoomSlots, Caption] },
}) {
  private root!: Group;
  private screenMesh!: Mesh;
  private screenMat!: MeshBasicMaterial;
  private halo!: Mesh;
  private haloMat!: MeshBasicMaterial;
  private light!: PointLight;
  private video?: HTMLVideoElement;
  private texture?: VideoTexture;
  private sampler?: CanvasRenderingContext2D;
  private sampleIn = 0;
  private avg = new Color();
  private target = new Color();
  private on = false;
  private amount = 0;
  private laughsDone = new Set<number>();
  private spoke = new Set<string>();
  private head = new Vector3();
  private fwd = new Vector3();
  private center = new Vector3();
  private pressBound = false;
  /** Offline Director renders step the film with the story clock (seeking frame by frame), not in real time. */
  private filmClock = 0;

  init(): void {
    this.root = new Group();
    this.root.name = 'MovieScreen';
    const w = cfg.width;
    const h = (w * 9) / 16;
    // A soft glow around the screen, tinted by the picture.
    this.haloMat = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false });
    this.halo = new Mesh(new PlaneGeometry(w * 1.35, h * 1.6), this.haloMat);
    this.halo.position.z = -0.03;
    const bezel = new Mesh(new PlaneGeometry(w + 0.08, h + 0.08), new MeshBasicMaterial({ color: Palette.cinemaBezel }));
    bezel.position.z = -0.01;
    this.screenMat = new MeshBasicMaterial({ color: 0x000000, toneMapped: false });
    this.screenMesh = new Mesh(new PlaneGeometry(w, h), this.screenMat);
    this.screenMesh.name = 'MovieSurface';
    this.root.add(this.halo, bezel, this.screenMesh);
    this.root.visible = false;
    const e = this.world.createTransformEntity(this.root);
    this.world.createTransformEntity(this.screenMesh, { parent: e }).addComponent(RayInteractable);
    // The film's light on the room: always present (intensity 0 when off), so turning it on never recompiles.
    this.light = new PointLight(0xffffff, 0, cfg.lightRange, 1.6);
    this.world.createTransformEntity(this.light);
  }

  update(realDelta: number): void {
    if (this.visibilityState.peek() !== VisibilityState.Visible) return;
    const d = this.queries.director.entities.values().next().value;
    if (!d) return;
    if (!this.pressBound) {
      this.pressBound = onPress(this.screenMesh as never, () => this.togglePause(), this.cleanupFuncs);
    }
    const want = !!d.getValue(Session, 'movie');
    if (want && !this.on) this.start(d);
    if (!want && this.on) this.endFilm(d);
    this.amount += ((this.on ? 1 : 0) - this.amount) * Math.min(1, realDelta * 1.2);
    d.setValue(RoomSlots, 'movieDim', this.amount);
    this.root.visible = this.amount > 0.01;
    if (!this.root.visible) {
      this.light.intensity = 0;
      return;
    }
    const v = this.video;
    if (v && Director.offline && this.on) {
      this.filmClock += realDelta;
      if (!v.paused) v.pause();
      if (!v.seeking) v.currentTime = this.filmClock;
      if (this.texture && v.readyState >= 2) this.texture.needsUpdate = true;
    }
    const t = v ? (Director.offline && this.on ? this.filmClock : v.currentTime) : 0;
    d.setValue(Session, 'movieTime', t);
    this.sample(realDelta);
    this.light.color.lerp(this.target, Math.min(1, realDelta * 4));
    const lum = this.light.color.r * 0.3 + this.light.color.g * 0.59 + this.light.color.b * 0.11;
    this.light.intensity = this.amount * cfg.lightIntensity * (0.35 + lum);
    this.haloMat.color.copy(this.light.color);
    this.haloMat.opacity = this.amount * 0.18;
    this.screenMat.color.setScalar(this.amount);
    // Cheers at the fun bits, his lines, and the end of the film.
    for (const at of cfg.laughs) {
      if (t > at && !this.laughsDone.has(at)) {
        this.laughsDone.add(at);
        d.setValue(Session, 'movieLaugh', 2.2);
        if (this.laughsDone.size === 2) this.say(d, 'movie-laugh', 'Ha! I love this part!');
      }
    }
    d.setValue(Session, 'movieLaugh', Math.max(0, (d.getValue(Session, 'movieLaugh') ?? 0) - realDelta));
    if (v && v.duration && t > v.duration - cfg.yawnBeforeEnd) this.say(d, 'movie-end', 'Yawn... best movie night ever. Goodnight, friend.');
    if (v?.ended) d.setValue(Session, 'movie', false);
  }

  /** Dim the room, place the screen in front of the viewer, and roll the film. */
  private start(d: Entity): void {
    this.on = true;
    this.laughsDone.clear();
    this.spoke.clear();
    this.player.head.getWorldPosition(this.head);
    this.fwd.set(0, 0, -1).applyQuaternion(this.player.head.getWorldQuaternion(this.root.quaternion)).setY(0).normalize();
    this.center.copy(this.head).addScaledVector(this.fwd, cfg.distance);
    this.center.y = cfg.height;
    this.root.position.copy(this.center);
    this.root.lookAt(this.head.x, this.center.y, this.head.z);
    this.light.position.copy(this.center).addScaledVector(this.fwd, -cfg.lightAhead);
    this.center.toArray(d.getVectorView(Session, 'movieScreen'));
    if (!this.video) {
      const v = document.createElement('video');
      v.src = MovieChoice.url || `${import.meta.env.BASE_URL}video/big-buck-bunny.mp4`;
      v.crossOrigin = 'anonymous';
      v.playsInline = true;
      v.preload = 'auto';
      this.video = v;
      this.texture = new VideoTexture(v);
      this.texture.colorSpace = SRGBColorSpace;
      this.texture.minFilter = LinearFilter;
      this.screenMat.map = this.texture;
      this.screenMat.needsUpdate = true;
      const c = document.createElement('canvas');
      c.width = c.height = 8;
      this.sampler = c.getContext('2d', { willReadFrequently: true }) ?? undefined;
    }
    Sound.attachVideo(this.video, this.center, cfg.volume);
    this.video.currentTime = 0;
    this.filmClock = 0;
    Timeline.log('movie', MovieChoice.url ? 'own' : 'big-buck-bunny', 1);
    if (Director.offline) this.video.muted = true;
    else void this.video.play().catch(() => undefined);
    this.say(d, 'movie-start', 'Movie night! I brought popcorn. Pinch the screen to pause.');
    const title = MovieChoice.url ? 'Your movie' : '"Big Buck Bunny" by the Blender Foundation (CC BY 3.0)';
    d.setValue(Caption, 'text', `Movie Night: ${title}`);
    d.setValue(Caption, 'ttl', 5);
  }

  private endFilm(d: Entity): void {
    this.on = false;
    this.video?.pause();
    Timeline.log('movie', '', 0);
    d.setValue(Session, 'movieLaugh', 0);
  }

  private togglePause(): void {
    const v = this.video;
    if (!v || !this.on) return;
    if (v.paused) void v.play().catch(() => undefined);
    else v.pause();
  }

  /** The picture's average colour, a few times a second (an 8×8 downsample). */
  private sample(dt: number): void {
    this.sampleIn -= dt;
    if (this.sampleIn > 0 || !this.video || !this.sampler || this.video.readyState < 2) return;
    this.sampleIn = 0.2;
    try {
      this.sampler.drawImage(this.video, 0, 0, 8, 8);
      const px = this.sampler.getImageData(0, 0, 8, 8).data;
      let r = 0;
      let g = 0;
      let b = 0;
      for (let i = 0; i < px.length; i += 4) {
        r += px[i];
        g += px[i + 1];
        b += px[i + 2];
      }
      const n = (px.length / 4) * 255;
      this.target.setRGB(r / n, g / n, b / n);
    } catch {
      this.target.set(0xb8c4ff);
    }
  }

  private say(d: Entity, id: string, text: string): void {
    if (this.spoke.has(id)) return;
    this.spoke.add(id);
    Sound.speak(id, this.center);
    d.setValue(Caption, 'text', `Bigfoot: ${text}`);
    d.setValue(Caption, 'ttl', Math.max(3.5, text.split(' ').length * 0.42));
  }
}
