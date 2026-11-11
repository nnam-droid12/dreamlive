import { World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { DevControls, DreamDirector, GazeRay } from './components/dream.js';
import { Gestures } from './components/hands.js';
import { Caption, Ritual } from './components/ritual.js';
import { Session } from './components/session.js';
import { RoomSlots, StageSurface } from './components/stage.js';
import { Director, DirectorFrame } from './config/director.js';
import { Timeline } from './audio/timeline.js';
import { PanelSystem } from './panel.js';
import { AttentionSystem } from './systems/attention-system.js';
import { AudioSystem } from './systems/audio-system.js';
import { BigfootSystem } from './systems/bigfoot-system.js';
import { CatchSystem } from './systems/catch-system.js';
import { DirectorSystem } from './systems/director-system.js';
import { DreamTvSystem } from './systems/dream-tv-system.js';
import { CaptionSystem } from './systems/caption-system.js';
import { DreamDirectorSystem } from './systems/dream-director-system.js';
import { DreamSeedSystem } from './systems/dream-seed-system.js';
import { DreamSpillSystem } from './systems/dream-spill-system.js';
import { GestureSystem } from './systems/gesture-system.js';
import { MemoryShelfSystem } from './systems/memory-shelf-system.js';
import { NightSkySystem } from './systems/night-sky-system.js';
import { RitualDirectorSystem } from './systems/ritual-director-system.js';
import { RooftopPartySystem } from './systems/rooftop-party-system.js';
import { ViewTourSystem } from './systems/view-tour-system.js';
import { RoomTransformSystem } from './systems/room-transform-system.js';
import { DrawWindowSystem } from './systems/draw-window-system.js';
import { PalmMenuSystem } from './systems/palm-menu-system.js';
import { RoomPartyLightSystem } from './systems/room-party-light-system.js';
import { LivingCitySystem } from './systems/living-city-system.js';
import { BedtimeSystem } from './systems/bedtime-system.js';
import { HandLookSystem } from './systems/hand-look-system.js';
import { NarrationSystem } from './systems/narration-system.js';
import { FilmSystem } from './systems/film-system.js';
import { CinemaSystem } from './systems/cinema-system.js';
import { MusicVisualizerSystem } from './systems/music-visualizer-system.js';
import { PhotoSystem } from './systems/photo-system.js';
import { MovieNightSystem } from './systems/movie-night-system.js';
import { TvCartoonSystem } from './systems/tv-cartoon-system.js';
import { CloudWorldSystem } from './systems/cloud-world-system.js';
import { SeaWorldSystem } from './systems/sea-world-system.js';
import { StreetWalkSystem } from './systems/street-walk-system.js';
import { FriendSystem } from './systems/friend-system.js';
import { JournalSystem } from './systems/journal-system.js';
import { SeaConsoleSystem } from './systems/sea-console-system.js';
import { mountMoviePicker } from './ui/movie-picker.js';
import { SkyFxSystem } from './systems/sky-fx-system.js';
import { RoomUnderstandingSystem } from './systems/room-understanding-system.js';
import { QualitySystem } from './systems/quality-system.js';
import { SessionSystem } from './systems/session-system.js';
import { ShowcaseSystem } from './systems/showcase-system.js';
import { WakingSystem } from './systems/waking-system.js';
import { WallAnchorSystem } from './systems/wall-anchor-system.js';

World.create(
  document.getElementById('scene-container') as HTMLDivElement,
  projectOptions,
).then((world) => {
  // The director entity holds the session-wide dream state.
  world
    .createEntity()
    .addComponent(Ritual)
    .addComponent(Caption)
    .addComponent(StageSurface)
    .addComponent(RoomSlots)
    .addComponent(DreamDirector)
    .addComponent(GazeRay)
    .addComponent(Gestures)
    .addComponent(DevControls)
    .addComponent(Session);

  // Order matters: sense → decide → present.
  world
    .registerSystem(GestureSystem)
    .registerSystem(SessionSystem)
    .registerSystem(QualitySystem)
    .registerSystem(AttentionSystem)
    .registerSystem(RoomUnderstandingSystem)
    .registerSystem(RitualDirectorSystem)
    .registerSystem(DreamDirectorSystem)
    .registerSystem(WallAnchorSystem)
    .registerSystem(BigfootSystem)
    .registerSystem(RooftopPartySystem)
    .registerSystem(ViewTourSystem)
    .registerSystem(RoomTransformSystem)
    .registerSystem(DrawWindowSystem)
    .registerSystem(PalmMenuSystem)
    .registerSystem(RoomPartyLightSystem)
    .registerSystem(LivingCitySystem)
    .registerSystem(BedtimeSystem)
    .registerSystem(HandLookSystem)
    .registerSystem(NarrationSystem)
    .registerSystem(FilmSystem)
    .registerSystem(CinemaSystem)
    .registerSystem(MusicVisualizerSystem)
    .registerSystem(PhotoSystem)
    .registerSystem(TvCartoonSystem)
    .registerSystem(CloudWorldSystem)
    .registerSystem(SeaWorldSystem)
    .registerSystem(StreetWalkSystem)
    .registerSystem(FriendSystem)
    .registerSystem(JournalSystem)
    .registerSystem(SeaConsoleSystem)
    .registerSystem(MovieNightSystem)
    .registerSystem(SkyFxSystem)
    .registerSystem(NightSkySystem)
    .registerSystem(DreamTvSystem)
    .registerSystem(DreamSpillSystem)
    .registerSystem(CatchSystem)
    .registerSystem(DreamSeedSystem)
    .registerSystem(WakingSystem)
    .registerSystem(MemoryShelfSystem)
    .registerSystem(ShowcaseSystem)
    .registerSystem(AudioSystem)
    .registerSystem(CaptionSystem)
    .registerSystem(PanelSystem);
  // Dev-only demo recording (`?director`): scripted camera, cards, WebM capture.
  if (Director.enabled) world.registerSystem(DirectorSystem);
  if (Director.offline) offlineRender(world);
  if (!Director.enabled) mountMoviePicker();
});

/**
 * Offline trailer render: a fixed story step per frame, and a hook after each
 * on-screen render (the cinema screen's off-screen pass is skipped) so the
 * Director can capture exactly one video frame per step.
 */
function offlineRender(world: Awaited<ReturnType<typeof World.create>>): void {
  const step = 1 / Director.fps;
  const r = world.renderer;
  if (Director.width && Director.height) {
    r.setPixelRatio(1);
    r.setSize(Director.width, Director.height, false);
  }
  let t = 0;
  Timeline.on = true;
  const update = world.update.bind(world);
  let waiting = false;
  world.update = (_delta: number, _time: number) => {
    // Something still pending (saving frames, a video seeking): hold this step.
    waiting = DirectorFrame.busy > 0;
    if (waiting) return;
    t += step;
    Timeline.t = t;
    update(step, t);
  };
  const render = r.render.bind(r);
  r.render = (scene, camera) => {
    render(scene, camera);
    if (!DirectorFrame.offscreen && !waiting) DirectorFrame.onFrame?.();
  };
}
