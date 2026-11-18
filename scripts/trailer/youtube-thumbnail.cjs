// The YouTube thumbnail (1280x720): a sunset or deep-night field (see THEMES), "DREAM / LIVE" in bold blue brush
// lettering (white outline, deep-blue shadow, as on the Devpost thumbnail), "BEST NEW ENTERTAINMENT EXPERIENCE" beneath, a big scene card running off the
// left edge, two stacked scene cards on the right, and the competition name at the bottom left.
//   node scripts/trailer/youtube-thumbnail.cjs LEFT.jpg RIGHT_TOP.jpg RIGHT_BOTTOM.jpg OUT.png [sunset|night]
const path = require('path');
const sharp = require(path.join(__dirname, '..', '..', 'node_modules', 'sharp'));

const W = 1280;
const H = 720;
const [left, rTop, rBot, out, theme = 'sunset'] = process.argv.slice(2);
/** Background themes: a warm sunset (blue's complement, so the title pops) or a deep night (the title glows). */
const THEMES = {
  sunset: { stops: '<stop offset="0" stop-color="#ff8a1f"/><stop offset="0.55" stop-color="#ff5a4e"/><stop offset="1" stop-color="#e83a7a"/>', glow: 'rgba(255,240,200,0.35)' },
  night: { stops: '<stop offset="0" stop-color="#0a1440"/><stop offset="0.55" stop-color="#1b1f6e"/><stop offset="1" stop-color="#2a1a5e"/>', glow: 'rgba(90,160,255,0.35)' },
};
const STOPS = THEMES[theme].stops;
const GLOW = THEMES[theme].glow;
const font = "'Ink Free', 'Segoe Print', 'Impact', sans-serif";
const sans = "'Segoe UI', 'Montserrat', Arial, sans-serif";

/** A photo cropped to w x h with rounded corners and a soft white rim. */
async function card(file, w, h, r) {
  const img = await sharp(file).resize(w, h, { fit: 'cover', position: 'centre' }).toBuffer();
  const mask = Buffer.from(`<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${r}" ry="${r}" fill="#fff"/></svg>`);
  const rim = Buffer.from(`<svg width="${w}" height="${h}"><rect x="2" y="2" width="${w - 4}" height="${h - 4}" rx="${r - 2}" ry="${r - 2}" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="4"/></svg>`);
  return sharp(img).composite([{ input: mask, blend: 'dest-in' }, { input: rim }]).png().toBuffer();
}

const word = (text, x, y, size) => `
  <g transform="translate(${x} ${y}) rotate(-4)">
    <text x="9" y="12" font-family="${font}" font-weight="900" font-size="${size}" fill="#1a5fb4" stroke="#1a5fb4" stroke-width="${size * 0.14}" stroke-linejoin="round" text-anchor="middle" letter-spacing="${size * 0.05}">${text}</text>
    <text x="0" y="0" font-family="${font}" font-weight="900" font-size="${size}" fill="#ffffff" stroke="#ffffff" stroke-width="${size * 0.14}" stroke-linejoin="round" text-anchor="middle" letter-spacing="${size * 0.05}">${text}</text>
    <text x="0" y="0" font-family="${font}" font-weight="900" font-size="${size}" fill="url(#sky)" stroke="url(#sky)" stroke-width="${size * 0.05}" stroke-linejoin="round" text-anchor="middle" letter-spacing="${size * 0.05}">${text}</text>
  </g>`;

const bg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      ${STOPS}
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="48%" r="45%"><stop offset="0" stop-color="${GLOW}"/><stop offset="1" stop-color="rgba(0,0,0,0)"/></radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
</svg>`;

const text = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fdcff"/><stop offset="1" stop-color="#2f8fe6"/></linearGradient></defs>
  ${word('DREAM', 645, 268, 150)}
  ${word('LIVE', 645, 420, 150)}
  <g font-family="${sans}" font-weight="700" fill="#ffffff" text-anchor="middle">
    <text x="645" y="508" font-size="34" letter-spacing="1">BEST NEW</text>
    <text x="645" y="552" font-size="34" letter-spacing="1">ENTERTAINMENT</text>
    <text x="645" y="596" font-size="34" letter-spacing="1">EXPERIENCE</text>
  </g>
  <g font-family="${sans}" fill="#ffffff">
    <text x="28" y="612" font-size="27" font-weight="500">Meta VR Start</text>
    <text x="28" y="648" font-size="31" font-weight="800">Developer</text>
    <text x="28" y="686" font-size="31" font-weight="800">Competition</text>
  </g>
</svg>`;

(async () => {
  const L = await card(left, 360, 470, 34);
  const RT = await card(rTop, 300, 260, 26);
  const RB = await card(rBot, 300, 260, 26);
  await sharp(Buffer.from(bg))
    .composite([
      { input: L, left: -70, top: 70 },
      { input: RT, left: W - 290, top: 60 },
      { input: RB, left: W - 290, top: 360 },
      { input: Buffer.from(text), left: 0, top: 0 },
    ])
    .png()
    .toFile(out);
  console.log('wrote', out);
})();
