"""
Pre-analyses every music track for offline Director renders:

  python scripts/trailer/bands.py

For public/audio/music/<name>.mp3 it writes <name>.bands.json: the track's
bass / mid / high energy (0..255, 30 frames a second, like the live analyser's
bands), so the music visualizer can dance in a render that has no live audio.
Needs ffmpeg and numpy.
"""
import base64
import glob
import json
import os
import subprocess

import numpy as np

SR = 22050
FPS = 30
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def analyse(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'],
                         capture_output=True, check=True).stdout
    x = np.frombuffer(raw, np.float32)
    hop = SR // FPS
    win = 1024
    n = max(1, (len(x) - win) // hop)
    w = np.hanning(win).astype(np.float32)
    freqs = np.fft.rfftfreq(win, 1 / SR)
    bands = [(90, 280), (280, 2000), (2000, 8000)]
    idx = [(freqs >= a) & (freqs < b) for a, b in bands]
    out = np.zeros((n, 3), np.uint8)
    for i in range(n):
        seg = x[i * hop:i * hop + win] * w
        mag = np.abs(np.fft.rfft(seg)) / (win / 4)
        db = 20 * np.log10(mag + 1e-9)
        # Like an AnalyserNode: -100..-30 dB mapped to 0..255, then averaged per band.
        v = np.clip((db + 100) / 70, 0, 1)
        for k in range(3):
            out[i, k] = int(v[idx[k]].mean() * 255)
    return out


def main():
    for path in sorted(glob.glob(os.path.join(ROOT, 'public', 'audio', 'music', '*.mp3'))):
        b = analyse(path)
        dst = path[:-4] + '.bands.json'
        json.dump({'fps': FPS, 'frames': len(b), 'data': base64.b64encode(b.tobytes()).decode()}, open(dst, 'w'))
        print(os.path.basename(dst), len(b), 'frames')


if __name__ == '__main__':
    main()
