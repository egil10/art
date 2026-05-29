"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Trophy, X, RotateCcw } from "lucide-react";
import {
  accuracy,
  recentTrend,
  type EloState,
} from "@/lib/elo";

/** A small inline sparkline of the rating history. */
function Sparkline({ history }: { history: number[] }) {
  const W = 280;
  const H = 70;
  const PAD = 4;
  if (history.length < 2) {
    return (
      <div className="grid h-[70px] place-items-center text-[11px] text-ink-muted">
        Play a few rounds to chart your rating.
      </div>
    );
  }
  const min = Math.min(...history);
  const max = Math.max(...history);
  const span = Math.max(1, max - min);
  const n = history.length;
  const x = (i: number) => PAD + (i / (n - 1)) * (W - PAD * 2);
  const y = (v: number) => PAD + (1 - (v - min) / span) * (H - PAD * 2);
  const pts = history.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const last = history[n - 1];
  const rising = last >= history[0];
  const stroke = rising ? "#16a34a" : "#dc2626";
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label="Rating over time"
    >
      <polyline
        points={pts}
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={x(n - 1)} cy={y(last)} r={3} fill={stroke} />
    </svg>
  );
}

function PanelStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-black/[0.04] px-3 py-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
        {label}
      </div>
      <div className="mt-0.5 text-lg font-bold tabular-nums text-ink">{value}</div>
    </div>
  );
}

export function EloBadge({
  state,
  delta,
  onReset,
}: {
  state: EloState;
  /** Most recent rating change, flashed beside the badge then cleared. */
  delta: number | null;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const trend = recentTrend(state);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative flex items-center gap-1.5 rounded-full border border-white/70 bg-white/55 px-3 py-1.5 text-xs backdrop-blur transition hover:bg-white/85 focus-ring"
        aria-label={`Your rating ${state.rating} — open history`}
        title="Your rating — tap for history"
      >
        <Trophy size={13} className="text-amber-500" strokeWidth={2.2} />
        <span className="text-ink-muted">Elo</span>
        <span className="font-semibold tabular-nums text-ink">{state.rating}</span>
        {delta !== null && delta !== 0 && (
          <span
            key={state.games}
            className={
              "animate-fade-up font-semibold tabular-nums " +
              (delta > 0 ? "text-green-600" : "text-red-600")
            }
          >
            {delta > 0 ? `+${delta}` : delta}
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Rating history"
        >
          <div className="frost-backdrop absolute inset-0 animate-fade-in" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="frost animate-pop relative w-full max-w-sm rounded-[28px] p-6"
          >
            <button
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full text-ink-muted transition hover:bg-black/5 hover:text-ink focus-ring"
              aria-label="Close"
            >
              <X size={16} />
            </button>

            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-muted">
              Your rating
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-4xl font-bold tabular-nums text-ink">
                {state.rating}
              </span>
              {trend !== 0 && (
                <span
                  className={
                    "inline-flex items-center gap-0.5 text-sm font-semibold " +
                    (trend > 0 ? "text-green-600" : "text-red-600")
                  }
                >
                  {trend > 0 ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
                  {trend > 0 ? `+${trend}` : trend}
                  <span className="text-ink-muted">/10</span>
                </span>
              )}
            </div>

            <div className="mt-4 rounded-2xl border border-black/[0.06] bg-white/40 p-3">
              <Sparkline history={state.history} />
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <PanelStat label="Peak" value={String(state.peak)} />
              <PanelStat label="Games" value={String(state.games)} />
              <PanelStat label="Accuracy" value={`${accuracy(state)}%`} />
            </div>

            <p className="mt-4 text-[12px] leading-snug text-ink/70">
              Each guess is a match against the painting — rarer, more obscure
              works are stronger opponents, so beating them is worth more.
            </p>

            <div className="mt-4 flex items-center justify-end">
              {confirmReset ? (
                <div className="flex items-center gap-2 text-[12px]">
                  <span className="text-ink-muted">Reset rating?</span>
                  <button
                    onClick={() => {
                      onReset();
                      setConfirmReset(false);
                    }}
                    className="rounded-full bg-red-600 px-3 py-1.5 font-semibold text-white transition hover:bg-red-700 focus-ring"
                  >
                    Reset
                  </button>
                  <button
                    onClick={() => setConfirmReset(false)}
                    className="rounded-full px-3 py-1.5 text-ink-muted transition hover:bg-black/5 focus-ring"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmReset(true)}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] text-ink-muted transition hover:bg-black/5 hover:text-ink focus-ring"
                >
                  <RotateCcw size={13} />
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
