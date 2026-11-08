import { CircleGeometry, Color, Mesh, ShaderMaterial, Vector3 } from '@iwsdk/core';

/**
 * The sea of clouds below the room: one big disc with a shader that paints a
 * slowly rolling cumulus floor (layered noise), lit from the low sun (bright
 * rims on the sun side, soft violet shadows in the valleys), fading into the
 * morning haze at the horizon. Cheap: one draw call, no textures.
 */
export class CloudSea {
  readonly mesh: Mesh;
  readonly uniforms = {
    uTime: { value: 0 },
    uOpacity: { value: 0 },
    uSun: { value: new Vector3(1, 0.1, 0) },
    uLit: { value: new Color() },
    uShade: { value: new Color() },
    uHaze: { value: new Color() },
    uCenter: { value: new Vector3() },
  };

  constructor(radius: number, lit: number, shade: number, haze: number) {
    this.uniforms.uLit.value.setHex(lit);
    this.uniforms.uShade.value.setHex(shade);
    this.uniforms.uHaze.value.setHex(haze);
    const mat = new ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      vertexShader: /* glsl */ `
        varying vec3 vWorld;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vWorld = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime, uOpacity;
        uniform vec3 uSun, uLit, uShade, uHaze, uCenter;
        varying vec3 vWorld;
        // 2D simplex noise (Ashima Arts / Stefan Gustavson, MIT): smooth, no grid artefacts.
        vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
        float snoise(vec2 v) {
          const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
          vec2 i = floor(v + dot(v, C.yy));
          vec2 x0 = v - i + dot(i, C.xx);
          vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
          vec4 x12 = x0.xyxy + C.xxzz;
          x12.xy -= i1;
          i = mod(i, 289.0);
          vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
          vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
          m = m * m;
          m = m * m;
          vec3 x = 2.0 * fract(p * C.www) - 1.0;
          vec3 h = abs(x) - 0.5;
          vec3 ox = floor(x + 0.5);
          vec3 a0 = x - ox;
          m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
          vec3 g;
          g.x = a0.x * x0.x + h.x * x0.y;
          g.yz = a0.yz * x12.xz + h.yz * x12.yw;
          return 130.0 * dot(m, g);
        }
        float fbm(vec2 p) {
          float v = 0.0, a = 0.5;
          for (int i = 0; i < 4; i++) { v += a * (snoise(p) * 0.5 + 0.5); p = p * 2.07 + vec2(1.7, 9.2); a *= 0.5; }
          return v / 0.9375;
        }
        float heap(vec2 p) {
          // Billowy heaps: sharpened noise, rounded tops.
          return smoothstep(0.22, 0.85, fbm(p));
        }
        void main() {
          float dist = length(vWorld.xz - uCenter.xz);
          float hz = smoothstep(25.0, 380.0, dist);
          vec2 p = (vWorld.xz - uCenter.xz) * 0.022 + vec2(uTime * 0.006, uTime * 0.002);
          float h = heap(p);
          // Relief from the height gradient, flattened with distance (no shimmer at the horizon).
          float e = 0.06;
          float hx = heap(p + vec2(e, 0.0));
          float hzz = heap(p + vec2(0.0, e));
          float k = 6.0 * (1.0 - hz);
          vec3 n = normalize(vec3(-(hx - h) / e * 0.05 * k, 1.0, -(hzz - h) / e * 0.05 * k));
          vec3 sun = normalize(uSun);
          float diff = clamp(dot(n, sun) * 2.2 + 0.15, 0.0, 1.0);
          // Soft, sunlit billows: brightness from height (light scatters through the heaps) and relief;
          // fine cauliflower detail on top, fading with distance.
          float detail = fbm(p * 5.3 + 4.1) * (1.0 - hz);
          float b = clamp(0.18 + h * 0.5 + diff * 0.45 + (detail - 0.5) * 0.35, 0.0, 1.0);
          vec3 col = mix(uShade, uLit, b);
          col += uLit * smoothstep(0.8, 1.0, b) * 0.12;
          col = mix(col, uHaze, hz);
          float edge = 1.0 - smoothstep(520.0, 600.0, dist);
          gl_FragColor = vec4(col, uOpacity * edge);
          #include <colorspace_fragment>
        }`,
    });
    this.mesh = new Mesh(new CircleGeometry(radius, 64), mat);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.name = 'CloudSea';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1;
  }
}
