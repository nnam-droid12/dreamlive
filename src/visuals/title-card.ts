import { Palette } from '../config/palette.js';
import { CanvasTexture, ClampToEdgeWrapping, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace } from '@iwsdk/core';

export interface CardLine {
  text: string;
  /** Font size in canvas pixels, style ('italic', 'bold', ''), colour (CSS). */
  size: number;
  style?: string;
  color?: string;
  /** Extra space above this line (px). */
  gap?: number;
}

export interface TitleCard {
  mesh: Mesh;
  material: MeshBasicMaterial;
  texture: CanvasTexture;
  draw(lines: readonly CardLine[], align?: 'center' | 'right'): void;
}

/**
 * Film-style text (title, chapter cards, end credits): serif type drawn on a
 * canvas with a soft shadow, on a transparent plane that never writes depth.
 * Built at runtime (it uses the DOM), never from the asset manifest.
 */
export function makeTitleCard(px: number, py: number, widthM: number): TitleCard {
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = py;
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = texture.wrapT = ClampToEdgeWrapping;
  const material = new MeshBasicMaterial({ map: texture, transparent: true, opacity: 0, depthWrite: false, depthTest: false });
  const mesh = new Mesh(new PlaneGeometry(widthM, (widthM * py) / px), material);
  mesh.renderOrder = 60;
  mesh.visible = false;
  const draw = (lines: readonly CardLine[], align: 'center' | 'right' = 'center') => {
    const g = canvas.getContext('2d');
    if (!g) return;
    g.clearRect(0, 0, px, py);
    const total = lines.reduce((h, l) => h + l.size * 1.25 + (l.gap ?? 0), 0);
    let y = (py - total) / 2;
    const scrim = hex(Palette.cardScrim);
    // A soft dark scrim behind the text block (Meta's contrast guidance: type stays
    // readable over a bright sky, sea or city, without a hard box).
    const cx = align === 'center' ? px / 2 : px * 0.7;
    const cy = py / 2;
    const r = Math.max(px * 0.5, total);
    const grad = g.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, `rgba(${scrim}, 0.5)`);
    grad.addColorStop(0.6, `rgba(${scrim}, 0.28)`);
    grad.addColorStop(1, `rgba(${scrim}, 0)`);
    g.save();
    g.translate(cx, cy);
    g.scale(1, Math.min(1, (total * 1.6) / r));
    g.translate(-cx, -cy);
    g.fillStyle = grad;
    g.fillRect(0, 0, px, py);
    g.restore();
    g.textAlign = align;
    g.textBaseline = 'top';
    g.lineJoin = 'round';
    for (const l of lines) {
      y += l.gap ?? 0;
      g.font = `${l.style ?? ''} ${l.size}px Georgia, 'Times New Roman', serif`;
      const x = align === 'center' ? px / 2 : px - 24;
      g.shadowColor = `rgba(${scrim}, 0.8)`;
      g.shadowBlur = 14;
      g.lineWidth = Math.max(2, l.size * 0.08);
      g.strokeStyle = `rgba(${scrim}, 0.85)`;
      g.strokeText(l.text, x, y);
      g.shadowBlur = 0;
      g.fillStyle = l.color ?? `#${Palette.cardText.toString(16).padStart(6, '0')}`;
      g.fillText(l.text, x, y);
      y += l.size * 1.25;
    }
    texture.needsUpdate = true;
  };
  return { mesh, material, texture, draw };
}

/** `0xrrggbb` as "r, g, b" for rgba(). */
function hex(c: number): string {
  return `${(c >> 16) & 255}, ${(c >> 8) & 255}, ${c & 255}`;
}
