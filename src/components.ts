import { defineComponents } from '@iwsdk/core';
import { DevControls, DreamDirector, DreamSeed, GazeRay, GazeTarget } from './components/dream.js';
import { Dreamer } from './components/dreamer.js';
import { Gestures, HandGestureState } from './components/hands.js';
import { MemoryOrb } from './components/memory.js';
import { Caption, Ritual } from './components/ritual.js';
import { RoomSlots, StageAnchor, StageSurface } from './components/stage.js';

export default defineComponents([
  StageSurface,
  StageAnchor,
  RoomSlots,
  Ritual,
  Caption,
  HandGestureState,
  Gestures,
  Dreamer,
  DreamDirector,
  DevControls,
  GazeRay,
  GazeTarget,
  DreamSeed,
  MemoryOrb,
]);
