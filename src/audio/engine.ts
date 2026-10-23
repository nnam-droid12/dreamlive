/**
 * Procedural audio for Dreamlive (placeholder until final tracks are approved):
 * everything is synthesized with Web Audio — no files, no network. Spatial
 * sounds use HRTF PannerNodes; music ducks under key moments.
 */
type Vec = { x: number; y: number; z: number };

/** Captions for sounds that matter to the story (accessibility). */
export const SOUND_CAPTIONS: Partial<Record<SoundName, string>> = {
  bell: 'A bell rings in the distance.',
  splash: 'Something gentle and big surfaces.',
  door: 'A little door creaks open.',
  rainStart: 'Rain begins to fall upward.',
};

export type SoundName =
  | 'chime' | 'bloom' | 'bell' | 'splash' | 'door' | 'catch' | 'wake' | 'rainStart' | 'hush';
export type LoopName = 'waves' | 'rain';

export interface LoopHandle {
  setPosition(p: Vec): void;
  setGain(g: number): void;
  stop(): void;
}

const MELODY = [72, 76, 79, 84, 83, 79, 76, 74, 72, 74, 76, 79, 77, 74, 71, 67];
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

class AudioEngine {
  ctx?: AudioContext;
  private master!: GainNode;
  private sfx!: GainNode;
  private music!: GainNode;
  private musicLevel = 0;
  private reverb!: ConvolverNode;
  private noise!: AudioBuffer;
  private nextNote = 0;
  private noteIndex = 0;
  private musicOn = false;
  private pad?: { stop(): void; gain: GainNode };
  private hum?: { stop(): void; gain: GainNode };
  /** Last caption-worthy sound, consumed by AudioSystem. */
  pendingCaption = '';

  /** Must first run inside a user gesture (entering XR counts). */
  ensure(): boolean {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        return false;
      }
      const c = this.ctx;
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      this.master = c.createGain();
      this.master.gain.value = 0.8;
      this.master.connect(comp).connect(c.destination);
      this.sfx = c.createGain();
      this.sfx.connect(this.master);
      this.music = c.createGain();
      this.music.gain.value = 0;
      this.music.connect(this.master);
      this.reverb = c.createConvolver();
      this.reverb.buffer = this.impulse(2.8);
      const wet = c.createGain();
      wet.gain.value = 0.35;
      this.reverb.connect(wet).connect(this.master);
      this.noise = this.noiseBuffer(2);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => undefined);
    return true;
  }

  suspend(): void {
    if (this.ctx?.state === 'running') void this.ctx.suspend().catch(() => undefined);
  }

  setListener(p: Vec, fwd: Vec, up: Vec): void {
    const l = this.ctx?.listener;
    if (!l) return;
    if (l.positionX) {
      const t = this.ctx!.currentTime;
      l.positionX.setTargetAtTime(p.x, t, 0.02);
      l.positionY.setTargetAtTime(p.y, t, 0.02);
      l.positionZ.setTargetAtTime(p.z, t, 0.02);
      l.forwardX.setTargetAtTime(fwd.x, t, 0.02);
      l.forwardY.setTargetAtTime(fwd.y, t, 0.02);
      l.forwardZ.setTargetAtTime(fwd.z, t, 0.02);
      l.upX.setTargetAtTime(up.x, t, 0.02);
      l.upY.setTargetAtTime(up.y, t, 0.02);
      l.upZ.setTargetAtTime(up.z, t, 0.02);
    } else {
      l.setPosition(p.x, p.y, p.z);
      l.setOrientation(fwd.x, fwd.y, fwd.z, up.x, up.y, up.z);
    }
  }

  /** One-shot sound, spatial when a position is given. */
  play(name: SoundName, at?: Vec, gain = 1): void {
    if (!this.ctx) return;
    const out = this.output(at, gain);
    const t = this.ctx.currentTime;
    switch (name) {
      case 'chime':
        this.tone(midi(88), t, 1.2, 0.22, out);
        this.tone(midi(88) * 2.76, t, 0.6, 0.05, out);
        break;
      case 'bloom':
        [84, 88, 91, 96].forEach((n, i) => this.tone(midi(n), t + i * 0.07, 1.4, 0.18, out));
        this.duck(0.5, 1.5);
        break;
      case 'bell':
        [1, 2, 2.76, 5.4].forEach((m, i) => this.tone(392 * m, t, 4 / (i + 1), 0.16 / (i + 1), out));
        break;
      case 'catch':
        [79, 84, 88, 91, 96, 100].forEach((n, i) => this.tone(midi(n), t + i * 0.05, 1.6, 0.14, out));
        this.duck(0.4, 2);
        break;
      case 'wake':
        [60, 64, 67, 72, 76].forEach((n, i) => this.tone(midi(n), t + i * 0.12, 1.8, 0.12, out));
        break;
      case 'hush':
        this.noiseBurst(t, 1.6, 900, 0.12, out);
        break;
      case 'splash':
        this.noiseBurst(t, 0.9, 700, 0.3, out);
        break;
      case 'door':
        this.noiseBurst(t, 1.2, 1800, 0.12, out);
        this.tone(midi(67), t + 0.3, 2, 0.1, out);
        break;
      case 'rainStart':
        this.noiseBurst(t, 1.5, 3200, 0.08, out);
        break;
    }
    const caption = SOUND_CAPTIONS[name];
    if (caption) this.pendingCaption = caption;
  }

  /** Looping ambience anchored in the room. */
  loop(name: LoopName, at: Vec, gain = 1): LoopHandle {
    const c = this.ctx;
    if (!c) return { setPosition() {}, setGain() {}, stop() {} };
    const panner = this.panner(at);
    const level = c.createGain();
    level.gain.value = 0;
    level.gain.setTargetAtTime(gain, c.currentTime, 1.5);
    const src = c.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filter = c.createBiquadFilter();
    const shape = c.createGain();
    if (name === 'waves') {
      filter.type = 'lowpass';
      filter.frequency.value = 520;
      const lfo = c.createOscillator();
      lfo.frequency.value = 0.13;
      const depth = c.createGain();
      depth.gain.value = 0.35;
      shape.gain.value = 0.55;
      lfo.connect(depth).connect(shape.gain);
      lfo.start();
    } else {
      filter.type = 'bandpass';
      filter.frequency.value = 3400;
      filter.Q.value = 0.6;
      shape.gain.value = 0.35;
    }
    src.connect(filter).connect(shape).connect(level).connect(panner).connect(this.sfx);
    src.start();
    return {
      setPosition: (p) => this.place(panner, p),
      setGain: (g) => level.gain.setTargetAtTime(g, c.currentTime, 0.4),
      stop: () => {
        level.gain.setTargetAtTime(0, c.currentTime, 0.5);
        src.stop(c.currentTime + 2.5);
      },
    };
  }

  /** Soft arrival hum (2D). */
  setHum(on: boolean): void {
    const c = this.ctx;
    if (!c) return;
    if (on && !this.hum) this.hum = this.drone([110, 165, 220.5], 0.05, 'sine');
    if (!on && this.hum) {
      this.hum.stop();
      this.hum = undefined;
    }
  }

  /** Music-box theme + chapter pad. `level` 0..1 fades the whole music bus. */
  setMusic(level: number): void {
    const c = this.ctx;
    if (!c) return;
    this.musicLevel = level;
    this.music.gain.setTargetAtTime(level * 0.9, c.currentTime, 1.5);
    if (level > 0 && !this.musicOn) {
      this.musicOn = true;
      this.nextNote = c.currentTime + 0.2;
      this.pad ??= this.drone([220, 277.2, 329.6], 0.04, 'triangle', this.music);
    }
  }

  /** Lower the music briefly so a key sound reads clearly. */
  duck(amount: number, seconds: number): void {
    const c = this.ctx;
    if (!c || !this.musicOn) return;
    const g = this.music.gain;
    const t = c.currentTime;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(this.musicLevel * 0.9 * (1 - amount), t, 0.08);
    g.setTargetAtTime(this.musicLevel * 0.9, t + seconds, 0.8);
  }

  /** Called every frame: schedules music-box notes slightly ahead. */
  tick(): void {
    const c = this.ctx;
    if (!c || !this.musicOn || c.state !== 'running') return;
    const beat = 60 / 76;
    while (this.nextNote < c.currentTime + 0.3) {
      const n = MELODY[this.noteIndex % MELODY.length];
      const accent = this.noteIndex % 4 === 0 ? 1 : 0.7;
      this.tone(midi(n), this.nextNote, 1.6, 0.09 * accent, this.music);
      this.tone(midi(n) * 3, this.nextNote, 0.4, 0.012, this.music);
      this.noteIndex++;
      this.nextNote += this.noteIndex % 8 === 0 ? beat * 2 : beat;
    }
  }

  // ---- building blocks ----------------------------------------------------

  private output(at: Vec | undefined, gain: number): AudioNode {
    const c = this.ctx!;
    const g = c.createGain();
    g.gain.value = gain;
    if (at) g.connect(this.panner(at)).connect(this.sfx);
    else g.connect(this.sfx);
    g.connect(this.reverb);
    return g;
  }

  private panner(at: Vec): PannerNode {
    const p = this.ctx!.createPanner();
    p.panningModel = 'HRTF';
    p.distanceModel = 'inverse';
    p.refDistance = 0.6;
    p.rolloffFactor = 0.8;
    this.place(p, at);
    return p;
  }

  private place(p: PannerNode, at: Vec): void {
    if (p.positionX) {
      const t = this.ctx!.currentTime;
      p.positionX.setTargetAtTime(at.x, t, 0.05);
      p.positionY.setTargetAtTime(at.y, t, 0.05);
      p.positionZ.setTargetAtTime(at.z, t, 0.05);
    } else p.setPosition(at.x, at.y, at.z);
  }

  private tone(freq: number, t: number, decay: number, gain: number, out: AudioNode): void {
    const c = this.ctx!;
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + decay + 0.05);
  }

  private noiseBurst(t: number, dur: number, freq: number, gain: number, out: AudioNode): void {
    const c = this.ctx!;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(freq * 0.5, t);
    f.frequency.exponentialRampToValueAtTime(freq, t + dur * 0.6);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + dur * 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(out);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  private drone(freqs: number[], gain: number, type: OscillatorType, out?: AudioNode) {
    const c = this.ctx!;
    const g = c.createGain();
    g.gain.value = 0;
    g.gain.setTargetAtTime(gain, c.currentTime, 2);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    lp.connect(g).connect(out ?? this.sfx);
    const oscs = freqs.map((f, i) => {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.value = f;
      o.detune.value = (i - 1) * 6;
      o.connect(lp);
      o.start();
      return o;
    });
    return {
      gain: g,
      stop: () => {
        g.gain.setTargetAtTime(0, c.currentTime, 1);
        oscs.forEach((o) => o.stop(c.currentTime + 4));
      },
    };
  }

  private noiseBuffer(seconds: number): AudioBuffer {
    const c = this.ctx!;
    const b = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  private impulse(seconds: number): AudioBuffer {
    const c = this.ctx!;
    const len = c.sampleRate * seconds;
    const b = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    return b;
  }
}

/** The one audio engine for the app. */
export const Sound = new AudioEngine();
