import { World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { DevControls, DreamDirector, GazeRay } from './components/dream.js';
import { Gestures } from './components/hands.js';
import { Caption, Ritual } from './components/ritual.js';
import { Session } from './components/session.js';
import { RoomSlots, StageSurface } from './components/stage.js';
import { Director } from './config/director.js';
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
});
