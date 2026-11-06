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
    g.textAlign = align;
    g.textBaseline = 'top';
    g.shadowColor = 'rgba(20, 10, 5, 0.75)';
    g.shadowBlur = 14;
    for (const l of lines) {
      y += l.gap ?? 0;
      g.font = `${l.style ?? ''} ${l.size}px Georgia, 'Times New Roman', serif`;
      g.fillStyle = l.color ?? '#ffe2a8';
      g.fillText(l.text, align === 'center' ? px / 2 : px - 24, y);
      y += l.size * 1.25;
    }
    texture.needsUpdate = true;
  };
  return { mesh, material, texture, draw };
}
