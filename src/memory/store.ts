/**
 * Memory Shelf persistence: kept orbs, the first night and the unlock-all flag,
 * in localStorage. Every access is guarded: private windows, blocked storage or
 * corrupt data fall back to a fresh first night instead of breaking the dream.
 */
const KEY = 'dreamlive.memories.v1';
const MAX_ORBS = 60;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface SavedOrb {
  chapterId: string;
  /** The act it keeps: 'surf' | 'dj' | 'ski'. */
  momentId: string;
  createdAt: string;
  night: number;
  /** A golden memory (the night's catch goal was reached). */
  gold?: boolean;
}

interface SaveData {
  /** Local calendar date of the first visit, YYYY-MM-DD. */
  firstNight: string;
  unlockAll: boolean;
  orbs: SavedOrb[];
}

const localDate = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

let cache: SaveData | undefined;

function read(): SaveData {
  if (cache) return cache;
  let data: Partial<SaveData> | undefined;
  try {
    const raw = localStorage.getItem(KEY);
    data = raw ? (JSON.parse(raw) as Partial<SaveData>) : undefined;
  } catch {
    data = undefined;
  }
  cache = {
    firstNight: typeof data?.firstNight === 'string' ? data.firstNight : localDate(new Date()),
    unlockAll: data?.unlockAll === true,
    orbs: Array.isArray(data?.orbs) ? data.orbs.filter((o) => typeof o?.momentId === 'string') : [],
  };
  if (!data) write();
  return cache;
}

function write(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // Storage unavailable: memories last for this session only.
  }
}

export const MemoryStore = {
  /** 1 on the first visit's calendar date, 2 the next local date, and so on. */
  night(now = new Date()): number {
    const [y, m, d] = read().firstNight.split('-').map(Number);
    const first = new Date(y, (m || 1) - 1, d || 1).getTime();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return Math.max(1, Math.round((today - first) / DAY_MS) + 1);
  },
  orbs(): readonly SavedOrb[] {
    return read().orbs;
  },
  addOrb(orb: SavedOrb): void {
    const data = read();
    data.orbs.push(orb);
    if (data.orbs.length > MAX_ORBS) data.orbs.splice(0, data.orbs.length - MAX_ORBS);
    write();
  },
  unlockAll(): boolean {
    return read().unlockAll;
  },
  setUnlockAll(on: boolean): void {
    read().unlockAll = on;
    write();
  },
};
