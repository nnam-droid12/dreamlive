// Download a Poly Haven texture set (CC0) and store compact WebP maps for the web.
// usage: node scripts/assets/ph-texture.cjs <id> <size px> [outRoot=public/textures]
// Writes <outRoot>/<id>/{diff,nor,arm}.webp (whichever maps exist).
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const [id, size = '1024', outRoot = 'public/textures'] = process.argv.slice(2);
const pick = (files, keys) => keys.map((k) => files[k]).find(Boolean);
(async () => {
  const files = await (await fetch(`https://api.polyhaven.com/files/${id}`)).json();
  const colKey = Object.keys(files).find((k) => /^col/.test(k));
  const maps = {
    diff: pick(files, ['Diffuse', 'diff', colKey].filter(Boolean)),
    nor: pick(files, ['nor_gl']),
    arm: pick(files, ['arm']),
  };
  const dir = path.join(outRoot, id);
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, entry] of Object.entries(maps)) {
    const url = entry?.['1k']?.jpg?.url ?? entry?.['2k']?.jpg?.url;
    if (!url) continue;
    const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
    const out = path.join(dir, `${name}.webp`);
    await sharp(buf).resize(+size, +size, { fit: 'inside' }).webp({ quality: name === 'nor' ? 92 : 82 }).toFile(out);
    console.log(id, name, (fs.statSync(out).size / 1024).toFixed(0) + ' KB');
  }
})().catch((e) => { console.error(id, e.message); process.exit(1); });
