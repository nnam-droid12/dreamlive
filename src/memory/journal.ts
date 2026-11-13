/**
 * "It remembers you": the story of you and Bigfoot across visits, kept in
 * localStorage (on your device only). Counts of what you did together, the
 * song you picked, whether you met the bunny. `before` is a snapshot of how
 * things stood when this visit began, so Bigfoot can greet you by your last
 * visit. Every access is guarded: no storage simply means a fresh first visit.
 */
const KEY = 'dreamlive.journal.v1';

export type Tally = 'highFive' | 'fistBump' | 'wave' | 'thumbs' | 'rock' | 'pat' | 'tickle' | 'movies' | 'photos' | 'stars';

export interface JournalData {
  visits: number;
  lastVisit: string;
  lastSong: string;
  bunny: boolean;
  counts: Record<Tally, number>;
}

const TALLIES: Tally[] = ['highFive', 'fistBump', 'wave', 'thumbs', 'rock', 'pat', 'tickle', 'movies', 'photos', 'stars'];

function fresh(): JournalData {
  return { visits: 0, lastVisit: '', lastSong: '', bunny: false, counts: Object.fromEntries(TALLIES.map((t) => [t, 0])) as Record<Tally, number> };
}

function load(): JournalData {
  const d = fresh();
  try {
    const raw = localStorage.getItem(KEY);
    const j = raw ? (JSON.parse(raw) as Partial<JournalData>) : undefined;
    if (j) {
      d.visits = typeof j.visits === 'number' ? Math.max(0, Math.floor(j.visits)) : 0;
      d.lastVisit = typeof j.lastVisit === 'string' ? j.lastVisit : '';
      d.lastSong = typeof j.lastSong === 'string' ? j.lastSong : '';
      d.bunny = j.bunny === true;
      for (const t of TALLIES) {
        const v = j.counts?.[t];
        d.counts[t] = typeof v === 'number' && v >= 0 ? Math.floor(v) : 0;
      }
    }
  } catch {
    // Unreadable: a fresh journal.
  }
  return d;
}

let now: JournalData | undefined;
let before: JournalData | undefined;
let listeners = 0;

function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(now));
  } catch {
    // Storage unavailable: the journal lasts for this visit only.
  }
}

/** The shared journal. Call `begin()` once per visit (it counts the visit and keeps the snapshot). */
export const Journal = {
  begin(): void {
    if (now) return;
    now = load();
    before = JSON.parse(JSON.stringify(now)) as JournalData;
    now.visits += 1;
    now.lastVisit = new Date().toISOString().slice(0, 10);
    save();
  },
  /** For the Director's film: play as a returning visitor with a little shared history. */
  seedDemo(): void {
    now = fresh();
    now.visits = 2;
    now.lastSong = 'house';
    now.bunny = true;
    Object.assign(now.counts, { highFive: 9, fistBump: 4, wave: 6, thumbs: 3, rock: 2, pat: 5, tickle: 3, movies: 1, photos: 2, stars: 5 });
    before = JSON.parse(JSON.stringify(now)) as JournalData;
    now.visits += 1;
  },
  /** How things stood when this visit began. */
  before(): Readonly<JournalData> {
    Journal.begin();
    return before!;
  },
  /** How things stand now. */
  now(): Readonly<JournalData> {
    Journal.begin();
    return now!;
  },
  add(t: Tally, n = 1): void {
    Journal.begin();
    now!.counts[t] += n;
    listeners++;
    save();
  },
  setSong(song: string): void {
    Journal.begin();
    if (now!.lastSong === song) return;
    now!.lastSong = song;
    listeners++;
    save();
  },
  metBunny(): void {
    Journal.begin();
    if (now!.bunny) return;
    now!.bunny = true;
    listeners++;
    save();
  },
  /** Bumps whenever something changes (for displays that redraw on change). */
  version(): number {
    return listeners;
  },
};
