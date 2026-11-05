import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  LineBasicMaterial,
  LineSegments,
  Points,
  PointsMaterial,
} from '@iwsdk/core';

export type WeatherKind = 'clear' | 'rain' | 'fog' | 'snow';

export interface WeatherBox {
  /** Local box the precipitation fills (the group is placed by the caller). */
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  z0: number;
  z1: number;
}

/**
 * Rain streaks and snowflakes filling a box (outside the window, over the
 * street and the party roof). Drops wrap from the bottom to the top, so the
 * pool is fixed. `amount` (0..1) fades the weather in and out.
 */
export class Weather {
  readonly group = new Group();
  private rain: LineSegments;
  private snow: Points;
  private rainPos: Float32Array;
  private snowPos: Float32Array;
  private rainMat: LineBasicMaterial;
  private snowMat: PointsMaterial;
  private rainAmount = 0;
  private snowAmount = 0;

  constructor(private box: WeatherBox, rainCount: number, snowCount: number, rainColor: number, snowColor: number) {
    this.group.name = 'Weather';
    const b = box;
    this.rainPos = new Float32Array(rainCount * 6);
    for (let i = 0; i < rainCount; i++) {
      const x = b.x0 + Math.random() * (b.x1 - b.x0);
      const y = b.y0 + Math.random() * (b.y1 - b.y0);
      const z = b.z0 + Math.random() * (b.z1 - b.z0);
      this.rainPos.set([x, y, z, x + 0.02, y + 0.45, z], i * 6);
    }
    const rg = new BufferGeometry();
    rg.setAttribute('position', new BufferAttribute(this.rainPos, 3));
    this.rainMat = new LineBasicMaterial({ color: new Color(rainColor), transparent: true, opacity: 0, depthWrite: false });
    this.rain = new LineSegments(rg, this.rainMat);
    this.rain.frustumCulled = false;

    this.snowPos = new Float32Array(snowCount * 3);
    for (let i = 0; i < snowCount; i++) {
      this.snowPos.set([b.x0 + Math.random() * (b.x1 - b.x0), b.y0 + Math.random() * (b.y1 - b.y0), b.z0 + Math.random() * (b.z1 - b.z0)], i * 3);
    }
    const sg = new BufferGeometry();
    sg.setAttribute('position', new BufferAttribute(this.snowPos, 3));
    this.snowMat = new PointsMaterial({ color: new Color(snowColor), size: 0.07, transparent: true, opacity: 0, depthWrite: false });
    this.snow = new Points(sg, this.snowMat);
    this.snow.frustumCulled = false;

    this.rain.visible = this.snow.visible = false;
    this.group.add(this.rain, this.snow);
  }

  update(kind: WeatherKind, delta: number, time: number, rate: number, rainSpeed: number, snowSpeed: number): void {
    const k = Math.min(1, delta * rate);
    this.rainAmount += ((kind === 'rain' ? 1 : 0) - this.rainAmount) * k;
    this.snowAmount += ((kind === 'snow' ? 1 : 0) - this.snowAmount) * k;
    this.rain.visible = this.rainAmount > 0.01;
    this.snow.visible = this.snowAmount > 0.01;
    this.rainMat.opacity = 0.75 * this.rainAmount;
    this.snowMat.opacity = 0.9 * this.snowAmount;
    const b = this.box;
    const h = b.y1 - b.y0;
    if (this.rain.visible) {
      const p = this.rainPos;
      const fall = rainSpeed * delta;
      for (let i = 0; i < p.length; i += 6) {
        p[i + 1] -= fall;
        p[i + 4] -= fall;
        if (p[i + 1] < b.y0) {
          p[i + 1] += h;
          p[i + 4] += h;
        }
      }
      this.rain.geometry.attributes.position.needsUpdate = true;
    }
    if (this.snow.visible) {
      const p = this.snowPos;
      const fall = snowSpeed * delta;
      for (let i = 0, n = 0; i < p.length; i += 3, n++) {
        p[i + 1] -= fall * (0.7 + (n % 5) * 0.12);
        // A gentle sideways drift, different per flake.
        p[i] += Math.sin(time * 0.8 + n) * 0.15 * delta;
        p[i + 2] += Math.cos(time * 0.6 + n * 1.3) * 0.15 * delta;
        if (p[i + 1] < b.y0) p[i + 1] += h;
      }
      this.snow.geometry.attributes.position.needsUpdate = true;
    }
  }

  /** How much rain is falling now (0..1), for the rain sound. */
  get rainLevel(): number {
    return this.rainAmount;
  }
}
