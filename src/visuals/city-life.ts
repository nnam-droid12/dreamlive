import { doveBodyGeometry, doveMaterial, doveWingGeometry } from '../scene-assets/dove.scene-asset.js';
import { Palette } from '../config/palette.js';
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  DoubleSide,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  SphereGeometry,
  Vector3,
} from '@iwsdk/core';

/** One merged geometry from coloured boxes: [w, h, d, x, y, z, colour]. */
function boxes(parts: readonly (readonly number[])[]): BufferGeometry {
  const pos: number[] = [];
  const col: number[] = [];
  const c = new Color();
  for (const [w, h, d, x, y, z, hex] of parts) {
    const g = new BoxGeometry(w, h, d).toNonIndexed();
    g.translate(x, y, z);
    const p = g.getAttribute('position');
    c.setHex(hex);
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      col.push(c.r, c.g, c.b);
    }
    g.dispose();
  }
  const out = new BufferGeometry();
  out.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  out.setAttribute('color', new BufferAttribute(new Float32Array(col), 3));
  return out;
}

export interface Lane {
  /** Lane axis: 'x' or 'z' in the city's local frame; the fixed coordinate across it; direction. */
  axis: 'x' | 'z';
  at: number;
  dir: 1 | -1;
  from: number;
  to: number;
}

export interface CityLifeOptions {
  streetY: number;
  lanes: readonly Lane[];
  carsPerLane: number;
  carSpeed: number;
  carColors: readonly number[];
  heli: { center: Vector3; radius: number; height: number; speed: number };
  birds: number;
  flock: { from: Vector3; to: Vector3; sec: number };
}

/**
 * Life in the city around the party: headlight-and-taillight traffic on the
 * streets far below, a helicopter circling with a blinking light and a
 * searchlight, and (at sunrise) a flock of birds crossing the sky. Everything
 * is instanced or a handful of meshes, built in the window frame.
 */
/** Doves are drawn a little larger than life so the flock reads from the room. */
const DOVE_SCALE = 2.6;

export class CityLife {
  readonly root = new Group();
  private cars: InstancedMesh;
  private carState: { lane: number; s: number; speed: number }[] = [];
  private heli = new Group();
  private rotor: Mesh;
  private blink: MeshBasicMaterial;
  private beam: Mesh;
  private beamMat: MeshBasicMaterial;
  private wingsL: InstancedMesh;
  private wingsR: InstancedMesh;
  private birdMat: MeshStandardMaterial;
  private wingMat: MeshStandardMaterial;
  private bodies: InstancedMesh;
  private m = new Matrix4();
  private q = new Quaternion();
  private p = new Vector3();
  private s = new Vector3(1, 1, 1);
  private up = new Vector3(0, 1, 0);
  private dummy = new Object3D();

  constructor(private o: CityLifeOptions) {
    this.root.name = 'CityLife';
    // Cars: dark body, warm headlights at the front (+z), red tail lights at the back.
    const car = boxes([
      [1.8, 0.9, 4.2, 0, 0.55, 0, 0x22252c],
      [1.5, 0.55, 2.2, 0, 1.25, -0.2, 0x1a1c22],
      [0.35, 0.22, 0.08, -0.6, 0.65, 2.12, 0xfff1c8],
      [0.35, 0.22, 0.08, 0.6, 0.65, 2.12, 0xfff1c8],
      [0.4, 0.18, 0.08, -0.6, 0.7, -2.12, 0xff2a2a],
      [0.4, 0.18, 0.08, 0.6, 0.7, -2.12, 0xff2a2a],
    ]);
    const n = o.lanes.length * o.carsPerLane;
    this.cars = new InstancedMesh(car, new MeshBasicMaterial({ vertexColors: true }), n);
    this.cars.name = 'Traffic';
    this.cars.frustumCulled = false;
    const tint = new Color();
    for (let l = 0; l < o.lanes.length; l++) {
      for (let k = 0; k < o.carsPerLane; k++) {
        const i = l * o.carsPerLane + k;
        this.carState.push({ lane: l, s: (k + Math.random() * 0.6) / o.carsPerLane, speed: o.carSpeed * (0.8 + Math.random() * 0.4) });
        // A little body colour variety (the light boxes are bright enough to survive the tint).
        tint.setHex(o.carColors[i % o.carColors.length]);
        this.cars.setColorAt(i, tint);
      }
    }
    this.root.add(this.cars);

    // Helicopter: a dark silhouette, spinning rotor, blinking red light and a searchlight cone.
    const dark = new MeshStandardMaterial({ color: 0x1b1d22, roughness: 0.6, metalness: 0.3 });
    const body = new Mesh(new SphereGeometry(1, 12, 8), dark);
    body.scale.set(1.1, 1, 1.9);
    const tail = new Mesh(new BoxGeometry(0.25, 0.3, 3.4), dark);
    tail.position.set(0, 0.25, -2.9);
    this.rotor = new Mesh(new BoxGeometry(7, 0.05, 0.25), dark);
    this.rotor.position.y = 1.15;
    this.blink = new MeshBasicMaterial({ color: 0xff2020 });
    const light = new Mesh(new SphereGeometry(0.18, 8, 6), this.blink);
    light.position.set(0, -0.9, 0.4);
    const tailLight = new Mesh(new SphereGeometry(0.14, 8, 6), this.blink);
    tailLight.position.set(0, 0.5, -4.5);
    this.beamMat = new MeshBasicMaterial({ color: 0xfff6d8, transparent: true, opacity: 0.12, blending: AdditiveBlending, depthWrite: false, side: DoubleSide });
    const cone = new ConeGeometry(4, 30, 20, 1, true);
    cone.translate(0, -15, 0);
    this.beam = new Mesh(cone, this.beamMat);
    this.beam.position.set(0, -0.8, 1.2);
    this.beam.rotation.x = 0.35;
    this.heli.add(body, tail, this.rotor, light, tailLight, this.beam);
    this.heli.name = 'Helicopter';
    this.root.add(this.heli);

    // White doves: instanced bodies and left/right wings that flap about the shoulders.
    this.birdMat = doveMaterial();
    this.birdMat.transparent = true;
    this.bodies = new InstancedMesh(doveBodyGeometry(), this.birdMat, o.birds);
    const wingMat = new MeshStandardMaterial({ color: Palette.doveWhite, roughness: 0.85, side: DoubleSide, transparent: true, emissive: new Color(Palette.doveWhite), emissiveIntensity: 0.12 });
    this.wingMat = wingMat;
    this.wingsL = new InstancedMesh(doveWingGeometry(), wingMat, o.birds);
    const wingR = doveWingGeometry();
    wingR.scale(-1, 1, 1);
    this.wingsR = new InstancedMesh(wingR, wingMat, o.birds);
    this.bodies.frustumCulled = this.wingsL.frustumCulled = this.wingsR.frustumCulled = false;
    this.bodies.name = 'Doves';
    this.root.add(this.bodies, this.wingsL, this.wingsR);
  }

  update(time: number, delta: number, energy: number, dawn: number, dusk = 0): void {
    this.traffic(delta);
    this.copter(time, energy, dawn);
    this.flock(time, Math.max(dawn, dusk));
  }

  private traffic(delta: number): void {
    const o = this.o;
    for (let i = 0; i < this.carState.length; i++) {
      const c = this.carState[i];
      const lane = o.lanes[c.lane];
      const len = Math.abs(lane.to - lane.from);
      c.s = (c.s + (c.speed * delta) / len) % 1;
      const along = lane.dir > 0 ? lane.from + c.s * (lane.to - lane.from) : lane.to - c.s * (lane.to - lane.from);
      if (lane.axis === 'z') this.p.set(lane.at, o.streetY, along);
      else this.p.set(along, o.streetY, lane.at);
      // Face the direction of travel (the car's +z is its front).
      const yaw = lane.axis === 'z' ? (lane.dir > 0 ? 0 : Math.PI) : lane.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      this.q.setFromAxisAngle(this.up, yaw);
      this.m.compose(this.p, this.q, this.s);
      this.cars.setMatrixAt(i, this.m);
    }
    this.cars.instanceMatrix.needsUpdate = true;
  }

  private copter(time: number, energy: number, dawn: number): void {
    const h = this.o.heli;
    const a = time * h.speed;
    this.heli.position.set(h.center.x + Math.cos(a) * h.radius, h.height + Math.sin(a * 0.5) * 2, h.center.z + Math.sin(a) * h.radius);
    // Nose along the orbit, banking a little into the turn.
    this.heli.rotation.set(0, -a, 0.12);
    this.rotor.rotation.y = time * 28;
    this.blink.color.setHex(Math.sin(time * 6) > 0.6 ? 0xff2020 : 0x300404);
    // The searchlight sweeps the party roof; it dims as the sky gets light.
    this.beam.rotation.z = Math.sin(time * 0.7) * 0.25;
    this.beamMat.opacity = (0.06 + 0.08 * energy) * (1 - dawn);
  }

  /** White doves cross the sky at golden hour and at sunrise (not at night). */
  private flock(time: number, light: number): void {
    const show = Math.max(0, Math.min(1, (light - 0.25) / 0.25));
    this.bodies.visible = this.wingsL.visible = this.wingsR.visible = show > 0.01;
    if (!this.bodies.visible) return;
    this.birdMat.opacity = this.wingMat.opacity = show;
    const f = this.o.flock;
    const k = (time / f.sec) % 1;
    this.p.lerpVectors(f.from, f.to, k);
    const heading = Math.atan2(f.to.x - f.from.x, f.to.z - f.from.z);
    for (let i = 0; i < this.o.birds; i++) {
      // A loose V behind the leader, each bird bobbing and flapping in its own rhythm.
      const row = Math.ceil(i / 2);
      const side = i % 2 ? 1 : -1;
      const d = this.dummy;
      d.position.set(this.p.x, this.p.y + Math.sin(time * 1.3 + i) * 0.3, this.p.z);
      d.rotation.set(0, heading, Math.sin(time * 0.6 + i) * 0.12);
      d.translateX(side * row * 1.1);
      d.translateZ(-row * 1.3);
      d.scale.setScalar(DOVE_SCALE);
      d.updateMatrix();
      this.bodies.setMatrixAt(i, d.matrix);
      // Flap, with a glide now and then: wings up-down about the shoulders.
      const glide = Math.sin(time * 0.7 + i * 1.7) > 0.55;
      const flap = glide ? 0.08 : Math.sin(time * 11 + i * 0.7) * 0.75;
      d.translateY(0.03 * DOVE_SCALE);
      d.translateX(0.03 * DOVE_SCALE);
      d.rotateZ(flap);
      d.updateMatrix();
      this.wingsL.setMatrixAt(i, d.matrix);
      d.rotateZ(-flap);
      d.translateX(-0.06 * DOVE_SCALE);
      d.rotateZ(-flap);
      d.updateMatrix();
      this.wingsR.setMatrixAt(i, d.matrix);
    }
    this.bodies.instanceMatrix.needsUpdate = true;
    this.wingsL.instanceMatrix.needsUpdate = true;
    this.wingsR.instanceMatrix.needsUpdate = true;
  }
}
