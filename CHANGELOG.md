# Changelog

All notable changes to Dreamlive, newest first.

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
