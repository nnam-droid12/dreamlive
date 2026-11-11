import { CanvasTexture, Color, Group, Mesh, PlaneGeometry, ShaderMaterial, SRGBColorSpace, Vector3 } from '@iwsdk/core';
import { Palette } from '../config/palette.js';
import { Tuning } from '../config/tuning.js';

const cfg = Tuning.seaConsole;

export type GoodnightDial = 'storm' | 'sun' | 'whales';
export const DIALS: GoodnightDial[] = ['storm', 'sun', 'whales'];
const LABELS: Record<GoodnightDial, string> = { storm: 'Storm', sun: 'Sun', whales: 'Whales' };

/**
 * The sea console (DreamSpace-style): three tall glass pills you drag with
 * a fingertip, a white fill rising to the value with a round icon knob at its
 * top, and a wide "Goodnight" pill underneath. Each pill is one plane drawn by
 * a small signed-distance shader (crisp edges at any distance, one draw call).
 * Local frame: x across, y up (pill bottoms at y = 0), facing +z (the viewer).
 */
export class GoodnightConsole {
  readonly root = new Group();
  readonly pills: { dial: GoodnightDial; mesh: Mesh; mat: ShaderMaterial; x: number }[] = [];
  readonly button: { mesh: Mesh; mat: ShaderMaterial; y: number; w: number; h: number };

  constructor() {
    this.root.name = 'GoodnightConsole';
    const W = cfg.pillW;
    const H = cfg.pillH;
    DIALS.forEach((dial, i) => {
      const x = (i - (DIALS.length - 1) / 2) * cfg.pillGap;
      const mat = pillMaterial(W, H, iconTexture(dial), labelTexture(LABELS[dial]));
      const mesh = new Mesh(new PlaneGeometry(W + 0.01, H + 0.034), mat);
      // The plane is a little taller than the pill: the label sits just below it.
      mesh.position.set(x, H / 2 - 0.012, 0);
      mesh.renderOrder = 30;
      mesh.name = `Goodnight_${dial}`;
      this.root.add(mesh);
      this.pills.push({ dial, mesh, mat, x });
    });
    const bw = cfg.pillGap * (DIALS.length - 1) + W;
    const bh = 0.034;
    const bmat = buttonMaterial(bw, bh, buttonTexture());
    const bmesh = new Mesh(new PlaneGeometry(bw + 0.006, bh + 0.006), bmat);
    const by = -0.064;
    bmesh.position.set(0, by, 0);
    bmesh.renderOrder = 30;
    bmesh.name = 'Goodnight_button';
    this.root.add(bmesh);
    this.button = { mesh: bmesh, mat: bmat, y: by, w: bw, h: bh };
  }

  setValue(i: number, v: number): void {
    this.pills[i].mat.uniforms.uValue.value = v;
  }

  setHover(i: number, h: number): void {
    this.pills[i].mat.uniforms.uHover.value = h;
  }

  setButton(hover: number, pressed: number): void {
    this.button.mat.uniforms.uHover.value = hover;
    this.button.mat.uniforms.uPress.value = pressed;
  }

  setOpacity(a: number): void {
    for (const p of this.pills) p.mat.uniforms.uAlpha.value = a;
    this.button.mat.uniforms.uAlpha.value = a;
    this.root.visible = a > 0.01;
  }

  /** World position of a pill's knob (where a fingertip drags it), for the film's hand. */
  knobWorld(i: number, out: Vector3): Vector3 {
    const v = this.pills[i].mat.uniforms.uValue.value as number;
    const y = Math.max(cfg.pillW / 2, v * cfg.pillH - cfg.pillW / 2);
    return this.root.localToWorld(out.set(this.pills[i].x, y, 0.004));
  }

  buttonWorld(out: Vector3): Vector3 {
    return this.root.localToWorld(out.set(0, this.button.y, 0.004));
  }
}

const SDF = /* glsl */ `
  float sdRoundBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }
`;

function pillMaterial(w: number, h: number, icon: CanvasTexture, label: CanvasTexture): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uValue: { value: 0 },
      uHover: { value: 0 },
      uAlpha: { value: 0 },
      uIcon: { value: icon },
      uLabel: { value: label },
      uGlass: { value: new Color(Palette.consoleGlass) },
      uFill: { value: new Color(Palette.consoleFill) },
      uLine: { value: new Color(Palette.handRim) },
      uSize: { value: [w, h] },
      uPlane: { value: [w + 0.01, h + 0.034] },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uValue;
      uniform float uHover;
      uniform float uAlpha;
      uniform sampler2D uIcon;
      uniform sampler2D uLabel;
      uniform vec3 uGlass;
      uniform vec3 uFill;
      uniform vec3 uLine;
      uniform vec2 uSize;
      uniform vec2 uPlane;
      varying vec2 vUv;
      ${SDF}
      void main() {
        // Metres in the plane; the pill sits above the label strip.
        vec2 p = (vUv - 0.5) * uPlane;
        p.y -= (uPlane.y - uSize.y) * 0.5 - 0.005;
        float r = uSize.x * 0.5;
        float d = sdRoundBox(p, uSize * 0.5, r);
        float aa = 0.0009;
        vec4 col = vec4(0.0);
        // Glass track.
        float inside = smoothstep(aa, -aa, d);
        col = vec4(uGlass, 0.55 + 0.1 * uHover) * inside;
        // White fill from the bottom to the value (clipped by the capsule).
        float top = -uSize.y * 0.5 + uValue * uSize.y;
        float fill = inside * smoothstep(top + aa, top - aa, p.y) * step(0.004, uValue);
        col = mix(col, vec4(uFill, 0.93), fill);
        // The knob: a circle at the top of the fill, with the dial's icon.
        vec2 c = vec2(0.0, max(-uSize.y * 0.5 + r, top - r));
        float kd = length(p - c) - (r - 0.0035);
        float knob = smoothstep(aa, -aa, kd);
        vec2 iuv = (p - c) / (2.0 * (r - 0.0035)) + 0.5;
        vec4 ic = texture2D(uIcon, iuv);
        vec3 knobCol = mix(uFill, vec3(0.11, 0.12, 0.15), ic.a);
        col = mix(col, vec4(knobCol, 0.97), knob);
        // Crisp white outline (brighter while your finger is on it).
        float line = smoothstep(0.0011 + aa, 0.0011, abs(d));
        col = mix(col, vec4(uLine, 0.85 + 0.15 * uHover), line);
        // Soft glow around a hovered pill.
        col += vec4(uLine, 1.0) * smoothstep(0.012, 0.0, d) * step(0.0, d) * 0.35 * uHover;
        // The label under the pill.
        vec2 luv = vec2(vUv.x, (p.y + uSize.y * 0.5 + 0.03) / 0.024);
        if (luv.y > 0.0 && luv.y < 1.0) {
          vec4 lc = texture2D(uLabel, luv);
          col = mix(col, vec4(lc.rgb, lc.a), lc.a);
        }
        gl_FragColor = vec4(col.rgb, col.a * uAlpha);
      }`,
    transparent: true,
    depthWrite: false,
  });
}

function buttonMaterial(w: number, h: number, text: CanvasTexture): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uHover: { value: 0 },
      uPress: { value: 0 },
      uAlpha: { value: 0 },
      uText: { value: text },
      uGlass: { value: new Color(Palette.consoleGlass) },
      uFill: { value: new Color(Palette.consoleFill) },
      uLine: { value: new Color(Palette.handRim) },
      uSize: { value: [w, h] },
      uPlane: { value: [w + 0.006, h + 0.006] },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uHover;
      uniform float uPress;
      uniform float uAlpha;
      uniform sampler2D uText;
      uniform vec3 uGlass;
      uniform vec3 uFill;
      uniform vec3 uLine;
      uniform vec2 uSize;
      uniform vec2 uPlane;
      varying vec2 vUv;
      ${SDF}
      void main() {
        vec2 p = (vUv - 0.5) * uPlane;
        float d = sdRoundBox(p, uSize * 0.5, uSize.y * 0.5);
        float aa = 0.0009;
        float inside = smoothstep(aa, -aa, d);
        // Glass, filling white as it is pressed; the text flips dark on white.
        vec3 body = mix(uGlass, uFill, uPress);
        vec4 col = vec4(body, 0.6 + 0.35 * uPress + 0.1 * uHover) * inside;
        vec2 tuv = (p / uSize) + 0.5;
        vec4 tc = texture2D(uText, tuv);
        vec3 tcol = mix(vec3(1.0), vec3(0.11, 0.12, 0.15), uPress);
        col.rgb = mix(col.rgb, tcol, tc.a * inside);
        float line = smoothstep(0.0011 + aa, 0.0011, abs(d));
        col = mix(col, vec4(uLine, 0.85 + 0.15 * uHover), line);
        gl_FragColor = vec4(col.rgb, col.a * uAlpha);
      }`,
    transparent: true,
    depthWrite: false,
  });
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function tex(c: HTMLCanvasElement): CanvasTexture {
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** The dial's icon, drawn in black (alpha is the shape) on a 128 px square. */
function iconTexture(dial: GoodnightDial): CanvasTexture {
  const [c, g] = canvas(128, 128);
  g.fillStyle = '#000';
  g.strokeStyle = '#000';
  g.lineCap = 'round';
  g.lineJoin = 'round';
  if (dial === 'sun') {
    // A sun: a disc and its rays.
    g.beginPath();
    g.arc(64, 64, 22, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = 9;
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      g.beginPath();
      g.moveTo(64 + Math.cos(a) * 33, 64 + Math.sin(a) * 33);
      g.lineTo(64 + Math.cos(a) * 50, 64 + Math.sin(a) * 50);
      g.stroke();
    }
  } else if (dial === 'storm') {
    // A storm cloud with a lightning bolt.
    g.beginPath();
    g.arc(44, 58, 20, Math.PI * 0.5, Math.PI * 1.5);
    g.arc(64, 42, 24, Math.PI, Math.PI * 2);
    g.arc(88, 56, 18, Math.PI * 1.5, Math.PI * 0.5);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(66, 70);
    g.lineTo(50, 98);
    g.lineTo(64, 98);
    g.lineTo(54, 122);
    g.lineTo(80, 88);
    g.lineTo(66, 88);
    g.lineTo(76, 70);
    g.closePath();
    g.fill();
  } else {
    // A whale's tail (flukes) rising out of a line of water.
    g.beginPath();
    g.moveTo(64, 96);
    g.bezierCurveTo(60, 70, 52, 56, 22, 40);
    g.bezierCurveTo(40, 58, 52, 50, 62, 58);
    g.lineTo(66, 58);
    g.bezierCurveTo(76, 50, 88, 58, 106, 40);
    g.bezierCurveTo(76, 56, 68, 70, 64, 96);
    g.closePath();
    g.fill();
    g.lineWidth = 8;
    g.beginPath();
    g.moveTo(18, 104);
    g.quadraticCurveTo(40, 96, 64, 104);
    g.quadraticCurveTo(88, 112, 110, 104);
    g.stroke();
  }
  return tex(c);
}

function labelTexture(text: string): CanvasTexture {
  const [c, g] = canvas(128, 48);
  g.font = '600 30px system-ui, "Segoe UI", Roboto, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = 'rgba(0,0,0,0.85)';
  g.shadowBlur = 6;
  g.fillStyle = '#ffffff';
  g.fillText(text, 64, 26);
  return tex(c);
}

function buttonTexture(): CanvasTexture {
  const [c, g] = canvas(512, 96);
  g.font = '600 50px system-ui, "Segoe UI", Roboto, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#ffffff';
  g.fillText('Goodnight', 256, 50);
  return tex(c);
}
