/**
 * The dream spilling out of the TV into the room: shader-driven particle fields
 * (no per-frame CPU work) and the light beams of the DJ act. All glows add light
 * without writing alpha, so they never darken passthrough.
 */
import { BufferAttribute, BufferGeometry, Color, ConeGeometry, Mesh, Points, ShaderMaterial, Vector3 } from '@iwsdk/core';
import { ADDITIVE_LIGHT, makeBeamMaterial } from './glow-materials.js';

export const SpillMode = { Spray: 0, Confetti: 1, Snow: 2 } as const;

/**
 * A particle field. Spray: droplets leap out of the screen rectangle toward the
 * viewer in arcs. Confetti / Snow: flakes fall through a box with a gentle sway.
 * Frame: `origin` + axes (right, up, normal-into-room); `extent` = box size.
 */
export function makeSpillPoints(mode: number, count: number, colors: readonly number[], size: number): Points {
  const seeds = new Float32Array(count * 4);
  for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random();
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3));
  geo.setAttribute('seed', new BufferAttribute(seeds, 4));
  const mat = new ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      opacity: { value: 0 },
      mode: { value: mode },
      size: { value: size },
      origin: { value: new Vector3() },
      axR: { value: new Vector3(1, 0, 0) },
      axU: { value: new Vector3(0, 1, 0) },
      axN: { value: new Vector3(0, 0, 1) },
      extent: { value: new Vector3(1, 1, 1) },
      colA: { value: new Color(colors[0]) },
      colB: { value: new Color(colors[1] ?? colors[0]) },
      colC: { value: new Color(colors[2] ?? colors[0]) },
    },
    vertexShader: /* glsl */ `
      attribute vec4 seed;
      uniform float time, mode, size;
      uniform vec3 origin, axR, axU, axN, extent, colA, colB, colC;
      varying float vFade;
      varying vec3 vCol;
      varying float vSquare;
      void main() {
        vec3 p;
        if (mode < 0.5) {
          float life = 1.4 + seed.w * 0.9;
          float tau = mod(time + seed.x * life, life);
          vec3 start = origin + axR * ((seed.y - 0.5) * extent.x) + axU * ((seed.z - 0.5) * extent.y);
          float v = 1.4 + seed.w * 1.8;
          p = start + axN * (v * tau) + axR * ((seed.y - 0.5) * 0.9 * tau)
            + vec3(0.0, 1.0, 0.0) * (1.6 * tau - 2.6 * tau * tau);
          vFade = smoothstep(0.0, 0.12, tau) * (1.0 - smoothstep(life * 0.55, life, tau));
        } else {
          float H = extent.y;
          float speed = mode < 1.5 ? 0.7 + seed.w * 0.6 : 0.3 + seed.w * 0.3;
          float y = H - mod(time * speed + seed.y * H, H);
          float sway = mode < 1.5 ? 0.22 : 0.14;
          p = origin
            + axR * ((seed.x - 0.5) * extent.x + sin(time * 1.3 + seed.z * 6.283) * sway)
            + axN * ((seed.z - 0.5) * extent.z + cos(time * 1.1 + seed.x * 6.283) * sway)
            + vec3(0.0, y - 0.5 * H, 0.0);
          vFade = smoothstep(0.0, 0.25, y) * smoothstep(H, H - 0.25, y);
        }
        vCol = seed.y < 0.34 ? colA : (seed.y < 0.67 ? colB : colC);
        vSquare = mode > 0.5 && mode < 1.5 ? 1.0 : 0.0;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = size * 900.0 / max(0.3, -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float opacity;
      varying float vFade;
      varying vec3 vCol;
      varying float vSquare;
      void main() {
        vec2 c = gl_PointCoord * 2.0 - 1.0;
        float disc = 1.0 - smoothstep(0.35, 1.0, length(c));
        float square = step(max(abs(c.x), abs(c.y * 1.8)), 0.8);
        float a = opacity * vFade * mix(disc, square, vSquare);
        if (a < 0.01) discard;
        gl_FragColor = vec4(vCol * a, a);
      }`,
    transparent: true,
    depthWrite: false,
    ...ADDITIVE_LIGHT,
  });
  const points = new Points(geo, mat);
  points.frustumCulled = false;
  points.visible = false;
  return points;
}

/** A soft cone of light; its apex sits at the object origin and it shines along -Y. */
export function makeLightBeam(color: number, length: number, radius: number): Mesh {
  const geo = new ConeGeometry(radius, length, 24, 1, true);
  geo.translate(0, -length / 2, 0);
  const beam = new Mesh(geo, makeBeamMaterial(color));
  beam.frustumCulled = false;
  beam.visible = false;
  return beam;
}
