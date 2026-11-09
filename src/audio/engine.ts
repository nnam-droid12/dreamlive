/**
 * Dreamlive's audio: recorded songs and Bigfoot's voice clips (public/audio,
 * streamed or decoded on demand) plus sound effects synthesized with Web Audio.
 * Spatial sounds use HRTF PannerNodes; music ducks under key moments; an
 * analyser feeds the music visualizer.
 */
import { Timeline } from './timeline.js';

type Vec = { x: number; y: number; z: number };

/** Captions for sounds that matter to the story (accessibility). */
export const SOUND_CAPTIONS: Partial<Record<SoundName, string>> = {
  wake: 'Bigfoot yawns and stretches.',
};

export type SoundName =
  | 'chime' | 'bloom' | 'bell' | 'splash' | 'door' | 'catch' | 'wake' | 'rainStart' | 'hush' | 'firework' | 'pop' | 'shutter' | 'thunder' | 'whale';
export type LoopName = 'waves' | 'wind' | 'snore' | 'rain';
export type ActName = '' | 'surf' | 'dj' | 'ski' | 'disco' | 'afro' | 'house';

export interface LoopHandle {
  setPosition(p: Vec): void;
  setGain(g: number): void;
  stop(): void;
}

const MELODY = [72, 76, 79, 84, 83, 79, 76, 74, 72, 74, 76, 79, 77, 74, 71, 67];
/** Act tempos (BPM) and patterns, one entry per 16th step. */
const ACT_BPM: Record<Exclude<ActName, ''>, number> = { surf: 100, dj: 120, ski: 140, disco: 118, afro: 104, house: 124 };
/** Acts played from recorded tracks (public/audio/music, credited in CREDITS.md); others are synthesized. */
const TRACK_ACTS = new Set<ActName>(['disco', 'afro', 'house']);
/** The opening ambient score on the music bus (each scene can set its own with setScore). */
const DREAM_TRACK = 'dream';

/** Live analysis of what is playing (the music visualizer reads this every frame). */
export interface AudioBands {
  /** 0..1 smoothed energy: bass (~90-280 Hz), mids (~280 Hz-2 kHz), highs (~2-8 kHz), overall. */
  bass: number;
  mid: number;
  high: number;
  level: number;
  /** 1 on a detected kick, decaying to 0 (~0.3 s). */
  kick: number;
}

interface Track {
  el: HTMLAudioElement;
  gain: GainNode;
  on: boolean;
}
// Rooftop Party songs (one entry per 16th step; 0 = rest).
const DISCO_BASS = [41, 53, 41, 53, 41, 53, 41, 53, 38, 50, 38, 50, 43, 55, 43, 55];
const DISCO_CHORDS = [[65, 69, 72], [62, 65, 69], [67, 71, 74], [64, 67, 72]];
const AFRO_BASS = [33, 0, 0, 33, 0, 0, 36, 0, 0, 0, 38, 0, 36, 0, 0, 0];
const AFRO_BELL = [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0];
const AFRO_PLUCK = [74, 0, 0, 76, 0, 79, 0, 0, 81, 0, 79, 0, 76, 0, 74, 0];
const HOUSE_BASS = [0, 0, 36, 0, 0, 0, 36, 0, 0, 0, 39, 0, 0, 0, 34, 0];
const HOUSE_STABS = [[60, 63, 67, 70], [58, 62, 65, 69], [56, 60, 63, 67], [58, 62, 65, 68]];
const DJ_BASS = [36, 0, 36, 48, 0, 36, 0, 46, 34, 0, 34, 46, 0, 34, 41, 43];
const DJ_CHORDS = [[60, 64, 67], [58, 62, 65], [57, 60, 64], [55, 59, 62]];
const SURF_PLUCKS = [72, 0, 76, 0, 79, 0, 76, 81, 79, 0, 76, 0, 74, 0, 72, 0];
const SKI_BELLS = [96, 0, 0, 0, 91, 0, 0, 0, 93, 0, 0, 0, 88, 0, 91, 0];
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

class AudioEngine {
  ctx?: AudioContext;
  private master!: GainNode;
  /** Final mix (after the compressor), for recording. */
  private out?: AudioNode;
  private sfx!: GainNode;
  private music!: GainNode;
  private musicLevel = 0;
  private reverb!: ConvolverNode;
  private noise!: AudioBuffer;
  private nextNote = 0;
  private noteIndex = 0;
  private musicOn = false;
  private pad?: { stop(): void; gain: GainNode };
  /** The act playing on the TV: its own bus, placed at the TV. */
  private act: ActName = '';
  private actBus?: GainNode;
  private actPanner?: PannerNode;
  /** Low-pass between the act and the room: the party heard through closed glass. */
  private actFilter?: BiquadFilterNode;
  private actLoop?: LoopHandle;
  private actStart = 0;
  private nextStep = 0;
  private step = 0;
  private hum?: { stop(): void; gain: GainNode };
  private tracks = new Map<string, Track>();
  private videos = new Map<HTMLVideoElement, { panner: PannerNode; gain: GainNode }>();
  /** Decoded voice lines (short clips), by file name; null = missing. */
  private voices = new Map<string, AudioBuffer | null>();
  private voiceLoading = new Set<string>();
  private trackAct: ActName = '';
  private lastOpen = -1;
  private dreamTrack = false;
  private score = '';
  private analyser?: AnalyserNode;
  private freq?: Uint8Array<ArrayBuffer>;
  private bassAvg = 0;
  private kickAt = -10;
  /** Live analysis of the mix, updated by tick(). */
  readonly bands: AudioBands = { bass: 0, mid: 0, high: 0, level: 0, kick: 0 };
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
      this.out = comp;
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
      this.analyser = c.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.55;
      this.freq = new Uint8Array(this.analyser.frequencyBinCount);
      comp.connect(this.analyser);
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => undefined);
      for (const t of this.tracks.values()) if (t.on) void t.el.play().catch(() => undefined);
    }
    return true;
  }

  /** The final mix as a MediaStream (Director-mode recording). */
  recordStream(): MediaStream | undefined {
    if (!this.ctx || !this.out) return undefined;
    const dest = this.ctx.createMediaStreamDestination();
    this.out.connect(dest);
    return dest.stream;
  }

  suspend(): void {
    if (this.ctx?.state === 'running') void this.ctx.suspend().catch(() => undefined);
    for (const t of this.tracks.values()) t.el.pause();
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
    Timeline.log('sfx', name, gain);
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
      case 'thunder':
        // A sharp crack, then a long rolling rumble.
        this.noiseBurst(t, 0.35, 2600, 0.3, out);
        this.rumble(t + 0.05, 4.5, 0.9, out);
        this.duck(0.5, 3);
        break;
      case 'whale':
        // A long, low, gliding whale call.
        this.glide(midi(43), midi(50), t, 2.6, 0.16, out);
        this.glide(midi(55), midi(48), t + 1.8, 2.2, 0.1, out);
        break;
      case 'firework':
        // A low thump, then a crackle.
        this.noiseBurst(t, 0.5, 220, 0.5, out);
        this.noiseBurst(t + 0.12, 1.4, 4200, 0.14, out);
        break;
      case 'shutter':
        // A camera shutter: two quick clicks and a short whir.
        this.noiseBurst(t, 0.05, 5000, 0.35, out);
        this.noiseBurst(t + 0.07, 0.05, 3500, 0.3, out);
        this.noiseBurst(t + 0.12, 0.25, 1800, 0.06, out);
        break;
      case 'pop':
        this.noiseBurst(t, 0.25, 2600, 0.25, out);
        [91, 96, 100].forEach((n, i) => this.tone(midi(n), t + 0.05 + i * 0.04, 0.7, 0.08, out));
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
    if (name === 'snore') {
      // Slow in-out breathing: low rumble swelling on each breath.
      filter.type = 'lowpass';
      filter.frequency.value = 260;
      const lfo = c.createOscillator();
      lfo.frequency.value = 0.22;
      const depth = c.createGain();
      depth.gain.value = 0.9;
      shape.gain.value = 0.2;
      lfo.connect(depth).connect(shape.gain);
      lfo.start();
    } else if (name === 'waves') {
      filter.type = 'lowpass';
      filter.frequency.value = 520;
      const lfo = c.createOscillator();
      lfo.frequency.value = 0.13;
      const depth = c.createGain();
      depth.gain.value = 0.35;
      shape.gain.value = 0.55;
      lfo.connect(depth).connect(shape.gain);
      lfo.start();
    } else if (name === 'rain') {
      // Steady hiss of rain on glass and roofs.
      filter.type = 'highpass';
      filter.frequency.value = 2400;
      shape.gain.value = 0.35;
    } else {
      // Wind: airy band-passed noise whose pitch drifts like gusts.
      filter.type = 'bandpass';
      filter.frequency.value = 900;
      filter.Q.value = 0.8;
      const lfo = c.createOscillator();
      lfo.frequency.value = 0.09;
      const depth = c.createGain();
      depth.gain.value = 500;
      lfo.connect(depth).connect(filter.frequency);
      lfo.start();
      shape.gain.value = 0.4;
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
    if (level !== this.musicLevel) Timeline.log('music', DREAM_TRACK, level);
    this.musicLevel = level;
    this.music.gain.setTargetAtTime(level * 0.9, c.currentTime, 1.5);
    if (level > 0 && !this.musicOn) {
      this.musicOn = true;
      this.nextNote = c.currentTime + 0.2;
      // The recorded dream score; the synthesized music box only if media playback is unavailable.
      this.dreamTrack = typeof Audio !== 'undefined';
      this.setScore(this.score || DREAM_TRACK);
      if (!this.dreamTrack) this.pad ??= this.drone([220, 277.2, 329.6], 0.04, 'triangle', this.music);
    }
  }

  /**
   * The act playing on the TV ('' = none): a DJ groove, surf swells and plucks,
   * or ski wind and bells, all from the TV's position. The music box steps back.
   */
  setAct(act: ActName, at: Vec): void {
    const c = this.ctx;
    if (!c || act === this.act) return;
    Timeline.log('act', act);
    this.act = act;
    this.actLoop?.stop();
    this.actLoop = undefined;
    if (!this.actBus) {
      this.actBus = c.createGain();
      this.actBus.gain.value = 0;
      this.actPanner = this.panner(at);
      this.actFilter = c.createBiquadFilter();
      this.actFilter.type = 'lowpass';
      this.actFilter.frequency.value = 20000;
      this.actBus.connect(this.actFilter).connect(this.actPanner).connect(this.sfx);
    }
    this.place(this.actPanner!, at);
    this.actBus.gain.setTargetAtTime(act ? 0.9 : 0, c.currentTime, act ? 0.6 : 0.8);
    // Recorded songs for the party; a new song starts from its top.
    if (this.trackAct && this.trackAct !== act) this.stopTrack(this.trackAct);
    this.trackAct = TRACK_ACTS.has(act) && this.startTrack(act, this.actBus, 1, 0.3, true) ? act : '';
    if (act === 'surf') this.actLoop = this.loop('waves', at, 0.7);
    if (act === 'ski') this.actLoop = this.loop('wind', at, 0.45);
    if (act) {
      this.actStart = this.nextStep = c.currentTime + 0.1;
      this.step = 0;
    }
  }

  /** How open the way to the act is (0 = behind closed glass, muffled; 1 = open air). */
  setActOpenness(open: number): void {
    const c = this.ctx;
    if (!c || !this.actFilter) return;
    if (Math.abs(open - this.lastOpen) > 0.08) {
      this.lastOpen = open;
      Timeline.log('open', this.act, open);
    }
    this.actFilter.frequency.setTargetAtTime(500 + 19500 * open * open, c.currentTime, 0.25);
  }

  /** 0..1 position within the current act beat (1 = on the beat). For visuals that pulse in time. */
  beatPhase(fallbackTime: number, bpm: number): number {
    const c = this.ctx;
    if (!c || !this.act || c.state !== 'running') return ((fallbackTime * bpm) / 60) % 1;
    // A recorded song: follow its real kicks (0 on a kick, rising to 1 by the next).
    if (this.trackAct) return Math.min(1, (c.currentTime - this.kickAt) / 0.45);
    const beats = ((c.currentTime - this.actStart) * ACT_BPM[this.act]) / 60;
    return ((beats % 1) + 1) % 1;
  }

  /** Lower the music briefly so a key sound reads clearly. */
  duck(amount: number, seconds: number): void {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime;
    // The party song too (a voice line must carry over the decks).
    if (this.act && this.actBus) {
      const a = this.actBus.gain;
      a.cancelScheduledValues(t);
      a.setTargetAtTime(0.9 * (1 - amount * 0.7), t, 0.08);
      a.setTargetAtTime(0.9, t + seconds, 0.8);
    }
    if (!this.musicOn) return;
    const g = this.music.gain;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(this.musicLevel * 0.9 * (1 - amount), t, 0.08);
    g.setTargetAtTime(this.musicLevel * 0.9, t + seconds, 0.8);
  }

  /** Called every frame: schedules music-box notes and act steps slightly ahead. */
  tick(): void {
    const c = this.ctx;
    if (!c || c.state !== 'running') return;
    this.analyse(c);
    this.tickAct(c);
    if (!this.musicOn || this.dreamTrack) return;
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

  /**
   * The scene's score on the music bus (public/audio/music/<name>.mp3, '' = none),
   * crossfading from the last one. Each new score starts from its top.
   */
  setScore(name: string): void {
    if (name === this.score && (this.tracks.get(name)?.on ?? !name)) return;
    if (name !== this.score) Timeline.log('score', name);
    if (this.score && this.score !== name) this.stopTrack(this.score);
    this.score = name;
    if (name && this.ctx && this.musicOn) this.startTrack(name, this.music, 0.8, 1.6, true);
  }

  /**
   * A video's soundtrack, played from a point in the room (the movie screen).
   * The element can only be wired once; later calls just move the sound.
   */
  attachVideo(el: HTMLVideoElement, at: Vec, gain = 1): void {
    const c = this.ctx;
    if (!c) return;
    let w = this.videos.get(el);
    if (!w) {
      const panner = this.panner(at);
      const g = c.createGain();
      g.gain.value = gain;
      c.createMediaElementSource(el).connect(g).connect(panner).connect(this.sfx);
      w = { panner, gain: g };
      this.videos.set(el, w);
    }
    this.place(w.panner, at);
    w.gain.gain.setTargetAtTime(gain, c.currentTime, 0.4);
  }

  /** One streamed track (an <audio> element routed into the graph; low memory on a headset). */
  private startTrack(name: string, bus: AudioNode, level: number, fade: number, fromTop: boolean): boolean {
    const c = this.ctx;
    if (!c || typeof Audio === 'undefined') return false;
    let t = this.tracks.get(name);
    if (!t) {
      try {
        const el = new Audio();
        el.src = `${import.meta.env.BASE_URL}audio/music/${name}.mp3`;
        el.loop = true;
        el.preload = 'auto';
        const gain = c.createGain();
        gain.gain.value = 0;
        c.createMediaElementSource(el).connect(gain).connect(bus);
        t = { el, gain, on: false };
        this.tracks.set(name, t);
      } catch {
        return false;
      }
    }
    if (fromTop && !t.on) t.el.currentTime = 0;
    t.on = true;
    void t.el.play().catch(() => undefined);
    t.gain.gain.setTargetAtTime(level, c.currentTime, fade);
    return true;
  }

  private stopTrack(name: string): void {
    const c = this.ctx;
    const t = this.tracks.get(name);
    if (!c || !t) return;
    t.on = false;
    t.gain.gain.setTargetAtTime(0, c.currentTime, 0.35);
    setTimeout(() => {
      if (!t.on) t.el.pause();
    }, 2000);
  }

  /**
   * A voice line (public/audio/voice/<name>.mp3) spoken from a point in the room,
   * with the music ducked under it. Returns false if the clip is missing or still
   * loading (it is fetched on first ask, so call `preloadVoice` ahead of time).
   */
  speak(name: string, at: Vec, gain = 1): boolean {
    Timeline.log('voice', name, gain);
    const c = this.ctx;
    const buf = this.voices.get(name);
    if (!c || !buf) {
      this.preloadVoice(name);
      return false;
    }
    const src = c.createBufferSource();
    src.buffer = buf;
    const level = c.createGain();
    level.gain.value = gain * 1.4;
    src.connect(level).connect(this.panner(at)).connect(this.sfx);
    src.start();
    this.duck(0.55, buf.duration + 0.3);
    return true;
  }

  preloadVoice(name: string): void {
    const c = this.ctx;
    if (!c || this.voices.has(name) || this.voiceLoading.has(name)) return;
    this.voiceLoading.add(name);
    fetch(`${import.meta.env.BASE_URL}audio/voice/${name}.mp3`)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((b) => c.decodeAudioData(b))
      .then((buf) => this.voices.set(name, buf))
      .catch(() => this.voices.set(name, null))
      .finally(() => this.voiceLoading.delete(name));
  }

  /** Reads the mix's spectrum into `bands` and spots kicks (bass jumping above its running average). */
  private analyse(c: AudioContext): void {
    const a = this.analyser;
    const f = this.freq;
    if (!a || !f) return;
    a.getByteFrequencyData(f);
    let bass = 0;
    let mid = 0;
    let high = 0;
    for (let i = 1; i <= 2; i++) bass += f[i];
    for (let i = 3; i <= 20; i++) mid += f[i];
    for (let i = 21; i <= 90; i++) high += f[i];
    const b = this.bands;
    b.bass = bass / (2 * 255);
    b.mid = mid / (18 * 255);
    b.high = high / (70 * 255);
    b.level = (b.bass + b.mid + b.high) / 3;
    if (b.bass > this.bassAvg * 1.07 && b.bass > 0.3 && c.currentTime - this.kickAt > 0.28) this.kickAt = c.currentTime;
    this.bassAvg += (b.bass - this.bassAvg) * 0.12;
    b.kick = Math.exp(-(c.currentTime - this.kickAt) * 7);
  }

  private tickAct(c: AudioContext): void {
    if (!this.act || !this.actBus || this.trackAct) return;
    const sixteenth = 60 / ACT_BPM[this.act] / 4;
    const out = this.actBus;
    while (this.nextStep < c.currentTime + 0.25) {
      const t = this.nextStep;
      const s = this.step % 16;
      const bar = Math.floor(this.step / 16);
      if (this.act === 'dj') {
        if (s % 4 === 0) this.kick(t, out);
        if (s % 4 === 2) this.noiseBurst(t, 0.06, 9000, 0.05, out);
        if (s === 4 || s === 12) this.noiseBurst(t, 0.18, 2200, 0.09, out);
        const b = DJ_BASS[s];
        if (b) this.synth(midi(b), t, sixteenth * 1.6, 0.16, 'sawtooth', 700, out);
        if (s === 0 || s === 10) {
          for (const n of DJ_CHORDS[bar % 4]) this.synth(midi(n), t, sixteenth * 2.5, 0.05, 'square', 1800, out);
        }
      } else if (this.act === 'disco') {
        if (s % 4 === 0) this.kick(t, out);
        if (s % 4 === 2) this.noiseBurst(t, 0.14, 8000, 0.07, out);
        if (s === 4 || s === 12) this.noiseBurst(t, 0.16, 2400, 0.08, out);
        if (s % 2 === 0) this.synth(midi(DISCO_BASS[s]), t, sixteenth * 1.8, 0.15, 'sawtooth', 900, out);
        if (s === 4 || s === 12) for (const n of DISCO_CHORDS[bar % 4]) this.synth(midi(n), t, sixteenth * 3, 0.045, 'sawtooth', 2600, out);
      } else if (this.act === 'afro') {
        if (s === 0 || s === 6 || s === 8 || s === 14) this.kick(t, out);
        this.noiseBurst(t, 0.05, 9000, s % 2 ? 0.025 : 0.04, out);
        if (AFRO_BELL[s]) this.tone(midi(s % 4 === 0 ? 88 : 84), t, 0.18, 0.05, out);
        const b = AFRO_BASS[s];
        if (b) this.synth(midi(b), t, sixteenth * 3, 0.2, 'sine', 500, out);
        const p = AFRO_PLUCK[s];
        if (p && bar % 2 === 1) this.tone(midi(p), t, 0.5, 0.06, out);
      } else if (this.act === 'house') {
        if (s % 4 === 0) this.kick(t, out);
        if (s % 4 === 2) this.noiseBurst(t, 0.06, 9500, 0.05, out);
        if (s === 4 || s === 12) this.noiseBurst(t, 0.2, 1800, 0.1, out);
        const b = HOUSE_BASS[s];
        if (b) this.synth(midi(b), t, sixteenth * 1.6, 0.18, 'sawtooth', 600, out);
        if (s === 3 || s === 10) for (const n of HOUSE_STABS[bar % 4]) this.tone(midi(n), t, 0.35, 0.04, out);
      } else if (this.act === 'surf') {
        const n = SURF_PLUCKS[s];
        if (n) this.tone(midi(n), t, 0.9, 0.07, out);
        if (s === 0 && bar % 2 === 0) this.noiseBurst(t, 2.4, 600, 0.14, out);
      } else {
        if (s % 2 === 0) this.noiseBurst(t, 0.07, 7000, s % 4 === 0 ? 0.05 : 0.03, out);
        const n = SKI_BELLS[s];
        if (n) this.tone(midi(n), t, 0.5, 0.05, out);
        if (s === 0 && bar % 2 === 1) this.noiseBurst(t, 0.8, 2600, 0.12, out);
      }
      this.step++;
      this.nextStep += sixteenth;
    }
  }

  /** Four-on-the-floor kick: a sine dropping in pitch. */
  private kick(t: number, out: AudioNode): void {
    const c = this.ctx!;
    const o = c.createOscillator();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    const g = c.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.32);
  }

  /** A short filtered synth note (bass, stabs). */
  private synth(freq: number, t: number, dur: number, gain: number, type: OscillatorType, cutoff: number, out: AudioNode): void {
    const c = this.ctx!;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(cutoff, t);
    f.frequency.exponentialRampToValueAtTime(cutoff * 0.3, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
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

  /** Low rolling noise (thunder, surf thumps): looped noise through a low-pass, swelling and dying away. */
  private rumble(t: number, dur: number, gain: number, out: AudioNode): void {
    const c = this.ctx!;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(260, t);
    f.frequency.exponentialRampToValueAtTime(70, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.15);
    g.gain.setTargetAtTime(gain * 0.5, t + 0.4, 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(out);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  /** A sine that glides from one pitch to another (the whale's song). */
  private glide(from: number, to: number, t: number, dur: number, gain: number, out: AudioNode): void {
    const c = this.ctx!;
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(to, t + dur * 0.8);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
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
