# Asset pipeline

Third-party assets are downloaded, optimized and committed under `public/`. Each one is listed in `CREDITS.md`.

```sh
# 1. Download a Poly Haven model (CC0) at 1k textures
node scripts/assets/ph-fetch.cjs <id> 1k <download-dir>

# 2. Pack into one GLB: WebP textures ≤1024 px, quantized geometry.
#    Uses only extensions three.js reads natively (no meshopt/Draco decoders or CDN fetches).
npx -y @gltf-transform/cli@4 optimize <download-dir>/<id>/<id>_1k.gltf public/models/<name>.glb \
  --texture-compress webp --texture-size 1024 --simplify false --compress quantize

# 3. HDR panorama → tone-mapped JPG backdrop (showcase mode only)
node scripts/assets/hdr2jpg.cjs <in.hdr> public/env/<name>.jpg <exposure> "$(pwd)/node_modules/sharp"
```
