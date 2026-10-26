import {
  CanvasTexture,
  createSystem,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Quaternion,
  SRGBColorSpace,
  Vector3,
  VisibilityState,
} from '@iwsdk/core';
import { Caption } from '../components/ritual.js';
import { Tuning } from '../config/tuning.js';

const CANVAS_W = 1024;
const CANVAS_H = 208;
const PAD_X = 36;
const MAX_TEXT_W = CANVAS_W - 2 * PAD_X - 40;
const WIDTH_M = 0.62;
const FOLLOW_RATE = 4;
const FADE_RATE = 3;

/**
 * One short caption line, centered and slightly low in view, lazily following
 * the head so it stays inside the essential FoV cone on Meta VR Glasses.
 */
export class CaptionSystem extends createSystem({
  captions: { required: [Caption] },
}) {
  private canvas!: HTMLCanvasElement;
  private texture!: CanvasTexture;
  private material!: MeshBasicMaterial;
  private mesh!: Mesh;
  private shownText = '';
  private opacity = 0;
  private placed = false;
  private head = new Vector3();
  private headQuat = new Quaternion();
  private target = new Vector3();
  private dir = new Vector3();
  private dropQuat = new Quaternion().setFromAxisAngle(
    new Vector3(1, 0, 0),
    (-Tuning.fov.captionDropDeg * Math.PI) / 180,
  );

  init(): void {
    this.canvas = document.createElement('canvas');
    this.canvas.width = CANVAS_W;
    this.canvas.height = CANVAS_H;
    this.texture = new CanvasTexture(this.canvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.material = new MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
    });
    this.mesh = new Mesh(new PlaneGeometry(WIDTH_M, (WIDTH_M * CANVAS_H) / CANVAS_W), this.material);
    this.mesh.name = 'Caption';
    this.mesh.renderOrder = 10;
    this.mesh.visible = false;
    this.world.createTransformEntity(this.mesh);
  }

  update(delta: number): void {
    const c = this.queries.captions.entities.values().next().value;
    const ttl = c?.getValue(Caption, 'ttl') ?? 0;
    if (c && ttl > 0) {
      const left = ttl - delta;
      c.setValue(Caption, 'ttl', Math.max(0, left));
      if (left <= 0) c.setValue(Caption, 'text', '');
    }
    const wanted = c ? (c.getValue(Caption, 'text') ?? '') : '';
    const inXR = this.visibilityState.peek() !== VisibilityState.NonImmersive;
    if (wanted && wanted !== this.shownText && this.opacity <= 0.01) this.draw(wanted);
    const show = inXR && wanted !== '' && wanted === this.shownText;
    this.opacity += ((show ? 1 : 0) - this.opacity) * Math.min(1, FADE_RATE * delta);
    this.material.opacity = this.opacity;
    this.mesh.visible = this.opacity > 0.01;
    if (!this.mesh.visible) {
      this.placed = false;
      return;
    }

    this.player.head.getWorldPosition(this.head);
    this.player.head.getWorldQuaternion(this.headQuat);
    this.dir.set(0, 0, -1).applyQuaternion(this.dropQuat).applyQuaternion(this.headQuat);
    this.target.copy(this.head).addScaledVector(this.dir, Tuning.fov.captionDistance);
    if (!this.placed) this.mesh.position.copy(this.target);
    else this.mesh.position.lerp(this.target, Math.min(1, FOLLOW_RATE * delta));
    this.placed = true;
    this.mesh.lookAt(this.head);
  }

  /** One line if it fits, else two balanced lines; the font shrinks until both fit. */
  private draw(text: string): void {
    const g = this.canvas.getContext('2d');
    if (!g) return;
    g.clearRect(0, 0, CANVAS_W, CANVAS_H);
    let size = 54;
    let lines = [text];
    const font = (px: number) => `500 ${px}px system-ui, "Segoe UI", Roboto, sans-serif`;
    g.font = font(size);
    if (g.measureText(text).width > MAX_TEXT_W) {
      lines = splitBalanced(text);
      while (size > 30 && Math.max(...lines.map((l) => g.measureText(l).width)) > MAX_TEXT_W) {
        size -= 2;
        g.font = font(size);
      }
    }
    const lineH = size * 1.25;
    const textW = Math.min(CANVAS_W - 8, Math.max(...lines.map((l) => g.measureText(l).width)) + 2 * PAD_X);
    const boxH = lines.length * lineH + 30;
    g.fillStyle = 'rgba(14, 12, 40, 0.78)';
    g.beginPath();
    g.roundRect((CANVAS_W - textW) / 2, (CANVAS_H - boxH) / 2, textW, boxH, Math.min(48, boxH / 2));
    g.fill();
    g.fillStyle = '#fdfcff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    lines.forEach((l, i) => g.fillText(l, CANVAS_W / 2, CANVAS_H / 2 + (i - (lines.length - 1) / 2) * lineH + 2));
    this.texture.needsUpdate = true;
    this.shownText = text;
  }
}

/** Splits at the space nearest the middle. */
function splitBalanced(text: string): string[] {
  const mid = text.length / 2;
  let best = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === ' ' && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
  }
  return best < 0 ? [text] : [text.slice(0, best), text.slice(best + 1)];
}
