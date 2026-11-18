"""
The submission demo video in 4K: the full film's kept stretches (in story order, slow holds
removed), each upscaled to 3840x2160, then the "DREAM LIVE" end card over the closing music.

  python scripts/trailer/final_video.py artifacts/dreamlive-full.mp4 artifacts/endcard-4k.png OUT.mp4 "a-b,c-d,..." END_FROM [CAPTION.png@FROM-TO]

The ranges are the stretches of the full film (seconds) to KEEP, in order. The end card holds
for CARD_SEC with the full film's audio from END_FROM (the closing music), fading in and out.
An optional 4K transparent caption (scripts/trailer/caption.cjs) fades in and out over the cut
from FROM to TO seconds. Needs ffmpeg.
"""
import subprocess
import sys

FADE = 0.18
CARD_SEC = 5.0


def main(src, card, out, ranges, end_from, caption=None):
    parts = [tuple(float(x) for x in r.split('-')) for r in ranges.split(',') if r.strip()]
    end_from = float(end_from)
    chains, labels = [], []
    for i, (a, b) in enumerate(parts):
        d = b - a
        chains.append(
            f'[0:v]trim={a}:{b},setpts=PTS-STARTPTS,scale=3840:-2:flags=lanczos,crop=3840:2160,setsar=1,'
            f'fade=t=in:st=0:d={FADE},fade=t=out:st={d - FADE}:d={FADE}[v{i}];'
            f'[0:a]atrim={a}:{b},asetpts=PTS-STARTPTS,afade=t=in:st=0:d={FADE},afade=t=out:st={d - FADE}:d={FADE}[a{i}]'
        )
        labels.append(f'[v{i}][a{i}]')
    n = len(parts)
    # The end card: the 4K still, fading in from black and out at the end, over the closing music.
    chains.append(
        f'[1:v]loop=loop=-1:size=1:start=0,trim=0:{CARD_SEC},setpts=PTS-STARTPTS,fps=30,format=yuv420p,setsar=1,'
        f'fade=t=in:st=0:d=0.8,fade=t=out:st={CARD_SEC - 0.8}:d=0.8[v{n}];'
        f'[0:a]atrim={end_from}:{end_from + CARD_SEC},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.5,afade=t=out:st={CARD_SEC - 1.2}:d=1.2[a{n}]'
    )
    labels.append(f'[v{n}][a{n}]')
    inputs = ['-i', src, '-i', card]
    if caption:
        cap, span = caption.rsplit('@', 1)
        c0, c1 = (float(x) for x in span.split('-'))
        inputs += ['-loop', '1', '-i', cap]
        graph = (';'.join(chains) + ';' + ''.join(labels) + f'concat=n={n + 1}:v=1:a=1[vc][a];'
                 f'[2:v]format=rgba,fade=t=in:st={c0}:d=0.4:alpha=1,fade=t=out:st={c1 - 0.4}:d=0.4:alpha=1[cap];'
                 f"[vc][cap]overlay=0:0:shortest=1:enable='between(t,{c0},{c1})'[v]")
    else:
        graph = ';'.join(chains) + ';' + ''.join(labels) + f'concat=n={n + 1}:v=1:a=1[v][a]'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', *inputs, '-filter_complex', graph,
                    '-map', '[v]', '-map', '[a]', '-r', '30',
                    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '5.1',
                    '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', out], check=True)
    total = sum(b - a for a, b in parts) + CARD_SEC
    print('wrote', out, f'{total:.1f}s ({int(total // 60)}:{total % 60:04.1f})')


if __name__ == '__main__':
    main(*sys.argv[1:7])
