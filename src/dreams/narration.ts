/**
 * Bigfoot's lines in the Rooftop Party (he narrates his own dream). Each line
 * plays when its beat starts (after `at` seconds), from his head, with a
 * subtitle. Voice files live at public/audio/voice/<id>.mp3; when a file is
 * missing the subtitle still shows, so the story never depends on audio.
 */
export interface NarrationLine {
  id: string;
  /** The beat (or 'bedtime') that triggers it, and how far in. */
  beat: string;
  at: number;
  text: string;
}

export const NARRATION: readonly NarrationLine[] = [
  {
    id: 'window',
    beat: 'draw-window',
    at: 0.4,
    text: "Psst... hey, friend. My window's stuck, and there's a party next door! Can you draw me a new one? Pinch, and drag on the wall.",
  },
  { id: 'leap', beat: 'to-window', at: 0.6, text: 'Perfect! Thank you. Okay... deep breath. Big leap!' },
  { id: 'made-it', beat: 'arrive', at: 0.8, text: 'I made it! Cousin Yeti, hit the music!' },
  { id: 'choose', beat: 'choice-1', at: 0.3, text: 'You pick the song! Just look at the light you like.' },
  { id: 'jam-afro', beat: 'afro', at: 2, text: 'Woo! This is my jam!' },
  { id: 'jam-house', beat: 'house', at: 2, text: 'Woo! This is my jam!' },
  { id: 'jam-disco', beat: 'disco', at: 2, text: 'Woo! This is my jam!' },
  { id: 'home', beat: 'leap-back', at: 0.3, text: 'Time to head home. Hold on!' },
  { id: 'gifts', beat: 'gifts', at: 0.8, text: "Yeti's throwing presents! Catch some for yourself!" },
  { id: 'goodnight', beat: 'to-bed', at: 0.5, text: 'What a night... Thank you for dreaming with me, friend.' },
];

/** Shared jam line: one voice file for all three songs. */
export const voiceFileOf = (id: string): string => (id.startsWith('jam-') ? 'jam' : id);
