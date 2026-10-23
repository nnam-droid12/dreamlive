// Download a Poly Haven model (gltf + includes) at a resolution into <outdir>/<id>/.
// usage: node ph-fetch.cjs <id> <res> <outdir>
const fs = require('fs');
const path = require('path');
const [id, res, outdir] = process.argv.slice(2);
(async () => {
  const files = await (await fetch(`https://api.polyhaven.com/files/${id}`)).json();
  const g = files.gltf?.[res]?.gltf;
  if (!g) throw new Error(`no gltf at ${res} for ${id}`);
  const dir = path.join(outdir, id);
  fs.mkdirSync(path.join(dir, 'textures'), { recursive: true });
  const get = async (url, to) => {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${r.status} ${url}`);
    fs.writeFileSync(to, Buffer.from(await r.arrayBuffer()));
  };
  await get(g.url, path.join(dir, path.basename(g.url)));
  for (const [rel, f] of Object.entries(g.include ?? {})) await get(f.url, path.join(dir, rel));
  console.log('fetched', id, '->', path.join(dir, path.basename(g.url)));
})().catch((e) => { console.error(e.message); process.exit(1); });
