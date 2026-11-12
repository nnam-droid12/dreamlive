import {
  AdditiveBlending,
  CanvasTexture,
  SRGBColorSpace,
  Color,
  Euler,
  createSystem,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  TextureLoader,
  DirectionalLight,
  Entity,
  Group,
  HemisphereLight,
  Object3D,
  ShaderMaterial,
  Sprite,
  SpriteMaterial,
  Quaternion,
  Vector3,
  VisibilityState,
} from '@iwsdk/core';
import { Sound } from '../audio/engine.js';
import { Ritual } from '../components/ritual.js';
import { Session } from '../components/session.js';
import { RoomSlots } from '../components/stage.js';
import { Palette } from '../config/palette.js';
import { Showcase } from '../config/showcase.js';
import { Tuning } from '../config/tuning.js';
import { buildLighthouse } from '../scene-assets/lighthouse.scene-asset.js';
import { buildSurfboard } from '../scene-assets/surfboard.scene-asset.js';
import { buildRowboat, dressRowboat, ROWBOAT } from '../scene-assets/rowboat.scene-asset.js';
import { SeaWeather } from './lib/sea-weather.js';
import { buildWhale } from '../scene-assets/whale.scene-asset.js';
import { NycLayout } from '../showcase/nyc-bedroom.js';
import { buildBeam, FloodWater, Lightning, Ocean, StormClouds, swellHeight, swellSlope } from '../visuals/sea-fx.js';
import { cloudTexture } from '../visuals/soft-sprites.js';
import { WorldKit, WorldSpots } from './lib/world-kit.js';

const cfg = Tuning.sea;

interface Whale {
  obj: Object3D;
  flukes?: Object3D;
  angle: number;
  radius: number;
  speed: number;
  /** Seconds into a breach (<0 = swimming, waiting `wait`). */
  breach: number;
  wait: number;
  splashed: boolean;
}

interface Splash {
  sprite: Sprite;
  age: number;
  vel: Vector3;
  size: number;
}

/**
 * Dream world E, Storm at Sea. The room stands at the edge of a wild night
 * ocean: Gerstner swells with foam on the crests and green light through
 * them, storm clouds rolling overhead, rain, and lightning that splits the sky
 * (the clouds, the sea and the room flash, thunder rolls in a moment later).
 * A lighthouse sweeps its beam across the water, humpback whales breach, and
 * Bigfoot surfs the swells out of the window. The storm has flooded the room
 * ankle-deep: rain rings the water, and a hand dipped in sends out ripples.
 */
export class SeaWorldSystem extends createSystem({
  director: { required: [Ritual, Session, RoomSlots] },
}) {
  /** The head's orientation in the world (the rig may be turned, e.g. by the Director). */
  private headQ = new Quaternion();
  private kit = new WorldKit('sea');
  private root!: Group;
  private ocean!: Ocean;
  private clouds!: StormClouds;
  private bolt!: Lightning;
  private flood!: FloodWater;
  private lighthouse!: Object3D;
  private beam!: Object3D;
  private beamMats: ShaderMaterial[] = [];
  private board!: Object3D;
  private boat!: Group;
  private room?: Object3D;
  private hidRoom = false;
  private sunDisc!: Mesh;
  private sunGlow!: Sprite;
  private sunLight!: DirectionalLight;
  private sunBeams: Mesh[] = [];
  private beamAxis = new Vector3(1, 0, 0);
  private sunDir = new Vector3();
  private cloudDark = new Color();
  private yawQ = new Quaternion();
  private tiltQ = new Quaternion();
  private boatYaw = 0;
  private whales: Whale[] = [];
  private splashes: Splash[] = [];
  private light!: DirectionalLight;
  private fill!: HemisphereLight;
  private windowAt = new Vector3();
  private out = new Vector3(1, 0, 0);
  private along = new Vector3(0, 0, 1);
  private center = new Vector3();
  private head = new Vector3();
  private fwd = new Vector3();
  private tmp = new Vector3();
  private tmp2 = new Vector3();
  private slope = { x: 0, z: 0 };
  private tiltE = new Euler();
  private tmpColor = new Color();
  private time = 0;
  private strikeIn = 0;
  private flash = 0;
  private boltAge = -1;
  private thunderIn = -1;
  private strikes = 0;
  private cheer = 0;
  private surfPhase = 0;
  private sprayIn = 0;
  private rainIn = 0;
  private dipped = [false, false];
  private waves?: ReturnType<typeof Sound.loop>;

  init(): void {
    this.root = new Group();
    this.root.name = 'SeaWorld';
    this.root.visible = false;
    this.ocean = new Ocean(cfg.oceanSize, cfg.oceanSegments, cfg.waves, {
      deep: Palette.oceanDeep,
      scatter: Palette.oceanScatter,
      foam: Palette.oceanFoam,
      sky: Palette.oceanSky,
      horizon: Palette.oceanHorizon,
    });
    this.clouds = new StormClouds(180, Palette.stormCloud, Palette.stormCloudLit);
    this.bolt = new Lightning(Palette.lightning);
    this.root.add(this.ocean.mesh, this.clouds.mesh, this.bolt.mesh);

    // The flood over the room floor.
    const R = NycLayout.room;
    this.flood = Showcase.enabled ? new FloodWater(R.maxX - R.minX, R.maxZ - R.minZ, Palette.floodWater) : new FloodWater(5, 5, Palette.floodWater);
    if (Showcase.enabled) this.flood.mesh.position.set((R.minX + R.maxX) / 2, cfg.floodDepth, (R.minZ + R.maxZ) / 2);
    this.root.add(this.flood.mesh);

    // The lighthouse and its turning beam.
    this.lighthouse = buildLighthouse();
    const lamp = this.lighthouse.getObjectByName('Lamp');
    this.beam = new Group();
    const b1 = buildBeam(140, 9, Palette.lighthouseLamp);
    const b2 = buildBeam(140, 9, Palette.lighthouseLamp);
    b2.rotation.y = Math.PI;
    this.beam.add(b1, b2);
    this.beamMats = [b1.material as ShaderMaterial, b2.material as ShaderMaterial];
    (lamp ?? this.lighthouse).add(this.beam);
    this.root.add(this.lighthouse);

    // Bigfoot's board, and the whales.
    this.board = buildSurfboard();
    this.board.scale.setScalar(1.15);
    this.board.visible = false;
    this.root.add(this.board);
    // Bigfoot's rowboat (he rides out the storm in it), and the sun that breaks through.
    this.boat = buildRowboat();
    this.boat.scale.setScalar(cfg.boatScale);
    dressRowboat(this.boat, new TextureLoader());
    this.root.add(this.boat);
    this.sunDisc = new Mesh(new SphereGeometry(6, 24, 16), new MeshBasicMaterial({ color: Palette.seaSun, transparent: true, opacity: 0, toneMapped: false, fog: false }));
    this.sunGlow = new Sprite(new SpriteMaterial({ map: radialGlow(), color: Palette.seaSunGlow, transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending, fog: false }));
    this.sunGlow.scale.setScalar(120);
    this.root.add(this.sunDisc, this.sunGlow);
    // Sunbeams: long soft shafts fanning down from the sun through the parting clouds.
    for (let i = 0; i < 6; i++) {
      const beam = buildBeam(190, 9 + i * 2.5, Palette.seaSunGlow);
      beam.renderOrder = 3;
      this.sunBeams.push(beam);
      this.root.add(beam);
    }
    this.sunLight = new DirectionalLight(Palette.seaSunLight, 0);
    for (let i = 0; i < cfg.whales; i++) {
      const obj = buildWhale();
      const [r0, r1] = cfg.whaleRadius;
      this.whales.push({
        obj,
        flukes: obj.getObjectByName('Flukes') ?? undefined,
        angle: i * 2.4,
        radius: r0 + (i / Math.max(1, cfg.whales - 1)) * (r1 - r0),
        speed: 0.012 + i * 0.004,
        breach: -1,
        wait: 6 + i * 9,
        splashed: false,
      });
      this.root.add(obj);
    }
    // Spray: soft white puffs thrown up where a whale breaks the surface.
    const tex = cloudTexture(9, 128);
    for (let i = 0; i < 40; i++) {
      const sprite = new Sprite(new SpriteMaterial({ map: tex, color: Palette.oceanFoam, transparent: true, depthWrite: false, opacity: 0 }));
      sprite.visible = false;
      this.root.add(sprite);
      this.splashes.push({ sprite, age: -1, vel: new Vector3(), size: 1 });
    }

    this.light = new DirectionalLight(Palette.lightning, 0);
    this.light.position.set(60, 80, 0);
    this.fill = new HemisphereLight(Palette.stormFill, Palette.stormGround, 0);
    this.world.createTransformEntity(this.root);
    for (const l of [this.light, this.light.target, this.fill, this.sunLight, this.sunLight.target]) this.world.createTransformEntity(l);
    this.cloudDark.copy(this.clouds.uniforms.uDark.value);
  }

  update(realDelta: number): void {
    if (this.visibilityState.peek() !== VisibilityState.Visible) return;
    const d = this.queries.director.entities.values().next().value;
    if (!d) return;
    const dt = Math.min(realDelta, 0.1);
    if (this.kit.step(d, dt, 0.5)) this.begin(d);
    const k = this.kit.amount;
    // The sea and the bedroom never show together: arriving, the room steps away at once and the sea fades in;
    // leaving, the sea stays until the room comes back. (So the boat is never seen inside the room.)
    this.root.visible = Showcase.enabled ? (this.kit.on ? k > 0.02 : k > 0.5) : k > 0 && (this.kit.on || k > 0.3);
    this.waves?.setGain(k * 0.9 * (0.3 + 0.7 * SeaWeather.storm) * (1 - 0.5 * SeaWeather.sun));
    if (!this.root.visible) {
      this.light.intensity = 0;
      this.fill.intensity = 0;
      this.sunLight.intensity = 0;
      this.hideRoom(false);
      return;
    }
    this.time += dt;
    this.player.head.getWorldPosition(this.head);
    this.fwd.set(0, 0, -1).applyQuaternion(this.player.head.getWorldQuaternion(this.headQ)).setY(0);
    if (this.fwd.lengthSq() < 1e-4) this.fwd.set(0, 0, -1);
    this.fwd.normalize();
    this.kit.readHands(this.player.gripSpaces.left, this.player.gripSpaces.right, dt);

    this.lightningTick(d, dt);
    const u = this.ocean.uniforms;
    u.uTime.value = this.time;
    u.uOpacity.value = k;
    u.uFlash.value = this.flash;
    u.uCenter.value.copy(this.center);
    this.weather(k);
    this.hideRoom(true);
    this.clouds.uniforms.uTime.value = this.time;
    this.clouds.uniforms.uOpacity.value = k;
    this.clouds.uniforms.uFlash.value = this.flash;
    this.clouds.mesh.position.set(this.head.x, 0, this.head.z);
    this.light.intensity = k * (cfg.stormLight + this.flash * cfg.flash);
    this.fill.intensity = k * (cfg.stormFill + this.flash * 1.5);

    // The lighthouse beam turns.
    this.beam.rotation.y = (this.time / 60) * cfg.beamRpm * Math.PI * 2;
    for (const m of this.beamMats) m.uniforms.uOpacity.value = k;

    if (WorldSpots.strikeNow) {
      WorldSpots.strikeNow = false;
      this.strikeIn = 0;
    }
    if (WorldSpots.breachNow && this.whales[0]?.breach < 0) {
      WorldSpots.breachNow = false;
      this.whales[0].wait = 0;
    }
    this.rowboat(d, dt);
    WorldSpots.board.copy(this.boat.position);
    if (this.whales[0]) WorldSpots.whale.copy(this.whales[0].obj.position);
    this.swimWhales(d, dt);
    this.spray(dt, k);
    this.floodTick(dt, k);
    if (this.cheer > 0) this.cheer -= dt;
  }

  private begin(d: Entity): void {
    const o = d.getVectorView(RoomSlots, 'windowOrigin');
    const out = d.getVectorView(RoomSlots, 'windowOut');
    const al = d.getVectorView(RoomSlots, 'windowAlong');
    this.player.head.getWorldPosition(this.head);
    this.fwd.set(0, 0, -1).applyQuaternion(this.player.head.getWorldQuaternion(this.headQ)).setY(0).normalize();
    if (out[0] || out[2]) {
      this.out.set(out[0], 0, out[2]).normalize();
      this.along.set(al[0], 0, al[2]).normalize();
      this.windowAt.set(o[0], 0, o[2]);
    } else {
      this.out.copy(this.fwd);
      this.along.set(-this.fwd.z, 0, this.fwd.x);
      this.windowAt.copy(this.head).setY(0).addScaledVector(this.fwd, 1.5);
    }
    this.center.copy(this.windowAt);
    this.ocean.mesh.position.set(this.center.x, cfg.seaY, this.center.z);
    this.lighthouse.position.copy(this.windowAt).addScaledVector(this.out, cfg.lighthouseOut).addScaledVector(this.along, -cfg.lighthouseSide);
    this.lighthouse.position.y = cfg.seaY;
    if (!Showcase.enabled) this.flood.mesh.position.set(this.head.x, cfg.floodDepth, this.head.z);
    this.strikeIn = cfg.firstStrike;
    this.strikes = 0;
    this.surfPhase = 0;
    if (!this.waves) this.waves = Sound.loop('waves', this.tmp.copy(this.windowAt).addScaledVector(this.out, 8), 0);
    this.kit.preload(['sea-hello', 'sea-thunder', 'sea-whale']);
    this.kit.caption(d, 'Storm at Sea');
  }

  /** Lightning: a bolt, the flash on clouds, sea and room, thunder after the light. */
  private lightningTick(d: Entity, dt: number): void {
    this.strikeIn -= dt * (0.3 + 1.7 * SeaWeather.storm);
    if (SeaWeather.thunderNow) {
      SeaWeather.thunderNow = false;
      this.strikeIn = 0;
    }
    if (this.strikeIn <= 0 && (SeaWeather.storm < 0.25 || SeaWeather.sun > 0.6)) this.strikeIn = 1;
    if (this.strikeIn <= 0) {
      const [g0, g1] = cfg.strikeGap;
      this.strikeIn = g0 + Math.random() * (g1 - g0);
      const r = cfg.strikeNear + Math.random() * (cfg.strikeFar - cfg.strikeNear);
      const side = (Math.random() - 0.5) * 1.6;
      const to = this.tmp.copy(this.windowAt).addScaledVector(this.out, r).addScaledVector(this.along, side * r * 0.6);
      to.y = cfg.seaY;
      const from = this.tmp2.copy(to);
      from.x += (Math.random() - 0.5) * 30;
      from.y += 95;
      from.z += (Math.random() - 0.5) * 30;
      this.bolt.strike(from, to, this.head, 0.5 + r * 0.006);
      this.boltAge = 0;
      this.clouds.uniforms.uFlashDir.value.subVectors(from, this.head).normalize();
      this.light.position.copy(from);
      this.light.target.position.copy(this.head);
      this.thunderIn = Math.min(3, r / 340 + 0.3);
      this.strikes++;
      this.cheer = 1.6;
    }
    if (this.boltAge >= 0) {
      // Two or three bright pulses, then gone.
      this.boltAge += dt;
      const t = this.boltAge;
      const pulse = t < 0.08 ? 1 : t < 0.14 ? 0.25 : t < 0.24 ? 0.9 : t < 0.32 ? 0.2 : t < 0.42 ? 0.6 : Math.max(0, 0.6 - (t - 0.42) * 3);
      this.flash = pulse;
      this.bolt.level = pulse * this.kit.amount;
      if (t > 0.7) {
        this.boltAge = -1;
        this.flash = 0;
        this.bolt.level = 0;
      }
    }
    if (this.thunderIn >= 0) {
      this.thunderIn -= dt;
      if (this.thunderIn < 0) {
        Sound.play('thunder', this.tmp.copy(this.windowAt).addScaledVector(this.out, 40), 1);
        if (this.strikes === 2) this.kit.say(d, 'sea-thunder', "Ha! Thunder doesn't scare me!", this.board.position);
      }
    }
  }

  /** Bigfoot rides the swells out of the window, carving to and fro. */
  /**
   * Bigfoot surfs right outside the window: big fast carves across the swell at
   * first, spray flying off the board, then gradually easing into a slow,
   * relaxed glide. He leans into each turn.
   */
  /** At sea there is only the sea: the showcase bedroom (and the floodwater in it) steps away. */
  private hideRoom(hide: boolean): void {
    if (!Showcase.enabled) return;
    this.room ??= this.scene.getObjectByName('NycBedroom') ?? undefined;
    if (!this.room) return;
    // Only give the room back if the sea took it (another world may be holding it).
    if (hide) {
      this.room.visible = false;
      this.hidRoom = true;
    } else if (this.hidRoom) {
      this.room.visible = true;
      this.hidRoom = false;
    }
    this.flood.mesh.visible = false;
  }

  /**
   * Storm and sunshine (SeaWeather, from the console and your gestures): the
   * swells' height, the clouds parting, the sun low over the sea with its glitter
   * path and warm light, the storm light fading.
   */
  private weather(k: number): void {
    const storm = SeaWeather.storm;
    const sun = SeaWeather.sun;
    const u = this.ocean.uniforms;
    u.uAmp.value = cfg.calmAmp + (1 - cfg.calmAmp) * storm * (1 - 0.6 * sun);
    u.uSun.value = sun;
    // The sun: low over the sea, a little to one side, rising as it breaks through.
    const el = (cfg.sunLowDeg + (cfg.sunHighDeg - cfg.sunLowDeg) * sun) * (Math.PI / 180);
    const az = cfg.sunAzimuthDeg * (Math.PI / 180);
    this.sunDir.copy(this.out).multiplyScalar(Math.cos(az) * Math.cos(el)).addScaledVector(this.along, Math.sin(az) * Math.cos(el));
    this.sunDir.y = Math.sin(el);
    this.sunDir.normalize();
    u.uSunDir.value.copy(this.sunDir);
    this.sunDisc.position.copy(this.center).addScaledVector(this.sunDir, 170);
    this.sunGlow.position.copy(this.sunDisc.position).addScaledVector(this.sunDir, -3);
    (this.sunDisc.material as MeshBasicMaterial).opacity = k * Math.min(1, sun * 1.6);
    (this.sunGlow.material as SpriteMaterial).opacity = k * Math.min(1, sun * 1.3);
    // The shafts fan down toward the sea around the line to us, swaying slowly.
    this.sunBeams.forEach((b, i) => {
      b.visible = sun > 0.05;
      b.position.copy(this.sunDisc.position);
      const spread = (i - 2.5) * 0.1 + Math.sin(this.time * 0.1 + i) * 0.02;
      this.tmp2.copy(this.center).addScaledVector(this.along, spread * 150).sub(b.position).normalize();
      b.quaternion.setFromUnitVectors(this.beamAxis, this.tmp2);
      (b.material as ShaderMaterial).uniforms.uOpacity.value = k * sun * (0.22 + 0.08 * Math.sin(this.time * 0.4 + i * 1.7));
    });
    this.sunDisc.visible = this.sunGlow.visible = sun > 0.01;
    this.sunLight.position.copy(this.sunDisc.position);
    this.sunLight.target.position.copy(this.center);
    this.sunLight.intensity = k * sun * cfg.sunLight;
    // The clouds thin and lighten as the sun breaks through; the storm's light fades.
    this.clouds.uniforms.uOpacity.value = k * (1 - 0.92 * sun) * (0.55 + 0.45 * storm);
    this.clouds.uniforms.uDark.value.copy(this.cloudDark).lerp(this.tmpColor.setHex(Palette.seaCloudSunlit), sun * 0.8);
    this.fill.intensity = k * (cfg.stormFill * (1 - sun) + this.flash * 1.5 + sun * cfg.sunFill);
  }

  /**
   * Bigfoot rides out the storm in his rowboat, a little way out of the window:
   * the stern toward you, the boat heaving and rolling on the real swells; he
   * sits on the middle thwart facing you, gripping both gunwales.
   */
  private rowboat(d: Entity, dt: number): void {
    const amp = this.ocean.uniforms.uAmp.value;
    const p = this.tmp.copy(this.windowAt).addScaledVector(this.out, cfg.boatOut).addScaledVector(this.along, cfg.boatSide);
    // A slow drift on the swell, so it never sits dead still.
    p.addScaledVector(this.along, Math.sin(this.time * 0.13) * 0.6);
    const y = cfg.seaY + swellHeight(cfg.waves, p.x, p.z, this.time) * amp;
    swellSlope(cfg.waves, p.x, p.z, this.time, this.slope);
    // Bow away from the window, quartering, so we see into the boat and Bigfoot's face.
    this.boatYaw = Math.atan2(this.out.x, this.out.z) + cfg.boatQuarterDeg * (Math.PI / 180);
    this.yawQ.setFromAxisAngle(this.tmp2.set(0, 1, 0), this.boatYaw);
    // Pitch and roll from the slope under it (world frame), applied on top of the heading.
    const pitch = Math.atan(-(this.slope.x * Math.sin(this.boatYaw) + this.slope.z * Math.cos(this.boatYaw)) * amp);
    const roll = Math.atan((this.slope.x * Math.cos(this.boatYaw) - this.slope.z * Math.sin(this.boatYaw)) * amp);
    this.tiltQ.setFromEuler(this.tiltE.set(pitch, 0, roll, 'YXZ'));
    this.boat.quaternion.copy(this.yawQ).multiply(this.tiltQ);
    this.boat.position.set(p.x, y, p.z);
    this.boat.updateMatrixWorld(true);
    this.ocean.uniforms.uBoatInv.value.copy(this.boat.matrixWorld).invert();
    this.ocean.uniforms.uBoat.value = 1;
    // Bigfoot on the middle thwart, facing the stern (and you); his hands on the gunwales.
    WorldSpots.seatQ.copy(this.boat.quaternion).multiply(this.yawQ.invert());
    this.boat.localToWorld(this.tmp2.set(0, ROWBOAT.seatTop, ROWBOAT.midSeatZ));
    // (Facing the stern, his left hand is on the boat's -X side.)
    this.boat.localToWorld(WorldSpots.holdL.set(-0.6, ROWBOAT.seatTop + 0.22, ROWBOAT.midSeatZ - 0.05));
    this.boat.localToWorld(WorldSpots.holdR.set(0.6, ROWBOAT.seatTop + 0.22, ROWBOAT.midSeatZ - 0.05));
    WorldSpots.hold = SeaWeather.sun < 0.6;
    this.kit.placeBigfoot(d, this.tmp2, this.boatYaw + Math.PI, 'sit');
    void dt;
  }

  private swimWhales(d: Entity, dt: number): void {
    const base = Math.atan2(this.out.z, this.out.x);
    for (const w of this.whales) {
      w.angle += w.speed * dt;
      const a = base + Math.sin(w.angle) * 0.9;
      const near = w.radius * (1 - 0.4 * SeaWeather.whales);
      const x = this.windowAt.x + Math.cos(a) * near;
      const z = this.windowAt.z + Math.sin(a) * near;
      const heading = Math.atan2(-Math.sin(a) * Math.cos(w.angle), Math.cos(a) * Math.cos(w.angle)) + Math.PI / 2;
      if (w.breach < 0) {
        // Cruising just under the surface; the back and the flukes show now and then.
        w.wait -= dt * (1 + 3 * SeaWeather.whales);
        const roll = Math.sin(this.time * 0.6 + w.radius);
        w.obj.position.set(x, cfg.seaY - 1.6 + roll * 0.9, z);
        w.obj.rotation.set(-roll * 0.08, heading, 0);
        if (w.flukes) w.flukes.rotation.x = Math.sin(this.time * 1.4 + w.radius) * 0.25;
        if (w.wait <= 0) {
          w.breach = 0;
          w.splashed = false;
          Sound.play('whale', w.obj.position, 1);
        }
      } else {
        // The breach: up out of the water nose first, twisting, then crashing down on its back.
        w.breach += dt;
        const t = w.breach / cfg.breachSec;
        const lift = Math.sin(Math.PI * Math.min(1, t)) * 9;
        w.obj.position.set(x, cfg.seaY - 4 + lift, z);
        w.obj.rotation.set(-1.1 * (1 - t * 1.6), heading, t * 1.8);
        if (!w.splashed && t > 0.12) {
          w.splashed = true;
          this.burst(this.tmp.set(x, cfg.seaY, z), 10);
          this.kit.say(d, 'sea-whale', 'Look, a whale! Did you see that?', w.obj.position);
          this.cheer = 2.5;
        }
        if (t > 0.85 && w.splashed) {
          this.burst(this.tmp.set(x, cfg.seaY, z), 14);
          w.splashed = false;
          w.breach = cfg.breachSec * 2; // done
        }
        if (t >= 1) {
          const [g0, g1] = cfg.breachGap;
          w.breach = -1;
          w.wait = g0 + Math.random() * (g1 - g0);
        }
      }
    }
  }

  private burst(at: Vector3, n: number, size = 1): void {
    let made = 0;
    for (const s of this.splashes) {
      if (s.age >= 0) continue;
      s.age = 0;
      s.size = (2 + Math.random() * 3) * size;
      s.sprite.position.copy(at).add(this.tmp2.set((Math.random() - 0.5) * 4, 0.5, (Math.random() - 0.5) * 4));
      s.vel.set((Math.random() - 0.5) * 4 * size, (5 + Math.random() * 6) * size, (Math.random() - 0.5) * 4 * size);
      s.sprite.visible = true;
      if (++made >= n) break;
    }
  }

  private spray(dt: number, k: number): void {
    for (const s of this.splashes) {
      if (s.age < 0) continue;
      s.age += dt;
      s.vel.y -= 9.8 * dt;
      s.sprite.position.addScaledVector(s.vel, dt);
      s.sprite.scale.setScalar(s.size * (1 + s.age * 1.2));
      s.sprite.material.opacity = k * Math.max(0, 0.9 - s.age * 0.6);
      if (s.age > 1.6) {
        s.age = -1;
        s.sprite.visible = false;
      }
    }
  }

  /** Rain rings the flood; a hand dipped low sends out a bigger ripple (and a splash). */
  private floodTick(dt: number, k: number): void {
    const u = this.flood.uniforms;
    u.uTime.value = this.time;
    u.uOpacity.value = k;
    u.uFlash.value = this.flash;
    this.rainIn -= dt * cfg.rainRipples;
    const m = this.flood.mesh;
    const geo = m.geometry.boundingBox ?? (m.geometry.computeBoundingBox(), m.geometry.boundingBox!);
    while (this.rainIn <= 0) {
      this.rainIn += 0.5 + Math.random();
      const x = m.position.x + geo.min.x + Math.random() * (geo.max.x - geo.min.x);
      const z = m.position.z + geo.min.z + Math.random() * (geo.max.z - geo.min.z);
      this.flood.ripple(x, z, this.time, 0.25 + Math.random() * 0.25);
    }
    for (let i = 0; i < 2; i++) {
      const h = this.kit.hands[i];
      const low = h.y < cfg.handDip && h.y > -0.5;
      if (low && (!this.dipped[i] || this.kit.handSpeed[i] > 0.6) && Math.random() < 0.35) {
        this.flood.ripple(h.x, h.z, this.time, 1);
        if (!this.dipped[i]) Sound.play('splash', h, 0.6);
      }
      this.dipped[i] = low;
    }
  }
}

/** A soft round glow (white; tinted by the sprite's colour): bright core, long falloff. */
function radialGlow(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.08, 'rgba(255,255,255,0.85)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.32)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.08)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}
