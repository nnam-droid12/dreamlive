# Dreamlive

*Every night, a new dream performs live on your table.*

A tiny dreamer falls asleep on your real table. Its dream grows across your room, and wherever you look, the dream follows.

Dreamlive is a seated, hands-first mixed-reality experience for Meta Quest 3 / 3S and Meta VR Glasses, built with the [Immersive Web SDK (IWSDK)](https://iwsdk.dev) on WebXR. It is an entry to the Meta VR Start Developer Competition 2026 (Entertainment track, New Experience division).

**Play:** https://nnam-droid12.github.io/dreamlive/ (open in Meta Quest Browser, seated at a table)

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
