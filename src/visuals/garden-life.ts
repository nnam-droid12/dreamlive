/**
 * The garden's small lives (procedural, project-owned): butterflies (monarch and
 * blue morpho wing patterns, painted on a canvas), a ladybug, and fireflies.
 * Built at runtime (they use the DOM for their textures).
 */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Points,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
} from '@iwsdk/core';
import { Palette } from '../config/palette.js';

export type WingPattern = 'monarch' | 'morpho';

/** One wing pair (fore and hind), drawn for the right side; the left side mirrors it. */
function wingTexture(pattern: WingPattern): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  // Forewing (long, toward the head) and hindwing (rounded), from the body at x = 0.
  const fore = new Path2D('M4 120 C 40 40, 150 4, 236 22 C 250 60, 214 110, 150 128 C 100 136, 40 132, 4 128 Z');
  const hind = new Path2D('M4 132 C 60 130, 140 140, 190 178 C 210 214, 170 248, 120 246 C 70 240, 30 200, 4 140 Z');
  if (pattern === 'monarch') {
    const orange = g.createLinearGradient(0, 0, 220, 200);
    orange.addColorStop(0, '#d9631a');
    orange.addColorStop(1, '#f39a2b');
    g.fillStyle = orange;
    g.fill(fore);
    g.fill(hind);
    // Black veins.
    g.strokeStyle = '#140d08';
    g.lineWidth = 5;
    g.save();
    g.clip(fore);
    for (const [x, y] of [[236, 30], [220, 80], [180, 118], [120, 128], [70, 124]]) {
      g.beginPath();
      g.moveTo(8, 124);
      g.quadraticCurveTo((8 + x) / 2, (124 + y) / 2 - 18, x, y);
      g.stroke();
    }
    g.restore();
    g.save();
    g.clip(hind);
    for (const [x, y] of [[190, 190], [160, 236], [110, 246], [60, 220]]) {
      g.beginPath();
      g.moveTo(8, 136);
      g.quadraticCurveTo((8 + x) / 2 + 10, (136 + y) / 2, x, y);
      g.stroke();
    }
    g.restore();
    // The thick black border, with a row of white dots.
    g.lineWidth = 16;
    g.strokeStyle = '#120c08';
    g.stroke(fore);
    g.stroke(hind);
    g.fillStyle = '#f6efe2';
    for (let i = 0; i < 26; i++) {
      const t = i / 26;
      g.beginPath();
      g.arc(30 + 200 * Math.sin(t * Math.PI * 0.9) + (i % 2) * 4, 20 + 220 * t, 2.6, 0, Math.PI * 2);
      g.fill();
    }
    // The black wingtip with its pale spots.
    g.save();
    g.clip(fore);
    g.fillStyle = '#120c08';
    g.beginPath();
    g.ellipse(226, 38, 34, 26, -0.4, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#f5d9a8';
    for (const [x, y] of [[214, 30], [228, 46], [204, 46]]) {
      g.beginPath();
      g.arc(x, y, 5, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  } else {
    // Blue morpho: iridescent blue, a black border, a few small white spots.
    const blue = g.createRadialGradient(40, 130, 10, 60, 130, 220);
    blue.addColorStop(0, '#62d6ff');
    blue.addColorStop(0.45, '#1d8fe6');
    blue.addColorStop(1, '#0a3c9e');
    g.fillStyle = blue;
    g.fill(fore);
    g.fill(hind);
    g.lineWidth = 22;
    g.strokeStyle = '#05070c';
    g.stroke(fore);
    g.stroke(hind);
    g.fillStyle = '#e9f3ff';
    for (const [x, y, r] of [[214, 40, 5], [196, 70, 4], [170, 214, 4], [140, 232, 3]]) {
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/**
 * A butterfly: a slim body with antennae, and two wings hinged on the body's
 * long axis (+Z is its head, +Y its back). `flap(angle)` raises the wings
 * (0 = flat open, up to ~1.4 = folded up together over the back).
 */
export class Butterfly {
  readonly root = new Group();
  private left = new Group();
  private right = new Group();

  constructor(pattern: WingPattern, span = 0.09) {
    this.root.name = `Butterfly_${pattern}`;
    const mat = new MeshBasicMaterial({ map: wingTexture(pattern), transparent: true, alphaTest: 0.4, side: DoubleSide });
    // The wing lies flat (XZ), its root edge on the body (x = 0), the forewing toward the head (+Z).
    const geo = new PlaneGeometry(span / 2, span / 2);
    geo.rotateX(-Math.PI / 2);
    geo.translate(span / 4, 0, 0);
    this.right.add(new Mesh(geo, mat));
    const wingL = new Mesh(geo, mat);
    wingL.scale.x = -1;
    this.left.add(wingL);
    const bodyMat = new MeshStandardMaterial({ color: 0x1a140f, roughness: 0.6 });
    const body = new Mesh(new CylinderGeometry(span * 0.035, span * 0.02, span * 0.42, 8), bodyMat);
    body.rotation.x = Math.PI / 2;
    const head = new Mesh(new SphereGeometry(span * 0.04, 8, 6), bodyMat);
    head.position.z = span * 0.22;
    const antenna = new CylinderGeometry(span * 0.004, span * 0.004, span * 0.26, 4);
    for (const s of [-1, 1]) {
      const a = new Mesh(antenna, bodyMat);
      a.position.set(s * span * 0.04, span * 0.06, span * 0.32);
      a.rotation.set(Math.PI / 2 - 0.6, 0, s * 0.35);
      this.root.add(a);
    }
    this.root.add(this.left, this.right, body, head);
  }

  flap(angle: number): void {
    this.right.rotation.z = angle;
    this.left.rotation.z = -angle;
  }
}

/** A ladybug: a glossy red dome with black spots and a black head. About 9 mm long; +Z is its head. */
export function buildLadybug(): Group {
  const root = new Group();
  root.name = 'Ladybug';
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#c41a12';
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#0c0807';
  g.fillRect(62, 0, 4, 128);
  for (const [x, y, r] of [[34, 40, 10], [94, 40, 10], [28, 84, 9], [100, 84, 9], [52, 108, 7], [76, 108, 7]]) {
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  const shell = new Mesh(new SphereGeometry(0.0045, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), new MeshStandardMaterial({ map: tex, roughness: 0.22, metalness: 0.05 }));
  shell.scale.set(1, 0.75, 1.2);
  const head = new Mesh(new SphereGeometry(0.0022, 10, 8), new MeshStandardMaterial({ color: 0x0c0807, roughness: 0.4 }));
  head.position.set(0, 0.0008, 0.0052);
  root.add(shell, head);
  return root;
}

/** Fireflies: soft warm green-gold points that blink, each on its own rhythm. Positions are set by the owner. */
export class Fireflies {
  readonly points: Points;
  readonly positions: Float32Array;
  private mat: ShaderMaterial;

  constructor(count: number) {
    this.positions = new Float32Array(count * 3);
    const phase = new Float32Array(count);
    for (let i = 0; i < count; i++) phase[i] = (i * 7.31) % 10;
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(this.positions, 3));
    g.setAttribute('aPhase', new BufferAttribute(phase, 1));
    this.mat = new ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uAmount: { value: 0 }, uColor: { value: new Color(Palette.firefly) } },
      vertexShader: /* glsl */ `
        attribute float aPhase;
        uniform float uTime;
        varying float vGlow;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          // Each one glows for a moment every few seconds, on its own beat.
          float cycle = mod(uTime * 0.45 + aPhase, 3.2);
          vGlow = smoothstep(0.0, 0.25, cycle) * (1.0 - smoothstep(0.6, 1.4, cycle));
          gl_PointSize = min(14.0, (4.0 + 10.0 * vGlow) * 2.0 / max(0.6, -mv.z));
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uAmount;
        varying float vGlow;
        void main() {
          float r = length(gl_PointCoord - 0.5) * 2.0;
          float a = smoothstep(1.0, 0.0, r);
          gl_FragColor = vec4(uColor * (0.5 + 1.5 * a), a * a * (0.12 + 0.88 * vGlow) * uAmount);
        }`,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    this.points = new Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.name = 'Fireflies';
  }

  update(time: number, amount: number): void {
    this.mat.uniforms.uTime.value = time;
    this.mat.uniforms.uAmount.value = amount;
    (this.points.geometry.getAttribute('position') as BufferAttribute).needsUpdate = true;
  }
}
