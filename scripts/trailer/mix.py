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
        'thunder': (thunder(), 1.0),
        'whale': (whale_call(), 0.9),
        'hush': (noise_burst(1.4, 0.0006, 0.18, 5), 0.8),
        'splash': (noise_burst(0.7, 0.0003, 0.45, 6), 0.9),
        'shutter': (noise_burst(0.12, 0.00005, 0.5, 7), 0.8),
    }


def thunder():
    """A sharp crack, then a long low rumble that rolls and dies away."""
    crack = noise_burst(0.4, 0.0001, 0.6, 11)
    rng = np.random.default_rng(12)
    n = int(5.0 * SR)
    x = smooth(rng.standard_normal(n).astype(np.float32), 0.004)
    x = smooth(x, 0.002)
    env = np.minimum(1, np.arange(n) / (0.15 * SR)) * np.exp(-np.arange(n) / SR * 0.9)
    roll = 1 + 0.5 * np.sin(np.arange(n) / SR * 2 * np.pi * 0.7)
    y = x * env * roll
    y = y / (np.abs(y).max() + 1e-6) * 0.95
    out = np.stack([y, y], 1).astype(np.float32)
    out[:len(crack)] += crack
    return out


def whale_call():
    """Two long, low, gliding sine moans."""
    out = np.zeros(int(4.5 * SR), np.float32)
    for f0, f1, at, dur, g in ((98, 147, 0.0, 2.6, 0.16), (196, 131, 1.8, 2.2, 0.1)):
        n = int(dur * SR)
        t = np.arange(n) / SR
        f = f0 * (f1 / f0) ** np.minimum(1, t / (dur * 0.8))
        ph = 2 * np.pi * np.cumsum(f) / SR
        env = np.minimum(1, t / (dur * 0.3)) * np.exp(-np.maximum(0, t - dur * 0.3) * 2.0)
        i = int(at * SR)
        out[i:i + n] += np.sin(ph) * env * g
    return np.stack([out, out], 1)


def world_beds(events, start, total):
    """Ambience for each dream world while it is open: wind, fire crackle, waves and rain."""
    rng = np.random.default_rng(21)
    bed = np.zeros((total, 2), np.float32)
    worlds = [e for e in events if e['type'] == 'world']
    for k, e in enumerate(worlds):
        name = e['name']
        if not name:
            continue
        t0 = max(0, e['t'] - start)
        t1 = (worlds[k + 1]['t'] - start) if k + 1 < len(worlds) else total / SR
        n = int((t1 - t0) * SR)
        if n <= 0:
            continue
        tt = np.arange(n) / SR
        noise = rng.standard_normal((n, 2)).astype(np.float32)
        wind = np.stack([smooth(noise[:, 0], 0.003), smooth(noise[:, 1], 0.003)], 1)
        wind /= np.abs(wind).max() + 1e-6
        gust = (0.6 + 0.4 * np.sin(tt * 2 * np.pi * 0.11) * np.sin(tt * 2 * np.pi * 0.047 + 1))[:, None]
        seg = np.zeros((n, 2), np.float32)
        if name == 'clouds':
            seg += wind * gust * 0.06
        elif name == 'winter':
            seg += wind * gust * 0.08
            pops = np.zeros(n, np.float32)
            for i in rng.integers(0, n, int(n / SR * 6)):
                m = min(n - i, int(0.02 * SR))
                pops[i:i + m] += rng.standard_normal(m).astype(np.float32) * np.exp(-np.arange(m) / (0.004 * SR)) * 0.08
            seg += np.stack([pops, pops], 1)
        elif name == 'sea':
            surf = np.stack([smooth(noise[:, 0], 0.0012), smooth(noise[:, 1], 0.0012)], 1)
            surf /= np.abs(surf).max() + 1e-6
            swell = (0.35 + 0.65 * (0.5 + 0.5 * np.sin(tt * 2 * np.pi / 7.5)) ** 2)[:, None]
            hiss = noise - np.stack([smooth(noise[:, 0], 0.0002), smooth(noise[:, 1], 0.0002)], 1)
            seg += surf * swell * 0.16 + hiss * 0.03 + wind * gust * 0.05
        fade = min(n, int(1.5 * SR))
        seg[:fade] *= np.linspace(0, 1, fade, dtype=np.float32)[:, None]
        seg[-fade:] *= np.linspace(1, 0, fade, dtype=np.float32)[:, None]
        add(bed, seg, t0, 1.0)
    return bed


def movie_sound(events, start, total):
    """The film's own soundtrack while Movie Night plays (from the excerpt in public/video)."""
    out = np.zeros((total, 2), np.float32)
    ev = [e for e in events if e['type'] == 'movie']
    for k, e in enumerate(ev):
        if not e['name'] or e['name'] == 'own':
            continue
        t0 = e['t'] - start
        t1 = next((x['t'] - start for x in ev[k + 1:] if not x['name']), total / SR)
        clip = load(os.path.join(ROOT, 'public', 'video', e['name'] + '.mp4'))[: int((t1 - t0) * SR)]
        fade = min(len(clip), int(1.0 * SR))
        clip[-fade:] *= np.linspace(1, 0, fade, dtype=np.float32)[:, None]
        add(out, clip, t0, 0.8)
    return out


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

    # Each scene's score, crossfading at every change, at the logged music-bus level.
    music_ev = [(e['t'], e['value']) for e in events if e['type'] == 'music']
    amb = np.zeros((total, 2), np.float32)
    scores = [e for e in events if e['type'] == 'score']
    if not scores:
        scores = [{'t': 0, 'name': 'dream'}]
    for k, e in enumerate(scores):
        if not e['name']:
            continue
        t0 = max(e['t'], start) - start
        t1 = (scores[k + 1]['t'] - start) if k + 1 < len(scores) else dur
        if t1 <= t0:
            continue
        seg = looped(load(os.path.join(AUDIO, 'music', e['name'] + '.mp3')), int((t1 - t0 + 1.5) * SR))
        fin, fout = min(len(seg), int(1.2 * SR)), min(len(seg), int(1.5 * SR))
        seg[:fin] *= np.linspace(0, 1, fin, dtype=np.float32)[:, None]
        seg[-fout:] *= np.linspace(1, 0, fout, dtype=np.float32)[:, None]
        add(amb, seg, t0, 1.0)
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

    beds = world_beds(events, start, total)
    film = movie_sound(events, start, total)
    mix = (amb + songs + film * 0.9) * duck[:, None] + voice + fx + beds
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
