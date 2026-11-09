import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Points,
  ShaderMaterial,
  Vector3,
} from '@iwsdk/core';

/** Smooth 2D value noise on the CPU (terrain heights), seeded and deterministic. */
function hash(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
function fbm(x: number, y: number): number {
  let v = 0;
  let a = 0.5;
  for (let i = 0; i < 5; i++) {
    v += a * vnoise(x, y);
    x = x * 2.03 + 1.7;
    y = y * 2.03 + 9.2;
    a *= 0.5;
  }
  return v;
}

/** Height of the snowy land at (x, z): flat where `flat` says so, hills further out, mountains at the horizon. */
export function landHeight(x: number, z: number, flat: (x: number, z: number) => number): number {
  const r = Math.hypot(x, z);
  const hills = fbm(x * 0.02, z * 0.02) * 9 * Math.min(1, Math.max(0, (r - 18) / 40));
  const mountains = Math.pow(fbm(x * 0.006 + 3, z * 0.006 + 7), 2.2) * 150 * Math.min(1, Math.max(0, (r - 140) / 160));
  return (hills + mountains) * (1 - flat(x, z)) - 0.04;
}

/**
 * Snow-covered land around the room: flat near the house and the frozen lake,
 * rolling into hills and then mountains at the horizon. Snow white on the
 * slopes that face up, blue in the shade; one mesh.
 * `flat(x, z)` says how flat the ground must stay at a point (1 = flat).
 */
export function buildSnowLand(size: number, segments: number, flat: (x: number, z: number) => number, white: number, shade: number): Mesh {
  const g = new PlaneGeometry(size, size, segments, segments);
  g.rotateX(-Math.PI / 2);
  const pos = g.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, landHeight(x, z, flat));
  }
  g.computeVertexNormals();
  // Colour: bright on up-facing slopes, blue-grey in the shade, with a little sparkle variation.
  const nor = g.getAttribute('normal');
  const col = new Float32Array(pos.count * 3);
  const w = new Color(white);
  const s = new Color(shade);
  const t = new Color();
  for (let i = 0; i < pos.count; i++) {
    const up = nor.getY(i);
    const k = Math.min(1, Math.max(0, (up - 0.55) / 0.45)) * (0.9 + hash(pos.getX(i), pos.getZ(i)) * 0.1);
    t.copy(s).lerp(w, k);
    col.set([t.r, t.g, t.b], i * 3);
  }
  g.setAttribute('color', new BufferAttribute(col, 3));
  const mesh = new Mesh(g, new MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0 }));
  mesh.name = 'SnowLand';
  mesh.receiveShadow = false;
  return mesh;
}

/**
 * Northern lights: a few tall curtains far off in the sky, folded and rippling,
 * green at the hem shading to violet at the top, with fine vertical rays that
 * drift sideways. Additive; one material for all curtains.
 */
export class Aurora {
  readonly meshes: Mesh[] = [];
  readonly uniforms = {
    uTime: { value: 0 },
    uOpacity: { value: 0 },
    uGreen: { value: new Color() },
    uViolet: { value: new Color() },
  };

  constructor(green: number, violet: number) {
    this.uniforms.uGreen.value.setHex(green);
    this.uniforms.uViolet.value.setHex(violet);
    const mat = new ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
      vertexShader: /* glsl */ `
        uniform float uTime;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec3 p = position;
          // Folds that travel along the curtain.
          p.z += sin(p.x * 0.035 + uTime * 0.25) * 18.0 + sin(p.x * 0.011 - uTime * 0.12) * 30.0;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime, uOpacity;
        uniform vec3 uGreen, uViolet;
        varying vec2 vUv;
        float h(float x) { return fract(sin(x * 91.7) * 4375.85); }
        float n1(float x) { float i = floor(x); float f = fract(x); return mix(h(i), h(i + 1.0), f * f * (3.0 - 2.0 * f)); }
        void main() {
          float x = vUv.x * 60.0 + uTime * 0.6;
          float rays = 0.55 + 0.45 * n1(x) * n1(x * 2.7 - uTime * 0.9);
          float hem = smoothstep(0.0, 0.12, vUv.y);
          float top = 1.0 - smoothstep(0.35, 1.0, vUv.y);
          float sway = 0.6 + 0.4 * n1(vUv.x * 7.0 + uTime * 0.15);
          float ends = smoothstep(0.0, 0.15, vUv.x) * smoothstep(1.0, 0.85, vUv.x);
          vec3 col = mix(uGreen, uViolet, smoothstep(0.25, 0.9, vUv.y));
          float a = hem * top * rays * sway * ends * uOpacity;
          gl_FragColor = vec4(col * a * 0.9, 1.0);
        }`,
    });
    const curtains = [
      { x: 0, z: -260, w: 520, h: 120, y: 70, ry: 0 },
      { x: 160, z: -120, w: 360, h: 90, y: 85, ry: -1.0 },
      { x: -170, z: -150, w: 300, h: 80, y: 80, ry: 0.9 },
    ];
    for (const c of curtains) {
      const m = new Mesh(new PlaneGeometry(c.w, c.h, 64, 1), mat);
      m.position.set(c.x, c.y, c.z);
      m.rotation.y = c.ry;
      m.frustumCulled = false;
      m.name = 'Aurora';
      this.meshes.push(m);
    }
  }
}

/**
 * Falling snow all around the viewer (inside the open room too): soft flakes
 * that tumble and drift on the wind; `intensity` (0..1) sets how many fall,
 * so shaking your hands can turn flurries into a blizzard.
 */
export class Snowfall {
  readonly points: Points;
  readonly uniforms = {
    uTime: { value: 0 },
    uIntensity: { value: 0.3 },
    uOpacity: { value: 0 },
    uBox: { value: new Vector3() },
    uCenter: { value: new Vector3() },
    uWind: { value: 0.4 },
    uMap: { value: null as unknown },
  };

  constructor(count: number, box: { x: number; y: number; z: number }, map: unknown) {
    const seeds = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      seeds[i * 4] = Math.random();
      seeds[i * 4 + 1] = Math.random();
      seeds[i * 4 + 2] = Math.random();
      seeds[i * 4 + 3] = i / count;
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute('seed', new BufferAttribute(seeds, 4));
    this.uniforms.uBox.value.set(box.x, box.y, box.z);
    this.uniforms.uMap.value = map;
    const mat = new ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      vertexShader: /* glsl */ `
        attribute vec4 seed;
        uniform float uTime, uIntensity, uWind;
        uniform vec3 uBox, uCenter;
        varying float vAlpha;
        void main() {
          float speed = 0.45 + seed.z * 0.5;
          float y = fract(seed.y - uTime * speed / uBox.y);
          vec3 p = vec3((seed.x - 0.5) * uBox.x, y * uBox.y, (seed.z - 0.5) * uBox.z);
          p.x += sin(uTime * (0.6 + seed.x) + seed.w * 40.0) * 0.25 + uWind * (1.0 - y) * 1.5;
          p.z += cos(uTime * (0.5 + seed.y) + seed.w * 30.0) * 0.25;
          // Keep the flakes in a box around the viewer (wrapped, so it is endless).
          vec3 w = p + vec3(0.0, 0.0, 0.0);
          w.xz = mod(w.xz - uCenter.xz + uBox.xz * 0.5, uBox.xz) - uBox.xz * 0.5 + uCenter.xz;
          vec4 mv = modelViewMatrix * vec4(w, 1.0);
          gl_Position = projectionMatrix * mv;
          float on = step(seed.w, uIntensity);
          vAlpha = on * smoothstep(0.0, 0.08, y) * smoothstep(1.0, 0.85, y);
          gl_PointSize = on * min(22.0, (0.02 + seed.x * 0.015) * 900.0 / max(0.3, -mv.z));
          vAlpha *= smoothstep(0.35, 1.0, -mv.z);
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        uniform float uOpacity;
        varying float vAlpha;
        void main() {
          vec4 t = texture2D(uMap, gl_PointCoord);
          gl_FragColor = vec4(vec3(0.95, 0.97, 1.0), t.a * vAlpha * uOpacity);
          #include <colorspace_fragment>
        }`,
    });
    this.points = new Points(g, mat);
    this.points.frustumCulled = false;
    this.points.name = 'Snowfall';
  }
}

/**
 * A wood fire: two crossed planes with a flame shader (rising noise shaped into
 * tongues, white-yellow at the core, orange to red at the tips). Additive.
 */
export function buildFlames(width: number, height: number): { mesh: Mesh; uniforms: { uTime: { value: number }; uOpacity: { value: number } } } {
  const uniforms = { uTime: { value: 0 }, uOpacity: { value: 1 } };
  const mat = new ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uOpacity;
      varying vec2 vUv;
      float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(h(i), h(i + vec2(1, 0)), u.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), u.x), u.y); }
      void main() {
        vec2 uv = vUv;
        float t = uTime;
        float noise = n(vec2(uv.x * 6.0, uv.y * 4.0 - t * 3.2)) * 0.6 + n(vec2(uv.x * 13.0, uv.y * 9.0 - t * 5.0)) * 0.4;
        // Tongues: narrow towards the top, flickering.
        float cx = abs(uv.x - 0.5) * 2.0;
        float shape = (1.0 - uv.y) * 1.25 - cx * (0.7 + uv.y) - noise * 0.75 * uv.y + 0.18;
        float f = smoothstep(0.0, 0.35, shape);
        vec3 col = mix(vec3(1.0, 0.25, 0.05), vec3(1.0, 0.65, 0.2), smoothstep(0.0, 0.5, shape));
        col = mix(col, vec3(1.0, 0.95, 0.75), smoothstep(0.45, 0.9, shape));
        gl_FragColor = vec4(col * f * uOpacity, 1.0);
      }`,
  });
  const g = new PlaneGeometry(width, height);
  g.translate(0, height / 2, 0);
  const a = new Mesh(g, mat);
  const b = new Mesh(g, mat);
  b.rotation.y = Math.PI / 2;
  a.add(b);
  a.name = 'Flames';
  return { mesh: a, uniforms };
}
