# Dreamlive — submission drafts

Draft answers for the Meta VR Start Developer Competition 2026 form. Copy each section into the matching field. Text marked *(owner: edit)* is yours to make personal.

---

## 1. Submission name

Dreamlive

## 2. Tagline

> Bigfoot leaps from his window to a rooftop party next door, then catches the gifts his DJ cousin throws home. You catch some too.

(129 characters; limit 140.)

## 3. Track and division

Entertainment · New Experience

## 4. Judge testing instructions

*(Also paste these at the top of the description.)*

- **Play:** https://nnam-droid12.github.io/dreamlive/ in **Meta Quest Browser** (Quest 3 / 3S; Meta VR Glasses supported). Sit facing a wall, ideally your TV wall, and press **Enter XR**.
- **Start:** look at sleeping Bigfoot (or just wait 12 seconds). He leaps from his window up to the rooftop party opposite; the view follows in soft fades.
- **Choose:** on the VIP deck, look at a glowing light (Disco · Afrobeats · House) until its ring fills. A pinch works too. Do nothing and the party chooses for you.
- **Catch:** back in his room, touch the gifts the Yeti DJ throws to you. Catch the night's goal for a golden memory.
- **Pause:** hold a palm out at face height, or press B / Y / Menu on a controller. The pause panel has *Unlock all dreams (judges)*, big captions and calm motion.
- **Length:** about 3 minutes per dream. It is fully completable with no input at all.
- **Return:** each real night is a new dream night. Your memory orbs stay on the shelf beside the TV; pinch one to dream it again.

## 5. Description (≤ 500 words)

**Inspiration.** We wanted mixed reality that feels like a bedtime story happening in your own room. What if a lovable Bigfoot fell asleep on your bed, and you could watch his dream?

**What it does.** Bigfoot sleeps on your real bed or couch, found with Quest's scene understanding. Look at him and he slides his window open and leaps up onto the roof of the taller skyscraper opposite, where his Yeti cousin is DJing a party. On a headset, a dream window opens in your real wall. You follow in comfortable fades: a VIP deck beside the decks, where your gaze picks the song (Disco, Afrobeats or House) with a dwell ring showing the choice forming; then the roof's edge, the street far below, as he leaps home. Back in his room, the Yeti throws gifts across the street: Bigfoot catches each one and stacks it on his floor, where the pile grows night after night, and some fly to you to catch with your hands. Catch enough and the night's memory orb turns gold. It lands on a Memory Shelf that persists between visits. On alternate nights his dream plays through your TV instead.

**How we built it.**
- Built with Meta's Immersive Web SDK (WebXR, Three.js, an entity-component system), as one system per behavior: attention (eye or head gaze), gestures read directly from hand joints, room understanding, the dream director, the TV portal, room spill, catching, the memory shelf, session and pause, audio, and adaptive quality.
- Bigfoot was concept art from Meshy, turned into a 3D mesh with TRELLIS.2, rigged and animated with Mixamo, and slimmed from 151k to 30k triangles in Blender.
- The dream worlds are rendered to a texture on the TV with head-coupled parallax.
- All music and sound is synthesized live with Web Audio.
- The New York bedroom used for capture is built from CC0 photo-scanned materials and a licensed skyline photo.

**Challenges.**
- We had no headset, so everything was built and tested in Meta's Immersive Web Emulator, including a 14-point robustness matrix (different rooms, missing walls, no input, lost hands, pause cycles, a long soak test).
- Making the experience work in rooms we never saw needed layered fallbacks: a real TV, then a wall, then a floating backdrop; a real bed, then a couch, then a cozy floor spot.

**Accessibility.**
- Completes with zero input.
- Pinch or controller alternatives to gaze.
- Captions for story and sound.
- High-contrast captions and a reduced-motion mode.
- Essential content stays inside a 60° cone for Meta VR Glasses.
- Adaptive quality protects frame rate.

**What's next.**
- Testing on Quest 3S hardware.
- More dream acts unlocking over real nights.
- Spatial anchors so the TV and shelf return to the same place.
- Launch as a PWA on the Meta Horizon Store.

## 6. Hand interactions

- **Look (eye or head gaze):** the core mechanic. Looking at a choice light brightens it at once and fills a ring over 1.5 s. Looking away drains it slowly, so a glance never commits. Eye gaze is used on Meta VR Glasses and head gaze on Quest 3/3S.
- **Pinch:** an instant alternative to gaze dwell, for choosing a light or replaying a memory orb. It uses the standard hand ray, or gaze plus pinch on Glasses.
- **Touch / catch:** reach out and touch what flies out of the TV (13 cm touch radius, or 20 cm with cupped hands). Items hover within easy seated reach, below eye level, for over a second. Controllers can catch too.
- **Palm out:** hold an open palm out at face height for 1.2 s to pause. It needs a raised hand, so waiting to catch never pauses by accident, and a cooldown prevents double triggers. Controllers use B / Y / Menu.
- **Comfort:**
  - Fully seated; nothing needs standing, turning around, or reaching beyond arm's length.
  - All gestures are short and optional: every choice has a lean-back default, and a whole dream completes with no input.
  - If hands drop out of tracking, a caption says so and the dream carries on.

**The future of VR** *(owner: edit)*: We think the most magical mixed reality is not a new world but your own room, gently changed: a character who lives in your space, remembers you, and gives you a reason to come back tomorrow night.

## 7. Target launch date

Q1 2027: PWA on the Meta Horizon Store.

## 8. Team

William Nnamani: Developer & Designer.

## 9. Screenshots (in `docs/screens/judge/`)

1. `14-bigfoot-on-bed-1.6m.png`: Bigfoot asleep on the bed (arrival).
2. `15-bigfoot-walk-grounded.png`: sleep-walking to the TV.
3. `08-dj-spill.png`: the rooftop party spilling into the room.
4. `13-act-ski.png`: skiing down a skyscraper inside the TV.
5. `09-mr-bigfoot-on-couch.png`: mixed reality; Bigfoot on a detected real couch.
6. `11-shelf-tomorrow-teaser.png`: the Memory Shelf and tomorrow's teaser.

## 10. Demo video

Recorded in the emulator with Director mode (no headset available):

1. `npm install`, then `npm run dev`.
2. In Chrome, open `https://localhost:8081/?director` and accept the local certificate warning.
3. Maximize the window (bigger window, sharper video) and click **Enter XR** on the start panel.
4. Don't touch anything. The camera follows the scripted shot list for about 2 min 20 s, then `dreamlive-demo.webm` downloads.

Upload it to YouTube as **Public**, under 3:00.
