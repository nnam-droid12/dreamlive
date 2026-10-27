# Dreamlive

*Bigfoot is asleep on your bed. Look at him, and he's off to the rooftop party next door.*

A lovable Bigfoot sleeps on your bed. Look at him and he gets up, slides his window open and leaps **up** onto the roof of the taller skyscraper opposite, where his Yeti cousin is DJing a party. You go too: the view fades to a VIP deck beside the decks. Your gaze picks the song (Disco, Afrobeats or House), and the music and lights change with it. Bigfoot dances with the crowd while the Yeti tosses parachute gifts down to the street. Then, from the roof's edge, you watch him leap back down home across the street. Back in his room, the Yeti throws gifts across: Bigfoot catches each one and stacks it on his floor (his pile grows night after night), and some fly to you to catch with your hands. He goes back to bed and leaves you a memory orb for your shelf. On alternate nights, his dream plays through your TV instead.

Dreamlive is a seated, hands-first mixed-reality experience for Meta Quest 3 / 3S and Meta VR Glasses, built with the [Immersive Web SDK (IWSDK)](https://iwsdk.dev) on WebXR. It is an entry to the Meta VR Start Developer Competition 2026 (Entertainment track, New Experience division).

**Play:** https://nnam-droid12.github.io/dreamlive/ — open in Meta Quest Browser, sit facing your TV wall, press *Enter XR*. Judges: *Unlock all dreams (judges)* is on the start panel and the pause panel.

**No headset?** Open the same link on a computer: it plays in a built-in headset emulator (IWSDK's Immersive Web Emulator) inside a New York high-rise bedroom at night. Press *Enter XR*, then use the emulator's on-screen controls to look around.

## How to play

- **Look** at sleeping Bigfoot to wake him (or just wait).
- **Look** at a glowing light by the window to choose the song (or pinch it). Do nothing and the party chooses for you.
- **Catch** the gifts the Yeti throws through the window (or what flies out of the TV) with your hand. Catch the night's goal for a golden memory.
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
