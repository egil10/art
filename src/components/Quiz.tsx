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
} from "lucide-react";
import {
  buildChoices,
  categoryLabel,
  imageUrl,
  paintingsFor,
  rng,
  wikipediaUrl,
  type CategoryKey,
  type Painting,
} from "@/lib/paintings";
import { reportPainting } from "@/lib/reports";

type Phase = "idle" | "answered";

type Round = {
  painting: Painting;
  choices: string[];
};

function pickRound(
  pool: Painting[],
  recent: Set<string>,
  r: () => number,
): Round {
  let p: Painting | null = null;
  for (let i = 0; i < 30; i++) {
    const cand = pool[Math.floor(r() * pool.length)];
    if (!recent.has(cand.id)) {
      p = cand;
      break;
    }
  }
  if (!p) p = pool[Math.floor(r() * pool.length)];
  return { painting: p, choices: buildChoices(p, pool, r) };
}

type State = {
  queue: Round[];
  current: Round | null;
  recent: Set<string>;
  picked: string | null;
  phase: Phase;
  score: number;
  streak: number;
  best: number;
  total: number;
  seed: number;
};

function makeInitial(pool: Painting[], seed: number): State {
  if (pool.length === 0) {
    return {
      queue: [],
      current: null,
      recent: new Set(),
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
  const queue = Array.from({ length: 4 }, () => pickRound(pool, new Set(), r));
  return {
    queue: queue.slice(1),
    current: queue[0],
    recent: new Set([queue[0].painting.id]),
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
  | { type: "next"; pool: Painting[] }
  | { type: "reset"; pool: Painting[]; seed: number };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "answer": {
      if (state.phase === "answered" || !state.current) return state;
      const correct = action.choice === state.current.painting.artist;
      const streak = correct ? state.streak + 1 : 0;
      return {
        ...state,
        picked: action.choice,
        phase: "answered",
        score: state.score + (correct ? 1 : 0),
        streak,
        best: Math.max(state.best, streak),
        total: state.total + 1,
      };
    }
    case "next": {
      const pool = action.pool;
      if (pool.length === 0) return state;
      const r = rng((state.seed + state.total * 7919) | 0);
      const queue = state.queue.slice();
      while (queue.length < 3) queue.push(pickRound(pool, state.recent, r));
      const nextRound = queue.shift()!;
      queue.push(pickRound(pool, state.recent, r));
      const recent = new Set(state.recent);
      recent.add(nextRound.painting.id);
      if (recent.size > 120) {
        const arr = [...recent];
        for (let i = 0; i < arr.length - 120; i++) recent.delete(arr[i]);
      }
      return {
        ...state,
        current: nextRound,
        queue,
        recent,
        picked: null,
        phase: "idle",
      };
    }
    case "reset":
      return makeInitial(action.pool, action.seed);
  }
}

export function Quiz({
  paintings,
  category,
  onChangeCategory,
}: {
  paintings: Painting[];
  category: CategoryKey;
  onChangeCategory: () => void;
}) {
  const pool = useMemo(
    () => paintingsFor(paintings, category),
    [paintings, category],
  );
  const [state, dispatch] = useReducer(
    reducer,
    null,
    () => makeInitial(pool, Date.now() & 0x7fffffff),
  );
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [imgReady, setImgReady] = useState(false);
  const [reported, setReported] = useState(false);

  const poolRef = useRef(pool);
  useEffect(() => {
    poolRef.current = pool;
  }, [pool]);

  const categoryRef = useRef(category);
  useEffect(() => {
    if (categoryRef.current !== category) {
      categoryRef.current = category;
      dispatch({ type: "reset", pool, seed: Date.now() & 0x7fffffff });
      setImgReady(false);
      setReported(false);
    }
  }, [category, pool]);

  // Preload upcoming images.
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

  // Keyboard shortcuts.
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
        dispatch({ type: "next", pool: poolRef.current });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.current, state.phase]);

  // Auto-advance after answer.
  useEffect(() => {
    if (state.phase !== "answered") return;
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(() => {
      dispatch({ type: "next", pool: poolRef.current });
    }, 2200);
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
  }, [state.phase]);

  const current = state.current;
  const accuracy = useMemo(
    () =>
      state.total === 0 ? 0 : Math.round((state.score / state.total) * 100),
    [state.score, state.total],
  );

  const handleReport = useCallback(() => {
    if (!current) return;
    reportPainting(current.painting);
    setReported(true);
  }, [current]);

  if (!current) return null;
  const answered = state.phase === "answered";

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-12 pt-3 sm:pt-6">
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
          <Link href="/gallery" className="pill-glass focus-ring" aria-label="Open gallery">
            <Images size={15} strokeWidth={2} />
            <span className="hidden sm:inline">Gallery</span>
          </Link>
        </div>

        <div className="flex items-center gap-1.5">
          <Stat label="Score" value={state.score} />
          <Stat label="Streak" value={state.streak} accent={state.streak >= 3} />
          <Stat label="Acc" value={`${accuracy}%`} subtle />
        </div>
      </div>

      {/* Painting */}
      <div className="relative animate-pop">
        <div className="glass-strong overflow-hidden rounded-[28px]">
          <div className="relative aspect-[4/5] sm:aspect-[16/11] w-full bg-canvas-warm">
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

            <button
              onClick={handleReport}
              disabled={reported}
              className={
                "absolute right-3 top-3 pill focus-ring " +
                (reported
                  ? "bg-black/5 text-ink-muted cursor-default"
                  : "glass text-ink/70 hover:text-ink")
              }
              aria-label="Report this painting"
              title="Report a wrong or bad image"
            >
              <Flag size={14} strokeWidth={2} />
              <span className="text-xs">{reported ? "Thanks" : "Report"}</span>
            </button>
          </div>
        </div>
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

      {/* Reveal panel — reserved height so the layout never jumps */}
      <RevealPanel
        painting={current.painting}
        correct={state.picked === current.painting.artist}
        visible={answered}
        onNext={() => dispatch({ type: "next", pool: poolRef.current })}
        bestStreak={state.best}
      />

      <p className="mt-4 text-center text-[11px] text-ink-muted">
        Press <Kbd>1</Kbd>–<Kbd>4</Kbd> to answer · <Kbd>Enter</Kbd> for next
      </p>
    </div>
  );
}

function RevealPanel({
  painting,
  correct,
  visible,
  onNext,
  bestStreak,
}: {
  painting: Painting;
  correct: boolean;
  visible: boolean;
  onNext: () => void;
  bestStreak: number;
}) {
  return (
    <div className="mt-4 min-h-[112px]">
      {!visible ? (
        <div className="grid h-[112px] place-items-center text-[11px] text-ink-muted">
          <span>
            Best streak <span className="text-ink font-medium">{bestStreak}</span>
          </span>
        </div>
      ) : (
        <div className="animate-fade-up rounded-2xl border border-white/70 bg-white/65 px-4 py-3 backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div
                className={
                  "text-[11px] font-semibold uppercase tracking-wide " +
                  (correct ? "text-green-700" : "text-red-700")
                }
              >
                {correct ? "Correct" : "Not quite"}
              </div>
              <div className="mt-0.5 text-base font-semibold text-ink truncate">
                {painting.title}
              </div>
              <div className="mt-0.5 text-sm text-ink/80 truncate">
                {painting.artist}
                {painting.year ? ` · ${painting.year}` : ""}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-muted">
                {painting.mv && (
                  <Tag>
                    <span className="text-ink/60">Movement</span>
                    <span className="text-ink/85 font-medium">{painting.mv}</span>
                  </Tag>
                )}
                {painting.g && (
                  <Tag>
                    <span className="text-ink/60">Genre</span>
                    <span className="text-ink/85 font-medium">{painting.g}</span>
                  </Tag>
                )}
                {painting.loc && (
                  <Tag>
                    <span className="text-ink/60">Location</span>
                    <span className="text-ink/85 font-medium truncate max-w-[260px]">
                      {painting.loc}
                    </span>
                  </Tag>
                )}
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <a
                href={wikipediaUrl(painting.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="pill-glass focus-ring text-[11px]"
                title="Open on Wikipedia"
              >
                <ExternalLink size={12} />
                <span>Wiki</span>
              </a>
              <button onClick={onNext} className="pill-solid focus-ring">
                Next
                <ArrowRight size={15} strokeWidth={2.2} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-black/[0.04] px-2 py-0.5">
      {children}
    </span>
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
            : "bg-white/55 text-ink/80 backdrop-blur border border-white/70")
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
