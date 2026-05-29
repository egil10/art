// Per-device Elo rating. The player is rated against each painting, where the
// painting's "opponent rating" is derived from its fame rank (obscure works are
// stronger opponents). State lives in localStorage so each browser keeps its
// own rating — no login, no backend. All persistence is funnelled through
// `loadElo`/`saveElo` so a future accounts/leaderboard phase can swap the
// storage layer without touching the maths or the UI.

const KEY = "canvas.elo.v1";

/** Everyone starts here — a gentle baseline that climbs as you play. */
export const DEFAULT_RATING = 800;
/** Rating can't crater below this, so a rough patch stays recoverable. */
const FLOOR = 100;
/** How many recent ratings we keep for the sparkline (bounds storage). */
const HISTORY_MAX = 250;

// Opponent-rating band. The most famous painting (rank 0) sits near the easy
// end, the most obscure near the hard end. Beating an obscure painting is
// therefore worth far more than nailing the Mona Lisa.
const MIN_OPP = 700;
const MAX_OPP = 2000;

export type EloState = {
  /** Current rating. */
  rating: number;
  /** Highest rating ever reached. */
  peak: number;
  /** Lowest rating ever reached. */
  low: number;
  /** Rounds scored. */
  games: number;
  /** Correct answers (for accuracy). */
  wins: number;
  /** Rating after each scored round, oldest first, capped to HISTORY_MAX. */
  history: number[];
  /** ISO timestamp of the last update. */
  updatedAt: string;
};

export function defaultElo(): EloState {
  return {
    rating: DEFAULT_RATING,
    peak: DEFAULT_RATING,
    low: DEFAULT_RATING,
    games: 0,
    wins: 0,
    history: [],
    updatedAt: new Date().toISOString(),
  };
}

/** Maps a painting's fame rank (0 = most famous) to an opponent rating. */
export function difficultyFromRank(rank: number, total: number): number {
  if (total <= 1) return DEFAULT_RATING;
  const t = Math.min(1, Math.max(0, rank / (total - 1)));
  return Math.round(MIN_OPP + t * (MAX_OPP - MIN_OPP));
}

/** Standard logistic expected score for `rating` against `opponent`. */
function expected(rating: number, opponent: number): number {
  return 1 / (1 + Math.pow(10, (opponent - rating) / 400));
}

// K-factor tapers as the player settles: volatile while provisional, calmer
// once there's a track record — the usual Elo provisional-rating shape.
function kFactor(games: number): number {
  if (games < 30) return 40;
  if (games < 100) return 24;
  return 16;
}

/** Applies one result and returns a new state (pure — caller persists). */
export function applyResult(
  state: EloState,
  opponent: number,
  won: boolean,
): EloState {
  const k = kFactor(state.games);
  const exp = expected(state.rating, opponent);
  // Standard Elo delta, but floored to ±1 so a result never reads as "+0".
  // Once you outrate the famous paintings, k·(1−exp) rounds to zero on a
  // correct answer — so the rating would sit stale even on a hot streak.
  // Guaranteeing at least +1 right / −1 wrong keeps it always moving.
  let delta = Math.round(k * ((won ? 1 : 0) - exp));
  if (won && delta < 1) delta = 1;
  if (!won && delta > -1) delta = -1;
  const rating = Math.max(FLOOR, state.rating + delta);
  const history = [...state.history, rating];
  if (history.length > HISTORY_MAX) {
    history.splice(0, history.length - HISTORY_MAX);
  }
  return {
    rating,
    peak: Math.max(state.peak, rating),
    low: Math.min(state.low, rating),
    games: state.games + 1,
    wins: state.wins + (won ? 1 : 0),
    history,
    updatedAt: new Date().toISOString(),
  };
}

export function accuracy(state: EloState): number {
  return state.games === 0 ? 0 : Math.round((state.wins / state.games) * 100);
}

/** Net rating change over the last `n` scored rounds (0 if not enough data). */
export function recentTrend(state: EloState, n = 10): number {
  const h = state.history;
  if (h.length < 2) return 0;
  const from = h[Math.max(0, h.length - 1 - n)];
  return h[h.length - 1] - from;
}

export type EloStatus = "high" | "low" | "up" | "down" | "flat";

/** Classifies the rating for the badge icon: all-time high/low take priority,
    otherwise the short-term (last ~4 answers) trend. Needs a few games first. */
export function eloStatus(state: EloState): EloStatus {
  if (state.games >= 5) {
    if (state.rating >= state.peak) return "high";
    if (state.rating <= state.low) return "low";
  }
  const t = recentTrend(state, 4);
  if (t > 0) return "up";
  if (t < 0) return "down";
  return "flat";
}

export function loadElo(): EloState {
  if (typeof window === "undefined") return defaultElo();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultElo();
    const parsed = JSON.parse(raw) as Partial<EloState>;
    // Merge over defaults so older/partial blobs stay valid.
    const base = defaultElo();
    const history = Array.isArray(parsed.history) ? parsed.history : base.history;
    const merged = { ...base, ...parsed, history };
    // Reconcile peak/low against the known data so an older blob (or one
    // missing `low`) can't report a high/low the history contradicts.
    const seen = [merged.rating, ...history];
    merged.peak = Math.max(merged.peak, ...seen);
    merged.low = Math.min(merged.low, ...seen);
    return merged;
  } catch {
    return defaultElo();
  }
}

export function saveElo(state: EloState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* quota or privacy mode — rating just won't persist this session */
  }
}

export function clearElo(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}
