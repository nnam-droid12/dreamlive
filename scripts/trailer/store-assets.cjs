// Meta Horizon Store listing art from the film frames: 2560x1440 screenshots, a 2560x1440 hero /
// cover (title centred, nothing in the top and bottom 20%, no badges), a 1440x1440 square cover and
// a 1024x1024 icon.
//   node scripts/trailer/store-assets.cjs OUT_DIR frameA.jpg frameB.jpg ...
const path = require('path');
const sharp = require(path.join(__dirname, '..', '..', 'node_modules', 'sharp'));
const [out, ...frames] = process.argv.slice(2);
const font = "'Ink Free', 'Segoe Print', 'Impact', sans-serif";

const title = (W, H, size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fdcff"/><stop offset="1" stop-color="#2f8fe6"/></linearGradient></defs>
  ${['DREAM', 'LIVE'].map((t, i) => `<g transform="translate(${W / 2} ${H / 2 - size * 0.12 + (i - 0.5) * size * 1.0}) rotate(-4)">
    <text x="${size * 0.06}" y="${size * 0.08}" font-family="${font}" font-weight="900" font-size="${size}" fill="#1a5fb4" stroke="#1a5fb4" stroke-width="${size * 0.14}" stroke-linejoin="round" text-anchor="middle" dominant-baseline="middle" letter-spacing="${size * 0.05}">${t}</text>
    <text font-family="${font}" font-weight="900" font-size="${size}" fill="#fff" stroke="#fff" stroke-width="${size * 0.14}" stroke-linejoin="round" text-anchor="middle" dominant-baseline="middle" letter-spacing="${size * 0.05}">${t}</text>
    <text font-family="${font}" font-weight="900" font-size="${size}" fill="url(#sky)" stroke="url(#sky)" stroke-width="${size * 0.05}" stroke-linejoin="round" text-anchor="middle" dominant-baseline="middle" letter-spacing="${size * 0.05}">${t}</text>
  </g>`).join('')}
</svg>`;

const sunset = (W, H) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff8a1f"/><stop offset="0.55" stop-color="#ff5a4e"/><stop offset="1" stop-color="#e83a7a"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#g)" fill-opacity="0.55"/></svg>`);

/** A frame, cropped to 16:9 and scaled up. */
const shot = (f, W, H) => sharp(f).resize(W, H, { fit: 'cover', kernel: 'lanczos3' }).sharpen({ sigma: 0.8 }).toBuffer();

(async () => {
  let i = 1;
  for (const f of frames) await sharp(await shot(f, 2560, 1440)).removeAlpha().png().toFile(path.join(out, `screenshot-${i++}.png`));
  // Hero / cover: a scene behind a soft sunset veil, the title centred (clear of the top and bottom 20%).
  const hero = async (W, H, size, bgFrame) => {
    const bg = await shot(bgFrame, W, H);
    const veil = await sharp(sunset(W, H)).png().toBuffer();
    return sharp(bg).composite([{ input: veil }, { input: Buffer.from(title(W, H, size)) }]);
  };
  // Meta wants 24-bit PNGs (no alpha): cover art in landscape, square and portrait, a 10:3 hero, a 512 icon.
  const png = (img, name) => img.removeAlpha().png().toFile(path.join(out, name));
  await png(await hero(2560, 1440, 330, frames[0]), 'cover-landscape-2560x1440.png');
  await png(await hero(1440, 1440, 300, frames[0]), 'cover-square-1440x1440.png');
  await png(await hero(1440, 2560, 300, frames[0]), 'cover-portrait-1440x2560.png');
  await png(await hero(3000, 900, 250, frames[0]), 'hero-cover-3000x900.png');
  await png(sharp('C:/Users/hp/Desktop/dreamlive-resources/pwa-staging/icons/icon-512.png').resize(512, 512).flatten({ background: '#0c1422' }), 'icon-512x512.png');
  console.log('done');
})();
