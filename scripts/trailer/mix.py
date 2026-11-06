"""
Builds the trailer from an offline Director render (see src/config/director.ts):

  python scripts/trailer/mix.py artifacts/frames artifacts/dreamlive-demo-timeline.json out.mp4

1. Assembles the captured frames at a steady 30 fps (one frame per story step).
2. Mixes the soundtrack from the logged timeline: the dream ambience at its
   logged levels, each party song from its start (quieter while the window is
   closed), Bigfoot's voice clips with the music ducked under them, simple
   synthesized stand-ins for the key sound effects, and rain after bedtime.
3. Muxes picture and sound into an H.264/AAC MP4.
Needs ffmpeg and numpy.
"""
import json
import os
import subprocess
import sys

import numpy as np

SR = 48000
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
AUDIO = os.path.join(ROOT, 'public', 'audio')


def load(path):
    """Decode any audio file to float32 stereo at SR."""
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).copy()


def add(mix, clip, at, gain=1.0):
    i = int(at * SR)
    if i >= len(mix) or i + len(clip) <= 0:
        return
    s = max(0, -i)
    i = max(0, i)
    j = min(len(mix), i + len(clip) - s)
    mix[i:j] += clip[s:s + (j - i)] * gain


def looped(clip, n):
    reps = int(np.ceil(n / len(clip)))
    return np.tile(clip, (reps, 1))[:n]


def smooth(x, seconds):
    """Centered moving average via a running sum (linear time, any window length)."""
    k = max(1, int(seconds * SR))
    if k == 1:
        return x.astype(np.float32)
    c = np.cumsum(np.concatenate([[0.0], x.astype(np.float64)]))
    y = (c[k:] - c[:-k]) / k
    pad_l = (len(x) - len(y)) // 2
    return np.pad(y, (pad_l, len(x) - len(y) - pad_l), mode='edge').astype(np.float32)


def env_from(events, start, total, default):
    """Piecewise level curve (smoothed) from (t, value) events."""
    curve = np.full(total, default, np.float32)
    level = default
    last = 0
    for t, v in events:
        i = max(0, min(total, int((t - start) * SR)))
        curve[last:i] = level
        level, last = v, i
    curve[last:] = level
    return smooth(curve, 0.6)


def tone_arp(notes, step, dur, gain):
    """Soft sine-bell arpeggio (chimes, catch, bloom)."""
    n = int((step * len(notes) + dur) * SR)
    out = np.zeros(n, np.float32)
    t = np.arange(int(dur * SR)) / SR
    for k, m in enumerate(notes):
        f = 440 * 2 ** ((m - 69) / 12)
        bell = np.sin(2 * np.pi * f * t) * np.exp(-t * 3.2) * gain
        i = int(k * step * SR)
        out[i:i + len(bell)] += bell
    return np.stack([out, out], 1)


def noise_burst(dur, lowpass_seconds, gain, seed):
    """Decaying noise; a moving average stands in for a low-pass (longer = darker)."""
    rng = np.random.default_rng(seed)
    n = int(dur * SR)
    x = rng.standard_normal(n).astype(np.float32)
    y = smooth(x, lowpass_seconds)
    y *= np.exp(-np.arange(n) / SR * (3.0 / dur)) * gain / (np.abs(y).max() + 1e-6)
    return np.stack([y, y], 1)


def sfx_bank():
    boom = noise_burst(0.9, 0.004, 0.9, 1)
    crackle = noise_burst(1.4, 0.0001, 0.25, 2)
    firework = np.zeros((int(1.6 * SR), 2), np.float32)
    firework[:len(boom)] += boom
    k = int(0.12 * SR)
    firework[k:k + len(crackle)] += crackle
    return {
        'firework': (firework, 0.8),
        'catch': (tone_arp([79, 84, 88, 91, 96, 100], 0.05, 1.4, 0.14), 1.0),
        'bloom': (tone_arp([84, 88, 91, 96], 0.07, 1.3, 0.16), 0.9),
        'chime': (tone_arp([88], 0.1, 1.2, 0.2), 0.7),
        'wake': (tone_arp([60, 64, 67, 72, 76], 0.12, 1.6, 0.12), 0.9),
        'pop': (noise_burst(0.25, 0.0002, 0.4, 3), 0.8),
    }


def main(frames_path, timeline_path, out_path):
    tl = json.load(open(timeline_path, encoding='utf8'))
    fps, start = tl['fps'], tl['start']
    events = tl['events']

    video = out_path.replace('.mp4', '-video.mp4')
    # Numbered JPEG frames (artifacts/frames), one per story step; 720p, even sizes for H.264.
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', str(fps), '-i', os.path.join(frames_path, 'frame-%05d.jpg'),
                    '-vf', 'scale=-2:720:flags=lanczos', '-c:v', 'libx264', '-crf', '18', '-preset', 'slow',
                    '-pix_fmt', 'yuv420p', video], check=True)
    dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', video],
                               capture_output=True, text=True).stdout.strip())
    total = int(dur * SR)
    print(f'video {dur:.1f}s')

    # Voices first: the music ducks under them.
    voice = np.zeros((total, 2), np.float32)
    clips = {}
    for e in events:
        if e['type'] != 'voice' or e['t'] < start - 0.5:
            continue
        name = e['name']
        if name not in clips:
            p = os.path.join(AUDIO, 'voice', name + '.mp3')
            clips[name] = load(p) if os.path.exists(p) else None
        if clips[name] is not None:
            add(voice, clips[name], e['t'] - start, 1.15)
    talking = smooth((np.abs(voice[:, 0]) > 0.01).astype(np.float32), 0.4) > 0
    duck = smooth(np.where(talking, 0.45, 1.0).astype(np.float32), 0.25)

    # Dream ambience at its logged levels.
    music_ev = [(e['t'], e['value']) for e in events if e['type'] == 'music']
    amb = looped(load(os.path.join(AUDIO, 'music', 'dream.mp3')), total)
    amb *= (env_from(music_ev, start, total, 0.0) * 0.55)[:, None]

    # Party songs: each from its start until the next act change; quieter behind closed glass.
    songs = np.zeros((total, 2), np.float32)
    acts = [e for e in events if e['type'] == 'act']
    for k, e in enumerate(acts):
        if e['name'] not in ('disco', 'afro', 'house'):
            continue
        t0 = e['t'] - start
        t1 = (acts[k + 1]['t'] - start) if k + 1 < len(acts) else dur
        if t1 <= max(t0, 0):
            continue
        seg = looped(load(os.path.join(AUDIO, 'music', e['name'] + '.mp3')), int((t1 - t0) * SR))
        fade = min(len(seg), int(0.6 * SR))
        seg[-fade:] *= np.linspace(1, 0, fade, dtype=np.float32)[:, None]
        add(songs, seg, t0, 0.9)
    open_ev = [(e['t'], 0.35 + 0.65 * (e.get('value') or 0)) for e in events if e['type'] == 'open']
    songs *= env_from(open_ev, start, total, 1.0)[:, None]

    # Sound effects, and rain after bedtime.
    fx = np.zeros((total, 2), np.float32)
    bank = sfx_bank()
    for e in events:
        if e['type'] == 'sfx' and e['name'] in bank and e['t'] >= start:
            clip, g = bank[e['name']]
            add(fx, clip, e['t'] - start, g * (e.get('value') or 1))
    rain_at = next((e['t'] - start for e in events if e['type'] == 'voice' and e['name'] == 'rain'), None)
    if rain_at is not None and rain_at < dur:
        rng = np.random.default_rng(7)
        n = total - int(max(0, rain_at - 2) * SR)
        hiss = rng.standard_normal((n, 2)).astype(np.float32)
        hiss[:, 0] -= smooth(hiss[:, 0], 0.0002)
        hiss[:, 1] -= smooth(hiss[:, 1], 0.0002)
        ramp = np.minimum(1, np.arange(n, dtype=np.float32) / (2 * SR))[:, None]
        fx[total - n:] += hiss * 0.035 * ramp

    mix = (amb + songs) * duck[:, None] + voice + fx
    peak = float(np.abs(mix).max())
    mix = np.tanh(mix / max(peak, 1e-6) * 1.4) * 0.9  # gentle limiter
    wav = out_path.replace('.mp4', '-mix.wav')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-i', '-', wav],
                   input=mix.astype(np.float32).tobytes(), check=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', video, '-i', wav, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
                    '-shortest', '-movflags', '+faststart', out_path], check=True)
    print('wrote', out_path)


if __name__ == '__main__':
    main(*sys.argv[1:4])
