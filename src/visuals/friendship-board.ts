import { CanvasTexture, Group, Mesh, MeshStandardMaterial, PlaneGeometry, SRGBColorSpace } from '@iwsdk/core';
import { Palette } from '../config/palette.js';
import { bevelBox } from '../scene-assets/lib/hardsurface.js';
import { JournalData } from '../memory/journal.js';

/**
 * "Bigfoot & You": a framed chalkboard on the bedroom wall that keeps your
 * friendship's tally in chalk: nights together, high-fives, fist bumps,
 * movies, photos, stars caught (and a little bunny doodle once you've met).
 * Drawn on a canvas; redrawn only when the journal changes.
 */
export class FriendshipBoard {
  readonly root = new Group();
  private canvas: HTMLCanvasElement;
  private tex: CanvasTexture;

  constructor(width = 0.9, height = 0.66) {
    this.root.name = 'FriendshipBoard';
    this.canvas = document.createElement('canvas');
    this.canvas.width = 900;
    this.canvas.height = 660;
    this.tex = new CanvasTexture(this.canvas);
    this.tex.colorSpace = SRGBColorSpace;
    const board = new Mesh(new PlaneGeometry(width, height), new MeshStandardMaterial({ map: this.tex, roughness: 0.95 }));
    // Just proud of the frame's front face (the frame is 2.5 cm deep, centred on the root).
    board.position.z = 0.0125 + 0.003;
    const frame = new Mesh(bevelBox(width + 0.07, height + 0.07, 0.025, 0.008), new MeshStandardMaterial({ color: Palette.boardFrame, roughness: 0.55 }));
    this.root.add(frame, board);
  }

  draw(j: Readonly<JournalData>): void {
    const g = this.canvas.getContext('2d');
    if (!g) return;
    const W = this.canvas.width;
    const H = this.canvas.height;
    // Slate, with a faint chalk-dust haze.
    g.fillStyle = '#23302b';
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 2200; i++) {
      g.fillStyle = `rgba(255,255,255,${Math.random() * 0.035})`;
      g.fillRect(Math.random() * W, Math.random() * H, 3, 3);
    }
    const chalk = (text: string, x: number, y: number, size: number, color = '#f2efe6', align: CanvasTextAlign = 'left') => {
      g.font = `${size}px "Segoe Print", "Comic Sans MS", "Bradley Hand", cursive`;
      g.textAlign = align;
      g.fillStyle = color;
      g.globalAlpha = 0.92;
      g.fillText(text, x, y);
      g.globalAlpha = 0.25;
      g.fillText(text, x + 1.5, y + 1);
      g.globalAlpha = 1;
    };
    chalk('Bigfoot & You', W / 2, 92, 64, '#ffe9b0', 'center');
    g.strokeStyle = 'rgba(242,239,230,0.6)';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(170, 120);
    g.quadraticCurveTo(W / 2, 108, W - 170, 122);
    g.stroke();
    const c = j.counts;
    const rows: [string, number][] = [
      ['nights together', j.visits],
      ['high-fives', c.highFive],
      ['fist bumps', c.fistBump],
      ['movie nights', c.movies],
      ['photos', c.photos],
      ['stars caught', c.stars],
    ];
    rows.forEach(([label, n], i) => {
      const y = 205 + i * 72;
      chalk(String(n), 120, y, 54, '#ffd38a', 'right');
      chalk(label, 150, y, 46);
      // Tally marks beside the small numbers.
      if (n > 0 && n <= 12) {
        g.strokeStyle = 'rgba(242,239,230,0.7)';
        g.lineWidth = 4;
        for (let k = 0; k < n; k++) {
          const x = 560 + (k % 5) * 16 + Math.floor(k / 5) * 100;
          g.beginPath();
          if (k % 5 === 4) {
            g.moveTo(x - 70, y - 30);
            g.lineTo(x + 6, y - 6);
          } else {
            g.moveTo(x, y - 38);
            g.lineTo(x + 3, y - 2);
          }
          g.stroke();
        }
      }
    });
    if (j.bunny) chalk('+ Buck the bunny  ♥', W - 60, H - 34, 34, '#f6b6c4', 'right');
    this.tex.needsUpdate = true;
  }
}
