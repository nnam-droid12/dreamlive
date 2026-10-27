import {
  CanvasTexture,
  createSystem,
  Entity,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Quaternion,
  SRGBColorSpace,
  Vector3,
} from '@iwsdk/core';
import { Sound } from '../audio/engine.js';
import { Bigfoot } from '../components/bigfoot.js';
import { DevControls, DreamDirector, DreamSeed, GazeTarget } from '../components/dream.js';
import { MemoryOrb } from '../components/memory.js';
import { Ritual, RitualPhase } from '../components/ritual.js';
import { Session } from '../components/session.js';
import { RoomSlots } from '../components/stage.js';
import { Director } from '../config/director.js';
import { newBeatContext, readBeat } from '../dreams/beat-context.js';
import { NycLayout } from '../showcase/nyc-bedroom.js';
import { frameToWorld, Rooftop } from '../showcase/rooftop-layout.js';

const UP = new Vector3(0, 1, 0);
const ONE = new Vector3(1, 1, 1);
const CAM_RATE = 1.4;
const CARD_W = 1.5;

/**
 * Director mode (dev only, `?director`): drives the camera through a scripted
 * shot list that follows the real dream (no faked state), lets the camera's
 * gaze make the choices, catches what flies out of the TV, shows a title and
 * an end card, and records the app's canvas + sound to a WebM download.
 */
export class DirectorSystem extends createSystem({
  director: { required: [Ritual, DreamDirector, DevControls, Session, RoomSlots] },
  bigfoot: { required: [Bigfoot] },
  heads: { required: [GazeTarget], excluded: [DreamSeed] },
  seeds: { required: [DreamSeed, GazeTarget] },
  orbs: { required: [MemoryOrb] },
}) {
  private beat = newBeatContext();
  private camPos = new Vector3();
  private camLook = new Vector3();
  private wantPos = new Vector3();
  private wantLook = new Vector3();
  private tmp = new Vector3();
  private placed = false;
  private clock = 0;
  private awakeAt = -1;
  private camMatrix = new Matrix4();
  private headMatrix = new Matrix4();
  private camQuat = new Quaternion();
  private card!: Mesh;
  private cardMat!: MeshBasicMaterial;
  private cardCanvas!: HTMLCanvasElement;
  private cardTexture!: CanvasTexture;
  private cardShown = '';
  private recorder?: MediaRecorder;
  private chunks: Blob[] = [];
  private done = false;

  init(): void {
    this.cardCanvas = document.createElement('canvas');
    this.cardCanvas.width = 1280;
    this.cardCanvas.height = 720;
    this.cardTexture = new CanvasTexture(this.cardCanvas);
    this.cardTexture.colorSpace = SRGBColorSpace;
    this.cardMat = new MeshBasicMaterial({ map: this.cardTexture, transparent: true, opacity: 0, depthTest: false, depthWrite: false });
    this.card = new Mesh(new PlaneGeometry(CARD_W, (CARD_W * 9) / 16), this.cardMat);
    this.card.renderOrder = 1000;
    this.card.visible = false;
    this.world.createTransformEntity(this.card);
    this.hideEmulatedInputs();
  }

  update(realDelta: number): void {
    const d = this.queries.director.entities.values().next().value;
    if (!d || this.done) return;
    const phase = d.getValue(Ritual, 'phase');
    if (phase === RitualPhase.Idle) return;
    d.setValue(DevControls, 'autoCatch', true);
    this.clock += realDelta;
    if (Director.record && !this.recorder && Sound.ctx) this.startRecording();

    this.chooseShot(d, phase ?? '');
    const k = this.placed ? 1 - Math.exp(-CAM_RATE * realDelta) : 1;
    this.camPos.lerp(this.wantPos, k);
    this.camLook.lerp(this.wantLook, k);
    this.placed = true;
    this.placeCamera();
    this.updateCard(phase ?? '');
  }

  /** Where the camera wants to be and what it looks at, from the dream's real state. */
  private chooseShot(d: Entity, phase: string): void {
    const tv = this.tmp.fromArray(d.getVectorView(RoomSlots, 'anchorPoint')).clone();
    const n = new Vector3().fromArray(d.getVectorView(RoomSlots, 'anchorNormal'));
    const right = new Vector3().crossVectors(UP, n).normalize();
    const seat = new Vector3(NycLayout.seat.position.x, 1.25, NycLayout.seat.position.z);
    const middle = new Vector3().addVectors(NycLayout.bed.top, tv).multiplyScalar(0.5).setY(1.0);
    const tvCam = tv.clone().addScaledVector(n, 2.7).addScaledVector(right, 0.45).setY(1.4);
    const head = this.bigfootHead();
    const root = this.queries.bigfoot.entities.values().next().value?.object3D?.position;
    const t = d.getValue(Ritual, 'phaseTime') ?? 0;

    if (phase === RitualPhase.Arrival) {
      if (t < 4.5 || !head) this.aim(seat, middle);
      // Push in on sleeping Bigfoot; the camera's gaze resting on him starts the dream.
      else this.aim(head.clone().addScaledVector(this.toward(head, seat), 1.7).setY(1.35), head);
      return;
    }
    if (phase === RitualPhase.Asleep && readBeat(d, this.beat) && d.getValue(DreamDirector, 'chapterId') === 'rooftop-party' && d.getValue(RoomSlots, 'windowReady')) {
      this.rooftopShot(d, seat, root);
      return;
    }
    if (phase === RitualPhase.Asleep && readBeat(d, this.beat)) {
      const scene = this.beat.scene;
      if (scene === 'sleepwalk' && root) {
        const look = root.clone().setY(0.9);
        this.aim(look.clone().addScaledVector(this.toward(look, seat), 2.6).setY(1.45), look);
      } else if (scene === 'finale') {
        this.aim(seat.clone().setY(1.5), middle);
      } else if (this.beat.id.startsWith('choice')) {
        const pick = (Director.picks[d.getValue(DreamDirector, 'chapterId') ?? ''] ?? [])[this.beat.id === 'choice-1' ? 0 : 1] ?? '';
        const seed = this.seedPos(pick);
        this.aim(tvCam, this.beat.time > 1.8 && seed ? seed : tv);
      } else {
        const drift = Math.sin(this.clock * 0.12) * 0.25;
        this.aim(tvCam.clone().addScaledVector(right, drift), tv);
      }
      return;
    }
    // Waking and awake: Bigfoot, then the orb on its way to the shelf.
    if (phase === RitualPhase.Awake && this.awakeAt < 0) this.awakeAt = this.clock;
    const orb = this.flyingOrb();
    if (orb) this.aim(seat.clone().setY(1.4), orb);
    else if (head) this.aim(seat.clone().setY(1.4), head);
  }

  /**
   * Rooftop Party shots, following the real dream: over his shoulder to the
   * glass; from the room as he leaps up to the taller roof; the VIP deck over the
   * party (Bigfoot dancing, then close on the Yeti DJ); the roof's edge looking
   * down at the street as he leaps home; the room as he catches gifts; bed.
   */
  private rooftopShot(d: Entity, seat: Vector3, root: Vector3 | undefined): void {
    const f = {
      origin: new Vector3().fromArray(d.getVectorView(RoomSlots, 'windowOrigin')),
      out: new Vector3().fromArray(d.getVectorView(RoomSlots, 'windowOut')),
      along: new Vector3().fromArray(d.getVectorView(RoomSlots, 'windowAlong')),
    };
    const at = (x: number, y: number, z: number) => frameToWorld(f, { x, y, z }, new Vector3());
    const scene = this.beat.scene;
    const t = this.beat.time;
    const him = root ? root.clone().setY(root.y + 1.1) : at(Rooftop.danceSpot.x, 7.1, Rooftop.danceSpot.z);
    const dj = at(Rooftop.djSpot.x, Rooftop.djSpot.y + 1.4, Rooftop.djSpot.z);
    const deck = Rooftop.views.party.at;
    if (scene === 'to-window') {
      this.aim(t < 6.8 ? him.clone().addScaledVector(this.toward(him, seat), 2.4).setY(1.6) : at(-2.4, 1.5, 1.4), t < 6.8 ? him : at(2, 2.2, -0.5));
    } else if (scene === 'leap-out') {
      this.aim(at(-2.2, 1.3, 1.8), him);
    } else if (scene === 'arrive' || scene === 'party-wait') {
      const pick = (Director.picks['rooftop-party'] ?? [])[0] ?? '';
      const seed = this.seedPos(pick);
      this.aim(at(deck.x, deck.y + 1.3, deck.z), scene === 'party-wait' && this.beat.time > 1.8 && seed ? seed : him);
    } else if (scene.startsWith('party-')) {
      if (t < 12) this.aim(at(deck.x - 1.0, deck.y + 1.4, deck.z - 0.4), him);
      else this.aim(at(Rooftop.djSpot.x + 2.6, Rooftop.djSpot.y + 1.6, Rooftop.djSpot.z + 3.0), dj);
    } else if (scene === 'leap-back') {
      // From the party roof's edge: the street far below, his tower and window across.
      const e = Rooftop.views.edge.at;
      this.aim(at(e.x + 0.4, e.y + 1.5, e.z + 0.8), t < 2.5 ? him : at(1.5, -8, -0.5).lerp(him, 0.6));
    } else if (scene === 'gifts') {
      this.aim(at(-3.3, 1.5, 2.6), him.clone().lerp(at(Rooftop.insideSpot.x + 0.5, 1.3, 0), 0.5));
    } else if (scene === 'to-bed' && root) {
      const look = root.clone().setY(0.9);
      this.aim(look.clone().addScaledVector(this.toward(look, seat), 2.6).setY(1.45), look);
    } else {
      this.aim(seat, dj);
    }
  }

  private aim(pos: Vector3, look: Vector3): void {
    this.wantPos.copy(pos);
    this.wantLook.copy(look);
  }

  /** Horizontal unit vector from `from` toward `to`. */
  private toward(from: Vector3, to: Vector3): Vector3 {
    return new Vector3().subVectors(to, from).setY(0).normalize();
  }

  private bigfootHead(): Vector3 | undefined {
    for (const e of this.queries.heads.entities) if (e.object3D) return e.object3D.position.clone();
    return undefined;
  }

  private seedPos(id: string): Vector3 | undefined {
    for (const s of this.queries.seeds.entities) {
      if (s.getValue(DreamSeed, 'seedId') === id) return new Vector3().fromArray(s.getVectorView(GazeTarget, 'worldPos'));
    }
    return undefined;
  }

  private flyingOrb(): Vector3 | undefined {
    for (const o of this.queries.orbs.entities) {
      if ((o.getValue(MemoryOrb, 'slot') ?? -1) < 0 && o.object3D) return o.object3D.position.clone();
    }
    return undefined;
  }

  /** Moves the player rig so the emulated head (wherever it sits in the rig) sees the shot. */
  private placeCamera(): void {
    this.camMatrix.lookAt(this.camPos, this.camLook, UP);
    this.camQuat.setFromRotationMatrix(this.camMatrix);
    this.camMatrix.compose(this.camPos, this.camQuat, ONE);
    // The head's pose inside the rig, from world matrices (whatever sits between them).
    this.player.updateMatrixWorld(true);
    this.headMatrix.copy(this.player.matrixWorld).invert().multiply(this.player.head.matrixWorld).invert();
    this.camMatrix.multiply(this.headMatrix);
    this.camMatrix.decompose(this.player.position, this.player.quaternion, this.tmp);
  }

  /** Title card at the start, end card once he's awake and the orb is shelved. */
  private updateCard(phase: string): void {
    let want = '';
    if (this.clock < 4.5) want = 'title';
    if (this.awakeAt >= 0 && this.clock - this.awakeAt > 9) want = 'end';
    if (want && want !== this.cardShown) this.drawCard(want);
    this.cardMat.opacity += ((want ? 1 : 0) - this.cardMat.opacity) * 0.08;
    this.card.visible = this.cardMat.opacity > 0.01;
    if (this.card.visible) {
      const head = this.player.head;
      head.getWorldPosition(this.card.position);
      head.getWorldQuaternion(this.card.quaternion);
      this.card.translateZ(-0.9);
    }
    if (phase === RitualPhase.Awake && want === 'end' && this.clock - this.awakeAt > 9 + Director.endCardSec) this.finish();
  }

  private drawCard(kind: string): void {
    this.cardShown = kind;
    const g = this.cardCanvas.getContext('2d');
    if (!g) return;
    const W = 1280;
    g.clearRect(0, 0, W, 720);
    g.fillStyle = kind === 'end' ? 'rgba(8, 10, 30, 0.88)' : 'rgba(8, 10, 30, 0.55)';
    g.beginPath();
    g.roundRect(80, 150, W - 160, 420, 40);
    g.fill();
    g.textAlign = 'center';
    g.fillStyle = '#fdfcff';
    g.font = '700 120px system-ui, "Segoe UI", Roboto, sans-serif';
    g.fillText('DREAMLIVE', W / 2, 310);
    g.font = '500 44px system-ui, "Segoe UI", Roboto, sans-serif';
    g.fillStyle = '#ffd89a';
    g.fillText(kind === 'end' ? 'Every night, a new dream.' : 'Bigfoot is asleep. Look at him...', W / 2, 390);
    if (kind === 'end') {
      g.fillStyle = '#c9d4ff';
      g.font = '400 32px system-ui, "Segoe UI", Roboto, sans-serif';
      g.fillText('Built with Immersive Web SDK for Meta Quest and Meta VR Glasses', W / 2, 460);
      g.fillText('nnam-droid12.github.io/dreamlive', W / 2, 515);
    }
    this.cardTexture.needsUpdate = true;
  }

  private startRecording(): void {
    const canvas = this.renderer.domElement as HTMLCanvasElement & { captureStream?: (fps: number) => MediaStream };
    if (!canvas.captureStream || typeof MediaRecorder === 'undefined') return;
    const stream = new MediaStream(canvas.captureStream(30).getVideoTracks());
    for (const track of Sound.recordStream()?.getAudioTracks() ?? []) stream.addTrack(track);
    const type = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((t) => MediaRecorder.isTypeSupported(t));
    this.recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 8_000_000 });
    this.recorder.ondataavailable = (e) => {
      if (e.data.size) this.chunks.push(e.data);
    };
    this.recorder.onstop = () => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob(this.chunks, { type: 'video/webm' }));
      a.download = Director.fileName;
      a.click();
    };
    this.recorder.start(1000);
  }

  private finish(): void {
    this.done = true;
    if (this.recorder?.state === 'recording') this.recorder.stop();
  }

  /** The emulator's floating hand/controller models would sit in every shot. */
  private hideEmulatedInputs(): void {
    const device = (window as unknown as { IWER_DEVICE?: Record<string, Record<string, { connected?: boolean }> | undefined> }).IWER_DEVICE;
    for (const group of [device?.hands, device?.controllers]) {
      for (const side of ['left', 'right']) {
        const input = group?.[side];
        if (input && 'connected' in input) input.connected = false;
      }
    }
  }
}
