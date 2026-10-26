# Changelog

All notable changes to Dreamlive, newest first.

## 2026-10-27 — Phase 6: polish (audio, accessibility, quality, framing, act worlds) and Bigfoot grounding

- **Bigfoot floated: root cause fixed.** The self-grounding nudged his model along the room's vertical. While he lay down, that vertical ran sideways through his body, and the nudges piled up there and stayed when he stood up (measured 1.2 m off). The correction is now one height value, rebuilt every frame.
  - Grounding uses his real skin: about 2,500 skinned vertices are sampled a few times a second to find how far the skin reaches below his bones in the current pose. His back rests on the mattress and his soles on the floor in every pose.
  - He is smaller (1.6 m, was 1.9 m), as the owner asked.
- **Act worlds rebuilt** (`src/dream-tv/surf.ts`, `dj.ts`, `ski.ts`), with new procedural props registered as assets and previewed in material and clay: `surfboard`, `skis`, `dj-booth`.
  - **Surf**: a lofted shortboard (rocker, stringer, fins), sea swells in the vertex shader (no CPU work), a breaking wave with foam, and the skyline above.
  - **DJ**: a rooftop over the city with a DJ booth (spinning turntables, mixer, speaker stacks with woofers), instanced string lights, lasers on the beat, and an instanced crowd bouncing at 120 BPM, with a clear lane so Bigfoot shows.
  - **Ski**: Bigfoot carves on real skis down a snowy tower roof. The run scrolls past him: groomed snow, slalom gates, and lit facades dropping away on both sides.
  - Tighter cameras in all three.
- **Per-act music** from the TV: a 120 BPM DJ groove (kick, hats, bass, stabs), surf swells and plucks, and ski wind with bells. The music box steps back during acts, and the room's DJ light pulses on the kick.
- **Accessibility**: pause-panel toggles for high-contrast captions (opaque black, large yellow text) and reduced motion (no TV parallax or flash, calmer room effects, slower catchables). Both are saved.
- **Adaptive quality** in the headset: below 66 fps for 3 s it steps down (half-resolution TV picture, then half the particles, then frozen shadows), and it steps back up after 20 s of headroom. The pause panel shows the measured fps. The showcase always stays at full quality.
- **Showcase framing**: the viewer's seat moved and turned so the bed and the TV share the 60° view. The TV is now 4 m away. The memory shelf moved to the left of the TV.
- The TV's room light moved off the wall so it no longer leaves a hard disc.
- Production build passes.

## 2026-10-26 — Judge loop #2 and fixes

An independent judge sub-agent scored the build **5.25 / 10**: Innovation 6, Experience 5, Technical 5, Polish 5. Its top issues and what changed:

1. **The mixed-reality path was not purposeful and the fallback was broken.**
   - Room understanding now reads Quest scene labels. Bigfoot sleeps on the user's **real bed or couch**, and the dream plays on the user's **real TV** (`screen` label) at its real size.
   - With no labels, his floor spot is always between the user and the TV.
   - The fallback backdrop moved from 1.2 m to 2.2 m, and the wall search follows the tuning value (5 m).
   - Emulator living room: Bigfoot lay on the detected couch and the TV hung on the real wall (`docs/screens/judge/09`, `10`).
2. **The dream was a flat picture.** The dream now breaks the frame (`DreamSpillSystem`):
   - Surf throws sea spray out of the screen.
   - The rooftop DJ sweeps light beams through the room, drops confetti and pulses the room light at 120 BPM (`docs/screens/judge/08`).
   - The ski run snows all around the viewer.
   - The TV washes the room in the act's color. Memory replays spill too, at lower strength.
3. **Thin return loop.**
   - All three acts are open on night 1.
   - Every later real night is a named **dream night** (`src/dreams/nights.ts`, a 7-night cycle: Sunset, Aurora, Pink Moon, Thunder Party, Golden Morning, Starfall). Each one has its own TV skies and Bigfoot moves, using three more Mixamo clips: house dance, happy bounce and big leap.
   - **Golden memories**: catch the night's goal (3 rising to 6) and the orb is gold. It is taught at the first act, celebrated when reached and saved on the shelf.
   - The shelf shows **"Tomorrow: <next night>"** beside a ghost orb.
   - The arrival caption names tonight.
- **Quick fixes:**
  - The caption wraps or shrinks instead of being cut off.
  - Choice seeds are 0.11 m with name labels ("Surf the city", "Rooftop DJ", "Ski the tower").
  - Palm-out pause needs a raised hand, so waiting to catch never pauses.
  - Leftover paper-sea sound captions were removed.
  - Seed label sprites no longer crash pointer raycasts.
- **Performance:**
  - No per-frame allocations in `face()` or the flyer fades.
  - The TV skips its render when the user looks away.
  - No MSAA on the TV render target.
- Not done yet from the judge's list: persisting placements with WebXR anchors, richer art in the act worlds, per-act music, adaptive quality, and bringing the showcase bed and TV within one 60° view.

## 2026-10-26 — Phase 4: Memory Shelf, nightly unlock, pause

- **Memory Shelf**: a walnut ledge on the wall beside the TV. Each dream's orb lands in the next slot, and the newest 7 are shown. Orbs are saved in localStorage (`src/memory/store.ts`, all access guarded) and come back after the page is closed and reopened. **Pinch an orb** (hand ray, or gaze plus pinch) to replay its act on the TV for 12 s while no dream is playing.
- **Nightly unlock**: night 1 (the first visit's local calendar date) opens surf and DJ, and ski opens on night 2. A locked act appears at the choice as a dim grey light that can't be chosen. Looking at it says "This dream opens tomorrow night." Lean-back skips it.
- **Judges & demo: unlock all dreams**: on the pause panel and on the browser landing panel (retitled Dreamlive). It is saved and can be undone.
- **Pause panel** (`public/ui/pause.uikitml`): hold a palm out, facing away, for 1.2 s. The panel shows the night, the memory count, and Resume, Restart dream, Unlock all and Exit. While it is open, dream time, Bigfoot, flying catches and audio all freeze. Restart puts Bigfoot back to sleep and keeps the shelf.
- Taking the headset off still freezes the dream. Putting it back on now adds a 1 s fade-in, and so does closing the pause panel.
- Panel buttons fire on press-then-release on the same button, not on `click`, because the pointer library drops a click when a pinch is held too long.
- Emulator results (Quest 3 profile, NYC showcase):
  - Palm-out paused the dream with beat time frozen.
  - Controller presses on Resume, Unlock all and Restart each changed the expected state.
  - A full dream shelved its orb in slot 0, and the orb was still there after a reload.
  - Pinching it set the replay and the TV played the surf act.
  - Production build passes.
  - Later run: at the first choice on night 1, the ski seed spawned locked while surf and DJ were open (`docs/screens/judge/04-choice-locked.png`).
- Not yet proven in the emulator: the headset-off fade-in, because the emulator tooling can't change visibility.

## 2026-10-26 — Bigfoot slimmed for Quest

- Bigfoot cut from 151k to 30k triangles (2.1 MB) in Blender with `scripts/assets/blender-slim.py`: voxel remesh, decimate, skin-weight transfer and a re-baked color texture. All 11 animations kept.
- Fixed his lying pose: the 'rest' pose now restores each bone's authored local transform. Three.js `Skeleton.pose()` lost the parents' scale on the new export and launched him 22 m into the air.
- Fixed the "map is undefined" console warning on the velvet bed material.
- Emulator results (Quest 3 profile, NYC showcase), all with a clean console:
  - Bigfoot lies face up on the king bed.
  - He sleep-walks to the TV with his feet on the floor.
  - The DJ act plays inside the TV.
  - Full zero-input run at 4x speed: lean-back picked DJ, then surf. A hand in reach caught 2 flying items. Bigfoot climbed back to bed and woke up standing by it, and the memory orb settled on the TV wall.

## 2026-10-24 — Direction change: Bigfoot and the dream TV

- See BUILD_PLAN.md §2b. Bigfoot sleeps on the bed, sleep-walks into a 100-inch TV and dreams inside it. Gaze picks surf, DJ or ski twice, and things fly out of the screen to catch. Then he climbs back to bed and leaves a memory orb.
- Added the NYC high-rise bedroom showcase for video and desktop: CC0 scanned materials, an Unsplash skyline and night lighting. On the headset the dream plays in the user's real room (passthrough).
- Retired the paper-sea chapter and the Dreamer.

## 2026-10-23 — Phase 2: Dream engine and gaze

- **Chapters as data** (`src/dreams/`): linear beats and choice beats with 2–3 seeds, each leading to a branch. Chapter 1's branching structure (lighthouse or fish, storm, star or door, island) is in place with placeholder scenes.
- **AttentionSystem**: one gaze ray per frame. It uses true eye gaze when the runtime exposes a `gaze` input source (Meta VR Glasses), otherwise head gaze from the center of view (Quest 3/3S). It picks the single seed closest in angle (7° cone plus the seed's size). In head-gaze mode a subtle reticle appears only near seeds.
- **DreamSeedSystem**: looking at a seed makes it react instantly (brighter, larger, halo up), and a dwell ring sweeps closed over 1.5 s; looking away drains it slowly. A pinch while pointing, or gaze plus pinch on Glasses, blooms it at once (accessibility). Idle seeds show a faint ring so they read as "look here", distinct from the ambient stars.
- **DreamDirectorSystem**: the lean-back default picks the most-looked-at seed (else the default) after 8 s of looking at nothing, with a 25 s cap per choice. Dream time freezes while the headset is off.
- Optional `gazeTracking` feature enabled; IWSDK gaze diagnostics logging turned off.
- Emulator results: zero input ran the whole chapter to completion (46 s of placeholder dream time). Head gaze (Quest 3 profile) chose the non-default door. Eye gaze (Glasses profile, head pointed elsewhere) chose the non-default fish. Gaze plus pinch chose the lighthouse before the dwell could finish.

## 2026-10-23 — Phase 1: The tuck-in ritual

- Removed the scaffold starter content (robot, plant, banner, CDN-hosted models); no runtime network calls remain.
- **The Dreamer**: an original moth-and-cloud creature built from code primitives (~5.7k triangles), with named parts for animation and a soft rim glow.
- **RoomUnderstandingSystem** picks the stage table (nearest 40–110 cm surface within seated reach), the wall in front, and the ceiling from detected planes.
- **GestureSystem** reads hand joints directly from WebXR (allocation-free `fillPoses`) and classifies flat, still palms.
- **PalmCalibrationSystem**: both palms flat, still and level for 2 s set the stage; it snaps to a detected table, falls back to a cloud platform in mid-air, and auto-places the stage after 25 s with no attempt, so the dream never stalls. Palms must be 20 cm below eye level, so raised hands never trigger it.
- **Ritual**: one caption, glowing palm guides, starlight rings that grow under each palm and merge, a night tint on the real table, and a moonlight shadow on the table. The Dreamer walks out, yawns, curls up and sleeps. The room then dims behind a vignette while stars drift above the table.
- Glow effects now add light without writing alpha, so they no longer darken the passthrough room.
- Emulator results: palms to "Dreamer asleep" in 17.6 s (living room, Quest 3 profile) and 16.6 s (small office, Meta VR Glasses profile, hands and gaze). The zero-input auto tuck-in also worked. No console errors.
- Repo made private during development; the Pages deploy is manual-only until it goes public.

## 2026-10-22 — Phase 0: Setup

- Scaffolded with `@iwsdk/create` 1.0.1: mixed-reality (AR/passthrough) TypeScript template with hand tracking, plane and mesh detection, anchors and hit-test enabled.
- Added `BUILD_PLAN.md` (spec and phase plan), `src/config/tuning.ts` and `src/config/palette.ts`.
- Added the GitHub Actions workflow that deploys to GitHub Pages on every push to `main`.
- The deployed "hello" build is still the IWSDK starter scene; it is replaced in Phase 1.
