/**
 * A 4K transparent caption overlay for the demo video (a lower-third line of text):
 *
 *   node scripts/trailer/caption.cjs "Text to show" OUT.png [top|bottom]
 *
 * White semibold text with a soft dark shadow, centred near the top (default, clear of the hands) or bottom of a 3840x2160 frame.
 */
const sharp = require('sharp');

const [text, out, where = 'top'] = process.argv.slice(2);
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const W = 3840;
const H = 2160;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <filter id="s" x="-20%" y="-50%" width="140%" height="200%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="14"/>
      <feOffset dy="6" result="b"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.85"/></feComponentTransfer>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <text x="${W / 2}" y="${where === 'bottom' ? H - 250 : 300}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="600" font-size="104" fill="#ffffff" filter="url(#s)">${esc(text)}</text>
</svg>`;
sharp(Buffer.from(svg)).png().toFile(out).then(() => console.log('wrote', out));
