"""Cut the distant-tree pictures out of magenta-background previews of Poly Haven
CC0 trees (island_tree_02, searsia_lucida; rendered with asset_render_preview),
freshen the leaves to a summer green, and save them as WebP with alpha.

usage: python bake_trees.py OUT_DIR NAME=PREVIEW.png:x0:x1 ...
(x0..x1 = the horizontal slice of the 2048-wide sheet that holds one view)
"""
import colorsys
import sys

from PIL import Image

out = sys.argv[1]
for arg in sys.argv[2:]:
    name, spec = arg.split('=')
    path, x0, x1 = spec.rsplit(':', 2)
    im = Image.open(path).convert('RGB')
    w, h = im.size
    im = im.crop((int(x0), 0, int(x1), h - 40))  # drop the label strip
    px = im.load()
    cw, ch = im.size
    rgba = Image.new('RGBA', im.size)
    po = rgba.load()
    for y in range(ch):
        for x in range(cw):
            r, g, b = px[x, y]
            # Magenta key: how far the pixel is from pure (255, 0, 255).
            mag = min(r, b) - g
            if mag > 150:
                po[x, y] = (0, 0, 0, 0)
                continue
            a = 255 if mag < 40 else int(255 * (150 - mag) / 110)
            # Despill: no channel's red/blue above green for leafy pixels' fringe.
            if mag > 0:
                r = min(r, g + 10)
                b = min(b, g)
            hh, ss, vv = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            # Leaves (yellow-olive hues) toward a fresh green, a little brighter.
            if 0.12 < hh < 0.4 and ss > 0.18:
                hh = hh + (0.29 - hh) * 0.55
                ss = min(1, ss * 1.25)
                vv = min(1, vv * 1.12)
            r2, g2, b2 = colorsys.hsv_to_rgb(hh, ss, vv)
            po[x, y] = (int(r2 * 255), int(g2 * 255), int(b2 * 255), a)
    box = rgba.getbbox()
    rgba = rgba.crop(box)
    # Keep the trunk base at the bottom edge; 512 px tall is plenty at 25-60 m.
    s = 512 / rgba.size[1]
    rgba = rgba.resize((max(1, int(rgba.size[0] * s)), 512), Image.LANCZOS)
    rgba.save(f'{out}/{name}.webp', quality=88)
    print(name, rgba.size)
