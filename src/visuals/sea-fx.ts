import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  DoubleSide,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  Vector4,
} from '@iwsdk/core';

export interface Wave {
  dx: number;
  dz: number;
  steep: number;
  length: number;
}

const G = 9.8;

/** Height of the swell at (x, z) and time t (metres above still water), matching the ocean shader. */
export function swellHeight(waves: readonly Wave[], x: number, z: number, t: number): number {
  let y = 0;
  for (const w of waves) {
    const len = Math.hypot(w.dx, w.dz);
    const k = (Math.PI * 2) / w.length;
    const c = Math.sqrt(G / k);
    const f = k * ((w.dx / len) * x + (w.dz / len) * z - c * t);
    y += (w.steep / k) * Math.sin(f);
  }
  return y;
}

/** Slope of the swell at (x, z) (dy/dx, dy/dz), for tilting things that ride it. */
export function swellSlope(waves: readonly Wave[], x: number, z: number, t: number, out: { x: number; z: number }): void {
  out.x = 0;
  out.z = 0;
  for (const w of waves) {
    const len = Math.hypot(w.dx, w.dz);
    const k = (Math.PI * 2) / w.length;
    const c = Math.sqrt(G / k);
    const dx = w.dx / len;
    const dz = w.dz / len;
    const f = k * (dx * x + dz * z - c * t);
    const d = w.steep * Math.cos(f);
    out.x += dx * d;
    out.z += dz * d;
  }
}

/**
 * A stormy ocean: Gerstner swells displaced in the vertex shader (with exact
 * normals), fine chop in the fragment, the dark sky reflected at grazing
 * angles, green light through the thin crests, foam on the steep tops, and a
 * flash of light from lightning. Fades into the dark horizon. One draw call.
 */
export class Ocean {
  readonly mesh: Mesh;
  readonly uniforms = {
    uTime: { value: 0 },
    uOpacity: { value: 0 },
    uFlash: { value: 0 },
    uCenter: { value: new Vector3() },
    uDeep: { value: new Color() },
    uScatter: { value: new Color() },
    uFoam: { value: new Color() },
    uSky: { value: new Color() },
    uHorizon: { value: new Color() },
    uW: { value: [new Vector4(), new Vector4(), new Vector4(), new Vector4()] },
  };

  constructor(size: number, segments: number, waves: readonly Wave[], colors: { deep: number; scatter: number; foam: number; sky: number; horizon: number }) {
    this.uniforms.uDeep.value.setHex(colors.deep);
    this.uniforms.uScatter.value.setHex(colors.scatter);
    this.uniforms.uFoam.value.setHex(colors.foam);
    this.uniforms.uSky.value.setHex(colors.sky);
    this.uniforms.uHorizon.value.setHex(colors.horizon);
    waves.slice(0, 4).forEach((w, i) => {
      const len = Math.hypot(w.dx, w.dz);
      this.uniforms.uW.value[i].set(w.dx / len, w.dz / len, w.steep, w.length);
    });
    const mat = new ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      vertexShader: /* glsl */ `
        uniform float uTime;
        uniform vec4 uW[4];
        varying vec3 vWorld;
        varying vec3 vNormal;
        varying float vCrest;
        void main() {
          vec3 p = (modelMatrix * vec4(position, 1.0)).xyz;
          vec3 base = p;
          vec3 tangent = vec3(1.0, 0.0, 0.0);
          vec3 binormal = vec3(0.0, 0.0, 1.0);
          float crest = 0.0;
          for (int i = 0; i < 4; i++) {
            vec2 d = uW[i].xy;
            float k = 6.2831853 / uW[i].w;
            float c = sqrt(9.8 / k);
            float f = k * (dot(d, base.xz) - c * uTime);
            float a = uW[i].z / k;
            float s = sin(f), co = cos(f);
            p.x += d.x * a * co;
            p.z += d.y * a * co;
            p.y += a * s;
            float q = uW[i].z;
            tangent += vec3(-d.x * d.x * q * s, d.x * q * co, -d.x * d.y * q * s);
            binormal += vec3(-d.x * d.y * q * s, d.y * q * co, -d.y * d.y * q * s);
            crest += q * s;
          }
          vNormal = normalize(cross(binormal, tangent));
          vWorld = p;
          vCrest = crest;
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime, uOpacity, uFlash;
        uniform vec3 uCenter, uDeep, uScatter, uFoam, uSky, uHorizon;
        varying vec3 vWorld;
        varying vec3 vNormal;
        varying float vCrest;
        float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float n(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(h(i), h(i + vec2(1, 0)), u.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), u.x), u.y); }
        void main() {
          vec3 view = normalize(cameraPosition - vWorld);
          float dist = length(vWorld.xz - uCenter.xz);
          float near = 1.0 - smoothstep(30.0, 160.0, dist);
          // Fine chop on top of the swell.
          vec2 cp = vWorld.xz * 0.9 + vec2(uTime * 0.7, uTime * 0.4);
          vec2 chop = vec2(n(cp) - n(cp + vec2(0.31, 0.0)), n(cp) - n(cp + vec2(0.0, 0.31))) * 1.6 * near;
          vec3 nrm = normalize(vNormal + vec3(chop.x, 0.0, chop.y));
          float fres = pow(1.0 - max(dot(nrm, view), 0.0), 4.0);
          fres = 0.04 + 0.96 * fres;
          vec3 sky = mix(uSky, uSky * 3.5 + vec3(0.25, 0.28, 0.35), uFlash);
          // Light through the thin tops of the waves.
          float sss = smoothstep(0.1, 0.55, vCrest) * (0.4 + 0.6 * max(0.0, dot(view.xz, -nrm.xz)));
          vec3 water = uDeep + uScatter * sss * 0.8;
          vec3 col = mix(water, sky, fres);
          // Foam on the steepest crests, broken up by noise.
          float foamN = n(vWorld.xz * 0.35 + uTime * 0.1) * 0.6 + n(vWorld.xz * 1.7 - uTime * 0.3) * 0.4;
          float foam = smoothstep(0.42, 0.62, vCrest + foamN * 0.35 - 0.12) * near;
          col = mix(col, uFoam * (0.55 + uFlash * 0.8), foam * 0.85);
          col += vec3(0.7, 0.75, 0.9) * uFlash * 0.12;
          col = mix(col, uHorizon * (1.0 + uFlash * 1.5), smoothstep(80.0, 250.0, dist));
          float edge = 1.0 - smoothstep(220.0, 255.0, dist);
          gl_FragColor = vec4(col, uOpacity * edge);
          #include <colorspace_fragment>
        }`,
    });
    const g = new PlaneGeometry(size, size, segments, segments);
    g.rotateX(-Math.PI / 2);
    this.mesh = new Mesh(g, mat);
    this.mesh.name = 'Ocean';
    this.mesh.frustumCulled = false;
  }
}

/** A dome of rolling storm clouds overhead, lit from inside by lightning. */
export class StormClouds {
  readonly mesh: Mesh;
  readonly uniforms = {
    uTime: { value: 0 },
    uOpacity: { value: 0 },
    uFlash: { value: 0 },
    uFlashDir: { value: new Vector3(1, 0.3, 0) },
    uDark: { value: new Color() },
    uLit: { value: new Color() },
  };

  constructor(radius: number, dark: number, lit: number) {
    this.uniforms.uDark.value.setHex(dark);
    this.uniforms.uLit.value.setHex(lit);
    const mat = new ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      side: BackSide,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uTime, uOpacity, uFlash;
        uniform vec3 uFlashDir, uDark, uLit;
        varying vec3 vDir;
        float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float n(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(h(i), h(i + vec2(1, 0)), u.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), u.x), u.y); }
        float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * n(p); p = p * 2.1 + 3.7; a *= 0.5; } return v; }
        void main() {
          vec3 d = normalize(vDir);
          vec2 p = d.xz / max(0.08, d.y) * 1.6 + vec2(uTime * 0.03, uTime * 0.012);
          float c = fbm(p);
          float billow = smoothstep(0.3, 0.75, c);
          vec3 col = mix(uDark * 0.6, uDark * 1.3, billow);
          // Lightning lights the cloud base around the strike.
          float near = pow(max(0.0, dot(d, normalize(uFlashDir))), 6.0);
          col += uLit * uFlash * (0.35 + near * 2.5) * (0.5 + billow);
          float a = uOpacity * smoothstep(0.0, 0.18, d.y) * (0.75 + 0.25 * billow);
          gl_FragColor = vec4(col, a);
          #include <colorspace_fragment>
        }`,
    });
    this.mesh = new Mesh(new SphereGeometry(radius, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat);
    this.mesh.name = 'StormClouds';
    this.mesh.frustumCulled = false;
  }
}

/**
 * A lightning bolt: a jagged main channel from the cloud base to the sea with
 * a few forks, drawn as flat glowing ribbons turned toward the viewer.
 * `strike(from, to, eye)` rebuilds it; `level` (0..1) sets its brightness.
 */
export class Lightning {
  readonly mesh: Mesh;
  private mat: ShaderMaterial;
  private pos = new Float32Array(0);
  private geo = new BufferGeometry();

  constructor(color: number) {
    this.mat = new ShaderMaterial({
      uniforms: { uLevel: { value: 0 }, uColor: { value: new Color(color) } },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
      vertexShader: /* glsl */ `
        attribute float across;
        varying float vAcross;
        void main() { vAcross = across; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uLevel;
        uniform vec3 uColor;
        varying float vAcross;
        void main() {
          float core = 1.0 - smoothstep(0.0, 0.25, abs(vAcross));
          float glow = 1.0 - smoothstep(0.0, 1.0, abs(vAcross));
          vec3 col = uColor * glow * 0.5 + vec3(1.0) * core;
          gl_FragColor = vec4(col * uLevel, 1.0);
        }`,
    });
    this.mesh = new Mesh(this.geo, this.mat);
    this.mesh.name = 'Lightning';
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  set level(v: number) {
    this.mat.uniforms.uLevel.value = v;
    this.mesh.visible = v > 0.01;
  }

  strike(from: Vector3, to: Vector3, eye: Vector3, width: number): void {
    const segs: [Vector3, Vector3, number][] = [];
    const walk = (a: Vector3, b: Vector3, steps: number, w: number, forks: number) => {
      let prev = a.clone();
      const len = a.distanceTo(b);
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const p = a.clone().lerp(b, t);
        if (i < steps) p.add(new Vector3((Math.random() - 0.5) * len * 0.09, (Math.random() - 0.5) * len * 0.03, (Math.random() - 0.5) * len * 0.09));
        segs.push([prev, p, w * (1 - t * 0.5)]);
        if (forks > 0 && Math.random() < 0.18) {
          const end = p.clone().add(new Vector3((Math.random() - 0.5) * len * 0.4, -len * (0.15 + Math.random() * 0.25), (Math.random() - 0.5) * len * 0.4));
          walk(p, end, 6, w * 0.45, forks - 1);
        }
        prev = p;
      }
    };
    walk(from, to, 22, width, 2);
    // Each segment as a quad facing the eye.
    this.pos = new Float32Array(segs.length * 6 * 3);
    const across = new Float32Array(segs.length * 6);
    const side = new Vector3();
    const dir = new Vector3();
    const toEye = new Vector3();
    let k = 0;
    for (const [a, b, w] of segs) {
      dir.subVectors(b, a).normalize();
      toEye.subVectors(eye, a).normalize();
      side.crossVectors(dir, toEye).normalize().multiplyScalar(w);
      const quad = [
        [a, -1],
        [b, -1],
        [b, 1],
        [a, -1],
        [b, 1],
        [a, 1],
      ] as const;
      for (const [p, s] of quad) {
        this.pos.set([p.x + side.x * s, p.y + side.y * s, p.z + side.z * s], k * 3);
        across[k] = s;
        k++;
      }
    }
    this.geo.setAttribute('position', new BufferAttribute(this.pos, 3));
    this.geo.setAttribute('across', new BufferAttribute(across, 1));
    this.geo.computeBoundingSphere();
  }
}

/** The lighthouse beam: a long soft cone of light fading with distance. */
export function buildBeam(length: number, radius: number, color: number): Mesh {
  const g = new ConeGeometry(radius, length, 24, 1, true);
  g.translate(0, -length / 2, 0);
  g.rotateZ(Math.PI / 2); // apex at the origin, pointing +X
  const mat = new ShaderMaterial({
    uniforms: { uColor: { value: new Color(color) }, uOpacity: { value: 0 } },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
    vertexShader: /* glsl */ `
      varying float vAlong;
      varying vec3 vN;
      varying vec3 vView;
      void main() {
        vAlong = clamp(position.x / ${length.toFixed(1)}, 0.0, 1.0);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying float vAlong;
      varying vec3 vN;
      varying vec3 vView;
      void main() {
        float edge = pow(abs(dot(vN, vView)), 1.5);
        float fade = (1.0 - vAlong) * (1.0 - vAlong);
        gl_FragColor = vec4(uColor * edge * fade * uOpacity * 0.5, 1.0);
      }`,
  });
  const m = new Mesh(g, mat);
  m.name = 'Beam';
  m.frustumCulled = false;
  return m;
}

/**
 * Ankle-deep water over the room floor: a clear, dark film that shows rings
 * where rain drops land and where a hand dips in. Up to 16 ripples at a time.
 */
export class FloodWater {
  readonly mesh: Mesh;
  readonly uniforms = {
    uTime: { value: 0 },
    uOpacity: { value: 0 },
    uFlash: { value: 0 },
    uTint: { value: new Color() },
    uRip: { value: Array.from({ length: 16 }, () => new Vector4(0, 0, -99, 0)) },
  };
  private next = 0;

  constructor(width: number, depth: number, tint: number) {
    this.uniforms.uTint.value.setHex(tint);
    const mat = new ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      vertexShader: /* glsl */ `
        varying vec3 vWorld;
        void main() { vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */ `
        uniform float uTime, uOpacity, uFlash;
        uniform vec3 uTint;
        uniform vec4 uRip[16];
        varying vec3 vWorld;
        void main() {
          // Sum the rings' slopes (each ring travels out and fades).
          vec2 g = vec2(0.0);
          for (int i = 0; i < 16; i++) {
            float age = uTime - uRip[i].z;
            if (age < 0.0 || age > 2.5) continue;
            vec2 d = vWorld.xz - uRip[i].xy;
            float r = length(d) + 1e-4;
            float front = age * 0.45;
            float ring = exp(-pow((r - front) * 14.0, 2.0)) * cos((r - front) * 60.0);
            float amp = uRip[i].w * exp(-age * 1.6) / (1.0 + r * 6.0);
            g += d / r * ring * amp;
          }
          float slope = length(g);
          vec3 view = normalize(cameraPosition - vWorld);
          vec3 n = normalize(vec3(-g.x * 1.5, 1.0, -g.y * 1.5));
          float fres = pow(1.0 - max(dot(n, view), 0.0), 3.0);
          vec3 col = uTint * (0.6 + uFlash * 2.0) + vec3(0.75, 0.82, 0.95) * (fres * 0.6 + slope * 2.5) * (0.4 + uFlash);
          gl_FragColor = vec4(col, uOpacity * (0.32 + fres * 0.4 + slope * 1.5));
          #include <colorspace_fragment>
        }`,
    });
    const g = new PlaneGeometry(width, depth);
    g.rotateX(-Math.PI / 2);
    this.mesh = new Mesh(g, mat);
    this.mesh.name = 'FloodWater';
    this.mesh.renderOrder = 2;
  }

  /** A new ring at (x, z), strength 0..1, starting at time t. */
  ripple(x: number, z: number, t: number, strength: number): void {
    this.uniforms.uRip.value[this.next].set(x, z, t, strength);
    this.next = (this.next + 1) % 16;
  }
}
