import { MeshStandardMaterial, Vector4 } from '@iwsdk/core';

export interface EqualizerUniforms {
  /** Live bands: x bass, y mids, z highs, w kick (0..1). */
  bands: { value: Vector4 };
  /** 0 = ordinary lit windows, 1 = the whole skyline is a music visualizer. */
  amount: { value: number };
  /** World height of the street and the span the meter climbs over (m). */
  base: { value: number };
  span: { value: number };
}

/**
 * Turns a facade material into a music visualizer: each tower (picked by its
 * position) follows the bass, the mids or the highs like a VU meter. Its windows
 * light up from the street to the current level, with a bright line at the peak,
 * and everything flashes a little on each kick. With `amount` 0 nothing changes.
 */
export function makeEqualizer(mat: MeshStandardMaterial, peak = 0xffd9a0): EqualizerUniforms {
  const u: EqualizerUniforms = {
    bands: { value: new Vector4() },
    amount: { value: 0 },
    base: { value: -45 },
    span: { value: 80 },
  };
  const pr = ((peak >> 16) & 255) / 255;
  const pg = ((peak >> 8) & 255) / 255;
  const pb = (peak & 255) / 255;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uEqBands = u.bands;
    shader.uniforms.uEqAmount = u.amount;
    shader.uniforms.uEqBase = u.base;
    shader.uniforms.uEqSpan = u.span;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vEqWorld;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvEqWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vEqWorld;\nuniform vec4 uEqBands;\nuniform float uEqAmount;\nuniform float uEqBase;\nuniform float uEqSpan;',
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        if (uEqAmount > 0.001) {
          // Which band this tower follows: a stable pick from its position.
          float id = floor(vEqWorld.x / 7.0) + floor(vEqWorld.z / 7.0) * 3.0;
          float pick = fract(sin(id * 12.9898) * 43758.5453);
          float band = pick < 0.34 ? uEqBands.x : (pick < 0.67 ? uEqBands.y : uEqBands.z);
          float h = clamp((vEqWorld.y - uEqBase) / uEqSpan, 0.0, 1.0);
          float level = clamp(band * 1.25 + uEqBands.w * 0.2, 0.0, 1.0);
          float lit = smoothstep(level + 0.015, level - 0.015, h);
          float cap = smoothstep(0.025, 0.0, abs(h - level));
          totalEmissiveRadiance *= mix(1.0, 0.2 + 1.7 * lit + 0.6 * uEqBands.w, uEqAmount);
          totalEmissiveRadiance += uEqAmount * cap * vec3(${pr.toFixed(3)}, ${pg.toFixed(3)}, ${pb.toFixed(3)}) * 0.9;
        }`,
      );
  };
  mat.customProgramCacheKey = () => 'dream-equalizer';
  return u;
}
