/**
 * The weather at sea, as the console and your gestures set it (0..1, eased):
 * `storm` (heavy rain, big swells, lightning and thunder), `sun` (the clouds
 * break and sunshine pours over a calming sea), `whales` (humpbacks come close,
 * breach and sing). SeaWorldSystem paints the sea from these.
 */
export const SeaWeather = {
  storm: 0.85,
  sun: 0,
  whales: 0,
  /** A thunderbolt called by a clenched fist (consumed by the sea). */
  thunderNow: false,
};

/** The film's Director works the console and the gestures like a viewer would. */
export const SeaCue = {
  /** Show the console (the film decides when). */
  show: false,
  /** Which dial the film's hand drags (-1 none), and to what value; the Goodnight button. */
  drive: -1,
  value: 0,
  press: false,
  /** A palm raised to the sky (the film's right hand): the sun comes on stronger while it is held. */
  palmUp: false,
};
