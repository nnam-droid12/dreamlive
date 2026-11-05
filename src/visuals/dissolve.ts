import { Color, MeshStandardMaterial, Vector4 } from '@iwsdk/core';

/** Uniforms that drive a dissolving surface (all in the mesh's local plane units). */
export interface DissolveUniforms {
  /** 0 solid .. 1 fully dissolved, over the whole surface. */
  progress: { value: number };
  /** A rectangle (x0, y0, x1, y1 in local plane coordinates) that dissolves on its own. */
  hole: { value: Vector4 };
  /** 0 closed .. 1 fully open, for the rectangle. */
  holeOpen: { value: number };
  edgeColor: { value: Color };
}

/**
 * Makes a standard material dissolve like a dream: ragged, noise-shaped holes
 * spread across the surface with a glowing edge, revealing whatever is behind
 * it (the city, the night sky). Works on planes; uses local x/y for the pattern.
 */
export function makeDissolving(mat: MeshStandardMaterial, edge = 0xffd89a): DissolveUniforms {
  const u: DissolveUniforms = {
    progress: { value: 0 },
    hole: { value: new Vector4(0, 0, 0, 0) },
    holeOpen: { value: 0 },
    edgeColor: { value: new Color(edge) },
  };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, { uProgress: u.progress, uHole: u.hole, uHoleOpen: u.holeOpen, uEdge: u.edgeColor });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vDissolve;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDissolve = position.xy;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec2 vDissolve;
        uniform float uProgress;
        uniform vec4 uHole;
        uniform float uHoleOpen;
        uniform vec3 uEdge;
        float dHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float dNoise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(dHash(i), dHash(i + vec2(1.0, 0.0)), f.x), mix(dHash(i + vec2(0.0, 1.0)), dHash(i + vec2(1.0, 1.0)), f.x), f.y);
        }
        float dFbm(vec2 p) { return 0.6 * dNoise(p) + 0.3 * dNoise(p * 2.3) + 0.1 * dNoise(p * 5.1); }`,
      )
      .replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
        {
          float n = dFbm(vDissolve * 2.2);
          // Whole-surface dissolve.
          float cut = uProgress * 1.15 - 0.05;
          // The drawn rectangle opens from its middle outward, with a ragged rim.
          vec2 c = 0.5 * (uHole.xy + uHole.zw);
          vec2 h = max(vec2(1e-3), 0.5 * abs(uHole.zw - uHole.xy));
          float r = max(abs(vDissolve.x - c.x) / h.x, abs(vDissolve.y - c.y) / h.y);
          float holeCut = uHoleOpen * 1.25 - r + (n - 0.5) * 0.25;
          if (n < cut || holeCut > 0.0) discard;
          float glow = smoothstep(0.07, 0.0, n - cut) * step(0.001, uProgress) + smoothstep(-0.12, 0.0, holeCut) * step(0.001, uHoleOpen);
          gl_FragColor.rgb += uEdge * glow * 2.0;
        }`,
      );
  };
  mat.customProgramCacheKey = () => 'dream-dissolve';
  return u;
}
