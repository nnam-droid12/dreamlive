# Dreamlive

*Bigfoot is asleep on your bed. Look at him, and slip into his dream.*

A lovable Bigfoot sleeps on your real bed or couch. Look at him and he sleep-walks across your room and dives into your TV, where his dream plays and spills out into the room: sea spray, rooftop-party lights and confetti, falling snow. Wherever you look, the dream follows: your gaze picks the next act (surf through New York, DJ a rooftop party, ski down a skyscraper). Catch what flies out of the screen with your hands. When he wakes, he leaves you a memory orb for your shelf. Every real night brings a new dream night.

Dreamlive is a seated, hands-first mixed-reality experience for Meta Quest 3 / 3S and Meta VR Glasses, built with the [Immersive Web SDK (IWSDK)](https://iwsdk.dev) on WebXR. It is an entry to the Meta VR Start Developer Competition 2026 (Entertainment track, New Experience division).

**Play:** https://nnam-droid12.github.io/dreamlive/ — open in Meta Quest Browser, sit facing your TV wall, press *Enter XR*. Judges: *Unlock all dreams (judges)* is on the start panel and the pause panel.

**No headset?** The full experience runs on desktop in the Immersive Web Emulator: clone the repo, `npm install`, `npm run dev`. That opens it in a New York high-rise bedroom at night (the showcase room used for the video). Adding `?showcase` to the live link shows that room in a desktop browser, but entering the dream needs a headset or the emulator.

## How to play

- **Look** at sleeping Bigfoot to peek into his dream (or just wait).
- **Look** at a glowing light to choose the dream (or pinch it). Do nothing and the dream chooses for you.
- **Catch** things that fly out of the TV with your hand. Catch the night's goal for a golden memory.
- **Pinch** an orb on your Memory Shelf to dream it again.
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
