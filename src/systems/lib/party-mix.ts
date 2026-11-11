/**
 * The party, mixed by your hand (0..1, eased): `volume` (the song's level),
 * `lights` (stage lights, lasers, the skyline's glow), `instruments` (how much
 * of the song plays: the beat and bass alone, then the chords and voices, then
 * the hats and shimmer). The audio engine and the party's lights read these.
 */
export const PartyMix = {
  volume: 0.85,
  lights: 0.85,
  instruments: 1,
};

/** The Director's film works the party console like a viewer would. */
export const PartyCue = {
  show: false,
  drive: -1,
  value: 0,
  press: false,
};
