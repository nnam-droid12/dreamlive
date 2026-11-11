# Apply after the final render finishes (these files are loaded by the running app).
def edit(p, pairs):
    s = open(p, encoding='utf8').read()
    for a, b in pairs:
        assert s.count(a) == 1, (p, a[:80], s.count(a))
        s = s.replace(a, b, 1)
    open(p, 'w', encoding='utf8').write(s)

# 1. Audio engine: the party's volume and band split (beat+bass always; chords/voices; hats/shimmer).
edit('src/audio/engine.ts', [
    ("      this.actBus.connect(this.actFilter).connect(this.actPanner).connect(this.sfx);\n    }",
     "      this.actBus.connect(this.actFilter).connect(this.actPanner).connect(this.sfx);\n"
     "      // The party console's Band: the song split three ways (beat and bass / chords and voices / hats and shimmer).\n"
     "      this.bandIn = c.createGain();\n"
     "      const low = c.createBiquadFilter();\n      low.type = 'lowpass';\n      low.frequency.value = 220;\n"
     "      const midHp = c.createBiquadFilter();\n      midHp.type = 'highpass';\n      midHp.frequency.value = 220;\n"
     "      const midLp = c.createBiquadFilter();\n      midLp.type = 'lowpass';\n      midLp.frequency.value = 3200;\n"
     "      const high = c.createBiquadFilter();\n      high.type = 'highpass';\n      high.frequency.value = 3200;\n"
     "      this.bandMid = c.createGain();\n      this.bandHigh = c.createGain();\n"
     "      this.bandIn.connect(low).connect(this.actBus);\n"
     "      this.bandIn.connect(midHp).connect(midLp).connect(this.bandMid).connect(this.actBus);\n"
     "      this.bandIn.connect(high).connect(this.bandHigh).connect(this.actBus);\n    }"),
    ("    this.actBus.gain.setTargetAtTime(act ? 0.9 : 0, c.currentTime, act ? 0.6 : 0.8);",
     "    this.actBus.gain.setTargetAtTime(act ? 0.9 * this.partyVol : 0, c.currentTime, act ? 0.6 : 0.8);"),
    ("    this.trackAct = TRACK_ACTS.has(act) && this.startTrack(act, this.actBus, 1, 0.3, true) ? act : '';",
     "    this.trackAct = TRACK_ACTS.has(act) && this.startTrack(act, this.bandIn ?? this.actBus, 1, 0.3, true) ? act : '';"),
    ("      a.setTargetAtTime(0.9 * (1 - amount * 0.7), t, 0.08);\n      a.setTargetAtTime(0.9, t + seconds, 0.8);",
     "      a.setTargetAtTime(0.9 * this.partyVol * (1 - amount * 0.7), t, 0.08);\n      a.setTargetAtTime(0.9 * this.partyVol, t + seconds, 0.8);"),
    ("  private actBus?: GainNode;\n",
     "  private actBus?: GainNode;\n  private bandIn?: GainNode;\n  private bandMid?: GainNode;\n  private bandHigh?: GainNode;\n  private partyVol = 1;\n  private partyBand = 1;\n"),
    ("  /**\n   * Bigfoot's music-box lullaby",
     "  /** The party console: the song's volume (0..1, 0.85 = as mixed) and how much of the band plays (0..1). Logged for the film's mix. */\n"
     "  setPartyMix(volume: number, band: number): void {\n"
     "    const v = volume / 0.85;\n"
     "    if (Math.abs(v - this.partyVol) > 0.02) {\n      this.partyVol = v;\n      Timeline.log('volume', '', volume);\n"
     "      if (this.ctx && this.act && this.actBus) this.actBus.gain.setTargetAtTime(0.9 * v, this.ctx.currentTime, 0.08);\n    }\n"
     "    if (Math.abs(band - this.partyBand) > 0.02) {\n      this.partyBand = band;\n      Timeline.log('band', '', band);\n"
     "      const t = this.ctx?.currentTime ?? 0;\n"
     "      this.bandMid?.gain.setTargetAtTime(Math.min(1, Math.max(0, band * 2)), t, 0.06);\n"
     "      this.bandHigh?.gain.setTargetAtTime(Math.min(1, Math.max(0, band * 2 - 1)), t, 0.06);\n    }\n  }\n\n"
     "  /**\n   * Bigfoot's music-box lullaby"),
])
edit('src/audio/timeline.ts', [("| 'movie' | 'lullaby';", "| 'movie' | 'lullaby' | 'volume' | 'band';")])

# 2. Lights follow the console.
edit('src/systems/room-party-light-system.ts', [
    ("      b.mat.opacity = this.energy * (cfg.beamOpacity + cfg.beamFlash * flash);",
     "      b.mat.opacity = this.energy * PartyMix.lights * (cfg.beamOpacity + cfg.beamFlash * flash);"),
    ("      s.intensity = this.energy * (cfg.spotIntensity + cfg.spotFlash * flash);",
     "      s.intensity = this.energy * PartyMix.lights * (cfg.spotIntensity + cfg.spotFlash * flash);"),
])
edit('src/showcase/rooftop.ts', [("      light.intensity = (14 + 16 * hit) * energy;", "      light.intensity = (14 + 16 * hit) * energy * PartyMix.lights;")])
edit('src/systems/rooftop-party-system.ts', [("    eq.amount.value += ((on ? cfg.visualizer : 0) - eq.amount.value) * Math.min(1, realDelta * 0.8);",
                                            "    eq.amount.value += ((on ? cfg.visualizer * PartyMix.lights : 0) - eq.amount.value) * Math.min(1, realDelta * 0.8);")])
for f in ['src/systems/room-party-light-system.ts', 'src/showcase/rooftop.ts', 'src/systems/rooftop-party-system.ts']:
    s = open(f, encoding='utf8').read()
    rel = "'../systems/lib/party-mix.js'" if f.startswith('src/showcase') else "'./lib/party-mix.js'"
    i = s.index('\nimport ') + 1
    s = s[:i] + f"import {{ PartyMix }} from {rel};\n" + s[i:]
    open(f, 'w', encoding='utf8').write(s)

# 3. Register the party console.
edit('src/index.ts', [("import { SeaConsoleSystem } from './systems/sea-console-system.js';",
                       "import { SeaConsoleSystem } from './systems/sea-console-system.js';\nimport { PartyConsoleSystem } from './systems/party-console-system.js';"),
                      ("    .registerSystem(SeaConsoleSystem)", "    .registerSystem(SeaConsoleSystem)\n    .registerSystem(PartyConsoleSystem)")])

# 4. The LIVE rooftop cam screen: up high, over the party (not where the guests dance), tilted to face you.
edit('src/config/tuning.ts', [("    width: 1.6,\n    x: -0.95,\n    y: 1.78,\n    z: -2.6,", "    width: 1.6,\n    x: -0.7,\n    y: 2.55,\n    z: -2.7,")])
edit('src/systems/cinema-system.ts', [("    this.screen.rotation.set(0, Math.atan2(this.head.x - this.screen.position.x, this.head.z - this.screen.position.z), 0);",
                                      "    // Facing you, tilted down from up high.\n    this.screen.lookAt(this.head);")])

# 5. The film: the left hand works the party console (strip to the beat, dim, then the drop).
edit('src/systems/director-system.ts', [
    ("import { SeaConsoleSpots } from './sea-console-system.js';",
     "import { SeaConsoleSpots } from './sea-console-system.js';\nimport { PartyConsoleSpots } from './party-console-system.js';\nimport { PartyCue } from './lib/party-mix.js';"),
    ("    if (scene === 'draw-window' && t > 1.5 && t < 8.5) {",
     "    // The party console (seconds into a party scene): the band stripped to the beat, the lights down, then the drop.\n"
     "    PartyCue.show = scene.startsWith('party-') && scene !== 'party-wait' && t > 2 && t < 11.5;\n"
     "    PartyCue.drive = -1;\n"
     "    if (PartyCue.show) {\n"
     "      for (const [i, from, to, a, b] of PARTY_DIALS) {\n"
     "        if (t < a || t > b + 0.4) continue;\n"
     "        const e = Math.min(1, (t - a) / (b - a));\n"
     "        PartyCue.drive = i;\n"
     "        PartyCue.value = from + (to - from) * e * e * (3 - 2 * e);\n"
     "      }\n"
     "    }\n"
     "    if (scene === 'draw-window' && t > 1.5 && t < 8.5) {"),
    ("const SEA_DIALS:", "const PARTY_DIALS: [number, number, number, number, number][] = [\n  [2, 1, 0.25, 3, 4.8],\n  [1, 0.85, 0.3, 5.2, 6.6],\n  [2, 0.25, 1, 7.2, 8.6],\n  [1, 0.3, 1, 9, 10.4],\n];\nconst SEA_DIALS:"),
    ("    } else if (scene === 'gifts') {",
     "    } else if (PartyCue.show && PartyConsoleSpots.ready) {\n"
     "      // The left fingertip on the party console's knob it drags (or the next one).\n"
     "      this.player.head.updateMatrixWorld(true);\n"
     "      const k = PartyCue.drive >= 0 ? PartyCue.drive : t < 5 ? 2 : t < 7 ? 1 : t < 9 ? 2 : 1;\n"
     "      const p = this.player.head.worldToLocal(H_TMP.aim.copy(PartyConsoleSpots.knob[k]));\n"
     "      left = { at: H_TMP.l.copy(p).add(H_TMP.off.set(0.02, -0.05, 0.11)), rot: Q_ID, pose: 'point', pinch: 0 };\n"
     "    } else if (scene === 'gifts') {"),
])
print('applied')
