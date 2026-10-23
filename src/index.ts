import { World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { DevControls, DreamDirector, GazeRay } from './components/dream.js';
import { Gestures } from './components/hands.js';
import { Caption, Ritual } from './components/ritual.js';
import { RoomSlots, StageSurface } from './components/stage.js';
import { PanelSystem } from './panel.js';
import { AttentionSystem } from './systems/attention-system.js';
import { AudioSystem } from './systems/audio-system.js';
import { CaptionSystem } from './systems/caption-system.js';
import { DreamDirectorSystem } from './systems/dream-director-system.js';
import { DreamSeedSystem } from './systems/dream-seed-system.js';
import { DreamerSystem } from './systems/dreamer-system.js';
import { GestureSystem } from './systems/gesture-system.js';
import { LighthouseSystem } from './systems/lighthouse-system.js';
import { NightSkySystem } from './systems/night-sky-system.js';
import { PalmCalibrationSystem } from './systems/palm-calibration-system.js';
import { PalmGuideSystem } from './systems/palm-guide-system.js';
import { RitualDirectorSystem } from './systems/ritual-director-system.js';
import { RoomUnderstandingSystem } from './systems/room-understanding-system.js';
import { SeaSystem } from './systems/sea-system.js';
import { SkySystem } from './systems/sky-system.js';
import { StageEffectsSystem } from './systems/stage-effects-system.js';
import { VoyageSystem } from './systems/voyage-system.js';
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
    .addComponent(DevControls);

  // Order matters: sense → decide → present.
  world
    .registerSystem(GestureSystem)
    .registerSystem(AttentionSystem)
    .registerSystem(RoomUnderstandingSystem)
    .registerSystem(PalmCalibrationSystem)
    .registerSystem(RitualDirectorSystem)
    .registerSystem(DreamDirectorSystem)
    .registerSystem(WallAnchorSystem)
    .registerSystem(PalmGuideSystem)
    .registerSystem(StageEffectsSystem)
    .registerSystem(DreamerSystem)
    .registerSystem(NightSkySystem)
    .registerSystem(SeaSystem)
    .registerSystem(LighthouseSystem)
    .registerSystem(VoyageSystem)
    .registerSystem(SkySystem)
    .registerSystem(DreamSeedSystem)
    .registerSystem(WakingSystem)
    .registerSystem(AudioSystem)
    .registerSystem(CaptionSystem)
    .registerSystem(PanelSystem);
});
