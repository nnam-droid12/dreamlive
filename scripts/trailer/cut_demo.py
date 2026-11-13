"""
Cuts the submission demo video out of the full walkthrough film, keeping the
experience in order and removing only slow holds (never during Bigfoot's lines):

  python scripts/trailer/cut_demo.py artifacts/dreamlive-full.mp4 artifacts/dreamlive-demo.mp4

REMOVE lists the stretches taken out (seconds of the full film). Each kept piece
gets a short soft fade of picture and sound at both ends, the pieces are joined,
and the picture is scaled to a standard 1280x720 (16:9). Needs ffmpeg.
"""
import subprocess
import sys

FADE = 0.18
# The end card (the last piece) is shown alone on black: only this box of the frame (x, y, w, h) is kept.
CARD = (352, 268, 504, 184)
# (start, end) seconds of the full film to remove.
REMOVE = [
    (0.0, 0.2),       # the room still loading
    (6.5, 10.5),      # long hold on the sleeping Bigfoot
    (47.6, 51.4),     # skyline beat at the party (the console moments stay)
    (92.5, 97.5),     # sleep hold before dawn
    (104.5, 107.5),   # memory orb hold
    (110.0, 114.0),   # Bigfoot's walk up to you
    (119.9, 122.8),   # pause between the high-five and the fist bump
    (141.5, 143.5),   # after the head pat
    (152.0, 155.0),   # part of the bunny's walk (stepping out of the film stays)
    (163.0, 170.0),   # long sofa hold
    (180.6, 198.6),   # the old street stretch (the street walk is gone from the app)
    (212.0, 215.0),   # sky hold before the falling star
    (229.0, 233.0),   # the empty garden after the butterfly leaves
    (234.0, 236.5),   # the dark start of the sea
    (247.55, 248.75), # one second of storm foam close to the camera
    (263.6, 289.6),   # the bedtime stretch (bedtime is now rain-free; the old render had rain)
    (294.0, 296.6),   # the end of the final title card
]


def keep_ranges(total):
    out = []
    t = 0.0
    for a, b in sorted(REMOVE):
        if a > t:
            out.append((t, a))
        t = max(t, b)
    if t < total:
        out.append((t, total))
    return out


def main(src, out):
    total = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', src],
                                 capture_output=True, text=True, check=True).stdout.strip())
    parts = keep_ranges(total)
    chains, labels = [], []
    for i, (a, b) in enumerate(parts):
        d = b - a
        last = i == len(parts) - 1
        x, y, w, h = CARD
        card = (f',crop={w}:{h}:{x}:{y},pad=iw+{x}+{x}:ih+{y}+{y}:{x}:{y}:black,scale=1208:720' if last else '')
        fin = 0.6 if last else FADE
        chains.append(
            f'[0:v]trim={a}:{b},setpts=PTS-STARTPTS{card},fade=t=in:st=0:d={fin},fade=t=out:st={d - FADE}:d={FADE}[v{i}];'
            f'[0:a]atrim={a}:{b},asetpts=PTS-STARTPTS,afade=t=in:st=0:d={FADE},afade=t=out:st={d - FADE}:d={FADE}[a{i}]'
        )
        labels.append(f'[v{i}][a{i}]')
    graph = (';'.join(chains) + ';' + ''.join(labels) + f'concat=n={len(parts)}:v=1:a=1[vc][a];'
             '[vc]scale=1280:-2,crop=1280:720,setsar=1[v]')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-filter_complex', graph, '-map', '[v]', '-map', '[a]',
                    '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k',
                    '-movflags', '+faststart', out], check=True)
    print('wrote', out, f'{sum(b - a for a, b in parts):.1f}s in {len(parts)} pieces')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
