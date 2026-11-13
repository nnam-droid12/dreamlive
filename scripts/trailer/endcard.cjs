// The demo video's closing card, at 4K: "DREAM / LIVE" in bold sky-blue brush lettering with a
// white edge, and "Available Soon On Meta Quest Store" under it, on a deep night background.
//   node scripts/trailer/endcard.cjs OUT.png
const path = require('path');
const sharp = require(path.join(__dirname, '..', '..', 'node_modules', 'sharp'));

const W = 3840;
const H = 2160;
const font = "'Ink Free', 'Segoe Print', 'Impact', sans-serif";
// Each word: a white layer offset down-right (the edge), then the blue face, a little rotated.
const word = (text, x, y, rot) => `
  <g transform="translate(${x} ${y}) rotate(${rot})">
    <text x="20" y="26" font-family="${font}" font-weight="900" font-size="640" fill="#f4fbff" stroke="#f4fbff" stroke-width="64" stroke-linejoin="round" text-anchor="middle" letter-spacing="24">${text}</text>
    <text x="0" y="0" font-family="${font}" font-weight="900" font-size="640" fill="url(#blue)" stroke="url(#blue)" stroke-width="50" stroke-linejoin="round" text-anchor="middle" letter-spacing="24">${text}</text>
  </g>`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="45%" r="70%">
      <stop offset="0" stop-color="#16243a"/>
      <stop offset="1" stop-color="#05070d"/>
    </radialGradient>
    <linearGradient id="blue" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#8fe0ff"/>
      <stop offset="1" stop-color="#3fa9ef"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  ${word('DREAM', W / 2, 980, -4)}
  ${word('LIVE', W / 2 + 60, 1600, -4)}
  <text x="${W / 2}" y="1880" font-family="'Century Gothic', 'Segoe UI', sans-serif" font-style="italic" font-size="120" fill="#cfefff" text-anchor="middle">Available Soon On</text>
  <text x="${W / 2}" y="2030" font-family="'Century Gothic', 'Segoe UI', sans-serif" font-style="italic" font-size="120" fill="#ffffff" text-anchor="middle">Meta Quest Store</text>
</svg>`;

sharp(Buffer.from(svg)).png().toFile(process.argv[2]).then((i) => console.log('ok', i.width, i.height));
