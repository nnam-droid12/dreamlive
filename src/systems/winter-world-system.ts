import {
  CircleGeometry,
  Color,
  createSystem,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Entity,
  Group,
  HemisphereLight,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PointLight,
  Quaternion,
  Vector3,
  VisibilityState,
} from '@iwsdk/core';
import { Sound } from '../audio/engine.js';
import { PartyGuests } from '../characters/party-guests.js';
import { Ritual } from '../components/ritual.js';
import { Session } from '../components/session.js';
import { RoomSlots } from '../components/stage.js';
import { Palette, PaletteSets } from '../config/palette.js';
import { Showcase } from '../config/showcase.js';
import { Tuning } from '../config/tuning.js';
import { buildChristmasTree, TREE_LIGHTS } from '../scene-assets/christmas-tree.scene-asset.js';
import { buildFireplace } from '../scene-assets/fireplace.scene-asset.js';
import { snowPineGeometry, snowPineMaterial } from '../scene-assets/snow-pine.scene-asset.js';
import { NycLayout } from '../showcase/nyc-bedroom.js';
import { softDotTexture } from '../visuals/soft-sprites.js';
import { Aurora, buildFlames, buildSnowLand, landHeight, Snowfall } from '../visuals/winter-fx.js';
import { WorldKit } from './lib/world-kit.js';

const cfg = Tuning.winter;
const UP = new Vector3(0, 1, 0);

/**
 * Dream world D, Winter Night. The room stands on a snowy hillside under the
 * northern lights: spruce forest heavy with snow, mountains at the horizon,
 * and out of the window a frozen lake with a lit town Christmas tree in the
 * middle and string lights all round. Bigfoot and the party guests skate on
 * it. Inside, a stone fireplace crackles and warms the room. Snow falls into
 * the open room; shake your hands and it turns into a blizzard. Hands only.
 */
export class WinterWorldSystem extends createSystem({
  director: { required: [Ritual, Session, RoomSlots] },
}) {
  private kit = new WorldKit('winter');
  private root!: Group;
  private land!: Mesh;
  private aurora!: Aurora;
  /** The northern lights, turned to hang beyond the window. */
  private sky!: Group;
  private snow!: Snowfall;
  private pines!: InstancedMesh;
  private rink!: Group;
  private tree!: Group;
  private bulbs?: InstancedMesh;
  private stringBulbs!: InstancedMesh;
  private fireplace!: Object3D;
  private flames!: ReturnType<typeof buildFlames>;
  private fireLight!: PointLight;
  private moon!: DirectionalLight;
  private fill!: HemisphereLight;
  private skaters?: PartyGuests;
  private loadingSkaters = false;
  private rinkAt = new Vector3();
  private out = new Vector3(1, 0, 0);
  private along = new Vector3(0, 0, 1);
  private head = new Vector3();
  private fwd = new Vector3();
  private tmp = new Vector3();
  private q = new Quaternion();
  private m = new Matrix4();
  private c = new Color();
  private warm = new Color(Palette.xmasBulb);
  private time = 0;
  private blizzard = 0;
  private shakeFor = 0;
  private cheer = 0;
  private wind?: ReturnType<typeof Sound.loop>;
  private crackle?: ReturnType<typeof Sound.loop>;

  init(): void {
    this.root = new Group();
    this.root.name = 'WinterWorld';
    this.root.visible = false;
    // The land is flat around the house and the lake, and rises into hills and mountains further out.
    this.land = buildSnowLand(900, 180, (x, z) => this.flatAt(x, z), Palette.snowWhite, Palette.snowShade);
    this.root.add(this.land);
    this.aurora = new Aurora(Palette.auroraGreen, Palette.auroraViolet);
    this.sky = new Group();
    for (const m of this.aurora.meshes) this.sky.add(m);
    this.root.add(this.sky);
    this.pines = new InstancedMesh(snowPineGeometry(), snowPineMaterial(), cfg.pines);
    this.pines.name = 'Spruces';
    this.pines.frustumCulled = false;
    this.root.add(this.pines);
    this.rink = this.buildRink();
    this.root.add(this.rink);
    this.tree = buildChristmasTree();
    this.tree.traverse((o) => {
      if (o.name === 'Lights' && o instanceof InstancedMesh) this.bulbs = o;
    });
    this.rink.add(this.tree);
    this.snow = new Snowfall(cfg.flakes, cfg.snowBox, softDotTexture());
    this.root.add(this.snow.points);

    // The fireplace (in the room) and its fire.
    this.fireplace = buildFireplace();
    this.flames = buildFlames(0.62, 0.55);
    const anchor = this.fireplace.getObjectByName('FireAnchor');
    (anchor ?? this.fireplace).add(this.flames.mesh);
    this.root.add(this.fireplace);

    // Lights: always present (intensity 0 when the world is away), so nothing recompiles.
    this.moon = new DirectionalLight(Palette.moonLight, 0);
    this.moon.position.set(-30, 60, -40);
    this.fill = new HemisphereLight(Palette.winterSky, Palette.winterGround, 0);
    this.fireLight = new PointLight(Palette.fireGlow, 0, cfg.fireRange, 1.8);
    this.world.createTransformEntity(this.root);
    for (const l of [this.moon, this.moon.target, this.fill, this.fireLight]) this.world.createTransformEntity(l);
  }

  /** How flat the land stays at (x, z): the house and the lake are level ground. */
  private flatAt(x: number, z: number): number {
    const r = Math.hypot(x, z);
    return 1 - Math.min(1, Math.max(0, (r - 30) / 25));
  }

  /** The frozen lake: polished ice, white boards, posts with string lights between them. */
  private buildRink(): Group {
    const g = new Group();
    g.name = 'IceRink';
    const R = cfg.rinkRadius;
    const ice = new Mesh(new CircleGeometry(R, 72), new MeshStandardMaterial({ color: Palette.iceRink, roughness: 0.06, metalness: 0.15 }));
    ice.rotation.x = -Math.PI / 2;
    ice.position.y = 0.03;
    const boards = new Mesh(new CylinderGeometry(R + 0.05, R + 0.05, cfg.boardHeight, 72, 1, true), new MeshStandardMaterial({ color: Palette.rinkBoard, roughness: 0.5, side: DoubleSide }));
    boards.position.y = cfg.boardHeight / 2;
    const rail = new Mesh(new CylinderGeometry(R + 0.06, R + 0.06, 0.06, 72, 1, true), new MeshStandardMaterial({ color: Palette.xmasRed, roughness: 0.4, side: DoubleSide }));
    rail.position.y = cfg.boardHeight;
    g.add(ice, boards, rail);
    // Posts and the string lights that sag between them.
    const postH = 3.2;
    const posts = new InstancedMesh(new CylinderGeometry(0.05, 0.06, postH, 8), new MeshStandardMaterial({ color: 0x2b2f36, metalness: 0.6, roughness: 0.4 }), cfg.posts);
    const n = cfg.posts * cfg.bulbsPerSpan;
    this.stringBulbs = new InstancedMesh(new IcosahedronGeometry(0.05, 0), new MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), n);
    const pr = R + 0.4;
    let k = 0;
    for (let i = 0; i < cfg.posts; i++) {
      const a = (i / cfg.posts) * Math.PI * 2;
      this.m.makeTranslation(Math.cos(a) * pr, postH / 2, Math.sin(a) * pr);
      posts.setMatrixAt(i, this.m);
      const a2 = ((i + 1) / cfg.posts) * Math.PI * 2;
      for (let j = 0; j < cfg.bulbsPerSpan; j++) {
        const t = (j + 0.5) / cfg.bulbsPerSpan;
        const x = Math.cos(a) * pr * (1 - t) + Math.cos(a2) * pr * t;
        const z = Math.sin(a) * pr * (1 - t) + Math.sin(a2) * pr * t;
        const sag = Math.sin(Math.PI * t) * 0.45;
        this.m.makeTranslation(x, postH - 0.1 - sag, z);
        this.stringBulbs.setMatrixAt(k, this.m);
        this.stringBulbs.setColorAt(k, this.c.setHex(k % 4 === 0 ? Palette.xmasRed : Palette.xmasBulb));
        k++;
      }
    }
    g.add(posts, this.stringBulbs);
    return g;
  }

  update(realDelta: number): void {
    if (this.visibilityState.peek() !== VisibilityState.Visible) return;
    const d = this.queries.director.entities.values().next().value;
    if (!d) return;
    const dt = Math.min(realDelta, 0.1);
    if (this.kit.step(d, dt, 0.5)) this.begin(d);
    const k = this.kit.amount;
    this.root.visible = k > 0;
    this.moon.intensity = k * cfg.moon;
    this.fill.intensity = k * cfg.skyFill;
    this.wind?.setGain(k * (0.2 + this.blizzard * 0.5));
    this.crackle?.setGain(k * 0.18);
    if (!this.root.visible) {
      this.fireLight.intensity = 0;
      return;
    }
    if (!this.skaters && !this.loadingSkaters) void this.loadSkaters();
    this.time += dt;
    this.player.head.getWorldPosition(this.head);
    this.fwd.set(0, 0, -1).applyQuaternion(this.player.head.quaternion).setY(0);
    if (this.fwd.lengthSq() < 1e-4) this.fwd.set(0, 0, -1);
    this.fwd.normalize();
    this.kit.readHands(this.player.gripSpaces.left, this.player.gripSpaces.right, dt);

    // Sky and snow.
    this.aurora.uniforms.uTime.value = this.time;
    this.aurora.uniforms.uOpacity.value = k;
    this.shake(d, dt);
    const s = this.snow.uniforms;
    s.uTime.value = this.time;
    s.uOpacity.value = k;
    s.uIntensity.value = cfg.snowBase + (1 - cfg.snowBase) * this.blizzard;
    s.uWind.value = 0.3 + this.blizzard * 1.6;
    s.uCenter.value.copy(this.head);

    // The fire: flickering flames and light.
    const flick = 0.75 + Math.sin(this.time * 13) * 0.08 + Math.sin(this.time * 7.3 + 1) * 0.1 + Math.sin(this.time * 23) * 0.05;
    this.flames.uniforms.uTime.value = this.time;
    this.flames.uniforms.uOpacity.value = k;
    this.fireLight.intensity = k * cfg.fire * flick;

    // Twinkling tree and string lights.
    if (this.bulbs) {
      for (let i = 0; i < TREE_LIGHTS; i++) {
        const tw = 0.55 + 0.45 * Math.max(0, Math.sin(this.time * 2.2 + i * 1.7));
        this.bulbs.setColorAt(i, this.c.copy(this.warm).multiplyScalar(tw * 1.6));
      }
      if (this.bulbs.instanceColor) this.bulbs.instanceColor.needsUpdate = true;
    }
    this.skate(d, dt);
    if (this.cheer > 0) this.cheer -= dt;
  }

  private begin(d: Entity): void {
    const o = d.getVectorView(RoomSlots, 'windowOrigin');
    const out = d.getVectorView(RoomSlots, 'windowOut');
    const al = d.getVectorView(RoomSlots, 'windowAlong');
    if (out[0] || out[2]) this.out.set(out[0], 0, out[2]).normalize();
    if (al[0] || al[2]) this.along.set(al[0], 0, al[2]).normalize();
    this.player.head.getWorldPosition(this.head);
    // The lake out of the window (or straight ahead, if no window is known).
    if (out[0] || out[2]) this.rinkAt.set(o[0], 0, o[2]).addScaledVector(this.out, cfg.rinkOut);
    else this.rinkAt.copy(this.head).setY(0).addScaledVector(this.fwd, cfg.rinkOut);
    this.rink.position.copy(this.rinkAt);
    this.sky.rotation.y = Math.atan2(-this.out.x, -this.out.z);
    this.scatterPines();
    this.placeFireplace();
    this.blizzard = 0;
    if (!this.wind) this.wind = Sound.loop('wind', this.rinkAt, 0);
    if (!this.crackle) this.crackle = Sound.loop('rain', this.fireplace.position, 0);
    this.kit.preload(['winter-hello', 'winter-snow']);
    this.kit.caption(d, 'Winter Night');
  }

  /** Spruces on the hills, most of them on the window side, none on the lake or the house. */
  private scatterPines(): void {
    let seed = 7;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    const base = Math.atan2(this.out.z, this.out.x);
    const s = new Vector3();
    for (let i = 0; i < cfg.pines; i++) {
      let x = 0;
      let z = 0;
      for (let tries = 0; tries < 8; tries++) {
        const front = rand() < cfg.pineFront;
        const a = front ? base + (rand() - 0.5) * Math.PI * 0.9 : rand() * Math.PI * 2;
        const r = cfg.pineNear + Math.pow(rand(), 0.7) * (cfg.pineFar - cfg.pineNear);
        x = Math.cos(a) * r;
        z = Math.sin(a) * r;
        if (Math.hypot(x - this.rinkAt.x, z - this.rinkAt.z) > cfg.rinkRadius + 6) break;
      }
      const sc = 0.7 + rand() * 0.8;
      s.set(sc, sc * (0.9 + rand() * 0.3), sc);
      this.q.setFromAxisAngle(UP, rand() * 6.28);
      this.m.compose(this.tmp.set(x, landHeight(x, z, (px, pz) => this.flatAt(px, pz)), z), this.q, s);
      this.pines.setMatrixAt(i, this.m);
    }
    this.pines.instanceMatrix.needsUpdate = true;
  }

  /** The fireplace stands against a wall of the room (the showcase room's left wall), or to your left. */
  private placeFireplace(): void {
    if (Showcase.enabled) {
      const R = NycLayout.room;
      this.fireplace.position.set(R.minX + 0.66, 0, 0.75);
      this.fireplace.rotation.y = Math.PI / 2;
    } else {
      // Two metres to the viewer's left, facing them.
      const left = this.tmp.set(this.fwd.z, 0, -this.fwd.x);
      this.fireplace.position.copy(this.head).setY(0).addScaledVector(left, 2.2).addScaledVector(this.fwd, 0.8);
      this.fireplace.rotation.y = Math.atan2(this.head.x - this.fireplace.position.x, this.head.z - this.fireplace.position.z);
    }
    this.fireplace.updateMatrixWorld(true);
    this.flames.mesh.getWorldPosition(this.fireLight.position);
    this.fireLight.position.y += 0.35;
    this.fireLight.position.addScaledVector(this.tmp.set(Math.sin(this.fireplace.rotation.y), 0, Math.cos(this.fireplace.rotation.y)), 0.5);
  }

  private async loadSkaters(): Promise<void> {
    this.loadingSkaters = true;
    const guests = new PartyGuests();
    try {
      await guests.load(cfg.skaters, PaletteSets.skaterOutfits, PaletteSets.guestSkin, ['Idle_Talking_Loop', 'Spell_Simple_Idle_Loop']);
    } catch {
      return;
    }
    this.skaters = guests;
    this.rink.add(guests.root);
  }

  /** Skaters glide round the tree, leaning into the curve; Bigfoot skates an inner circle. */
  private skate(d: Entity, dt: number): void {
    const sk = this.skaters;
    if (sk) {
      sk.update(dt, 0.3, 0);
      const [r0, r1] = cfg.skateRadius;
      for (let i = 0; i < sk.guests.length; i++) {
        const g = sk.guests[i];
        const r = r0 + ((i * 0.37) % 1) * (r1 - r0);
        const dir = i % 3 === 2 ? -1 : 1;
        const a = dir * (this.time / cfg.skateLap) * Math.PI * 2 * (r0 / r) + i * 1.9;
        g.root.position.set(Math.cos(a) * r, 0.03, Math.sin(a) * r);
        // Facing along the circle, leaning in (with a little stride sway).
        const yaw = Math.atan2(-Math.sin(a) * dir, Math.cos(a) * dir);
        g.root.rotation.set(0, yaw, 0);
        g.root.rotateZ(dir * -0.12 + Math.sin(this.time * 2.4 + i) * 0.05);
      }
    }
    // Bigfoot.
    const a = (this.time / cfg.bigfootLap) * Math.PI * 2;
    const R = cfg.bigfootRadius;
    this.tmp.set(this.rinkAt.x + Math.cos(a) * R, 0.03, this.rinkAt.z + Math.sin(a) * R);
    const yaw = Math.atan2(-Math.sin(a), Math.cos(a));
    const toMe = Math.atan2(this.head.x - this.tmp.x, this.head.z - this.tmp.z);
    const sees = Math.cos(yaw - toMe) > 0.4;
    const anim = this.cheer > 0 ? 'cheer' : sees ? 'wave' : 'walk';
    this.kit.placeBigfoot(d, this.tmp, anim === 'wave' || anim === 'cheer' ? toMe : yaw, anim);
    if (this.time > 4) this.kit.say(d, 'winter-hello', 'Brrr, a winter night! Come skate with me. And if you want more snow, shake your hands!', this.tmp);
  }

  /** Shaking both hands (or one hard) calls up a blizzard for a while. */
  private shake(d: Entity, dt: number): void {
    const v = (this.kit.handSpeed[0] + this.kit.handSpeed[1]) / 2;
    this.shakeFor = v > cfg.shakeSpeed ? this.shakeFor + dt : 0;
    if (this.shakeFor > cfg.shakeHold && this.blizzard < 0.7) {
      this.blizzard = 1;
      this.cheer = 2.5;
      Sound.play('hush', this.head, 0.9);
      this.kit.say(d, 'winter-snow', 'Whoa, a blizzard! You are a winter wizard.', this.rinkAt);
    }
    this.blizzard = Math.max(0, this.blizzard - dt / cfg.blizzardSec);
  }
}
