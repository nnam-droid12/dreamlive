// Convert a Radiance .hdr (RGBE, RLE) to a tone-mapped sRGB JPG.
// usage: node hdr2jpg.cjs <in.hdr> <out.jpg> <exposure> <sharpPath>
const fs = require('fs');
const [inp, out, exposure = '1', sharpPath] = process.argv.slice(2);
const sharp = require(sharpPath);
const buf = fs.readFileSync(inp);
let pos = 0;
const line = () => { let s = ''; while (buf[pos] !== 10) s += String.fromCharCode(buf[pos++]); pos++; return s; };
while (line() !== '') {}
const dims = line().match(/-Y (\d+) \+X (\d+)/);
const H = +dims[1], W = +dims[2];
const rgbe = new Uint8Array(W * H * 4);
const scan = new Uint8Array(W * 4);
for (let y = 0; y < H; y++) {
  if (buf[pos] !== 2 || buf[pos + 1] !== 2) throw new Error('only new-style RLE supported');
  pos += 4;
  for (let c = 0; c < 4; c++) {
    let x = 0;
    while (x < W) {
      let n = buf[pos++];
      if (n > 128) { n -= 128; const v = buf[pos++]; while (n--) scan[(x++) * 4 + c] = v; }
      else { while (n--) scan[(x++) * 4 + c] = buf[pos++]; }
    }
  }
  rgbe.set(scan, y * W * 4);
}
const ex = +exposure;
const rgb = Buffer.alloc(W * H * 3);
for (let i = 0; i < W * H; i++) {
  const e = rgbe[i * 4 + 3];
  const f = e ? Math.pow(2, e - 136) * ex : 0;
  for (let c = 0; c < 3; c++) {
    const v = rgbe[i * 4 + c] * f;
    const t = v / (1 + v); // Reinhard
    rgb[i * 3 + c] = Math.round(255 * Math.min(1, Math.pow(t, 1 / 2.2)));
  }
}
sharp(rgb, { raw: { width: W, height: H, channels: 3 } }).jpeg({ quality: 82, mozjpeg: true }).toFile(out)
  .then((i) => console.log('ok', W, H, (i.size / 1e6).toFixed(2) + ' MB'));
