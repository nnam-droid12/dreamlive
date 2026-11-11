import { Color, createSystem, Object3D, ShaderMaterial, SkinnedMesh } from '@iwsdk/core';
import { Palette } from '../config/palette.js';

/**
 * Hands like the headset's own: IWSDK draws tracked hands as an invisible
 * body with a white outline. This gives that body a dark smoky-glass fill with
 * a bright white edge (fading towards the wrist), so hands read clearly over the dream and over passthrough.
 */
export class HandLookSystem extends createSystem({}) {
  private fill!: ShaderMaterial;
  private done = new WeakSet<Object3D>();
  private every = 0;

  init(): void {
    this.fill = new ShaderMaterial({
      uniforms: { uColor: { value: new Color(Palette.handGlass) }, uRim: { value: new Color(Palette.handRim) } },
      vertexShader: /* glsl */ `
        #include <common>
        #include <skinning_pars_vertex>
        attribute float wristDist;
        varying float vWrist;
        varying vec3 vNormal;
        varying vec3 vView;
        void main() {
          #include <skinbase_vertex>
          #include <beginnormal_vertex>
          #include <skinnormal_vertex>
          #include <defaultnormal_vertex>
          vec3 transformed = vec3(position);
          #include <skinning_vertex>
          vec4 mv = modelViewMatrix * vec4(transformed, 1.0);
          vNormal = normalize(transformedNormal);
          vView = normalize(-mv.xyz);
          vWrist = wristDist;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform vec3 uRim;
        varying float vWrist;
        varying vec3 vNormal;
        varying vec3 vView;
        void main() {
          float rim = 1.0 - abs(dot(normalize(vNormal), normalize(vView)));
          // Dark smoky glass with a bright white edge: reads on bright walls and night skies alike.
          float edge = smoothstep(0.55, 0.95, rim);
          float a = (0.55 + 0.4 * edge) * smoothstep(0.03, 0.08, vWrist);
          vec3 c = mix(uColor, uRim, edge);
          gl_FragColor = vec4(c, a);
        }`,
      transparent: true,
      depthWrite: false,
    });
  }

  update(): void {
    // Hand visuals load when hands connect; look for new ones a few times a second.
    if (++this.every % 20 !== 0) return;
    this.player.traverse((o) => {
      const m = o as SkinnedMesh;
      if (!m.isSkinnedMesh || this.done.has(m)) return;
      const mat = m.material as ShaderMaterial;
      if (!mat?.uniforms?.outlineColor) return;
      this.done.add(m);
      // The outline: a soft glow rather than plain white.
      mat.uniforms.outlineColor.value = new Color(Palette.handOutline);
      // The frosted body: same skinned geometry, drawn just before the outline.
      const body = m.clone();
      body.material = this.fill;
      body.renderOrder = 998;
      this.done.add(body);
      m.parent?.add(body);
    });
  }
}
