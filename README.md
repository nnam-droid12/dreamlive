# Dreamlive

*Draw Bigfoot a window, and your room becomes a penthouse over New York.*

A lovable Bigfoot naps in your room, and he tells you his dream out loud. His window is stuck and there's a party next door, so you draw him a new one with your hand. Your wall dissolves into glass over **golden-hour New York**. He leaps up to the rooftop of the skyscraper opposite, where his Yeti cousin is DJing. The story unfolds like a short film, in chapters:

- **Your room transforms:** the window wall turns to glass and the ceiling opens to the sky.
- **Spatial cinema:** a floating **LIVE rooftop cam** screen cuts between close-ups of him dancing, the DJ and the crowd.
- **You pick the song:** real recorded tracks in spatial audio.
- **A music visualizer:** the whole skyline turns into a VU meter.
- **You join in:** turn your palm up to be the DJ, fire confetti and fireworks, or change the weather.

- **Bigfoot is your friend:** wave and he waves back. High-five him, fist-bump him, give a thumbs up, throw the rock sign and he dances, pat his head or tickle him. Your tracked hands are read joint by joint.
- **Step into the story:** at Movie Night he sits beside you on a loveseat with popcorn, and the bunny walks out of the film to join you.
- **Dream worlds:** above the clouds, a storm at sea where he surfs past your window, and a walk down a New York street between the skyscrapers.
- **He remembers you:** come back and he greets you by your last visit, and a chalkboard on his wall keeps your story together (stored only on your device).

Night falls for the fireworks. He leaps home and catches the gifts the Yeti throws, stacking them on his floor, and some fly to you. End credits roll, then **Bedtime**: rain on the glass while he snores. Each night leaves a memory orb on your shelf.

Dreamlive is a seated, hands-first mixed-reality experience for Meta Quest 3 / 3S and Meta VR Glasses, built with the [Immersive Web SDK (IWSDK)](https://iwsdk.dev) on WebXR. It is an entry to the Meta VR Start Developer Competition 2026 (Entertainment track, New Experience division).

**Play:** https://nnam-droid12.github.io/dreamlive/ — open in Meta Quest Browser, sit facing your TV wall, press *Enter XR*. Judges: *Unlock all dreams (judges)* is on the start panel and the pause panel.

**No headset?** Open the same link on a computer: it plays in a built-in headset emulator (IWSDK's Immersive Web Emulator) inside a New York high-rise bedroom at night. Press *Enter XR*, then use the emulator's on-screen controls to look around.

## How to play

- **Draw Bigfoot a window:** pinch and drag a rectangle on the wall. The plaster dissolves open there, and his window, the city and the party all move to where you drew. Do nothing and it draws itself.
- **Watch the room transform:** once Bigfoot lands at the party, the window wall dissolves into floor-to-ceiling glass over New York, and the ceiling opens to the stars. Lasers from the party sweep across your walls on the beat.
- **Look** at sleeping Bigfoot to wake him (or just wait).
- **Look** at a glowing light by the window to choose the song (or pinch it). Do nothing and the party chooses for you.
- **Catch** the gifts the Yeti throws through the window (or what flies out of the TV) with your hand. Catch the night's goal for a golden memory.
- **Play with Bigfoot using your hands:** wave, raise a palm for a high-five, a fist for a fist bump, thumbs up, rock on, pat his head, tickle his belly, or point somewhere and he looks. A card shows the signs.
- **Pinch** an orb on your Memory Shelf to dream it again.
- **Turn your left palm up** (or press X on the left controller) for the palm menu:
  - be the DJ (pick the Yeti's song);
  - fire confetti, or a fireworks volley over the city;
  - change the weather (rain, fog, snow) and the time (night or sunrise);
  - choose **Bedtime**: rain on the glass while Bigfoot snores. Bedtime also starts by itself after the story.
- **Hold a palm out** (or press B / Y / Menu on a controller) to pause: resume, restart, unlock all, big captions, calm motion, exit.

## Develop

```sh
npm install
npm run dev        # CLI-managed Vite server + managed browser with the IWER emulator
npm run typecheck
npm run build      # production build → dist/
```

- `iwsdk.config.json` is the project authority (XR features, scene, modules).
- `src/config/tuning.ts` holds every timing and threshold; `src/config/palette.ts` every color.
- `BUILD_PLAN.md` is the product spec and phase plan.

## Deploy

Every push to `main` builds and deploys to GitHub Pages via `.github/workflows/deploy.yml`.

## Credits and licenses

See [CREDITS.md](CREDITS.md). Progress log: [CHANGELOG.md](CHANGELOG.md).
