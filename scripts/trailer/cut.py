"""
Cuts the trailer out of the full walkthrough film:

  python scripts/trailer/cut.py artifacts/dreamlive-full.mp4 artifacts/dreamlive-trailer.mp4 "0-20,34.5-52,..."

Each range (seconds) is trimmed from the full film, given a short fade of
picture and sound at both ends, and the pieces are joined into one H.264/AAC MP4.
Needs ffmpeg.
"""
import subprocess
import sys

FADE = 0.35


def main(src, out, ranges):
    parts = [tuple(float(x) for x in r.split('-')) for r in ranges.split(',') if r.strip()]
    chains = []
    labels = []
    for i, (a, b) in enumerate(parts):
        d = b - a
        chains.append(
            f'[0:v]trim={a}:{b},setpts=PTS-STARTPTS,fade=t=in:st=0:d={FADE},fade=t=out:st={d - FADE}:d={FADE}[v{i}];'
            f'[0:a]atrim={a}:{b},asetpts=PTS-STARTPTS,afade=t=in:st=0:d={FADE},afade=t=out:st={d - FADE}:d={FADE}[a{i}]'
        )
        labels.append(f'[v{i}][a{i}]')
    graph = ';'.join(chains) + ';' + ''.join(labels) + f'concat=n={len(parts)}:v=1:a=1[v][a]'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-filter_complex', graph, '-map', '[v]', '-map', '[a]',
                    '-c:v', 'libx264', '-crf', '18', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k',
                    '-movflags', '+faststart', out], check=True)
    print('wrote', out, f'{sum(b - a for a, b in parts):.1f}s')


if __name__ == '__main__':
    main(*sys.argv[1:4])
