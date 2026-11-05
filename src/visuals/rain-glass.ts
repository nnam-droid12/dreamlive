import { AdditiveBlending, Color, Mesh, PlaneGeometry, ShaderMaterial } from '@iwsdk/core';

/**
 * Raindrops running down a window: wobbling drops that leave a trail of tiny
 * droplets, two layers of different sizes. Drawn additively as soft highlights
 * on the glass (no refraction, so it is cheap). Plane faces +z; size in metres.
 */
export function buildRainGlass(width: number, height: number, tint: number): Mesh {
  const mat = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uAmount: { value: 0 },
      uSize: { value: [width, height] },
      uTint: { value: new Color(tint) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uAmount;
      uniform vec2 uSize;
      uniform vec3 uTint;
      varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      float layer(vec2 m, float t) {
        vec2 aspect = vec2(2.0, 1.0);
        vec2 uv = m * aspect;
        uv.y += t * 0.25;
        vec2 gv = fract(uv) - 0.5;
        vec2 id = floor(uv);
        float n = hash(id);
        t += n * 6.2831;
        float w = m.y * 10.0;
        float x = (n - 0.5) * 0.8;
        x += (0.4 - abs(x)) * sin(3.0 * w) * pow(sin(w), 6.0) * 0.45;
        float y = -sin(t + sin(t + sin(t) * 0.5)) * 0.45;
        y -= (gv.x - x) * (gv.x - x);
        vec2 dropPos = (gv - vec2(x, y)) / aspect;
        float drop = smoothstep(0.05, 0.03, length(dropPos));
        vec2 trailPos = (gv - vec2(x, t * 0.25)) / aspect;
        trailPos.y = (fract(trailPos.y * 8.0) - 0.5) / 8.0;
        float trail = smoothstep(0.03, 0.01, length(trailPos));
        float fogTrail = smoothstep(-0.05, 0.05, dropPos.y) * smoothstep(0.5, y, gv.y);
        trail *= fogTrail;
        return drop + trail * 0.6 * step(0.35, n);
      }
      void main() {
        vec2 m = vUv * uSize;
        float t = uTime;
        float v = layer(m * 3.2, t) + layer(m * 5.1 + 7.3, t * 1.1) * 0.7;
        float a = clamp(v, 0.0, 1.0) * 0.9 * uAmount;
        if (a < 0.004) discard;
        gl_FragColor = vec4(uTint * a, a);
      }`,
  });
  const mesh = new Mesh(new PlaneGeometry(width, height), mat);
  mesh.name = 'RainOnGlass';
  mesh.renderOrder = 25;
  mesh.visible = false;
  return mesh;
}
