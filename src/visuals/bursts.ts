import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DataTexture,
  NormalBlending,
  Points,
  PointsMaterial,
  Vector3,
} from '@iwsdk/core';

export interface BurstOptions {
  count: number;
  /** Launch speed (m/s), spread evenly over a sphere with some jitter. */
  speed: number;
  colors: readonly number[];
  /** Downward pull (m/s²) and air drag (fraction of speed lost per second). */
  gravity: number;
  drag: number;
  /** Seconds each particle lives. */
  life: number;
  /** Extra velocity added to every particle (e.g. a little lift for confetti). */
  lift?: number;
}

/**
 * A fixed pool of particles for one-shot bursts: firework shells over the city
 * or a handful of confetti. One draw call; spent particles are parked out of
 * sight. Nothing is allocated after construction.
 */
export class Bursts {
  readonly points: Points;
  private pos: Float32Array;
  private col: Float32Array;
  private base: Float32Array;
  private vel: Float32Array;
  private age: Float32Array;
  private life: Float32Array;
  private gravity: Float32Array;
  private drag: Float32Array;
  private next = 0;
  private live = 0;
  private c = new Color();

  constructor(private size: number, particleSize: number, private additive: boolean) {
    this.pos = new Float32Array(size * 3).fill(-9999);
    this.col = new Float32Array(size * 3);
    this.base = new Float32Array(size * 3);
    this.vel = new Float32Array(size * 3);
    this.age = new Float32Array(size).fill(1);
    this.life = new Float32Array(size).fill(1);
    this.gravity = new Float32Array(size);
    this.drag = new Float32Array(size);
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(this.pos, 3));
    g.setAttribute('color', new BufferAttribute(this.col, 3));
    const m = new PointsMaterial({
      size: particleSize,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: additive ? AdditiveBlending : NormalBlending,
      sizeAttenuation: true,
      // Glowing sparks are soft round dots; confetti stays as little paper squares.
      map: additive ? softDot() : null,
    });
    this.points = new Points(g, m);
    this.points.frustumCulled = false;
    this.points.renderOrder = 30;
  }

  burst(at: Vector3, o: BurstOptions): void {
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let k = 0; k < o.count; k++) {
      const i = this.next;
      this.next = (this.next + 1) % this.size;
      // Fibonacci sphere directions, so shells look round, plus a little jitter.
      const y = 1 - (2 * (k + 0.5)) / o.count;
      const r = Math.sqrt(1 - y * y);
      const a = k * golden;
      const s = o.speed * (0.85 + Math.random() * 0.3);
      this.vel[i * 3] = Math.cos(a) * r * s;
      this.vel[i * 3 + 1] = y * s + (o.lift ?? 0);
      this.vel[i * 3 + 2] = Math.sin(a) * r * s;
      this.pos[i * 3] = at.x;
      this.pos[i * 3 + 1] = at.y;
      this.pos[i * 3 + 2] = at.z;
      this.c.setHex(o.colors[k % o.colors.length]);
      this.base[i * 3] = this.c.r;
      this.base[i * 3 + 1] = this.c.g;
      this.base[i * 3 + 2] = this.c.b;
      this.age[i] = 0;
      this.life[i] = o.life * (0.8 + Math.random() * 0.4);
      this.gravity[i] = o.gravity;
      this.drag[i] = o.drag;
    }
    this.live = Math.min(this.size, this.live + o.count);
  }

  get active(): boolean {
    return this.live > 0;
  }

  update(delta: number): void {
    if (this.live <= 0) return;
    let alive = 0;
    for (let i = 0; i < this.size; i++) {
      if (this.age[i] >= this.life[i]) continue;
      this.age[i] += delta;
      const k = this.age[i] / this.life[i];
      if (k >= 1) {
        this.pos[i * 3 + 1] = -9999;
        continue;
      }
      alive++;
      const damp = Math.max(0, 1 - this.drag[i] * delta);
      this.vel[i * 3] *= damp;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * damp - this.gravity[i] * delta;
      this.vel[i * 3 + 2] *= damp;
      this.pos[i * 3] += this.vel[i * 3] * delta;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * delta;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * delta;
      // Sparks: bright, then fading out with a twinkle. Confetti: keeps its colour, flickering as it tumbles.
      const fade = this.additive
        ? (1 - k) * (k > 0.6 ? 0.6 + 0.4 * Math.sin(this.age[i] * 40 + i) : 1)
        : 0.75 + 0.25 * Math.sin(this.age[i] * 9 + i * 1.7);
      this.col[i * 3] = this.base[i * 3] * fade;
      this.col[i * 3 + 1] = this.base[i * 3 + 1] * fade;
      this.col[i * 3 + 2] = this.base[i * 3 + 2] * fade;
    }
    this.live = alive;
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}

let dot: DataTexture | undefined;
/** A 32x32 white dot with a soft edge (built once, no DOM needed). */
function softDot(): DataTexture {
  if (dot) return dot;
  const n = 32;
  const data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const r = Math.hypot(x + 0.5 - n / 2, y + 0.5 - n / 2) / (n / 2);
      const v = Math.round(255 * Math.max(0, 1 - r) ** 1.6);
      data.set([v, v, v, v], (y * n + x) * 4);
    }
  }
  dot = new DataTexture(data, n, n);
  dot.needsUpdate = true;
  return dot;
}
