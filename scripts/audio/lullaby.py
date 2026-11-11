"""
Bigfoot's lullaby: an original music-box melody (written for Dreamlive) with a
soft pad underneath, rendered from scratch (no samples, no third-party music).
3/4 time at 72 BPM, 32 bars (80 s), so it loops seamlessly.

    python scripts/audio/lullaby.py            -> public/audio/music/music-box.mp3

It is the whales' song at sea (the Whales slider sets its level).
"""
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np

SR = 44100
BPM = 72
BEAT = 60.0 / BPM
BARS = 32

# Melody (MIDI notes, one per beat; None = hold). Two 8-bar phrases, played A B A B.
A = [
    76, 79, 76, 74, 72, 74, 76, 79, 84, 83, None, None,
    81, 84, 81, 79, 76, 79, 77, 76, 74, 72, None, None,
]
B = [
    67, 72, 76, 79, None, 76, 77, 81, 77, 76, None, 72,
    74, 77, 81, 79, 77, 76, 74, 76, 74, 72, None, None,
]
# Chord roots per bar (pad), C major.
CHORDS_A = [[48, 55, 64], [43, 50, 59], [48, 55, 64], [43, 50, 59], [41, 48, 57], [48, 55, 64], [43, 50, 59], [48, 55, 64]]
CHORDS_B = [[48, 55, 64], [48, 55, 64], [41, 48, 57], [48, 55, 64], [50, 57, 65], [48, 55, 64], [43, 50, 59], [48, 55, 64]]

MELODY = A + B + A + B
CHORDS = CHORDS_A + CHORDS_B + CHORDS_A + CHORDS_B


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def music_box(f, dur):
    """A plucked comb tine: a pure fundamental, a bright inharmonic overtone, a quick tick."""
    t = np.arange(int(dur * SR)) / SR
    env = np.exp(-t / 1.1) * (1 - np.exp(-t / 0.002))
    tone = np.sin(2 * np.pi * f * t) + 0.32 * np.sin(2 * np.pi * f * 2.0 * t) * np.exp(-t / 0.5)
    tone += 0.18 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t / 0.18)
    tone += 0.06 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t / 0.05)
    return tone * env


def pad(freqs, dur):
    t = np.arange(int(dur * SR)) / SR
    env = np.minimum(1, t / 0.6) * np.minimum(1, (dur - t) / 0.6)
    out = np.zeros_like(t)
    for f in freqs:
        # Two slightly detuned sines: a warm, slow chorus.
        out += np.sin(2 * np.pi * f * t) + 0.7 * np.sin(2 * np.pi * f * 1.003 * t + 1.3)
    return out * env / len(freqs)


def main(out_mp3):
    total = BARS * 3 * BEAT
    n = int(total * SR)
    mix = np.zeros(n + SR * 3)
    for i, note in enumerate(MELODY):
        if note is None:
            continue
        at = int(i * BEAT * SR)
        clip = music_box(hz(note), 3.2)
        mix[at : at + len(clip)] += clip * 0.32
        # A soft echo an octave below on the bar's first beat.
        if i % 3 == 0:
            low = music_box(hz(note - 12), 2.6) * 0.12
            mix[at : at + len(low)] += low
    bar = 3 * BEAT
    for b, chord in enumerate(CHORDS):
        at = int(b * bar * SR)
        clip = pad([hz(m) for m in chord], bar + 0.8)
        mix[at : at + len(clip)] += clip * 0.09
    # Fold the tail past the loop point back onto the start, so the loop is seamless.
    tail = mix[n:]
    mix = mix[:n]
    mix[: len(tail)] += tail
    mix /= np.max(np.abs(mix)) * 1.15
    stereo = np.stack([mix, np.roll(mix, int(0.012 * SR))], axis=1)
    pcm = (stereo * 32767).astype(np.int16)
    wav = Path(out_mp3).with_suffix('.wav')
    with wave.open(str(wav), 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(wav), '-codec:a', 'libmp3lame', '-b:a', '128k', str(out_mp3)], check=True)
    wav.unlink()
    print(f'{out_mp3}: {total:.1f} s, {BPM} BPM')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'public/audio/music/music-box.mp3')
