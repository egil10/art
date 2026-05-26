"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  Flag,
  Check,
  X,
  ArrowRight,
  Sparkles,
  Layers,
  Loader2,
} from "lucide-react";
import {
  buildChoices,
  paintingsFor,
  rng,
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

function makeInitial(category: CategoryKey, seed: number): State {
  const pool = paintingsFor(category);
  const r = rng(seed);
  const queue = Array.from({ length: 4 }, () =>
    pickRound(pool, new Set(), r),
  );
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
  | { type: "next"; category: CategoryKey }
  | { type: "reset"; category: CategoryKey; seed: number };

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
      const pool = paintingsFor(action.category);
      const r = rng((state.seed + state.total * 7919) | 0);
      const queue = state.queue.slice();
      // ensure queue has at least 3 ahead
      while (queue.length < 3) queue.push(pickRound(pool, state.recent, r));
      const nextRound = queue.shift()!;
      queue.push(pickRound(pool, state.recent, r));
      const recent = new Set(state.recent);
      recent.add(nextRound.painting.id);
      // cap recent history
      if (recent.size > 80) {
        const arr = [...recent];
        for (let i = 0; i < arr.length - 80; i++) recent.delete(arr[i]);
      }
      return {
        ...state,
        current: nextRound,
        queue,
        picked: null,
        phase: "idle",
      };
    }
    case "reset":
      return makeInitial(action.category, action.seed);
  }
}

export function Quiz({
  category,
  onChangeCategory,
}: {
  category: CategoryKey;
  onChangeCategory: () => void;
}) {
  const [state, dispatch] = useReducer(
    reducer,
    null,
    () => makeInitial(category, Date.now() & 0x7fffffff),
  );
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [imgReady, setImgReady] = useState(false);
  const [reported, setReported] = useState(false);

  // Restart when category switches.
  const categoryRef = useRef(category);
  useEffect(() => {
    if (categoryRef.current !== category) {
      categoryRef.current = category;
      dispatch({ type: "reset", category, seed: Date.now() & 0x7fffffff });
      setImgReady(false);
      setReported(false);
    }
  }, [category]);

  // Preload upcoming images.
  useEffect(() => {
    for (const r of state.queue.slice(0, 3)) {
      const img = new Image();
      img.decoding = "async";
      img.src = r.painting.image;
    }
  }, [state.queue]);

  // Reset image-loaded flag when current changes.
  useEffect(() => {
    setImgReady(false);
    setReported(false);
  }, [state.current?.painting.id]);

  // Keyboard shortcuts: 1-4 to pick, Enter/Space to advance.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!state.current) return;
      if (state.phase === "idle") {
        const idx = Number(e.key) - 1;
        if (idx >= 0 && idx < 4) {
          dispatch({ type: "answer", choice: state.current.choices[idx] });
        }
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        dispatch({ type: "next", category });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.current, state.phase, category]);

  // Auto-advance after answer.
  useEffect(() => {
    if (state.phase !== "answered") return;
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(() => {
      dispatch({ type: "next", category });
    }, 1600);
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
  }, [state.phase, category]);

  const current = state.current;
  const accuracy = useMemo(
    () => (state.total === 0 ? 0 : Math.round((state.score / state.total) * 100)),
    [state.score, state.total],
  );

  const handleReport = useCallback(() => {
    if (!current) return;
    reportPainting(current.painting);
    setReported(true);
  }, [current]);

  if (!current) return null;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-10 pt-3 sm:pt-6">
      {/* Top status bar */}
      <div className="flex items-center justify-between gap-2 pb-3">
        <button
          onClick={onChangeCategory}
          className="pill-glass focus-ring"
          aria-label="Change category"
        >
          <Layers size={15} strokeWidth={2} />
          <span className="capitalize">{category}</span>
        </button>

        <div className="flex items-center gap-1.5">
          <Stat label="Score" value={state.score} />
          <Stat label="Streak" value={state.streak} accent={state.streak >= 3} />
          <Stat label="Acc" value={`${accuracy}%`} subtle />
        </div>
      </div>

      {/* Painting */}
      <div className="relative animate-pop">
        <div className="glass-strong overflow-hidden rounded-[28px]">
          <div className="relative aspect-[4/5] sm:aspect-[5/4] w-full bg-canvas-warm">
            {!imgReady && (
              <div className="absolute inset-0 grid place-items-center text-ink-muted">
                <Loader2 className="animate-spin" size={20} />
              </div>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={current.painting.id}
              src={current.painting.image}
              alt=""
              onLoad={() => setImgReady(true)}
              onError={() => setImgReady(true)}
              className={
                "h-full w-full object-contain transition duration-500 " +
                (imgReady ? "opacity-100" : "opacity-0")
              }
            />

            {/* Report button overlay */}
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

          {/* Caption strip — reveals after answer */}
          <div
            className={
              "px-5 py-4 transition-all duration-300 " +
              (state.phase === "answered"
                ? "opacity-100 max-h-32"
                : "opacity-0 max-h-0 py-0")
            }
          >
            <div className="text-sm font-medium text-ink">
              {current.painting.title}
            </div>
            <div className="text-xs text-ink-muted">
              {current.painting.artist}
              {current.painting.year ? ` · ${current.painting.year}` : ""}
            </div>
          </div>
        </div>
      </div>

      {/* Choices */}
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {current.choices.map((choice, i) => {
          const isCorrect = choice === current.painting.artist;
          const isPicked = state.picked === choice;
          const showState = state.phase === "answered";
          return (
            <button
              key={choice + i}
              onClick={() => dispatch({ type: "answer", choice })}
              disabled={state.phase === "answered"}
              className={[
                "group relative overflow-hidden rounded-full px-4 py-3 text-left text-sm font-medium",
                "focus-ring transition active:scale-[.99]",
                "border",
                showState && isCorrect
                  ? "border-green-300/70 bg-green-50/90 text-green-900"
                  : showState && isPicked && !isCorrect
                    ? "border-red-300/70 bg-red-50/90 text-red-900"
                    : "border-white/70 bg-white/55 backdrop-blur hover:bg-white/80",
              ].join(" ")}
            >
              <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/5 text-[10px] font-semibold text-ink-muted">
                {i + 1}
              </span>
              <span>{choice}</span>
              {showState && isCorrect && (
                <Check
                  size={16}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-green-700"
                />
              )}
              {showState && isPicked && !isCorrect && (
                <X
                  size={16}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-red-700"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Next button after answer */}
      <div className="mt-4 flex items-center justify-between">
        <div className="text-xs text-ink-muted">
          {state.phase === "answered" ? (
            <span className="animate-fade-in">
              {state.picked === current.painting.artist ? (
                <span className="text-green-700">Correct</span>
              ) : (
                <span className="text-red-700">
                  Answer: {current.painting.artist}
                </span>
              )}
            </span>
          ) : (
            <span>
              Best streak <span className="text-ink">{state.best}</span>
            </span>
          )}
        </div>

        <button
          onClick={() => dispatch({ type: "next", category })}
          className={
            "pill-solid focus-ring transition " +
            (state.phase === "answered"
              ? "opacity-100"
              : "opacity-0 pointer-events-none")
          }
        >
          Next
          <ArrowRight size={15} strokeWidth={2.2} />
        </button>
      </div>

      <p className="mt-6 text-center text-[11px] text-ink-muted">
        Press <Kbd>1</Kbd>–<Kbd>4</Kbd> to answer · <Kbd>Enter</Kbd> for next
      </p>
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
