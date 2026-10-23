/**
 * The moonlit paper sea: one flat plane shaded as gentle waves, clipped to the
 * real table (foam line at its edge), growing out of a calm pool around the
 * sleeping Dreamer. `waveHeight` mirrors the shader so boats bob in sync.
 */
import { Color, ShaderMaterial, Vector2 } from '@iwsdk/core';
import { Palette } from '../config/palette.js';

export function waveHeight(x: number, z: number, t: number, storm: number): number {
  const calm = Math.sin(x * 38 + t * 1.3) * 0.5 + Math.sin(z * 31 - t * 1.0 + x * 11) * 0.5;
  const rough = Math.sin(x * 21 - t * 3.1) * Math.sin(z * 25 + t * 2.6);
  return (calm + storm * 1.8 * rough) * 0.0025;
}

export function makeSeaMaterial(width: number, depth: number): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      size: { value: new Vector2(width, depth) },
      rise: { value: 0 },
      storm: { value: 0 },
      opacity: { value: 0.88 },
      pool: { value: new Vector2(0, 0) },
      poolRadius: { value: 0.09 },
      deep: { value: new Color(Palette.seaDeep) },
      shallow: { value: new Color(Palette.seaShallow) },
      moon: { value: new Color(Palette.moonBlueSoft) },
      foam: { value: new Color(Palette.starWhite) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float time, rise, storm, opacity, poolRadius;
      uniform vec2 size, pool;
      uniform vec3 deep, shallow, moon, foam;
      varying vec2 vUv;
      void main() {
        // Local meters: x right, y = stage +Z (toward the user).
        vec2 p = (vUv - 0.5) * size * vec2(1.0, -1.0);
        float calm = sin(p.x * 38.0 + time * 1.3) * 0.5 + sin(p.y * 31.0 - time * 1.0 + p.x * 11.0) * 0.5;
        float rough = sin(p.x * 21.0 - time * 3.1) * sin(p.y * 25.0 + time * 2.6);
        float h = calm + storm * 1.8 * rough;
        float shade = 0.45 + 0.3 * h;
        vec3 col = mix(deep, shallow, shade);
        // Moonlit crests: thin bright bands along the wave tops.
        float crest = smoothstep(0.55, 0.95, h * 0.5 + 0.5);
        col = mix(col, moon, crest * 0.35);
        float glint = pow(max(0.0, sin(p.x * 70.0 + time * 2.0) * sin(p.y * 64.0 - time * 1.6 + p.x * 9.0)), 28.0);
        col += moon * glint * 0.5 * (1.0 - storm * 0.5);

        vec2 edge = size * 0.5 - abs(p);
        float edgeDist = min(edge.x, edge.y);
        float foamLine = smoothstep(0.018, 0.0, edgeDist) * (0.75 + 0.25 * sin(time * 2.0 + (p.x + p.y) * 50.0));
        float inside = smoothstep(-0.002, 0.004, edgeDist);

        float r = length(p - pool);
        float reach = rise * length(size) * 0.65;
        float front = smoothstep(reach, reach - 0.03, r);
        float frontFoam = smoothstep(0.012, 0.0, abs(r - reach)) * step(0.01, rise) * step(rise, 0.99);
        float poolEdge = r - poolRadius;
        float poolMask = smoothstep(0.0, 0.012, poolEdge);
        float poolFoam = smoothstep(0.014, 0.0, abs(poolEdge)) * 0.8;

        float f = clamp(foamLine + frontFoam + poolFoam + storm * 0.25 * max(0.0, rough), 0.0, 1.0);
        col = mix(col, foam, f * 0.85);
        float alpha = opacity * inside * front * max(poolMask, poolFoam);
        gl_FragColor = vec4(col, alpha);
      }`,
    transparent: true,
    depthWrite: false,
  });
}
