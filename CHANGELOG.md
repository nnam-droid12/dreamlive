# Changelog

All notable changes to Dreamlive, newest first.

## 2026-11-06 — Realistic modern skyscrapers; trailer hands; small gifts

- **The city towers are now built like real modern skyscrapers** instead of textured boxes:
  - a reflective glass curtain wall per tier, mirroring the real sky photo, with lit offices behind it at night;
  - concrete floor-slab edges every 3.6 m storey, corner columns and parapets;
  - aluminium (or bronze) mullion fins every 1.6 m on every face;
  - a recessed double-height glass lobby with a canopy;
  - two setbacks on tall towers, and a louvred mechanical crown with a mast and a red beacon.
- Styles: blue glass, black glass with bronze fins, and limestone with punched windows (real facade photo).
- The party tower is now a glass office tower with a flat roof. Each tower is about four draw calls (instanced concrete and fins). The skyline music visualizer plays on the new glass.
- **The trailer shows hands.** The emulator's tracked-hand model doesn't appear in captures, so Director mode draws frosted-glass hands (articulated palm, thumb and fingers) at the same poses it gives the emulated hands. Those still really draw the window, pinch and catch. The hands point and draw, dance at the party, turn palm-up for the menu, and cup to catch gifts.
- **Small gifts only.** The Yeti's gifts to Bigfoot are now about 17 cm (they were 31 cm), and the heap spacing matches.
- **No gifts in the room before the party.** The floor starts clear each night; the heap grows only as Bigfoot catches tonight's gifts.

## 2026-11-06 — Real people at the party

- **The toy capsules are replaced by 14 real animated party guests.** They are Quaternius Universal Base Characters (CC0), male and female, simplified from 14k to about 4.5k triangles, and they dance with the Universal Animation Library's moves (CC0): mostly Dance_Loop, plus jumping, hands-up and chatting.
  - Each guest has their own move, tempo and phase, faces the decks, and dances harder with the party's energy and the music's kick.
- The base bodies come without clothes, so **outfits are painted on in the shader** from the rest pose: sneakers; trousers or a dress; a short-sleeved shirt with a little fabric shading. Each guest has their own colours and skin tone.
- The stand-in figures stay until the guests load, then step aside. The street crowd far below stays simple.
- Emulator check: guests in shirts and jeans dancing around Bigfoot on the lit floor; the live cam shows them too.

## 2026-11-06 — Every scene has its own music and visualizer; white doves

- **A score for every scene**, crossfading as the story moves (all CC BY 4.0 from Free Music Archive, credited in CREDITS.md and in the end credits):
  - the opening: "Bloom";
  - the bedroom (drawing the window, the walk to it): "Every Day Is A Good Day";
  - the leaps: "Open Skies With Bright Percussive Lift";
  - the party: its three songs, now only at the party;
  - gifts at night: "Happy Pop Instrumental";
  - goodnight, waking and credits: "Beautiful Piano With Expressive Dynamics";
  - bedtime: "Jazz Ballad Rainy Night".
- **A music visualizer for every scene**, driven live by the analyser (bass, mids, highs, kick). It is one cloud of soft motes around you, animated entirely in the vertex shader:
  - the bedroom: golden dream dust;
  - the leaps: light streaming upward;
  - the party: the skyline equalizer;
  - the gifts: colourful sparkles that jump on the kick;
  - the ending: a slow pink-gold swirl;
  - bedtime: cool fireflies.
- **White doves.** A new procedural dove model (lathed body, fanned tail, scalloped feathered wings, orange beak) is instanced in the flock. The doves flap and glide in a loose V at golden hour and sunrise.
- The trailer mixer crossfades between the scene scores from the timeline.

## 2026-11-06 — Real skies, real buildings, smaller gifts (owner feedback)

- **Real photographed skies** (CC0 Poly Haven panoramas) replace the painted sky shader: golden hour with real clouds, a moonlit starry night, and sunrise. They blend by time of day and are turned so the photo's sun matches the scene's sunlight. A light star twinkle is added at night.
- **Realistic skyscrapers:**
  - Every tower now wears a real photo-based facade (CC0 ambientCG) with normal maps for window depth, at believable window sizes (UVs in metres).
  - The party tower is an office block whose real lit-window maps show interiors at night. Bigfoot's tower is brick apartments. Around them are stone, brick and glass towers; the glass curtain walls reflect the real sky.
  - Windows glow brighter as night falls. Roofs have parapets and plant boxes.
  - The skyline music visualizer works across all the new materials.
- **Smaller gifts for the viewer.** Gifts the Yeti throws to you are less than half the size and land at hand height, off to one side, so they never cover the view. They can still be caught by touch.

## 2026-11-06 — The trailer (offline render)

- **Director mode can render offline** (`VITE_DIRECTOR=director&offline&w=1280&h=720` in `.env.development.local`, or URL flags):
  - Every frame advances the story by exactly 1/30 s, however slowly the laptop draws it.
  - Each finished frame is read from the XR framebuffer and saved by a dev-only endpoint as `artifacts/frames/frame-NNNNN.jpg`.
  - Every sound event is logged to a timeline.
  - `scripts/trailer/mix.py` assembles the frames at 30 fps and mixes the soundtrack from that timeline: songs, Bigfoot's voice with the music ducked under it, ambience, fireworks, chimes and bedtime rain. Result: smooth and in sync even on a 2-core laptop at about 1 fps.
- **The trailer's script**, on top of the real dream:
  - A lower-right caption names each feature as it happens: draw a window, he tells his dream, one giant leap, your room becomes a penthouse, your gaze picks the song, spatial cinema, the skyline visualizer, fireworks from your palm, real music in spatial audio, catching gifts, golden hour to sunrise, the memory, the credits, bedtime.
  - New shots: the leap seen from the party roof; the leap home seen from his room; a wide skyline; the fireworks sky; rain at the glass.
  - The title and end cards are in the film style. The trailer always films the Rooftop Party.
- First render: 2:11, 1036×623 upscaled to 720p, H.264/AAC (`artifacts/dreamlive-trailer.mp4`; contact sheet at `docs/screens/trailer-contact-sheet.jpg`). Soundtrack about −18 dB average.

## 2026-11-06 — Spatial cinema: the dream cinema screen

- **A floating "LIVE · Rooftop cam" screen** shows a director's cut of Bigfoot's night while you watch the real thing:
  - At the party it cuts every 4.5 s between a close-up of Bigfoot dancing, the Yeti at the decks, a crane shot over the crowd, and a low hero angle.
  - During the leaps it tracks him from the side.
  - For the gifts it alternates a shot from beside his bed with one looking in through his window.
- A second camera renders the scene into a 640×360 texture every third frame (XR rendering paused for that pass; shadows reused). Captions, cards, fades and the vignette are hidden from the shot. Lower adaptive quality refreshes it less often.
- The screen floats front-left of the viewer, anchored to the player rig, so the view tour carries it along. On a headset it floats in your real room. It fades in for the leap, the party, the leap home and the gifts.
- Emulator check: from the VIP deck, the screen shows Bigfoot dancing in the crowd, then the Yeti at the decks under the lasers. Clean console.

## 2026-11-06 — Interactive-film framing and Bigfoot's narration

- **The Rooftop Party is told as a film:**
  - **Title card:** "a Dreamlive story — *Bigfoot's Rooftop Party*" as the dream opens.
  - **Chapter cards** in a movie-caption style: One "The Leap", Two "The Party", Three "Home Across the Street", Four "Gifts from the Sky", Five "Goodnight".
  - **End credits** roll after Bigfoot wakes: the cast, the music credits (CC BY 4.0, as required), Built with, Made by.
  - Cards are serif gold type with a soft shadow. They are placed in the world where you look and anchored to your rig, so a viewpoint change carries them along; they never stick to your head.
  - Automatic bedtime now waits until the credits finish.
- **Bigfoot narrates his dream:**
  - Eleven short lines, one at the start of each beat: asking you to draw his window, the leap, "Cousin Yeti, hit the music!", "You pick the song", "Catch some for yourself!", "Thank you for dreaming with me", and "listen to the rain" at bedtime.
  - Each line plays from his head (spatial audio). The music, including the party song, ducks under it.
  - Each line shows as a subtitle ("Bigfoot: …"). The subtitles double as the hands-first instructions, replacing the old draw-window caption.
  - **Bigfoot's voice:** nine clips generated offline with Kokoro text-to-speech (Apache 2.0, voice `am_michael`). Each was pitched down about 10%, given chest warmth and a touch of room, and loudness-normalised (275 KB in total, `public/audio/voice/`). The voice is credited in CREDITS.md and in the end credits.
- Emulator checks (systems paused for the captures, because the laptop runs at about 3 fps): the title card over the room; "The Leap" chapter card; the credits roll; Bigfoot's subtitle text on the beat.

## 2026-11-06 — Real music and a music visualizer

- **Real recorded songs replace the synth beats** at the rooftop party. They are free to use with credit (CC BY 4.0), from Free Music Archive:
  - "Discode" by Neil Fernandes (Disco);
  - "Afrobeat" by Alex Morgan (Afrobeats);
  - "Let's Bounce" by 1000 Handz (House).
- The dream's ambience is now "Bloom" by Purrple Cat (chill), in place of the synthesized music box.
- The songs stream through `<audio>` elements routed into Web Audio, which keeps memory low on a headset. They still come from the Yeti's decks in 3D, and still sound muffled through closed glass.
- All four tracks are credited in CREDITS.md, loudness-normalised and re-encoded (5.3 MB in total).
- **Music visualizer.** An analyser reads the mix every frame (bass, mids, highs, level and kick hits):
  - While the party is live, or while you DJ, the skyline becomes an equalizer. Each tower follows the bass, the mids or the highs like a VU meter: its windows light from the street up to the level, with a bright peak line, and flash on each kick.
  - The beat clock for the party lights now follows the song's real kicks.
  - The analysis is published on Session (musicBass/Mid/High/Level/Kick) for any system.
- The party crowd wears varied, lighter outfit colours instead of dark purple silhouettes.
- Emulator checks: the songs play and the analyser reads them (bass about 0.6–0.8 on the house track); the tower peak lines move between frames under the sunset sky.

## 2026-11-06 — Golden sunset

- **The dream is now bright and golden, like DreamSpace.** It opens at golden hour:
  - The sky has a gold horizon, a pink band and deep blue above, with a low sun and glow and soft clouds lit gold (all in one shader).
  - A warm low sun from beyond the window, plus a warm sky/ground fill, light the room, Bigfoot and the city.
  - The showcase room's ambient light rises with it, and the sleep vignette mostly steps back.
- **Timeline:**
  1. Golden hour from the start through the party.
  2. Deeper dusk as the party ends.
  3. A lit-up night for the leap home, the gifts and the fireworks finale.
  4. Sunrise at the end.
- Palm menu **Time**: Sunset, Night, Dawn, Bedtime.
- Both lights stay in the scene at all times (zero intensity when unused), so changing the time of day never recompiles materials.
- Emulator checks: the bright warm room at the start; the party roof under an orange sunset sky; night for the gifts. Clean console.

## 2026-11-06 — Hands-first, end to end

- **Hands look like the headset's own.** Tracked hands get a frosted-glass body (faint in the middle, brighter at the rim, fading at the wrist) inside IWSDK's soft glowing outline. This is the Meta system-hand look, and it reads over the dream and over passthrough. The showcase room used to swap them for skin-coloured hands; that swap is gone, so the browser shows the same hands as a headset.
- **Panel buttons fire on the pinch.** With hand tracking the pointing ray drifts while the fingers close, so a release often lands off the button. Buttons now fire on pinch-down, with a short guard against double presses. This applies to the palm menu and the pause panel.
- Hands-only run-through in the emulator (hand tracking, no controller):
  - The left palm turned up opens the palm menu; a right-hand ray pinch on Fireworks fires them.
  - A right-hand pinch-drag on the wall draws Bigfoot's window; it dissolves open and the story moves on.
  - A palm held out pauses; a pinch on Resume resumes.
  - Waking Bigfoot and choosing a song work by gaze alone, and gifts are caught by touch.

## 2026-11-05 — Landmark towers on the skyline

- Two new procedural landmark models, generic and not copies of real buildings:
  - **An art-deco spire tower** (about 96 m): a limestone shaft rising in two setbacks with vertical piers, a three-tier stepped crown of glowing gilded arches, a needle spire and a red aircraft beacon.
  - **A slim glass supertall** (about 150 m): blue-black glass tapering as it rises, scattered floors lit cool white, an open crown with a glowing ring, a mast and a beacon.
- Lit windows come from deterministic window textures (no DOM), and the UVs count window cells, so the panes are the same size on every face.
- Cost: the deco tower is 13 meshes (1,344 triangles; its piers are instanced); the glass tower is 6 meshes (212 triangles).
- Placement: both stand close enough that their crowns rise above the party roof as seen from Bigfoot's room. From inside the room, the party tower hides everything below about 32° of elevation.
- Emulator checks: isolated previews (front, back, side, top and quarter views); from the room, the deco crown sits centre-stage over the party with the supertall to the right. The production build passes.

## 2026-11-05 — Bedtime mode

- **Bedtime:** a calm place to stay after the story. Choose it from the palm menu, or it starts by itself 25 seconds after the Rooftop night ends.
  - A soft fade from black covers the change.
  - The sky goes to deep night, rain falls outside, and **raindrops run down the glass** (a cheap highlight shader with wobbling drops and droplet trails).
  - The music box drops almost to silence, so the rain hiss and Bigfoot's snoring carry the room. He is back in bed, fast asleep.
- Bedtime ends with "Restart dream" or a new night. Pressing the button again wakes the room ("Good morning").
- Rain on the glass also appears whenever rain is chosen from the palm menu.
- Emulator checks: Bigfoot asleep in bed; up at the glass, rain streaks outside and drops on the pane. Clean console after reload.

## 2026-11-05 — A living city

- **Traffic:** headlight-and-taillight cars stream along the cross streets and the avenue far below (one instanced draw).
- **A helicopter** circles the party tower, with a spinning rotor, a blinking red light and a searchlight sweeping the roof. The searchlight dims at sunrise.
- **Birds:** a flock crosses the sky in a loose V as the sky turns to dawn.
- **Fireworks finale:** a volley goes up as Bigfoot lands back home, and another as the last gift lands. Each fires once per dream.
- Emulator checks:
  - Seen: the helicopter and searchlight over the towers, and the room spotlight pooling on the floor.
  - Not yet seen on screen: the traffic below (the view tour moved on before the shot); it will be checked in the trailer pass.

## 2026-11-05 — The party lights reach your room

- While the party is loud and you are at home (Bigfoot landing, leaping back, the gifts, a replayed song, or any time you DJ), four laser beams fire from the Yeti's stage across the street, come in through the window, and sweep over your walls.
- In the showcase room, two coloured spotlights also wash the walls and ceiling.
- Colours follow the song (yours, if you are DJing) and flash on the beat. The lights fade up and down smoothly. The spotlights stay in the scene at zero intensity, so switching them on never recompiles materials.
- Emulator check: the gifts beat shows the beams crossing the room and a coloured wash on the far wall. Clean console.

## 2026-11-05 — Palm menu: you DJ, fireworks, confetti, weather

- **Palm menu.** Turn your left palm up (or press X on the left controller) and a small "Party controls" panel floats above it:
  - **You DJ:** choose Disco, Afro or House. The Yeti plays your song from the decks for the rest of the night, and the party lights change to match.
  - **Confetti** pops just in front of you and flutters down.
  - **Fireworks:** a volley of four shells bursts over the city beyond the party roof, each with a thump and a crackle.
  - **Weather:** clear, rain (streaks outside the glass, a rain hiss, a little haze), fog, or snow drifting over New York.
  - **Time:** deep night or sunrise over the penthouse sky.
- All effects live in the window frame, so they follow a window drawn somewhere else. Particle pools are fixed (no allocation per frame).
- Emulator checks: the panel opens with X and sits above the left controller. A ray press on Fireworks fires a volley (state changed through the real button). Snow, fireworks and confetti were seen in the runtime. Clean console.

## 2026-11-05 — The room transforms; draw Bigfoot a window

- **The room becomes a penthouse.** The dream starts in an ordinary bedroom with a plaster window wall. Once Bigfoot lands at the party, the wall dissolves (a noise dissolve with a glowing edge) into floor-to-ceiling glass over New York. The ceiling then opens into a starry night sky, which warms into sunrise as he goes back to bed.
- **Draw Bigfoot a window.** The Rooftop night opens with "Draw Bigfoot a window: pinch and drag on the wall". A glowing outline follows the drag. On release the wall dissolves open inside it, and his window, the city and the party all move to where you drew. In the showcase room it snaps to the nearer glass bay. With no input, it draws itself after 9 seconds.
- Emulator checks: plain bedroom, then the drawn hole opening on the city, then the full penthouse with an open ceiling and stars. A controller drag draws and opens the window, and the story moves on.

## 2026-10-27 — Rooftop Party v2 (owner's refinement)

- The party is on the roof of a **taller skyscraper opposite** Bigfoot's window. He slides his glass open and leaps **up** to it, dances with the crowd, and leaps **back down** home.
- **The DJ is his Yeti cousin**: the same rigged model with snow-white fur (a shader turns the fur texture to brightened grey, keeping its detail) and DJ headphones on his head bone.
  - During the party he tosses parachute gifts to the street crowd.
  - Afterwards he throws gifts across to Bigfoot at his window. Bigfoot catches each one and stacks it on his floor as a loose heap; the pile is saved, so it grows night after night.
  - Some gifts come to the viewer to catch.
- **A comfortable viewpoint tour** (the view never glides; it fades out, moves, and fades in): his room for the start; a raised VIP deck beside the stage for the party and the song choice; the party roof's edge, looking down at the street and across at his tower as he leaps home; his room again for the gifts. On a headset, the outside viewpoints get a night sky and a lit stand-in for his room in his tower.
- The world now includes Bigfoot's own tower (facade with his window cut out, roof and sides) and towers all round.
- Emulator checks: the party view shows Bigfoot dancing and the Yeti at the decks; the edge view shows his tower and lit room across the street; the gift heap stands in his room. Clean console.

## 2026-10-27 — The Rooftop Party (owner's direction change, BUILD_PLAN.md §2c)

- **New main event.** Bigfoot wakes and walks to the floor-to-ceiling glass. A bay slides open, he steps onto the ledge and leaps across the street onto the rooftop of the neighbouring high-rise, where a DJ party is going on.
  - He DJs on a stage facing your window, behind a booth with turntables and speaker stacks. The crowd dances on a glowing floor under string lights and lasers, beside a classic water tower.
  - He throws goodies: wrapped gifts on glowing parachutes drift down to a crowd on the street below, and every few seconds one flies across, in through the open window, to be caught by hand. Golden memories still work.
  - Your gaze picks the song twice (Disco / Afrobeats / House, on lights by the window). Each song has its own procedural music, light palette and colors. The music is muffled through the closed glass and pours in as it slides open.
  - He leaps back, climbs in, and flops into bed. The memory orb lands on the shelf.
- New world: `src/showcase/rooftop.ts` and `rooftop-layout.ts`, a "window frame" layout so the same rooftop stands outside the showcase glass or beyond the headset's dream window. New chapter: `src/dreams/chapter_rooftop.ts`. New `RooftopPartySystem`, goodies, and Bigfoot's rooftop choreography.
- **Headset:** a glowing dream window opens in the real wall beside the TV, with a glass pane that slides. An invisible wall-plane occluder means the rooftop world shows only through the opening. Emulator living room: 17 planes, dream window placed, the full dream completed.
- **TV dream kept as an extra:** odd nights play the Rooftop Party (night 1 first) and even nights the TV dream. With unlock-all, *Restart dream* alternates.
- **Showcase:** the seat faces between the bed and the window. The glass is split into bays and one slides.
- **Director mode:** rooftop shot list. It follows him to the glass, watches the leap from the open bay, uses a dream camera over the dance floor, looks down from the ledge at goodies parachuting to the street, and gazes at "House" then "Afrobeats".

## 2026-10-27 — Phase 8: submission materials

- **Director mode** (`?director`, development only) for the demo video:
  - A scripted camera follows the real dream: the opening view with the title, a push-in on sleeping Bigfoot (the camera's gaze starts the dream), following him to the TV, the camera's gaze choosing DJ then ski, the acts spilling into the room, the finale, waking, and the orb landing.
  - Flying items are caught automatically, and an end card shows the play link.
  - The app records its own canvas and sound to `dreamlive-demo.webm`, so emulator overlays are not captured. The full take is about 2 min 20 s.
  - Verified in the emulator: the gaze chose DJ, then ski; 16 catches (golden); clean console.
- **SUBMISSION.md**: name, tagline (102 characters), track, judge testing instructions, description (492 words), hand interactions with the comfort rationale, launch target, team, screenshot list, and steps to record the video.
- The site is live at https://nnam-droid12.github.io/dreamlive/ (the repo is public and Pages deploys on push).

## 2026-10-27 — Judge loop #3 and safe fixes

The second independent judge pass scored the build **6.0 / 10** (Innovation 7, Experience 6, Technical 5, Polish 6; it was 5.25). Safe fixes applied:

- **Room planes first.** The TV, shelf and Bigfoot's bed wait up to 2.5 s for detected planes, so a real Quest no longer locks in the fallback layout from an empty first scan.
- **Shelf beside the TV's real edge** in mixed reality. In the showcase it stays authored. A TV on the floating backdrop is 1.4 m wide so it fits the 60° cone.
- **Controllers can catch** (grip position), so the golden goal no longer needs hands.
- Near clip plane 0.001 → 0.02 for depth precision. Bigfoot's grounding updates only its own transform chain, not the whole scene graph, each frame.
- The lean-back default never repeats the act that just played.
- The palm-out cooldown survives dropping the hand.
- The "Tomorrow" tag no longer overlaps the orbs, and the shelf sort no longer allocates every frame.
- CREDITS: the audio line now says it is synthesized live in the browser.
- Emulator smoke test (living room, mixed reality): 17 planes detected before placement, TV on the real wall, shelf just left of it, console clean.
- Known, not changed in the freeze: never run on a real Quest (fps, hand tracking and plane timing are unverified), no persistence with WebXR anchors, and the dream nights are mostly visual variety.

## 2026-10-27 — Phase 7: hardening (robustness matrix)

The matrix from BUILD_PLAN.md §8 was adapted to the Bigfoot design: the table and surface items became room-detection checks. All runs were in the IWER emulator.

| # | Test | Result |
|---|---|---|
| 1 | Living room (MR) | Pass: 17 planes. Bigfoot sleeps on the detected couch and the TV hangs on the real wall. |
| 2 | Office (MR, Meta VR Glasses profile) | Pass: 10 planes. No usable wall ahead, so the backdrop goes in at 2.2 m. No couch, so Bigfoot uses the floor spot between the user and the TV. |
| 3/5 | No wall or no planes, fallbacks | Pass: same fallback path as #2. |
| 4 | Tiny surface | N/A: there is no table stage in the Bigfoot design. |
| 6 | Zero input for a whole session | Pass: lean-back choices, waking and the orb on the shelf. |
| 7 | Hands lost mid-dream | Pass: the dream continues and the caption "Hands out of view - the dream carries on." shows once (new). |
| 8 | Rapid repeated gestures | Pass: palm-out has a cooldown, seeds bloom once, and the B button toggles cleanly. |
| 9 | Pause / resume ×3 mid-act | Pass: dream time is frozen exactly while paused and continues after resume. |
| 10 | Gaze + hands (Glasses) | Pass: eye gaze with the head held forward chose the non-default ski act. |
| 11 | Controllers only | Pass: the trigger presses panel buttons and seeds, and **B / Y / Menu now open and close the pause panel** (new; palm-out needs hands). |
| 12 | Fresh profile, first launch | Store falls back to night 1 when storage is empty. To be re-checked on the deployed URL. |
| 13 | Reload after collecting orbs | Pass (Phase 4): the shelf is restored. |
| 14 | Soak run | Pass: after about 32 minutes of dream time, the JS heap is flat (125 → 128 MB), audio nodes are collected (1,248 → 233), and frames run at p50 16.7 ms. |

- Zero console errors across a full showcase dream. No `console.*` calls in `src/`.
- An early slowdown to about 1 fps in the emulator was Chrome throttling the hidden emulator window, not the app; with a profiler attached, frames ran at 16–33 ms.

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
