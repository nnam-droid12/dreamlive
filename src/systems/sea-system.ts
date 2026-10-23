import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  createSystem,
  DoubleSide,
  Entity,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  Points,
  ShaderMaterial,
  SRGBColorSpace,
  Vector3,
  VisibilityState,
} from '@iwsdk/core';
import { LoopHandle, Sound } from '../audio/engine.js';
import { DevControls, DreamDirector } from '../components/dream.js';
import { Gestures } from '../components/hands.js';
import { Ritual, RitualPhase } from '../components/ritual.js';
import { StageAnchor, StageSurface } from '../components/stage.js';
import { Palette } from '../config/palette.js';
import { Tuning } from '../config/tuning.js';
import { newBeatContext, readBeat } from '../dreams/beat-context.js';
import { makeRainMaterial } from '../visuals/glow-materials.js';
import { makeSeaMaterial } from '../visuals/paper-sea.js';
import { drawPalmOutline } from './palm-guide-system.js';

const RAIN_COUNT = 240;
const RAIN_HEIGHT = 0.45;
const SLEEPER_Z = 0.078;
const RECEDE_PER_SEC = 1 / 6;

/**
 * The paper sea and its storm: the sea grows out of a calm pool around the
 * sleeping Dreamer, clipped to the real table; during the storm, rain falls
 * upward from the table edges until it passes or a flat palm hushes it.
 */
export class SeaSystem extends createSystem({
  director: { required: [DreamDirector, Ritual, DevControls, StageSurface, Gestures] },
  stage: { required: [StageAnchor] },
}) {
  private sea?: Mesh;
  private seaMat?: ShaderMaterial;
  private rainMat?: ShaderMaterial;
  private hushHint?: Mesh;
  private hushMat?: MeshBasicMaterial;
  private waves?: LoopHandle;
  private rain?: LoopHandle;
  private beat = newBeatContext();
  private rise = 0;
  private storm = 0;
  private time = 0;
  private lastScene = '';
  private center = new Vector3();

  update(realDelta: number): void {
    if (this.visibilityState.peek() !== VisibilityState.Visible) return;
    const d = this.queries.director.entities.values().next().value;
    if (!d) return;
    const delta = realDelta * (d.getValue(DevControls, 'timeScale') ?? 1);
    const dreaming = readBeat(d, this.beat);
    if (!this.sea) {
      if (!dreaming) return;
      const stage = this.queries.stage.entities.values().next().value?.object3D;
      if (!stage) return;
      this.build(d, stage);
    }
    this.time += delta;
    const phase = d.getValue(Ritual, 'phase');
    const scene = this.beat.scene;
    if (scene !== this.lastScene) this.onScene(scene);

    if (phase === RitualPhase.Waking || phase === RitualPhase.Awake) {
      this.rise = Math.max(0, this.rise - delta * RECEDE_PER_SEC);
    } else {
      const target = scene === 'sea-rise' ? Math.min(1, this.beat.progress * 1.25) : 1;
      this.rise += (target - this.rise) * Math.min(1, delta * 2);
    }
    const stormTarget = scene === 'storm' && phase === RitualPhase.Asleep ? 1 : 0;
    this.storm += (stormTarget - this.storm) * Math.min(1, delta * (stormTarget ? 0.6 : 1.2));

    this.seaMat!.uniforms.time.value = this.time;
    this.seaMat!.uniforms.rise.value = this.rise;
    this.seaMat!.uniforms.storm.value = this.storm;
    this.sea!.visible = this.rise > 0.001;
    this.rainMat!.uniforms.time.value = this.time;
    this.rainMat!.uniforms.opacity.value = this.storm;
    this.waves?.setGain(this.rise * (0.45 + this.storm * 0.5));
    this.rain?.setGain(this.storm * 0.5);
    this.updateHush(d, scene);
  }

  /** Storm hush: a flat palm held over the stage ends the storm beat early. */
  private updateHush(d: Entity, scene: string): void {
    const storming = scene === 'storm';
    const hold = d.getValue(Gestures, 'hushHold') ?? 0;
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 2.4);
    this.hushMat!.opacity = storming ? 0.18 + 0.15 * pulse + 0.6 * (hold / Tuning.gestures.hushHoldSec) : 0;
    this.hushHint!.visible = storming;
    if (storming && d.getValue(Gestures, 'hush') && !d.getValue(DreamDirector, 'signal')) {
      d.setValue(DreamDirector, 'signal', 'hush');
      Sound.play('hush', this.center);
    }
  }

  private onScene(scene: string): void {
    this.lastScene = scene;
    if (scene === 'storm') Sound.play('rainStart', this.center, 0.7);
  }

  private build(d: Entity, stage: Object3D): void {
    const width = d.getValue(StageSurface, 'width') ?? 0.6;
    const depth = d.getValue(StageSurface, 'depth') ?? 0.4;
    this.seaMat = makeSeaMaterial(width, depth);
    this.seaMat.uniforms.pool.value.set(0, SLEEPER_Z);
    this.sea = new Mesh(new PlaneGeometry(width, depth), this.seaMat);
    this.sea.name = 'PaperSea';
    this.sea.rotation.x = -Math.PI / 2;
    this.sea.position.y = 0.004;
    this.sea.renderOrder = 1;
    stage.add(this.sea);

    const pos = new Float32Array(RAIN_COUNT * 3);
    const seed = new Float32Array(RAIN_COUNT);
    const perimeter = 2 * (width + depth);
    for (let i = 0; i < RAIN_COUNT; i++) {
      let s = ((i * 0.618034) % 1) * perimeter;
      let x: number;
      let z: number;
      if (s < width) [x, z] = [s - width / 2, -depth / 2];
      else if ((s -= width) < depth) [x, z] = [width / 2, s - depth / 2];
      else if ((s -= depth) < width) [x, z] = [width / 2 - s, depth / 2];
      else [x, z] = [-width / 2, depth / 2 - (s - width)];
      pos.set([x, 0.005, z], i * 3);
      seed[i] = (i * 0.754877) % 1;
    }
    const rainGeo = new BufferGeometry();
    rainGeo.setAttribute('position', new BufferAttribute(pos, 3));
    rainGeo.setAttribute('seed', new BufferAttribute(seed, 1));
    this.rainMat = makeRainMaterial(Palette.moonBlueSoft, RAIN_HEIGHT);
    const rain = new Points(rainGeo, this.rainMat);
    rain.name = 'UpwardRain';
    rain.frustumCulled = false;
    stage.add(rain);

    const tex = new CanvasTexture(drawPalmOutline());
    tex.colorSpace = SRGBColorSpace;
    this.hushMat = new MeshBasicMaterial({
      map: tex,
      color: Palette.moonBlueSoft,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: DoubleSide,
    });
    this.hushHint = new Mesh(new PlaneGeometry(0.16, 0.16), this.hushMat);
    this.hushHint.name = 'HushHint';
    this.hushHint.rotation.x = -Math.PI / 2;
    this.hushHint.position.set(0, 0.16, -0.02);
    this.hushHint.visible = false;
    stage.add(this.hushHint);

    stage.getWorldPosition(this.center);
    this.waves = Sound.loop('waves', this.center, 0);
    this.rain = Sound.loop('rain', this.center, 0);
  }
}
