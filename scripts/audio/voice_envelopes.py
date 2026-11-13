"""
Measures how loud each of Bigfoot's voice lines is, 30 times a second, so his
head and chest can move with his words while he talks:

  python scripts/audio/voice_envelopes.py public/audio/voice OUT.json

Writes {"clip-name": [0..1 at 30 per second, ...], ...}: RMS per 1/30 s,
lightly smoothed, normalised per clip, rounded to 2 decimals. Needs ffmpeg and numpy.
"""
import json
import os
import subprocess
import sys

import numpy as np

SR = 24000
STEP = SR // 30


def envelope(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'],
                         capture_output=True, check=True).stdout
    x = np.frombuffer(raw, np.float32)
    n = len(x) // STEP
    if n == 0:
        return []
    rms = np.sqrt(np.mean(x[: n * STEP].reshape(n, STEP) ** 2, axis=1))
    # A little smoothing (about 0.1 s) so the motion follows phrases, not every consonant.
    k = np.ones(3) / 3
    rms = np.convolve(rms, k, mode='same')
    peak = np.percentile(rms, 98) or 1.0
    return [round(float(v), 2) for v in np.clip(rms / peak, 0, 1)]


def main(folder, out):
    data = {}
    for f in sorted(os.listdir(folder)):
        if f.endswith('.mp3'):
            data[f[:-4]] = envelope(os.path.join(folder, f))
    with open(out, 'w', encoding='utf8') as fh:
        json.dump(data, fh, separators=(',', ':'))
    print('wrote', out, len(data), 'clips')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
