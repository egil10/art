"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import {
  Flag,
  Check,
  X,
  ArrowRight,
  Sparkles,
  Layers,
  Loader2,
  Images,
  ExternalLink,
  Hash,
  Timer,
  Hand,
  Zap,
  Gamepad2,
  Repeat,
  RotateCcw,
} from "lucide-react";
import {
  buildChoicesForMode,
  categoryLabel,
  imageUrl,
  modeMeta,
  paintingsFor,
  paintingsForMode,
  rng,
  wikipediaUrl,
  type CategoryKey,
  type GameMode,
  type Painting,
} from "@/lib/paintings";
import {
  copyToClipboard,
  formatReport,
  getReports,
  reportPainting,
} from "@/lib/reports";
import { ReportsModal } from "./ReportsModal";

type Phase = "idle" | "answered";
type AutoMode = "off" | "fast" | "slow" | "slower";

const AUTO_KEY = "canvas.autoAdvance.v1";
const REVIEW_KEY = "canvas.reviewWrong.v1";
const AUTO_DELAYS: Record<AutoMode, number> = {
  off: 0,
  fast: 1000,
  slow: 3000,
  slower: 5000,
};
const AUTO_LABELS: Record<AutoMode, string> = {
  off: "Manual",
  fast: "Auto 1s",
  slow: "Auto 3s",
  slower: "Auto 5s",
};
const AUTO_ORDER: AutoMode[] = ["off", "fast", "slow", "slower"];
// How often a re-surfaced wrong answer is preferred over a fresh random pick.
const REVIEW_PROB = 0.35;
// Cap the wrong-queue so it can't grow unboundedly across a long session.
const WRONG_QUEUE_MAX = 60;

function recentCap(poolSize: number) {
  // Recent-history window scales with the pool so small categories (e.g. ~80
  // paintings in Italian) don't starve, but large ones still spread out.
  return Math.max(6, Math.min(poolSize - 6, 220));
}

function recentArtistCap(distinctArtists: number) {
  // Smaller than the painting window — we want to discourage back-to-back
  // artists but still let popular ones recur. Scales with the artist count.
  if (distinctArtists <= 6) return Math.max(2, distinctArtists - 2);
  return Math.max(4, Math.min(Math.floor(distinctArtists / 4), 14));
}

type Round = {
  painting: Painting;
  choices: string[];
  target: string;
};

type ArtistFreq = Map<string, number>;

export function buildArtistFreq(pool: Painting[]): ArtistFreq {
  const m: ArtistFreq = new Map();
  for (const p of pool) m.set(p.artist, (m.get(p.artist) || 0) + 1);
  return m;
}

function buildRound(
  painting: Painting,
  pool: Painting[],
  mode: GameMode,
  r: () => number,
): Round {
  const { choices, target } = buildChoicesForMode(painting, pool, mode, r);
  return { painting, choices, target };
}

function pickPainting(
  pool: Painting[],
  recent: Set<string>,
  recentArtists: string[],
  artistFreq: ArtistFreq,
  r: () => number,
): Painting {
  // Map artist -> recency rank (0 = oldest tracked, N-1 = most recent).
  const N = recentArtists.length;
  const rank = new Map<string, number>();
  for (let i = 0; i < N; i++) rank.set(recentArtists[i], i);

  // Sample K distinct candidates, then pick proportional to their weights.
  // K is small relative to the pool, but large enough that the weighting
  // actually has variety to choose from.
  const K = Math.min(32, pool.length);
  const seen = new Set<string>();
  const cands: Painting[] = [];
  const ws: number[] = [];
  let total = 0;
  let tries = 0;
  while (cands.length < K && tries < K * 4) {
    const c = pool[Math.floor(r() * pool.length)];
    tries++;
    if (seen.has(c.id)) continue;
    seen.add(c.id);

    let w = 1;
    // Painting-level penalty — very strong (effectively excludes) but not
    // zero so we still recover gracefully on tiny pools.
    if (recent.has(c.id)) w *= 0.03;
    // Artist-level recency penalty — most-recent gets the strongest hit and
    // it decays linearly back toward 1 as the artist falls out of the window.
    const ri = rank.get(c.artist);
    if (ri !== undefined && N > 0) {
      const dist = N - ri; // 1 = most recent, N = oldest tracked
      w *= Math.max(0.12, dist / (N + 0.5));
    }
    // Pool balance: under-represented artists are slightly favored, so a
    // painter with 4 works shows up more often per painting than one with
    // 40 — without swamping the headline names entirely.
    const freq = artistFreq.get(c.artist) || 1;
    w *= 1 / Math.sqrt(freq);

    cands.push(c);
    ws.push(w);
    total += w;
  }

  if (cands.length === 0 || total <= 0) {
    return pool[Math.floor(r() * pool.length)];
  }

  let u = r() * total;
  for (let i = 0; i < cands.length; i++) {
    u -= ws[i];
    if (u <= 0) return cands[i];
  }
  return cands[cands.length - 1];
}

function pickRound(
  pool: Painting[],
  mode: GameMode,
  recent: Set<string>,
  recentArtists: string[],
  artistFreq: ArtistFreq,
  r: () => number,
): Round {
  const p = pickPainting(pool, recent, recentArtists, artistFreq, r);
  return buildRound(p, pool, mode, r);
}

type State = {
  queue: Round[];
  current: Round | null;
  recent: Set<string>;
  /** Artist names in the order they were shown — oldest first. */
  recentArtists: string[];
  /** IDs of paintings answered incorrectly, oldest first. */
  wrong: string[];
  picked: string | null;
  phase: Phase;
  score: number;
  streak: number;
  best: number;
  total: number;
  seed: number;
};

function trimRecentArtists(arr: string[], cap: number): string[] {
  if (arr.length <= cap) return arr;
  return arr.slice(arr.length - cap);
}

function makeInitial(
  pool: Painting[],
  mode: GameMode,
  artistFreq: ArtistFreq,
  seed: number,
): State {
  if (pool.length === 0) {
    return {
      queue: [],
      current: null,
      recent: new Set(),
      recentArtists: [],
      wrong: [],
      picked: null,
      phase: "idle",
      score: 0,
      streak: 0,
      best: 0,
      total: 0,
      seed,
    };
  }
  const r = rng(seed);
  // Build the lookahead queue while keeping each pick weighted against the
  // already-picked recents — otherwise the prefetched 3 might all be by the
  // same painter.
  const recent = new Set<string>();
  const recentArtists: string[] = [];
  const artistCap = recentArtistCap(artistFreq.size);
  const paintingCap = recentCap(pool.length);
  const rounds: Round[] = [];
  for (let i = 0; i < 4; i++) {
    const round = pickRound(pool, mode, recent, recentArtists, artistFreq, r);
    rounds.push(round);
    recent.add(round.painting.id);
    if (recent.size > paintingCap) {
      const oldest = recent.values().next().value;
      if (oldest) recent.delete(oldest);
    }
    recentArtists.push(round.painting.artist);
    if (recentArtists.length > artistCap) recentArtists.shift();
  }
  return {
    queue: rounds.slice(1),
    current: rounds[0],
    // Reset the painting/artist windows to just the displayed round so the
    // prefetched look-ahead doesn't double-penalize early picks.
    recent: new Set([rounds[0].painting.id]),
    recentArtists: [rounds[0].painting.artist],
    wrong: [],
    picked: null,
    phase: "idle",
    score: 0,
    streak: 0,
    best: 0,
    total: 0,
    seed,
  };
}

type Action =
  | { type: "answer"; choice: string }
  | {
      type: "next";
      pool: Painting[];
      mode: GameMode;
      artistFreq: ArtistFreq;
      review: boolean;
    }
  | {
      type: "reset";
      pool: Painting[];
      mode: GameMode;
      artistFreq: ArtistFreq;
      seed: number;
    };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "answer": {
      if (state.phase === "answered" || !state.current) return state;
      const correct = action.choice === state.current.target;
      const streak = correct ? state.streak + 1 : 0;
      const currentId = state.current.painting.id;
      let wrong = state.wrong;
      if (correct) {
        // Got it right — drop from the review queue if it's there.
        if (wrong.includes(currentId)) wrong = wrong.filter((id) => id !== currentId);
      } else {
        // Push to the back of the queue (keep the original entry if present).
        wrong = wrong.includes(currentId) ? wrong : [...wrong, currentId];
        if (wrong.length > WRONG_QUEUE_MAX) wrong = wrong.slice(wrong.length - WRONG_QUEUE_MAX);
      }
      return {
        ...state,
        picked: action.choice,
        phase: "answered",
        score: state.score + (correct ? 1 : 0),
        streak,
        best: Math.max(state.best, streak),
        total: state.total + 1,
        wrong,
      };
    }
    case "next": {
      const { pool, mode, artistFreq, review } = action;
      if (pool.length === 0) return state;
      const r = rng((state.seed + state.total * 7919) | 0);

      // Decide whether to inject a previously-wrong painting.
      let nextRound: Round | null = null;
      let wrong = state.wrong;
      if (review && wrong.length > 0 && r() < REVIEW_PROB) {
        // Pick the oldest wrong painting we still have in pool and isn't in recent.
        for (let i = 0; i < wrong.length; i++) {
          const id = wrong[i];
          if (state.recent.has(id)) continue;
          const found = pool.find((p) => p.id === id);
          if (!found) continue;
          nextRound = buildRound(found, pool, mode, r);
          wrong = [...wrong.slice(0, i), ...wrong.slice(i + 1)];
          break;
        }
      }

      const queue = state.queue.slice();
      if (!nextRound) {
        while (queue.length < 1) {
          queue.push(
            pickRound(pool, mode, state.recent, state.recentArtists, artistFreq, r),
          );
        }
        nextRound = queue.shift()!;
      }
      // Top up the look-ahead queue with fresh picks. Each new pick takes the
      // newly-picked rounds into account so we don't end up with three works
      // by the same painter sitting in the queue.
      const provisionalRecent = new Set(state.recent);
      provisionalRecent.add(nextRound.painting.id);
      const provisionalArtists = [...state.recentArtists, nextRound.painting.artist];
      for (const r2 of queue) {
        provisionalRecent.add(r2.painting.id);
        provisionalArtists.push(r2.painting.artist);
      }
      while (queue.length < 3) {
        const round = pickRound(
          pool,
          mode,
          provisionalRecent,
          provisionalArtists,
          artistFreq,
          r,
        );
        queue.push(round);
        provisionalRecent.add(round.painting.id);
        provisionalArtists.push(round.painting.artist);
      }

      const recent = new Set(state.recent);
      recent.add(nextRound.painting.id);
      const cap = recentCap(pool.length);
      if (recent.size > cap) {
        const arr = [...recent];
        for (let i = 0; i < arr.length - cap; i++) recent.delete(arr[i]);
      }
      const artistCap = recentArtistCap(artistFreq.size);
      const recentArtists = trimRecentArtists(
        [...state.recentArtists, nextRound.painting.artist],
        artistCap,
      );
      return {
        ...state,
        current: nextRound,
        queue,
        recent,
        recentArtists,
        wrong,
        picked: null,
        phase: "idle",
      };
    }
    case "reset":
      return makeInitial(action.pool, action.mode, action.artistFreq, action.seed);
  }
}

export function Quiz({
  paintings,
  category,
  mode,
  onChangeCategory,
  onChangeMode,
}: {
  paintings: Painting[];
  category: CategoryKey;
  mode: GameMode;
  onChangeCategory: () => void;
  onChangeMode: () => void;
}) {
  const pool = useMemo(
    () => paintingsForMode(paintingsFor(paintings, category), mode),
    [paintings, category, mode],
  );
  const artistFreq = useMemo(() => buildArtistFreq(pool), [pool]);
  const [state, dispatch] = useReducer(
    reducer,
    null,
    () => makeInitial(pool, mode, artistFreq, Date.now() & 0x7fffffff),
  );
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [imgReady, setImgReady] = useState(false);
  const [reported, setReported] = useState(false);
  const [reportCount, setReportCount] = useState(0);
  const [showCopied, setShowCopied] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [autoMode, setAutoMode] = useState<AutoMode>("slow");
  const [review, setReview] = useState(false);

  // Hydrate persisted preferences after mount (SSR-safe).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const v = localStorage.getItem(AUTO_KEY);
    if (v && (AUTO_ORDER as string[]).includes(v)) setAutoMode(v as AutoMode);
    setReview(localStorage.getItem(REVIEW_KEY) === "1");
  }, []);

  const reviewRef = useRef(review);
  useEffect(() => {
    reviewRef.current = review;
  }, [review]);

  function toggleReview() {
    setReview((on) => {
      const next = !on;
      if (typeof window !== "undefined") {
        localStorage.setItem(REVIEW_KEY, next ? "1" : "0");
      }
      return next;
    });
  }

  // Sync queue length on mount + when reports change.
  useEffect(() => {
    setReportCount(getReports().length);
  }, [reportsOpen]);

  const cycleAutoMode = useCallback(() => {
    setAutoMode((m) => {
      const i = AUTO_ORDER.indexOf(m);
      const next = AUTO_ORDER[(i + 1) % AUTO_ORDER.length];
      if (typeof window !== "undefined") {
        localStorage.setItem(AUTO_KEY, next);
      }
      return next;
    });
  }, []);

  const poolRef = useRef(pool);
  useEffect(() => {
    poolRef.current = pool;
  }, [pool]);
  const artistFreqRef = useRef(artistFreq);
  useEffect(() => {
    artistFreqRef.current = artistFreq;
  }, [artistFreq]);

  const categoryRef = useRef(category);
  const modeRef = useRef(mode);
  useEffect(() => {
    if (categoryRef.current !== category || modeRef.current !== mode) {
      categoryRef.current = category;
      modeRef.current = mode;
      dispatch({
        type: "reset",
        pool,
        mode,
        artistFreq,
        seed: Date.now() & 0x7fffffff,
      });
      setImgReady(false);
      setReported(false);
    }
  }, [category, mode, pool, artistFreq]);

  useEffect(() => {
    for (const r of state.queue.slice(0, 3)) {
      const img = new Image();
      img.decoding = "async";
      img.src = imageUrl(r.painting.image, 1024);
    }
  }, [state.queue]);

  useEffect(() => {
    setImgReady(false);
    setReported(false);
  }, [state.current?.painting.id]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!state.current) return;
      const tgt = e.target as HTMLElement | null;
      if (tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA")) return;
      if (state.phase === "idle") {
        const idx = Number(e.key) - 1;
        if (idx >= 0 && idx < 4) {
          dispatch({ type: "answer", choice: state.current.choices[idx] });
        }
      } else if (e.key === "Enter" || e.key === " " || e.key === "ArrowRight") {
        e.preventDefault();
        dispatch({ type: "next", pool: poolRef.current, mode: modeRef.current, artistFreq: artistFreqRef.current, review: reviewRef.current });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.current, state.phase]);

  useEffect(() => {
    if (state.phase !== "answered") return;
    if (autoMode === "off") return;
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(() => {
      dispatch({ type: "next", pool: poolRef.current, mode: modeRef.current, artistFreq: artistFreqRef.current, review: reviewRef.current });
    }, AUTO_DELAYS[autoMode]);
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
  }, [state.phase, autoMode]);

  const current = state.current;
  const accuracy = useMemo(
    () =>
      state.total === 0 ? 0 : Math.round((state.score / state.total) * 100),
    [state.score, state.total],
  );

  const handleReport = useCallback(async () => {
    if (!current) return;
    const entry = reportPainting(current.painting);
    setReported(true);
    setReportCount(getReports().length);
    const ok = await copyToClipboard(formatReport(entry));
    if (ok) {
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 1800);
    }
  }, [current]);

  const handleNext = useCallback(() => {
    dispatch({ type: "next", pool: poolRef.current, mode: modeRef.current, artistFreq: artistFreqRef.current, review: reviewRef.current });
  }, []);

  if (!current) return null;
  const answered = state.phase === "answered";
  const correct = state.picked === current.target;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-12 pt-3 sm:pt-6">
      {/* Top status bar */}
      <div className="flex items-center justify-between gap-2 pb-3">
        <div className="flex items-center gap-1.5">
          <button
            onClick={onChangeCategory}
            className="pill-glass focus-ring"
            aria-label="Change category"
          >
            <Layers size={15} strokeWidth={2} />
            <span>{categoryLabel(category)}</span>
          </button>
          <button
            onClick={onChangeMode}
            className="pill-glass focus-ring"
            aria-label="Change game mode"
            title="Change what you're guessing"
          >
            <Gamepad2 size={15} strokeWidth={2} />
            <span>{modeMeta(mode).label}</span>
          </button>
          <Link
            href="/gallery"
            className="pill-glass focus-ring"
            aria-label="Open gallery"
          >
            <Images size={15} strokeWidth={2} />
            <span className="hidden sm:inline">Gallery</span>
          </Link>
          <button
            onClick={cycleAutoMode}
            className="pill-glass focus-ring"
            aria-label={`Auto-advance: ${AUTO_LABELS[autoMode]} — tap to cycle`}
            title="Cycle auto-advance speed"
          >
            {autoMode === "off" ? (
              <Hand size={14} strokeWidth={2} />
            ) : autoMode === "fast" ? (
              <Zap size={14} strokeWidth={2} />
            ) : autoMode === "slow" ? (
              <Timer size={14} strokeWidth={2} />
            ) : (
              <Timer size={14} strokeWidth={2.4} />
            )}
            <span className="hidden sm:inline">{AUTO_LABELS[autoMode]}</span>
          </button>
          <button
            onClick={toggleReview}
            className={
              "pill focus-ring border " +
              (review
                ? "border-ink/15 bg-ink text-white"
                : "border-white/70 bg-white/55 text-ink/80 backdrop-blur hover:bg-white/80")
            }
            aria-pressed={review}
            aria-label={`Review wrong answers: ${review ? "on" : "off"}`}
            title="Recycle paintings you got wrong"
          >
            {review ? (
              <Repeat size={14} strokeWidth={2.2} />
            ) : (
              <RotateCcw size={14} strokeWidth={2} />
            )}
            <span className="hidden sm:inline">Review</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <Stat label="Score" value={state.score} />
          <Stat label="Streak" value={state.streak} accent={state.streak >= 3} />
          <Stat label="Acc" value={`${accuracy}%`} subtle />
          <button
            onClick={() => {
              if (reported) setReportsOpen(true);
              else handleReport();
            }}
            className={
              "relative grid h-8 w-8 place-items-center rounded-full border focus-ring transition " +
              (reported
                ? "border-ink/15 bg-ink text-white"
                : "border-white/70 bg-white/55 text-ink/70 backdrop-blur hover:bg-white/85 hover:text-ink")
            }
            aria-label={
              reported
                ? `Open report queue (${reportCount})`
                : "Report this painting — copies it to clipboard"
            }
            title={
              reported
                ? `Reported — tap to view queue (${reportCount})`
                : "Flag and copy this painting"
            }
          >
            <Flag size={14} strokeWidth={2} />
            {reportCount > 0 && !reported && (
              <span
                aria-hidden
                className="absolute right-0 top-0 h-2 w-2 rounded-full bg-ink ring-2 ring-canvas"
              />
            )}
          </button>
        </div>
      </div>

      {/* Painting + side panel row */}
      <div className="flex flex-col items-stretch gap-3 md:flex-row">
        {/* Painting card */}
        <div className="relative min-w-0 flex-1 animate-pop">
          <div
            className={
              "glass-strong relative overflow-hidden rounded-[28px] transition-shadow duration-300 " +
              (answered
                ? correct
                  ? "ring-[3px] ring-green-400/70"
                  : "ring-[3px] ring-red-400/70"
                : "ring-0")
            }
          >
            <div className="relative aspect-[4/5] w-full bg-canvas-warm sm:aspect-[5/4]">
              {!imgReady && (
                <div className="absolute inset-0 grid place-items-center text-ink-muted">
                  <Loader2 className="animate-spin" size={20} />
                </div>
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={current.painting.id}
                src={imageUrl(current.painting.image, 1280)}
                alt=""
                onLoad={() => setImgReady(true)}
                onError={() => setImgReady(true)}
                className={
                  "h-full w-full object-contain transition duration-500 " +
                  (imgReady ? "opacity-100" : "opacity-0")
                }
              />

              {/* Mobile reveal — overlay at bottom of painting */}
              <div
                aria-hidden={!answered}
                className={
                  "pointer-events-none absolute inset-x-2 bottom-2 transition-all duration-300 md:hidden " +
                  (answered
                    ? "translate-y-0 opacity-100"
                    : "translate-y-2 opacity-0")
                }
              >
                <div className="glass-strong pointer-events-auto rounded-2xl px-3 py-2.5">
                  <CompactReveal
                    painting={current.painting}
                    target={current.target}
                    mode={mode}
                    correct={correct}
                    onNext={handleNext}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Desktop side panel */}
        <aside className="hidden md:flex md:w-[300px] md:shrink-0">
          <div className="glass-strong flex w-full flex-col rounded-[28px] p-5">
            {answered ? (
              <SideReveal
                painting={current.painting}
                target={current.target}
                mode={mode}
                correct={correct}
                onNext={handleNext}
              />
            ) : (
              <IdleSidePanel
                category={category}
                mode={mode}
                total={state.total}
                best={state.best}
              />
            )}
          </div>
        </aside>
      </div>

      {/* Choices */}
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {current.choices.map((choice, i) => {
          const isCorrect = choice === current.painting.artist;
          const isPicked = state.picked === choice;
          return (
            <button
              key={choice + i}
              onClick={() => dispatch({ type: "answer", choice })}
              disabled={answered}
              className={[
                "group relative overflow-hidden rounded-full px-4 py-3 text-left text-sm font-medium",
                "focus-ring transition active:scale-[.99]",
                "border",
                answered && isCorrect
                  ? "border-green-300/70 bg-green-50/90 text-green-900"
                  : answered && isPicked && !isCorrect
                    ? "border-red-300/70 bg-red-50/90 text-red-900"
                    : "border-white/70 bg-white/55 backdrop-blur hover:bg-white/80",
              ].join(" ")}
            >
              <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/5 text-[10px] font-semibold text-ink-muted">
                {i + 1}
              </span>
              <span className="truncate">{choice}</span>
              {answered && isCorrect && (
                <Check
                  size={16}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-green-700"
                />
              )}
              {answered && isPicked && !isCorrect && (
                <X
                  size={16}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-red-700"
                />
              )}
            </button>
          );
        })}
      </div>

      <p className="mt-4 text-center text-[11px] text-ink-muted">
        Press <Kbd>1</Kbd>–<Kbd>4</Kbd> to answer · <Kbd>Enter</Kbd> for next
      </p>

      {/* Copy-confirmation toast */}
      <div
        aria-live="polite"
        className={
          "pointer-events-none fixed inset-x-0 top-3 z-40 flex justify-center transition-all duration-300 " +
          (showCopied
            ? "translate-y-0 opacity-100"
            : "-translate-y-2 opacity-0")
        }
      >
        <div className="glass-strong rounded-full px-4 py-2 text-[12px] text-ink shadow-lg">
          Copied — paste it in our chat to flag the image.
        </div>
      </div>

      {reportsOpen && <ReportsModal onClose={() => setReportsOpen(false)} />}
    </div>
  );
}

function CompactReveal({
  painting,
  target,
  mode,
  correct,
  onNext,
}: {
  painting: Painting;
  target: string;
  mode: GameMode;
  correct: boolean;
  onNext: () => void;
}) {
  const showTitle = mode !== "title";
  const subline = mode === "painter"
    ? [painting.year, painting.mv, painting.loc].filter(Boolean).join(" · ")
    : `${painting.artist}${painting.year ? " · " + painting.year : ""}`;
  return (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <div
          className={
            "text-[10px] font-semibold uppercase tracking-wider " +
            (correct ? "text-green-700" : "text-red-700")
          }
        >
          {correct ? "Correct" : "Not quite"}
        </div>
        <div className="truncate text-[14px] font-bold text-ink">{target}</div>
        <div className="truncate text-[11px] text-ink-muted">
          {showTitle ? painting.title : subline}
        </div>
      </div>
      <button
        onClick={onNext}
        className="pill-solid focus-ring shrink-0"
        aria-label="Next painting"
      >
        Next
        <ArrowRight size={14} strokeWidth={2.2} />
      </button>
    </div>
  );
}

function SideReveal({
  painting,
  target,
  mode,
  correct,
  onNext,
}: {
  painting: Painting;
  target: string;
  mode: GameMode;
  correct: boolean;
  onNext: () => void;
}) {
  // What's NOT already shown as the headline answer — render the painting's
  // context underneath so the player sees the link between the image and the
  // answer they should remember.
  const showTitle = mode !== "title";
  const showArtist = mode !== "painter";
  const showYear = mode !== "decade" && painting.year;
  const showMovement = mode !== "movement" && painting.mv;

  return (
    <div className="flex h-full animate-fade-up flex-col">
      <div
        className={
          "inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider " +
          (correct
            ? "bg-green-100 text-green-800"
            : "bg-red-100 text-red-800")
        }
      >
        {correct ? <Check size={12} /> : <X size={12} />}
        {correct ? "Correct" : "Not quite"}
      </div>

      {/* The answer — biggest element so it's the thing the player reads. */}
      <div className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
        {modeMeta(mode).label}
      </div>
      <h2
        className={
          "mt-0.5 text-xl font-bold leading-tight " +
          (correct ? "text-ink" : "text-red-800")
        }
      >
        {target}
      </h2>

      {/* Painting context, smaller and supporting. */}
      <div className="mt-4 border-t border-black/[0.06] pt-3 text-[12px] leading-snug">
        {showTitle && (
          <div className="font-medium text-ink">{painting.title}</div>
        )}
        {(showArtist || showYear) && (
          <div className="text-ink/80">
            {showArtist && painting.artist}
            {showArtist && showYear ? " · " : ""}
            {showYear && painting.year}
          </div>
        )}
        <dl className="mt-2 space-y-1.5">
          {showMovement && <Row label="Movement" value={painting.mv!} />}
          {painting.g && <Row label="Genre" value={painting.g} />}
          {painting.loc && <Row label="Location" value={painting.loc} />}
        </dl>
      </div>

      <div className="flex-1" />
      <div className="mt-4 flex items-center justify-between gap-2">
        <a
          href={wikipediaUrl(painting.id)}
          target="_blank"
          rel="noopener noreferrer"
          className="pill-glass focus-ring text-[11px]"
        >
          <ExternalLink size={12} />
          Wiki
        </a>
        <button onClick={onNext} className="pill-solid focus-ring">
          Next
          <ArrowRight size={15} strokeWidth={2.2} />
        </button>
      </div>
    </div>
  );
}

function IdleSidePanel({
  category,
  mode,
  total,
  best,
}: {
  category: CategoryKey;
  mode: GameMode;
  total: number;
  best: number;
}) {
  return (
    <div className="flex h-full flex-col text-sm">
      <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-black/[0.05] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-ink/70">
        <Hash size={12} />
        Round {total + 1}
      </div>
      <div className="mt-3 text-base font-semibold text-ink">
        {modeMeta(mode).question}
      </div>
      <p className="mt-1 text-[12px] text-ink-muted">
        Pick the answer from the four below — or press
        <span className="mx-1">
          <Kbd>1</Kbd>
        </span>
        through
        <span className="mx-1">
          <Kbd>4</Kbd>
        </span>
        on your keyboard.
      </p>

      <div className="flex-1" />

      <div className="space-y-2 text-[12px] text-ink-muted">
        <Row label="Mode" value={modeMeta(mode).label} />
        <Row label="Collection" value={categoryLabel(category)} />
        <Row label="Best streak" value={String(best)} />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-[11px] uppercase tracking-wider text-ink-muted">
        {label}
      </dt>
      <dd className="min-w-0 truncate text-right text-[12px] font-medium text-ink">
        {value}
      </dd>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  subtle,
}: {
  label: string;
  value: number | string;
  accent?: boolean;
  subtle?: boolean;
}) {
  return (
    <div
      className={
        "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs " +
        (accent
          ? "bg-amber-100/80 text-amber-900 backdrop-blur"
          : subtle
            ? "bg-black/[0.04] text-ink-muted"
            : "border border-white/70 bg-white/55 text-ink/80 backdrop-blur")
      }
    >
      {accent && <Sparkles size={12} />}
      <span className="text-ink-muted">{label}</span>
      <span className="font-semibold tabular-nums text-ink">{value}</span>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span className="mx-0.5 inline-flex min-w-[1.4em] items-center justify-center rounded border border-black/10 bg-white/80 px-1 text-[10px] font-semibold text-ink-soft shadow-sm">
      {children}
    </span>
  );
}
