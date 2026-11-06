import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, Points, ShaderMaterial, Vector3 } from '@iwsdk/core';

export interface MoteStyle {
  colorA: number;
  colorB: number;
  /** Drift (m), how fast they wander, how fast they rise (m/s; negative falls), base size (px at 1 m). */
  drift: number;
  speed: number;
  rise: number;
  size: number;
  /** How strongly size follows the bass and the kick, and brightness the highs. */
  bassSize: number;
  kickJump: number;
  twinkle: number;
}

/**
 * Music-driven motes: one cloud of soft glowing points filling a box around the
 * viewer. All motion is in the vertex shader (no per-frame CPU work besides a
 * few uniforms); a style sets colours and behaviour, the bands make it dance.
 */
export class Motes {
  readonly points: Points;
  readonly mat: ShaderMaterial;

  constructor(count: number, box: Vector3) {
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      // Low-discrepancy spread, so the cloud looks even and composed.
      pos[i * 3] = ((i * 0.618034) % 1) - 0.5;
      pos[i * 3 + 1] = (i * 0.754878) % 1;
      pos[i * 3 + 2] = ((i * 0.56984) % 1) - 0.5;
      seed[i] = (i * 0.381966) % 1;
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(pos, 3));
    g.setAttribute('seed', new BufferAttribute(seed, 1));
    this.mat = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uBox: { value: box.clone() },
        uOpacity: { value: 0 },
        uBands: { value: new Vector3() },
        uKick: { value: 0 },
        uColorA: { value: new Color() },
        uColorB: { value: new Color() },
        uDrift: { value: 0.3 },
        uSpeed: { value: 0.2 },
        uRise: { value: 0 },
        uSize: { value: 18 },
        uBassSize: { value: 1 },
        uKickJump: { value: 0 },
        uTwinkle: { value: 1 },
      },
      vertexShader: /* glsl */ `
        attribute float seed;
        uniform float uTime, uDrift, uSpeed, uRise, uSize, uBassSize, uKickJump, uKick;
        uniform vec3 uBox, uBands;
        varying float vSeed;
        varying float vBright;
        void main() {
          vSeed = seed;
          vec3 p = position;
          float t = uTime * uSpeed + seed * 40.0;
          p.y = fract(p.y + uTime * uRise / uBox.y + seed * 0.01);
          vec3 w = vec3((p.x) * uBox.x, p.y * uBox.y, (p.z) * uBox.z);
          w += uDrift * vec3(sin(t * 1.3 + seed * 9.0), sin(t * 0.9 + seed * 5.0) * 0.6, cos(t * 1.1 + seed * 7.0));
          w.y += uKickJump * uKick * (0.3 + seed * 0.4);
          vec4 mv = modelViewMatrix * vec4(w, 1.0);
          float pulse = 1.0 + uBassSize * uBands.x * (0.6 + seed) + 0.6 * uKick;
          gl_PointSize = uSize * pulse / max(0.4, -mv.z);
          vBright = 0.45 + 0.9 * uBands.y + 0.6 * uBands.z * step(0.6, fract(seed * 7.0 + uTime * 0.5));
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColorA, uColorB;
        uniform float uOpacity, uTwinkle, uTime;
        varying float vSeed;
        varying float vBright;
        void main() {
          float r = length(gl_PointCoord - 0.5) * 2.0;
          float a = pow(max(0.0, 1.0 - r), 2.2);
          float tw = mix(1.0, 0.55 + 0.45 * sin(uTime * 3.0 + vSeed * 50.0), uTwinkle);
          vec3 c = mix(uColorA, uColorB, vSeed);
          gl_FragColor = vec4(c * a * vBright * tw * uOpacity, a * uOpacity);
        }`,
    });
    this.points = new Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 15;
    this.points.name = 'MusicMotes';
  }

  /** Ease the uniforms toward a style (k = 0..1 per frame). */
  blendTo(s: MoteStyle, k: number): void {
    const u = this.mat.uniforms;
    (u.uColorA.value as Color).lerp(this.tmpA.setHex(s.colorA), k);
    (u.uColorB.value as Color).lerp(this.tmpB.setHex(s.colorB), k);
    u.uDrift.value += (s.drift - u.uDrift.value) * k;
    u.uSpeed.value += (s.speed - u.uSpeed.value) * k;
    u.uRise.value += (s.rise - u.uRise.value) * k;
    u.uSize.value += (s.size - u.uSize.value) * k;
    u.uBassSize.value += (s.bassSize - u.uBassSize.value) * k;
    u.uKickJump.value += (s.kickJump - u.uKickJump.value) * k;
    u.uTwinkle.value += (s.twinkle - u.uTwinkle.value) * k;
  }

  private tmpA = new Color();
  private tmpB = new Color();
}
