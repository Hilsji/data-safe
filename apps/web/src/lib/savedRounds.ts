/** Opt-in-Verlauf auf diesem Gerät (localStorage) – ohne Themen, ohne Politik, ohne ID. */
export interface SavedRound {
  savedAt: string;
  durationMin: number;
  videosSeen: number;
  minutesInvested: number;
  contentCorrectShare: number | null;
  dPrime: number | null;
  baselineDPrime: number | null;
}

const KEY = "guide-me:rounds";

export function loadRounds(): SavedRound[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as SavedRound[];
  } catch {
    return [];
  }
}

export function saveRound(r: SavedRound): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify([...loadRounds(), r].slice(-20)));
    return true;
  } catch {
    return false;
  }
}

export function clearRounds(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignorieren */
  }
}
