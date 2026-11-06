# Dreamlive — submission drafts

Draft answers for the Meta VR Start Developer Competition 2026 form. Copy each section into the matching field. Text marked *(owner: edit)* is yours to make personal.

---

## 1. Submission name

Dreamlive

## 2. Tagline

> Draw Bigfoot a window and your room becomes a penthouse: he leaps to a rooftop party, tells you his dream, and throws you gifts.

(128 characters; limit 140.)

## 3. Track and division

Entertainment · New Experience

## 4. Judge testing instructions

*(Also paste these at the top of the description.)*

- **Play:** https://nnam-droid12.github.io/dreamlive/ in **Meta Quest Browser** (Quest 3 / 3S; Meta VR Glasses supported). Sit facing a wall and press **Enter XR**. **Hands only, no controller needed.**
- **Start:** look at sleeping Bigfoot (or wait). He asks you, out loud, to draw him a window.
- **Draw:** pinch and drag a rectangle on your wall. It dissolves open onto New York at golden hour. (Do nothing and it draws itself.)
- **Watch:** he leaps to the rooftop party. Your wall becomes glass, your ceiling opens to the sky, and a floating live "rooftop cam" screen shows close-ups.
- **Choose:** look at a glowing light to pick the song (Disco · Afrobeats · House). A pinch works too.
- **Play along:** turn your **left palm up** for the palm menu: be the DJ, fire confetti or fireworks, change the weather or time, or choose Bedtime.
- **Catch:** touch the gifts the Yeti throws to you.
- **Pause:** hold a palm out at face height. The pause panel has *Unlock all dreams (judges)*, big captions and calm motion.
- **Length:** about 3 minutes. It completes with no input at all; Bedtime follows the credits.

## 5. Description (≤ 500 words)

**Inspiration.** Mixed reality that feels like a bedtime story told in your own room. What if a lovable Bigfoot fell asleep there, and you could step into his dream?

**What it does.** Dreamlive is an interactive, spatial short film that plays in your room.
- Bigfoot sleeps on your bed or couch (found with scene understanding).
- He narrates his own dream in his own voice, with subtitles: his window is stuck and there's a party next door. You draw him a window with your hand, and your real wall dissolves into floor-to-ceiling glass over golden-hour New York.
- He leaps to the rooftop of the skyscraper opposite, where his Yeti cousin DJs.
- The film unfolds in chapters:
  - your ceiling opens to the sky;
  - a floating "LIVE rooftop cam" screen cuts between close-ups of him dancing, the DJ and the crowd: spatial cinema;
  - your gaze picks the song, real recorded tracks in spatial audio;
  - the whole skyline turns into a music visualizer, each tower a VU meter.
- Turn your palm up to join in: DJ, confetti, fireworks over the city, snow, rain or fog.
- Night falls for the fireworks. He leaps home and catches the gifts the Yeti throws, stacking them in his room (the pile grows night after night). Some fly to you to catch.
- End credits roll, then Bedtime: rain on the glass, Bigfoot snoring.
- Each night leaves a memory orb on your shelf.

**How we built it.**
- Meta's Immersive Web SDK (WebXR, Three.js, ECS): one system per behavior.
- A live director camera renders into a texture for the cinema screen.
- A Web Audio analyser drives the skyline equalizer.
- Shader dissolves, sunset sky and clouds, rain on glass.
- Bigfoot: Meshy concept art, TRELLIS.2 mesh, Mixamo rig, slimmed in Blender.
- Voice: offline Kokoro text-to-speech.
- Music: CC BY tracks from Free Music Archive (credited in-app).

**Challenges.**
- No headset: everything was built and verified in Meta's Immersive Web Emulator, including a hands-only run-through.
- Hand rays drift as fingers close, so buttons fire on the pinch itself.
- Our trailer is rendered offline at a fixed time step, with its soundtrack mixed from a logged timeline.

**Accessibility.**
- Hands-first, no controller needed.
- Completes with zero input.
- Subtitles for every line and key sound.
- High-contrast captions and reduced motion.
- Seated, with view changes as soft fades.
- Adaptive quality.

**What's next.**
- Quest 3S hardware testing.
- New dream stories on real nights.
- Spatial anchors for the shelf.
- PWA on the Horizon Store.

## 6. Hand interactions

- **Pinch-drag on a wall:** draw Bigfoot's window. A glowing outline follows your hand; on release the wall dissolves open there.
- **Look (eye or head gaze):** choose the song. The light brightens and a ring fills over 1.5 s. A glance never commits.
- **Pinch:** instant alternative to a gaze choice; presses every panel button (fires on the pinch, robust to ray drift).
- **Palm up (left hand):** opens the palm menu above your hand.
- **Touch / catch:** reach out and touch the gifts flying to you.
- **Palm out:** hold an open palm out at face height for 1.2 s to pause.
- **Comfort:**
  - Fully seated; nothing beyond arm's reach.
  - Every choice has a lean-back default.
  - Hand tracking loss is announced and the story carries on.
  - Hands are drawn as soft frosted-glass outlines.

**The future of VR** *(owner: edit)*: The most magical mixed reality isn't a new world but your own room, transformed for a few minutes: a character who lives in your space, tells you a story, remembers you, and gives you a reason to come back tomorrow night.

## 7. Target launch date

Q1 2027: PWA on the Meta Horizon Store.

## 8. Team

William Nnamani: Developer & Designer.

## 9. Screenshots (in `docs/screens/judge/`)

1. `33-golden-hour-party.jpg`: the rooftop party under a golden-hour sky.
2. `38-dream-cinema-bigfoot.jpg`: the LIVE rooftop cam (spatial cinema).
3. `35-skyline-equalizer.jpg`: the skyline as a music visualizer.
4. `27-room-becomes-penthouse.png`: the room transformed.
5. `25-draw-window.png`: drawing Bigfoot's window.
6. `32-frosted-hands.jpg`: hands-first, frosted-glass hands.
7. `36-title-card.jpg`: the film's title card.

## 10. Demo video

Rendered in the emulator with Director mode's offline render (no headset available). It is smooth on any laptop and the sound is in sync:

1. `npm install`, then create `.env.development.local` containing `VITE_DIRECTOR=director&offline&w=1280&h=720`, then `npm run dev`.
2. Click **Enter XR** and wait (about an hour on a 2-core laptop). The camera follows the scripted shots, with a caption naming each feature. The frames (`artifacts/frames/`) and an audio timeline are saved.
3. `python scripts/trailer/mix.py artifacts/frames artifacts/dreamlive-demo-timeline.json artifacts/dreamlive-trailer.mp4`
4. Delete `.env.development.local`. Upload the MP4 to YouTube as **Public** (under 3:00).
