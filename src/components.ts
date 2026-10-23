import { defineComponents } from '@iwsdk/core';
import { Dreamer } from './components/dreamer.js';
import { HandGestureState } from './components/hands.js';
import { Caption, Ritual } from './components/ritual.js';
import { RoomSlots, StageAnchor, StageSurface } from './components/stage.js';

export default defineComponents([
  StageSurface,
  StageAnchor,
  RoomSlots,
  Ritual,
  Caption,
  HandGestureState,
  Dreamer,
]);
