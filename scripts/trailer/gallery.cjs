// Devpost gallery images (3:2): a film frame cropped to 3:2 around a chosen centre, upscaled to
// 2400x1600 with a high-quality filter and light sharpening, saved as a high-quality JPEG.
//   node scripts/trailer/gallery.cjs FRAME.jpg OUT.jpg [centreX 0..1, default 0.5] [brightness, default 1]
const path = require('path');
const sharp = require(path.join(__dirname, '..', '..', 'node_modules', 'sharp'));

(async () => {
  const [src, out, cx = '0.5', bright = '1'] = process.argv.slice(2);
  const img = sharp(src);
  const { width, height } = await img.metadata();
  const w = Math.round((height * 3) / 2);
  const left = Math.max(0, Math.min(width - w, Math.round(width * Number(cx) - w / 2)));
  const info = await sharp(src)
    .extract({ left, top: 0, width: w, height })
    .resize(2400, 1600, { kernel: 'lanczos3' })
    .sharpen({ sigma: 0.8 })
    .modulate({ saturation: 1.05, brightness: Number(bright) })
    .jpeg({ quality: 93, mozjpeg: true })
    .toFile(out);
  console.log('ok', out, info.width, info.height, (info.size / 1e6).toFixed(2) + ' MB');
})();
