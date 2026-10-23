/**
 * Small shader materials for the soft-glow paper-dream look. All are cheap
 * single-pass fragment shaders suitable for Quest; additive ones never write depth.
 */
import {
  AddEquation,
  BackSide,
  Color,
  CustomBlending,
  NormalBlending,
  OneFactor,
  ShaderMaterial,
  ZeroFactor,
} from '@iwsdk/core';

/**
 * Adds premultiplied light without touching canvas alpha. In passthrough AR the
 * compositor treats alpha as "covers the room", so plain additive blending would
 * darken the real world around every glow.
 */
export const ADDITIVE_LIGHT = {
  blending: CustomBlending,
  blendEquation: AddEquation,
  blendSrc: OneFactor,
  blendDst: OneFactor,
  blendSrcAlpha: ZeroFactor,
  blendDstAlpha: OneFactor,
} as const;

const PLANE_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

/** Starlight ring on a unit plane: ring radius as a fraction of the plane half-size. */
export function makeRingMaterial(color: number): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      color: { value: new Color(color) },
      opacity: { value: 0 },
      radius: { value: 0.72 },
      thickness: { value: 0.07 },
      fill: { value: 0.15 },
      time: { value: 0 },
    },
    vertexShader: PLANE_VERT,
    fragmentShader: /* glsl */ `
      uniform vec3 color;
      uniform float opacity, radius, thickness, fill, time;
      varying vec2 vUv;
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float d = length(p);
        float ring = exp(-pow((d - radius) / thickness, 2.0));
        float a = atan(p.y, p.x);
        float sparkle = 0.65 + 0.35 * sin(a * 23.0 + time * 3.0) * sin(a * 7.0 - time * 1.7);
        float inner = fill * exp(-pow(d / radius, 2.0) * 2.0);
        float alpha = (ring * sparkle + inner) * opacity * smoothstep(1.0, 0.9, d);
        gl_FragColor = vec4(color * alpha, alpha);
      }`,
    transparent: true,
    depthWrite: false,
    ...ADDITIVE_LIGHT,
  });
}

/** Feathered rectangle (night tint on the table). `feather` is in UV units. */
export function makeSoftRectMaterial(color: number): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      color: { value: new Color(color) },
      opacity: { value: 0 },
      feather: { value: 0.12 },
    },
    vertexShader: PLANE_VERT,
    fragmentShader: /* glsl */ `
      uniform vec3 color;
      uniform float opacity, feather;
      varying vec2 vUv;
      void main() {
        vec2 e = min(vUv, 1.0 - vUv);
        float edge = smoothstep(0.0, feather, e.x) * smoothstep(0.0, feather, e.y);
        gl_FragColor = vec4(color, opacity * edge);
      }`,
    transparent: true,
    depthWrite: false,
    blending: NormalBlending,
  });
}

/** Soft radial disc (contact glow, cloud platform underglow). */
export function makeDiscMaterial(color: number): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { color: { value: new Color(color) }, opacity: { value: 0 } },
    vertexShader: PLANE_VERT,
    fragmentShader: /* glsl */ `
      uniform vec3 color;
      uniform float opacity;
      varying vec2 vUv;
      void main() {
        float d = length(vUv * 2.0 - 1.0);
        float alpha = opacity * exp(-d * d * 4.0) * smoothstep(1.0, 0.85, d);
        gl_FragColor = vec4(color * alpha, alpha);
      }`,
    transparent: true,
    depthWrite: false,
    ...ADDITIVE_LIGHT,
  });
}

/** Drifting, twinkling star points. Attribute `seed` (0..1) varies each star. */
export function makeStarMaterial(color: number): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      color: { value: new Color(color) },
      opacity: { value: 0 },
      time: { value: 0 },
      size: { value: 14 },
    },
    vertexShader: /* glsl */ `
      attribute float seed;
      uniform float time, size;
      varying float vTwinkle;
      void main() {
        vec3 p = position;
        p.x += sin(time * 0.11 + seed * 40.0) * 0.03;
        p.y += sin(time * 0.17 + seed * 23.0) * 0.02;
        p.z += cos(time * 0.13 + seed * 31.0) * 0.03;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vTwinkle = 0.55 + 0.45 * sin(time * (1.2 + seed * 2.0) + seed * 60.0);
        gl_PointSize = size * (0.4 + seed * 0.8) / max(0.05, -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 color;
      uniform float opacity;
      varying float vTwinkle;
      void main() {
        float d = length(gl_PointCoord * 2.0 - 1.0);
        float alpha = opacity * vTwinkle * exp(-d * d * 3.5) * step(d, 1.0);
        gl_FragColor = vec4(color * alpha, alpha);
      }`,
    transparent: true,
    depthWrite: false,
    ...ADDITIVE_LIGHT,
  });
}

/**
 * Head-locked dark shell that dims the passthrough room, stronger toward the
 * edges of view. Rendered first; dream objects inside it draw on top.
 */
export function makeVignetteMaterial(color: number): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { color: { value: new Color(color) }, opacity: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vView;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vView = mv.xyz;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 color;
      uniform float opacity;
      varying vec3 vView;
      void main() {
        float centered = max(0.0, -normalize(vView).z);
        float edge = 1.0 - smoothstep(0.55, 0.98, centered);
        gl_FragColor = vec4(color, opacity * (0.7 + 0.3 * edge));
      }`,
    side: BackSide,
    transparent: true,
    depthWrite: false,
    depthTest: true,
  });
}
