import { CanvasTexture, Sprite, SpriteMaterial, SRGBColorSpace } from '@iwsdk/core';

/**
 * A readable, camera-facing name tag (dark pill, light text) `width` meters wide.
 * Pointer rays pass through it: Sprite raycasts need a camera and would throw.
 */
export function labelSprite(text: string, width: number): Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 112;
  const g = canvas.getContext('2d');
  if (g) {
    let size = 52;
    g.font = `600 ${size}px system-ui, "Segoe UI", Roboto, sans-serif`;
    while (size > 28 && g.measureText(text).width > 450) {
      size -= 2;
      g.font = `600 ${size}px system-ui, "Segoe UI", Roboto, sans-serif`;
    }
    const w = Math.min(500, g.measureText(text).width + 56);
    g.fillStyle = 'rgba(14, 12, 40, 0.72)';
    g.beginPath();
    g.roundRect((512 - w) / 2, 12, w, 88, 44);
    g.fill();
    g.fillStyle = '#fdfcff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, 256, 58);
  }
  const map = new CanvasTexture(canvas);
  map.colorSpace = SRGBColorSpace;
  const sprite = new Sprite(new SpriteMaterial({ map, transparent: true, depthWrite: false }));
  sprite.name = 'Label';
  sprite.raycast = () => {};
  sprite.scale.set(width, (width * 112) / 512, 1);
  sprite.renderOrder = 4;
  return sprite;
}
