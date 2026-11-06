import { BackSide, Color, Mesh, ShaderMaterial, SphereGeometry, Vector3 } from '@iwsdk/core';
import { Palette } from '../config/palette.js';

/**
 * The dream's sky dome, all in the shader (no textures):
 * - `dusk` 0 → 1 blends a night sky (gradient + twinkling stars) into a golden
 *   sunset (gold horizon, pink band, deep blue above) with a low sun and its glow;
 * - `dawn` 0 → 1 then eases whatever is showing into a warm sunrise;
 * - soft clouds drift low in the sky, lit gold at sunset and blue-grey at night.
 * Centered on the viewer each frame by its owner; drawn behind everything.
 */
export function buildNightSky(radius = 85): Mesh {
  const mat = new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uDawn: { value: 0 },
      uDusk: { value: 0 },
      uSunDir: { value: new Vector3(0.8, 0.1, -0.5).normalize() },
      uNightTop: { value: new Color(Palette.skyNightTop) },
      uNightLow: { value: new Color(Palette.skyNightLow) },
      uDawnTop: { value: new Color(Palette.skyDawnTop) },
      uDawnLow: { value: new Color(Palette.skyDawnLow) },
      uDuskTop: { value: new Color(Palette.skyDuskTop) },
      uDuskMid: { value: new Color(Palette.skyDuskMid) },
      uDuskLow: { value: new Color(Palette.skyDuskLow) },
      uSun: { value: new Color(Palette.sunDisc) },
      uSunGlow: { value: new Color(Palette.sunGlow) },
      uCloudLit: { value: new Color(Palette.cloudLit) },
      uCloudNight: { value: new Color(Palette.cloudNight) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uDawn, uDusk;
      uniform vec3 uSunDir;
      uniform vec3 uNightTop, uNightLow, uDawnTop, uDawnLow, uDuskTop, uDuskMid, uDuskLow;
      uniform vec3 uSun, uSunGlow, uCloudLit, uCloudNight;
      varying vec3 vDir;
      float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash2(i), hash2(i + vec2(1.0, 0.0)), u.x), mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0)), u.x), u.y);
      }
      float fbm(vec2 p) {
        float v = 0.0, a = 0.5;
        for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
        return v;
      }
      void main() {
        vec3 d = normalize(vDir);
        float h = clamp(d.y, -0.2, 1.0);
        vec3 night = mix(uNightLow, uNightTop, smoothstep(0.0, 0.6, h));
        vec3 dusk = mix(uDuskLow, uDuskMid, smoothstep(-0.02, 0.16, h));
        dusk = mix(dusk, uDuskTop, smoothstep(0.12, 0.65, h));
        vec3 dawn = mix(uDawnLow, uDawnTop, smoothstep(-0.05, 0.5, h));
        vec3 col = mix(night, dusk, uDusk);
        col = mix(col, dawn, uDawn);

        // The low sun and its glow (at sunset and at sunrise).
        float sunAmt = max(uDusk, uDawn);
        float s = max(dot(d, normalize(uSunDir)), 0.0);
        col += uSunGlow * (pow(s, 6.0) * 0.35 + pow(s, 48.0) * 0.6) * sunAmt;
        col = mix(col, uSun, smoothstep(0.9988, 0.9993, s) * sunAmt);

        // Soft clouds in a band above the horizon, drifting slowly.
        vec2 cp = d.xz / (d.y + 0.18) * 1.6 + vec2(uTime * 0.006, 0.0);
        float c = fbm(cp);
        float band = smoothstep(0.02, 0.12, h) * smoothstep(0.55, 0.18, h);
        float cloud = smoothstep(0.48, 0.78, c) * band;
        vec3 cloudCol = mix(uCloudNight, uCloudLit, sunAmt);
        cloudCol += uSunGlow * pow(s, 4.0) * 0.4 * sunAmt;
        col = mix(col, cloudCol, cloud * 0.8);

        // Stars: sparse cells on the upper sky, twinkling; gone in daylight.
        vec3 cell = floor(d * 180.0);
        float r = hash(cell);
        float star = step(0.9965, r) * smoothstep(0.05, 0.25, h) * (1.0 - cloud);
        star *= 0.6 + 0.4 * sin(uTime * (1.0 + r * 3.0) + r * 40.0);
        col += vec3(star) * (1.0 - sunAmt);
        gl_FragColor = vec4(col, 1.0);
      }`,
    side: BackSide,
    depthWrite: false,
  });
  const sky = new Mesh(new SphereGeometry(radius, 32, 16), mat);
  sky.name = 'DreamSky';
  sky.renderOrder = -20;
  sky.frustumCulled = false;
  return sky;
}
