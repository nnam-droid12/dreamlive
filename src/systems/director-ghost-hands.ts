import { AdditiveBlending, BackSide, CapsuleGeometry, Color, Group, Mesh, Object3D, ShaderMaterial, SphereGeometry, Vector3 } from '@iwsdk/core';
import { Palette } from '../config/palette.js';

/**
 * Trailer-only hands (Director mode): the emulator's tracked-hand model does
 * not show in offline captures, so the Director draws these frosted-glass hands
 * for the camera at the same poses it gives the emulated hands. An articulated
 * palm, a two-joint thumb and four three-joint fingers; a light glass body with
 * a cool rim, and a soft outer glow. Identity pose: palm down, fingers forward
 * (-Z); +X is the hand's right.
 */
const FINGERS = [
  // x across the palm (left hand: thumb side is +X), segment lengths (m), radius.
  { name: 'index', x: 0.03, len: [0.042, 0.026, 0.021], r: 0.0095 },
  { name: 'middle', x: 0.01, len: [0.046, 0.029, 0.022], r: 0.0098 },
  { name: 'ring', x: -0.01, len: [0.043, 0.027, 0.021], r: 0.0093 },
  { name: 'pinky', x: -0.029, len: [0.034, 0.021, 0.019], r: 0.0082 },
] as const;

/** Curl per finger joint (radians, + bends toward the palm) for each pose. */
const POSES: Record<string, { fingers: [number, number, number][]; thumb: [number, number]; thumbOut: number }> = {
  default: { fingers: [[0.25, 0.3, 0.2], [0.3, 0.35, 0.2], [0.35, 0.4, 0.25], [0.4, 0.45, 0.3]], thumb: [0.2, 0.2], thumbOut: 0.5 },
  open: { fingers: [[0.05, 0.05, 0.03], [0.05, 0.05, 0.03], [0.06, 0.06, 0.04], [0.08, 0.08, 0.05]], thumb: [0.05, 0.05], thumbOut: 0.75 },
  point: { fingers: [[0.02, 0.03, 0.02], [1.4, 1.5, 0.9], [1.45, 1.55, 0.9], [1.5, 1.55, 0.9]], thumb: [0.6, 0.5], thumbOut: 0.25 },
  pinch: { fingers: [[0.7, 0.7, 0.4], [0.5, 0.5, 0.3], [0.55, 0.55, 0.3], [0.6, 0.6, 0.35]], thumb: [0.45, 0.35], thumbOut: 0.2 },
  cup: { fingers: [[0.35, 0.3, 0.2], [0.35, 0.3, 0.2], [0.38, 0.32, 0.2], [0.42, 0.35, 0.22]], thumb: [0.25, 0.2], thumbOut: 0.55 },
};

function glassMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uBody: { value: new Color(Palette.handGlass) }, uRim: { value: new Color(Palette.handRim) } },
    vertexShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uBody, uRim;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        float rim = 1.0 - abs(dot(normalize(vN), normalize(vV)));
        float a = 0.3 + 0.55 * pow(rim, 1.8);
        gl_FragColor = vec4(mix(uBody, uRim, smoothstep(0.25, 0.95, rim)), a);
      }`,
  });
}

function glowMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: BackSide,
    uniforms: { uGlow: { value: new Color(Palette.handOutline) } },
    vertexShader: /* glsl */ `
      varying float vRim;
      void main() {
        vec3 p = position + normal * 0.0035;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vRim = 1.0 - abs(dot(normalize(normalMatrix * normal), normalize(-mv.xyz)));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uGlow;
      varying float vRim;
      void main() { gl_FragColor = vec4(uGlow * pow(vRim, 2.0) * 0.55, 1.0); }`,
  });
}

interface Joint {
  pivot: Object3D;
}

export class GhostHand {
  readonly root = new Group();
  private fingers: Joint[][] = [];
  private thumb: Joint[] = [];
  private thumbBase = new Group();

  constructor(side: 'left' | 'right') {
    const body = glassMaterial();
    const glow = glowMaterial();
    const part = (geo: CapsuleGeometry | SphereGeometry, parent: Object3D) => {
      const m = new Mesh(geo, body);
      const g = new Mesh(geo, glow);
      m.renderOrder = 900;
      g.renderOrder = 899;
      parent.add(g, m);
      return m;
    };
    const flip = side === 'right' ? -1 : 1;
    // Palm: a softly rounded slab (a squashed capsule) from the wrist forward.
    const palmGeo = new CapsuleGeometry(0.034, 0.05, 6, 14);
    palmGeo.rotateX(Math.PI / 2);
    palmGeo.scale(1.22, 0.3, 1);
    const palm = part(palmGeo, this.root);
    palm.position.z = -0.045;
    // Fingers: three capsule segments each, hinged at the knuckles.
    for (const f of FINGERS) {
      const joints: Joint[] = [];
      let parent: Object3D = this.root;
      let z = -0.095;
      f.len.forEach((len, i) => {
        const pivot = new Group();
        pivot.position.set(i === 0 ? f.x * flip : 0, i === 0 ? 0.002 : 0, i === 0 ? z : -f.len[i - 1]);
        // A natural spread: fingers fan out a little from the knuckles.
        if (i === 0) pivot.rotation.y = (f.x / 0.03) * 0.07 * flip;
        parent.add(pivot);
        const geo = new CapsuleGeometry(f.r * (1 - i * 0.08), len - f.r * 1.6, 4, 10);
        geo.rotateX(Math.PI / 2);
        geo.translate(0, 0, -len / 2);
        part(geo, pivot);
        joints.push({ pivot });
        parent = pivot;
        z = 0;
      });
      this.fingers.push(joints);
    }
    // Thumb: from the side of the palm near the wrist, angled out and forward.
    this.thumbBase.position.set(0.04 * flip, -0.004, -0.03);
    this.root.add(this.thumbBase);
    let parent: Object3D = this.thumbBase;
    [0.036, 0.03].forEach((len, i) => {
      const pivot = new Group();
      pivot.position.z = i === 0 ? 0 : -0.036;
      parent.add(pivot);
      const geo = new CapsuleGeometry(0.011 - i * 0.001, len - 0.016, 4, 10);
      geo.rotateX(Math.PI / 2);
      geo.translate(0, 0, -len / 2);
      part(geo, pivot);
      this.thumb.push({ pivot });
      parent = pivot;
    });
    this.side = flip;
    this.root.visible = false;
  }

  private side: number;

  /** Ease toward a named pose (k = 0..1 per frame); pinch 0..1 closes thumb and index. */
  pose(name: string, pinch: number, k: number): void {
    const p = POSES[name] ?? POSES.default;
    const target = pinch > 0.5 ? POSES.pinch : p;
    this.fingers.forEach((joints, fi) => joints.forEach((j, ji) => this.ease(j.pivot, 'x', -target.fingers[fi][ji], k)));
    this.ease(this.thumbBase, 'y', target.thumbOut * this.side, k);
    this.thumb.forEach((j, i) => this.ease(j.pivot, 'x', -target.thumb[i], k));
  }

  private ease(o: Object3D, axis: 'x' | 'y', to: number, k: number): void {
    const now = o.rotation[axis];
    o.rotation[axis] = now + (to - now) * k;
  }

  /** Wrist world pose (the hand extends forward along its -Z). */
  place(pos: Vector3, quat: import('@iwsdk/core').Quaternion): void {
    this.root.visible = true;
    this.root.position.copy(pos);
    this.root.quaternion.copy(quat);
  }
}
