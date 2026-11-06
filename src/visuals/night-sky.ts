import { BackSide, Color, Mesh, ShaderMaterial, SphereGeometry, Texture, Vector3 } from '@iwsdk/core';
import { Palette } from '../config/palette.js';

/** Where the sun sits across each sky photo (equirect u, 0..1); the dome turns it onto our sunlight. */
const PHOTO_SUN_U = 0.59;

/**
 * The dream's sky dome. Real photographed skies (CC0 Poly Haven panoramas in
 * public/env/sky): golden hour, a starry moonlit night, and sunrise, blended by
 * `dusk` (night → golden hour) and `dawn` (→ sunrise), and turned so each photo's
 * sun lines up with the scene's sunlight. A soft twinkle of stars is added at
 * night. Until the photos load, a simple gradient stands in. Centered on the
 * viewer each frame by its owner; drawn behind everything.
 */
export function buildNightSky(radius = 85): Mesh {
  const mat = new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uDawn: { value: 0 },
      uDusk: { value: 0 },
      uSunDir: { value: new Vector3(0.8, 0.1, -0.5).normalize() },
      uPhotoSun: { value: (PHOTO_SUN_U - 0.5) * Math.PI * 2 },
      uReady: { value: 0 },
      uGolden: { value: null as Texture | null },
      uNight: { value: null as Texture | null },
      uSunrise: { value: null as Texture | null },
      uNightGain: { value: new Color(Palette.skyNightGain) },
      uNightTop: { value: new Color(Palette.skyNightTop) },
      uNightLow: { value: new Color(Palette.skyNightLow) },
      uDuskTop: { value: new Color(Palette.skyDuskTop) },
      uDuskLow: { value: new Color(Palette.skyDuskLow) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      #include <common>
      uniform float uTime, uDawn, uDusk, uPhotoSun, uReady;
      uniform vec3 uSunDir, uNightGain, uNightTop, uNightLow, uDuskTop, uDuskLow;
      uniform sampler2D uGolden, uNight, uSunrise;
      varying vec3 vDir;
      float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      void main() {
        vec3 d = normalize(vDir);
        float h = clamp(d.y, -0.2, 1.0);
        vec3 col;
        if (uReady > 0.5) {
          // Equirect lookup, turned so the photo's sun sits where our sun is.
          float az = atan(d.z, d.x) - atan(uSunDir.z, uSunDir.x) + uPhotoSun;
          vec2 uv = vec2(fract(az * RECIPROCAL_PI2 + 0.5), asin(clamp(d.y, -1.0, 1.0)) * RECIPROCAL_PI + 0.5);
          vec3 night = texture2D(uNight, uv).rgb * uNightGain;
          vec3 golden = texture2D(uGolden, uv).rgb;
          vec3 sunrise = texture2D(uSunrise, uv).rgb;
          col = mix(night, golden, uDusk);
          col = mix(col, sunrise, uDawn);
        } else {
          col = mix(mix(uNightLow, uNightTop, smoothstep(0.0, 0.6, h)), mix(uDuskLow, uDuskTop, smoothstep(0.0, 0.6, h)), uDusk);
        }
        // A light twinkle of stars at night, high in the sky.
        vec3 cell = floor(d * 180.0);
        float r = hash(cell);
        float star = step(0.997, r) * smoothstep(0.08, 0.3, h) * (0.6 + 0.4 * sin(uTime * (1.0 + r * 3.0) + r * 40.0));
        col += vec3(star) * 0.7 * (1.0 - max(uDusk, uDawn));
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
    side: BackSide,
    depthWrite: false,
  });
  const sky = new Mesh(new SphereGeometry(radius, 48, 24), mat);
  sky.name = 'DreamSky';
  sky.renderOrder = -20;
  sky.frustumCulled = false;
  return sky;
}

/** Hands the loaded sky photos to the dome (sRGB textures). */
export function setSkyPhotos(sky: Mesh, golden: Texture, night: Texture, sunrise: Texture): void {
  const u = (sky.material as ShaderMaterial).uniforms;
  u.uGolden.value = golden;
  u.uNight.value = night;
  u.uSunrise.value = sunrise;
  u.uReady.value = 1;
}
