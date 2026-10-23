import { World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { Caption, Ritual } from './components/ritual.js';
import { RoomSlots, StageSurface } from './components/stage.js';
import { PanelSystem } from './panel.js';
import { CaptionSystem } from './systems/caption-system.js';
import { DreamerSystem } from './systems/dreamer-system.js';
import { GestureSystem } from './systems/gesture-system.js';
import { NightSkySystem } from './systems/night-sky-system.js';
import { PalmCalibrationSystem } from './systems/palm-calibration-system.js';
import { PalmGuideSystem } from './systems/palm-guide-system.js';
import { RitualDirectorSystem } from './systems/ritual-director-system.js';
import { RoomUnderstandingSystem } from './systems/room-understanding-system.js';
import { StageEffectsSystem } from './systems/stage-effects-system.js';

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
    .addComponent(RoomSlots);

  // Order matters: sense → decide → present.
  world
    .registerSystem(GestureSystem)
    .registerSystem(RoomUnderstandingSystem)
    .registerSystem(PalmCalibrationSystem)
    .registerSystem(RitualDirectorSystem)
    .registerSystem(PalmGuideSystem)
    .registerSystem(StageEffectsSystem)
    .registerSystem(DreamerSystem)
    .registerSystem(NightSkySystem)
    .registerSystem(CaptionSystem)
    .registerSystem(PanelSystem);
});
