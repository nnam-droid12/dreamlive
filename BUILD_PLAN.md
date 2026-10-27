# DREAMLIVE — Master Build Plan

> Work **one phase at a time**. At the end of every phase, stop, summarize what was built, list what was tested and how, and wait for the owner's go-ahead before starting the next phase.

---

## 0. Who you are and what we're building

You are the lead engineer, technical artist, and QA tester for **Dreamlive**, a mixed-reality entertainment experience for Meta VR devices (Meta Quest 3 / 3S and the new Meta VR Glasses), built with the **Immersive Web SDK (IWSDK)** on WebXR.

It is the owner's entry to the **Meta VR Start Developer Competition 2026**, **Entertainment track, New Experience division**, targeting **Best New Entertainment Experience**. The project must be conceived and built inside the competition window (from Sept 24, 2026). Do not import or reuse any pre-existing game code.

**Hard deadline:** submission closes **Nov 18, 2026, 12:00 PM PST**. Internal code freeze is **Nov 15**, and submission happens on **Nov 16**. After the deadline the deployed build cannot change, so the build we deploy must be the build we're proud of.

### The one-sentence pitch
*"Every night, a new dream performs live on your table."*
A tiny original creature, **the Dreamer**, falls asleep on the user's real table. Its dream grows out of the real surface and spills across the real room for about 6–8 minutes. **Whatever the user looks at blooms and becomes the next part of the dream.** The user can watch passively (lean-back), or gently interact with their hands. At the end, the dream folds back into the table and the user keeps a glowing memory orb that lives on their real wall.

### Tagline (140 chars max)
"A tiny dreamer falls asleep on your real table. Its dream grows across your room, and wherever you look, the dream follows."

---

## 1. Competition rules you must design around (non-negotiable)

Treat each of these as an acceptance test. If a feature violates one, cut or redesign the feature.

1. **Hands-first, end to end.** Every step, from launch to the end of a dream, must be completable with bare hands. No controller required, ever. Controllers can be supported but must never be needed.
2. **Seated, two-foot radius ("airplane seat test").** The user sits. Nothing requires standing, walking, turning around, or reaching beyond arm's length. All important content lives in the forward hemisphere.
3. **Quick in, quick out ("one bus stop test").** Cold start to first magic moment within ~45 seconds. Clean pause/resume (headset removed → pause; put back on → resume). A complete, satisfying session in ≤10 minutes.
4. **Passthrough must be purposeful.** The experience must be meaningfully different (and worse) with passthrough off. The real table and walls are the stage.
5. **FoV-aware design.** Meta VR Glasses have roughly a **70° × 66°** field of view (Quest 3 is ~110° × 96°). All essential UI, captions, story beats and interactable objects must sit within a central ~60° cone. Never put anything important at the edges.
6. **Works in rooms we never tested.** Surface detection must have a robust fallback (palm calibration). Missing walls, cluttered tables, dim rooms and small spaces must not break the experience.
7. **Performance:** must hold **at least 60 fps on Quest 3S** (target 72 fps). Stable, no crashes, no console errors in the shipped build.
8. **Original, not a wrapper.** No third-party content platforms, no LLM chat wrapper. The core experience is ours.
9. **Content rules:**
   - all art, music, and sound is original or properly licensed (track licenses in `CREDITS.md`);
   - no real or identifiable people, no brands, logos or branded products;
   - nothing scary, violent or adult; target rating **Everyone/10+**;
   - **no themes involving death, dead or deceased people, ghosts, or grief.** The emotional palette is wonder, curiosity, longing, comfort and homecoming;
   - all text in English.
10. **Submission must be a hosted HTTPS link** (GitHub Pages; Vercel as backup) that stays live through judging (until ~Dec 11, 2026).

---

## 2. How you should work (process rules)

- **Use the IWSDK skills that come with the scaffold.** Before writing code for any IWSDK feature (planes, hit-test, hands, gaze, anchors, UI panels, audio, camera), check the bundled skills/docs in the project first. **Do not guess APIs.** If unsure an API exists, say so and look it up rather than inventing it.
- **Use the ECS architecture properly.** State lives in components. Behavior lives in systems. Systems act on queries. Keep systems small and focused so state can be inspected while testing.
- **Test before you call anything done.** After every feature:
  1. run it in the Immersive Web Emulator (IWER) with hand input;
  2. take screenshots and inspect component state;
  3. try at least two emulated environments (living room and office);
  4. try the "Gaze + Hands" input mode (VR Glasses simulation);
  5. report results honestly, including what couldn't be tested.
- **Say when something needs a real headset test.** The owner has a Quest for testing. When a feature's quality can only be judged in a headset (passthrough blending, shadow realism, hand-tracking feel, audio spatialization), say so explicitly and give a short checklist of what to look for.
- **Independent judge loop.** At the end of Phases 3, 5 and 7, spin up an **independent sub-agent acting as a competition judge**. Give it the judging rubric in Section 11. Have it score the current build on each criterion (1–10) with specific critiques. Then fix the top three issues before moving on.
- **Commit often**, with clear messages, on the GitHub repo `dreamlive`. Tag milestones (`v0.1-phase1`, etc.).
- **Keep a `CHANGELOG.md`** with dated entries. It's used in the write-up.
- **Never silently cut scope.** If something is too risky or slow, propose the cut and the fallback, and let the owner decide.

---

## 2b. Direction change — 2026-10-24 (supersedes the tabletop "Paper Sea" content in Section 3)

Decided by the owner after the first judge review and a look at the 2025 winners (Best Entertainment went to a "stunning" room-transforming MR experience):

- **Hero character: a lovable, realistic-cartoon Bigfoot** (original design, generated by the owner in Meshy, CC BY 4.0, credited), rigged with idle / walk / jump / sleep / dance / wave / stretch animations.
- **Story ("Bigfoot's Big Dream")**: Bigfoot is asleep and snoring on your bed or couch. As he dreams, he sleep-walks: rolls off, walks across your floor and dives into your TV. The TV becomes a portal into his dream, which plays inside it and spills out into your room. **Wherever you look, his dream changes** (gaze chooses the next scene); things fly out of the screen for you to catch with your hands; a flat palm hushes a stormy dream. At the end he climbs back out, flops into bed, and leaves you a memory orb on the wall.
- **Mixed reality on the headset**: uses the user's real room. Bigfoot sleeps on a detected bed/couch (Quest scene labels; fallback: a cozy spot on the floor near the wall); the TV portal sits on the real wall ahead (the user's real TV if Quest labels a screen; otherwise a virtual plasma TV on the wall anchor).
- **Showcase mode (desktop emulator, screenshots, demo video)**: a realistic **New York high-rise bedroom at night** — floor-to-ceiling glass windows with the skyline, a plasma TV on the wall, a bed opposite it. Built from CC0 photo-scanned materials and models plus a licensed skyline photo.
- **Kept from earlier phases**: dream engine (chapters as data, gaze seeds, lean-back), gestures (cup / hush / pinch), spatial audio, captions, waking + memory orb, room understanding, wall anchor, FoV rules, zero-input completion.
- **Dropped**: the tabletop paper sea chapter and Chapter 2 (staircase); the tiny moth-cloud Dreamer is replaced by Bigfoot.
- **Constraints unchanged**: hands-first, seated (Bigfoot comes to the forward hemisphere; the TV is ahead), FoV cone, family-friendly, no brands/logos (generic TV, no real logos in the skyline image), ≥60 fps target on Quest 3S, owner has no headset (emulator-only testing).

## 2c. Direction change — 2026-10-27: the Rooftop Party (main event)

Decided by the owner after seeing the TV-portal build live:

- **Main event:** Bigfoot leaves the bedroom **through the glass**. He slides a floor-to-ceiling panel open, steps onto the ledge and leaps across the street to the **rooftop of the neighbouring high-rise**, where a DJ party is on. He DJs and **throws goodies from the rooftop down to the ground floor**: most parachute down to a cheering street crowd, and a few fly across through the open window for the user to catch by hand. Then he leaps back, climbs in and goes back to bed; the memory orb and shelf stay.
- **Viewer:** stays seated **in the bedroom, watching through the window**; the seated rules are unchanged. Gaze picks the songs (Disco / Afrobeats / House), which change the music, lights and goodies.
- **The TV dream stays as an extra.** Odd nights play the rooftop party (night 1 first), even nights play the TV dream. With "Unlock all (judges)", *Restart dream* alternates between them.
- **Headset (MR):** a dream window opens in the user's real wall and the rooftop party lies beyond it.
- **Physical note:** a seated viewer cannot see a street 45 m below through floor-level glass. Goodies are visible as they parachute below the roof edge and the crowd is heard cheering; the demo video adds a look-down shot from the glass.

## 3. Experience design (the full script)

### 3.1 Session structure (about 8–9 minutes total)

| Time | Beat | What happens |
|---|---|---|
| 0:00–0:20 | **Arrival** | Passthrough fades in. A soft hum plays. A small floating caption, centered and low in view: "Place both hands flat on a table near you." A faint glowing outline of two palms appears on the nearest detected horizontal surface (or floating in front if none is detected yet). |
| 0:20–0:45 | **Tuck-in (calibration)** | The user places both palms on the table. Two rings of starlight grow under the palms, expand, merge into one ring, then fade. The table surface gets a soft, dim "night" tint. The Dreamer walks out from the ring's center, yawns, curls up, and falls asleep. A tiny "zzz" particle rises. **This is the tutorial: no text beyond one caption.** |
| 0:45–1:15 | **Falling asleep** | Room lighting dims (vignette over passthrough). Stars drift above the table. A gentle music-box theme starts. A dream bubble rises from the Dreamer and pops. |
| 1:15–7:00 | **The Dream** | One of the dream chapters (Section 3.4). It plays by itself (lean-back). The user's gaze and optional hand gestures shape it. |
| 7:00–8:00 | **Waking** | Everything folds back into the table like a pop-up book closing. The Dreamer stirs, stretches, and gives the user a glowing **memory orb** of the moment they "kept" (or the moment they looked at longest). |
| 8:00–8:30 | **The Shelf** | The orb floats to a small shelf anchored on the nearest real wall (or beside the table if no wall is detected). Previously collected orbs glow there. Caption: "Tomorrow night, a new dream." The user can raise a hand (palm out, held 1 s) to exit, or pinch an orb to replay that dream. |

### 3.2 The core mechanic: "Attention shapes the dream" (gaze)

This is the main innovation. It must be **obvious within the first 60 seconds**, or judges will miss it.

- Every dream chapter contains **2–3 "Dream Seeds"** at each branching point: glowing objects placed within the central 60° view cone (e.g., a paper boat, a star, a door in the wall).
- **Gaze dwell:** when the user looks at a seed, it immediately reacts (it brightens, a soft chime plays, particles drift toward it). A circular fill indicator grows around it over **1.5 seconds**. When complete, that seed **blooms** and the dream transitions to the branch it leads to.
- **Lean-back default:** if the user looks at nothing for 8 seconds, the dream picks the seed the user looked at most (or a default) and continues. **The dream never stalls and never punishes.**
- **Input modes:**
  - On devices with eye tracking / gaze input (Meta VR Glasses, and emulator "gaze + hands" mode): use true eye gaze.
  - On Quest 3/3S without eye tracking: use **head-gaze** (a ray from the center of view), with a subtle reticle that appears only near seeds.
  - Use IWSDK's input configuration to switch between these; check the bundled docs for the exact setting.
- **Accessibility:** seeds can also be chosen by **pinching while pointing** at them (ray), so gaze is never the only way.

### 3.3 Hand moments (all optional, all forgiving)

| Gesture | Meaning | Where it's used |
|---|---|---|
| Both palms flat on table, held ~2 s | Tuck in / calibrate the stage | Start of every session |
| Cupped hands (palms up, together) | Catch something falling (a star, a raindrop of light) | 1–2 times per chapter |
| One palm held flat, facing down, over the table, ~1 s | "Hush": calms the dream (storm eases, waves settle) | When a chapter gets stormy |
| Pinch on a glowing moment | "Keep" this moment as a memory orb | Anytime; the kept moment becomes the end-of-dream orb |
| Palm facing out (stop sign), held ~1 s | Pause menu / exit | Anytime |

Rules: generous gesture thresholds, visible feedback the instant a gesture starts being recognized (glow on the hand outline), no penalty for failure. Keep the hand mesh/outline visible so the user can see their hands' interaction state.

### 3.4 Dream chapters (content)

Build **two chapters to full polish** for submission. Build the third only if Phases 1–5 finish early.

**Chapter 1: "The Paper Sea"** (the hero chapter; it's in the video)
1. The table surface ripples and turns into a moonlit sea. Waves stay within the table's real boundary; the table edge becomes a soft foam line.
2. The Dreamer, now tiny, sits in a paper boat.
3. **Branch 1 seeds:** a lighthouse light in the distance (on the table far edge), or a big gentle fish rising from the water.
   - Lighthouse → the boat sails toward the light; the light beam sweeps across the real wall.
   - Fish → the fish carries the boat on its back; bioluminescent trails glow on the table.
4. A gentle storm begins (rain falls *upward* from the table edges). The user can **hush** it with a palm, or it passes on its own after 20 s.
5. **Branch 2 seeds:** a star falling (catch it with cupped hands) or a door that appears on the real wall.
6. The ending: the boat reaches a small island of light at the center of the table, and the Dreamer looks up at a sky full of stars projected on the real ceiling (or above the table if no ceiling is detected).

**Chapter 2: "The Staircase to the Moon"**
1. Paper steps unfold from the table edge and climb the nearest real wall.
2. The Dreamer climbs; each step chimes a note of the music-box melody.
3. **Branch seeds:** a floating kite, a cloud shaped like the Dreamer's friend, a tiny moon.
4. Ends with the Dreamer sitting on a crescent moon above the table.

**Chapter 3 (stretch): "The Lighthouse"**
Pays off a gentle mystery (Section 3.5).

### 3.5 Reason to come back
- **One new chapter unlocks per real night** (calendar date change in local time). For judges, add an always-visible **"Judges & demo: unlock all dreams"** option on the shelf/pause panel so they can see everything in one sitting.
- **The Memory Shelf** persists between sessions (localStorage, wrapped in try/catch, plus WebXR anchors if supported). Each orb replays the moment it captured.
- **A soft mystery:** in every chapter, a lighthouse light appears somewhere in the distance. Each night reveals a little more of why the Dreamer keeps dreaming of it (it's where the Dreamer's best friend, a small seabird, lives; Chapter 3 is the reunion). Warm and hopeful only.

### 3.6 Pause, resume, exit
- Headset removed / session visibility lost → pause audio and animation, and freeze dream time.
- Return → a 1-second fade-in, then resume exactly where the user left off.
- Palm-out gesture → pause panel (centered, within the FoV cone): Resume · Restart dream · Unlock all (demo) · Exit.

---

## 4. Art direction and audio

### 4.1 Visual style: "Soft-glow paper dream"
- **Low-poly + paper craft + soft glow.** Simple primitive-based shapes (folded-paper boats, stairs, clouds, a lighthouse) with emissive edges and gentle bloom-like glow. This style looks intentional at low polygon counts.
- **Palette:** deep indigo, moonlight blue, warm amber lantern light, soft pink accents. All colors defined in one `palette.ts` file.
- **The Dreamer:** an original small round creature, part moth and part cloud, with big sleepy eyes and soft fur rendered as a fuzzy rim glow. **Must not resemble any existing character.** Built from primitives first; may be replaced with a custom glTF later.
- **Grounding:** every dream object casts a soft shadow onto the calibrated real table plane. Shadows and contact glow are what make it feel *in my room*.
- **Passthrough blending:** dim the passthrough slightly during the dream (a vignette and subtle darkening) so glowing elements pop, but never fully hide the room. The room is the stage.
- **Assets:** prefer agent-built primitives; then Meta's 3D asset library; then Drawcall Market. Every asset must be licensed for this use. Use glTF with compressed (KTX2) textures. Record every asset source in `CREDITS.md`.

### 4.2 Audio
- Spatialized audio (Web Audio API `PannerNode` with HRTF), anchored to objects on the table/walls: waves come from the table, the lighthouse bell from the far wall.
- A music-box main theme, an ambient pad per chapter, and short chimes for gaze feedback. All original (owner provides or approves tracks), or licensed royalty-free with license recorded. Until then: procedural Web Audio placeholders (approved).
- Audio is the emotional backbone. Mix carefully: no clipping, music ducks under key moments.
- Captions describe important sounds for accessibility ("A bell rings in the distance").

---

## 5. Technical architecture

### 5.1 Stack
- **IWSDK 1.0.1 stable** (owner-approved; RC only with approval), Three.js underneath (import from `@iwsdk/core`), TypeScript, CLI-managed Vite dev server.
- **Template:** mixed reality / passthrough (AR), hands enabled. Gaze + hands support so it works on Meta VR Glasses.
- **Hosting:** GitHub Pages via GitHub Actions (HTTPS) at `https://nnam-droid12.github.io/dreamlive/`. Vercel as backup mirror.

### 5.2 Folder structure (adapted to the IWSDK scaffold)
```
iwsdk.config.json         // project authority: XR features, scene, modules
src/
  index.ts                // World.create + system registration
  components.ts           // defineComponents() manifest
  assets.ts               // defineAssets() manifest (side-effect free)
  config/palette.ts       // colors
  config/tuning.ts        // all timings and thresholds in one place
  components/             // ECS components (data only)
  systems/                // ECS systems (behavior only)
  dreams/
    chapter1_paperSea.ts  // chapter definition as data: beats, seeds, branches
    chapter2_staircase.ts
  scene-assets/           // procedural Object3D prototypes
public/
  ui/                     // UIKitML panels (captions, pause, shelf)
  scenes/                 // scene JSON (composition only)
```

### 5.3 Core components (data)
- `StageSurface`: calibrated table plane (pose, extents, source: auto-detected or palm-calibrated).
- `RoomSlots`: chosen "stage wall," ceiling availability, fallback flags.
- `DreamDirector`: current chapter, current beat, dream clock, paused flag.
- `DreamSeed`: branch id, gaze accumulation, look-time total, bloom state.
- `GazeTarget`: marks something gaze can affect.
- `HandGestureState`: per-hand pose classification and confidence.
- `MemoryMoment`: something pinchable to keep.
- `MemoryOrb`: persisted orb (chapter id, moment id, created date).
- `ShadowCaster` / `GroundContact`: objects that should shadow onto the real table.
- `AudioEmitter`: spatial sound source.

### 5.4 Core systems (behavior)
1. **RoomUnderstandingSystem:** reads detected planes/meshes; picks the stage table (nearest horizontal surface 40–110 cm high, within arm's reach, in front of the user); picks the stage wall (the vertical plane most in front of the seated user); records fallbacks.
2. **PalmCalibrationSystem:** detects both palms flat and low-velocity, close to the same height, for ~2 s. Sets or overrides `StageSurface` to the palms' plane. Drives the two-rings-merge animation. **Always available, even when auto-detection works** (it's also the ritual).
3. **DreamDirectorSystem:** runs the chapter timeline (data-driven beats), handles branching, timeouts, the lean-back default, and pause/resume.
4. **GazeSystem:** computes the gaze ray (eye gaze if available, else head gaze); accumulates dwell on `DreamSeed`s; drives immediate feedback; triggers blooms.
5. **GestureSystem:** classifies cupped / hush / pinch / palm-out from joint data, with hysteresis and confidence thresholds from `tuning.ts`.
6. **SurfaceEffectSystem:** sea ripple shader on the table plane, upward rain, foam edge clipped to the table bounds.
7. **ShadowSystem:** soft shadows from dream objects onto a transparent shadow-receiving material on the stage table plane (and the stage wall where used). Mind shader cost on Quest.
8. **AudioSystem:** spatial emitters, music ducking, chimes.
9. **CaptionSystem:** short centered captions within the FoV cone; never more than one line at a time.
10. **MemorySystem:** keep-moment logic, orb creation, persistence (localStorage with try/catch; WebXR anchors when available), shelf layout on the stage wall.
11. **SessionSystem:** visibility / blur / focus handling for pause and resume; cold-start sequencing.
12. **PerformanceSystem (dev only):** fps overlay, draw-call count; adaptive quality (reduce particles and shadow resolution if fps drops below 66).

### 5.5 Room robustness and fallbacks (must implement)
| Situation | Fallback |
|---|---|
| No table detected | Palm calibration defines the stage. If the user calibrates in mid-air (no surface), allow it and place a soft glowing "dream cloud" platform at palm height. |
| Table too small or cluttered | Scale the dream stage to fit inside the calibrated area (min 40 × 30 cm; below that, the stage extends visually into the air with a cloud edge). |
| No wall in front | Wall beats (stairs, lighthouse beam, shelf) use a virtual floating paper backdrop 1.2 m in front of the user. |
| No ceiling data | The star sky renders as a dome above the table. |
| Dim room | Raise dream glow intensity slightly; never rely on reading passthrough brightness. |
| Hand tracking lost | Pause gesture recognition and show a gentle "show your hands" icon; the dream continues (lean-back). |
| Plane detection unsupported or permission denied | Palm calibration only, with no errors shown to the user. |

### 5.6 Passthrough camera access (stretch only, Phase 6+)
Optional: with user permission, sample the passthrough camera through `getUserMedia` to tint the dream palette with the room's dominant colors. **Only if Phases 1–5 are done and stable.** Must degrade gracefully if permission is denied. Never store or transmit camera frames.

---

## 6. Build phases (follow in order; stop after each)

### Phase 0: Setup
- Scaffold IWSDK mixed-reality template, hands on.
- Git + GitHub repo. `README.md`, `CHANGELOG.md`, `CREDITS.md`, `config/tuning.ts`, `config/palette.ts`.
- Confirm dev server works and the emulator launches.
- GitHub Pages deploy pipeline now (deploy a "hello" scene). Verify the deployed URL opens and enters XR in the emulator.
- **Done when:** a passthrough scene with visible hands runs locally and on the deployed HTTPS URL.

### Phase 1: The tuck-in ritual (first five minutes)
- RoomUnderstandingSystem, PalmCalibrationSystem, the two-rings-merge animation, table night tint.
- The Dreamer (primitive version) walks out, yawns, curls up, and sleeps, with a shadow on the table.
- One caption only. Arrival → tuck-in → falling-asleep beats.
- **Done when:** in two emulator environments, a user with hands only reaches "Dreamer asleep" in under 45 s with no text other than the one caption. Give the in-headset checklist.

### Phase 2: Dream engine and gaze
- DreamDirectorSystem with data-driven beats and branches; GazeSystem with head-gaze and eye-gaze modes; seed feedback, dwell fill, bloom; lean-back timeout default.
- Placeholder visuals first (glowing spheres as seeds).
- **Done when:** a placeholder dream branches correctly by gaze in both "hands" and "gaze + hands" emulator modes, and runs to completion with zero input.

### Phase 3: Chapter 1, "The Paper Sea"
- Sea ripple surface clipped to the table, paper boat, fish, lighthouse, upward rain, hush gesture, cupped-hands star catch, door on the wall, star sky.
- Spatial audio for waves, bell and chimes; music-box theme placeholder.
- Waking sequence and orb creation.
- **Judge loop #1** (Section 11), then fix the top 3 issues.
- **Done when:** Chapter 1 plays start to finish in under 8 minutes, all branches work, and it holds 72 fps in the emulator's performance view. Give the in-headset checklist.

### Phase 4: Memory Shelf, persistence and session handling
- Shelf on the stage wall (with fallback), orb persistence, replay by pinching an orb, nightly unlock logic, "Judges & demo: unlock all" option, pause panel, palm-out gesture, visibility pause/resume.
- **Done when:** closing and reopening the page keeps the orbs; removing the headset (simulated visibility change) pauses and resumes cleanly.

### Phase 5: Chapter 2, "The Staircase to the Moon"
- Steps unfolding up the wall (with fallback backdrop), climbing, chiming steps, kite / cloud / moon branches, crescent moon ending.
- **Judge loop #2**, then fix the top 3 issues.

### Phase 6: Polish
- Art pass: consistent palette, glow, shadows, transitions (pop-up-book fold), particle tuning.
- Audio pass: final tracks, mixing, ducking.
- FoV pass: verify everything essential is inside a 60° cone using the VR Glasses FoV simulation.
- Accessibility pass: captions for important sounds, pinch-to-select alternative to gaze, high-contrast caption option, reduced-motion option.
- Performance pass: draw calls, texture compression, adaptive quality; confirm 60+ fps on Quest 3S in-headset (owner tests and reports).
- Stretch (only if everything above is solid): Chapter 3, or passthrough camera palette tinting.

### Phase 7: Hardening and freeze (finish by Nov 15)
- Robustness test matrix (Section 8). Fix every failure.
- Remove dev overlays and console logs; zero console errors.
- **Judge loop #3.** Fix only safe, high-impact issues. No new features.
- Final deploy; verify the live URL from a fresh browser profile, in the emulator, and on the headset. Tag `v1.0-submission`.
- **Code freeze.**

### Phase 8: Submission materials (Nov 15–16)
See Sections 9 and 10.

---

## 7. Coding standards
- TypeScript strict mode; no `any` unless justified in a comment.
- All tunable numbers in `src/config/tuning.ts`.
- Chapters defined as **data** (beats, seeds, branches, timings), not hard-coded logic.
- No network calls at runtime except loading our own static assets. No analytics, no tracking, no data collection.
- Wrap all storage access in try/catch; the experience must work if storage is unavailable.
- Keep the first-load bundle small (under ~10 MB if possible): lazy-load Chapter 2 assets while Chapter 1 plays.

---

## 8. Robustness test matrix (Phase 7)
1. Living-room environment, auto-detected table.
2. Office environment, desk calibration.
3. No planes available → palm calibration in mid-air.
4. Tiny surface (40 × 30 cm).
5. No wall in front → backdrop fallback.
6. Zero input for an entire session → completes with defaults.
7. Hands disconnected mid-dream → dream continues, icon shows.
8. Rapid repeated gestures → no double-triggers.
9. Pause / resume three times mid-chapter → state intact.
10. "Gaze + Hands" (VR Glasses profile) full run.
11. Controllers only → still usable (pinch via trigger), never required.
12. Fresh browser profile, first launch, permission prompts → clean flow.
13. Reload after collecting orbs → shelf restored.
14. 20-minute soak run → no memory growth, fps stable.

---

## 9. Demo video (under 3 minutes)

Real headset capture as primary footage; emulator footage only as backup or B-roll. No AI-generated video carrying the pitch. Build a dev-only **"Director mode"** flag that plays a chapter with a scripted, smooth sequence for clean recording.

| Time | Shot |
|---|---|
| 0:00–0:10 | Real room. Hands press flat on a real table. Two rings merge. The Dreamer walks out and falls asleep. Title: **DREAMLIVE**. |
| 0:10–0:35 | The table turns into a moonlit sea. Paper boat. The lighthouse beam sweeps across the real wall. |
| 0:35–1:05 | Gaze mechanic: look at the fish, it brightens, fills, blooms, the story changes. "Wherever you look, the dream follows." |
| 1:05–1:30 | Hands: hush the storm with a palm, catch a falling star with cupped hands. |
| 1:30–1:55 | Chapter 2: stairs unfold up the real wall. |
| 1:55–2:20 | Waking, the memory orb, the Memory Shelf on the wall. "A new dream every night." |
| 2:20–2:45 | Montage: different rooms, VR Glasses gaze mode, accessibility options. |
| 2:45–2:55 | End card: tagline, "Built with Immersive Web SDK for Meta Quest and Meta VR Glasses," the play URL. |

Upload to YouTube, **Public**.

---

## 10. Submission form drafts (Phase 8 → `SUBMISSION.md`)
1. **Submission name:** Dreamlive
2. **Tagline (≤140 chars):** finalize from Section 0; count characters.
3. **Track:** Entertainment. **Division:** New Experience.
4. **Description (≤500 words)**: Inspiration · What it does · How we built it · Challenges · What's next. Real facts from `CHANGELOG.md` only. No exaggeration.
5. **Hand interactions section:** each gesture, comfort rationale, failure forgiveness, gaze + hands on Meta VR Glasses. Then a short "future of VR" paragraph for the owner to edit.
6. **Target launch date:** propose (e.g., Q1 2027 PWA on Meta Horizon Store).
7. **Team:** William Nnamani (Developer & Designer).
8. **Judge testing instructions** (also at top of description): play URL; "Best in Meta Quest Browser, seated at a table"; "Place both palms flat on the table to begin"; "Use 'Judges & demo: unlock all dreams' on the shelf to see every chapter"; expected session length.
9. **Screenshots list:** 5–6 key frames.

---

## 11. Judging rubric (for the sub-agent judge loops)
Equally weighted, 25% each:
1. **Innovation & Creativity:** originality, creative ambition, relevance to Entertainment, unique use of Meta device capabilities (spatial depth, hands-first), drives repeat usage.
2. **Experience Design:** intuitive onboarding, clear seated hands-first journey, habit-forming purpose, **purposeful passthrough**, **FoV-aware** layout.
3. **Technical Implementation:** reliability, performance (≥60 fps on Quest), hand tracking, gaze, passthrough, scene understanding / anchoring, holds up in untested rooms.
4. **Polish & Presentation:** UI/UX, art direction, sound design, visual cohesion, quality of video and text.

Special-award angles: **Best First Five Minutes**, **Best Reason to Come Back**, **Boldest Original Concept**, **Best Accessibility Forward Experience**.

---

## 12. Definition of done (submission-ready)
- [ ] Live HTTPS URL works in a fresh browser, in the emulator, and on Quest 3/3S.
- [ ] A full session is completable with hands only, seated, in under 10 minutes.
- [ ] The gaze mechanic is clearly noticeable in the first minute.
- [ ] Two chapters fully polished; all branches work.
- [ ] Memory Shelf persists; nightly unlock works; demo unlock-all works.
- [ ] Every robustness test passes.
- [ ] 60+ fps on Quest 3S (owner's in-headset confirmation).
- [ ] All essential content within the VR Glasses FoV cone.
- [ ] Zero console errors; no dev overlays in production.
- [ ] `CREDITS.md` complete with all asset and music licenses.
- [ ] Video under 3:00, public on YouTube.
- [ ] `SUBMISSION.md` complete; Devpost form submitted by **Nov 16**.
- [ ] Code frozen; the deployed URL stays up through judging.
