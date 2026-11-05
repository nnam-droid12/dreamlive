import { BackSide, Color, Mesh, ShaderMaterial, SphereGeometry } from '@iwsdk/core';

/**
 * The dream's sky dome: a deep night gradient with twinkling stars (computed in
 * the shader, no geometry), easing into a warm sunrise as `dawn` goes 0 → 1.
 * Centered on the viewer each frame by its owner; drawn behind everything.
 */
export function buildNightSky(radius = 85): Mesh {
  const mat = new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uDawn: { value: 0 },
      uNightTop: { value: new Color(0x03051a) },
      uNightLow: { value: new Color(0x1c2554) },
      uDawnTop: { value: new Color(0x3b5ea8) },
      uDawnLow: { value: new Color(0xffa766) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uDawn;
      uniform vec3 uNightTop, uNightLow, uDawnTop, uDawnLow;
      varying vec3 vDir;
      float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      void main() {
        float h = clamp(vDir.y, -0.2, 1.0);
        vec3 night = mix(uNightLow, uNightTop, smoothstep(0.0, 0.6, h));
        vec3 dawn = mix(uDawnLow, uDawnTop, smoothstep(-0.05, 0.5, h));
        vec3 col = mix(night, dawn, uDawn);
        // Stars: sparse cells on the upper sky, twinkling, fading out at dawn.
        vec3 cell = floor(vDir * 180.0);
        float r = hash(cell);
        float star = step(0.9965, r) * smoothstep(0.05, 0.25, h);
        star *= 0.6 + 0.4 * sin(uTime * (1.0 + r * 3.0) + r * 40.0);
        col += vec3(star) * (1.0 - uDawn);
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
