/**
 * The audio timeline of an offline Director render. Frames are rendered at a
 * fixed step (slower than real time), so live audio would drift; instead every
 * sound event is logged with its story time and the soundtrack is mixed
 * afterwards (scripts/trailer/mix.py). Inactive unless Director offline mode
 * switches it on.
 */
export interface TimelineEvent {
  t: number;
  type: 'act' | 'music' | 'score' | 'voice' | 'sfx' | 'open' | 'world' | 'movie' | 'lullaby' | 'volume' | 'band';
  name: string;
  value?: number;
}

export const Timeline = {
  on: false,
  /** Story time of the current frame (seconds since the render started). */
  t: 0,
  events: [] as TimelineEvent[],
  log(type: TimelineEvent['type'], name: string, value?: number): void {
    if (!this.on) return;
    this.events.push({ t: Math.round(this.t * 1000) / 1000, type, name, value });
  },
};
