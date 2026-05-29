"use client";

import { useEffect, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Trophy,
  Anchor,
  Minus,
  X,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";
import {
  accuracy,
  recentTrend,
  eloStatus,
  type EloState,
  type EloStatus,
} from "@/lib/elo";

// Drives the badge icon: all-time high/low, else the short-term trend.
// Clean lucide marks only — TrendingUp/Down read as the "stock up/down" cue.
const STATUS: Record<
  EloStatus,
  { Icon: LucideIcon; cls: string; label: string }
> = {
  high: { Icon: Trophy, cls: "text-amber-500", label: "all-time high" },
  low: { Icon: Anchor, cls: "text-sky-600", label: "all-time low" },
  up: { Icon: TrendingUp, cls: "text-green-600", label: "trending up" },
  down: { Icon: TrendingDown, cls: "text-red-600", label: "trending down" },
  flat: { Icon: Minus, cls: "text-ink-muted", label: "steady" },
};

// A "nice" round gridline step (1/2/2.5/5 ×10ⁿ) aiming for ~4 lines.
function niceStep(range: number): number {
  if (range <= 0) return 100;
  const raw = range / 4;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  return ([1, 2, 2.5, 5, 10].map((m) => m * pow).find((c) => c >= raw) ??
    10 * pow);
}

/** The rating history as a line chart with a rating (y) and question (x) axis. */
function RatingChart({ history, games }: { history: number[]; games: number }) {
  const W = 300;
  const H = 132;
  const ML = 36; // left gutter for rating labels
  const MR = 8;
  const MT = 8;
  const MB = 18; // bottom gutter for question labels
  const plotW = W - ML - MR;
  const plotH = H - MT - MB;

  if (history.length < 2) {
    return (
      <div className="grid h-[132px] place-items-center text-[11px] text-ink-muted">
        Play a few rounds to chart your rating.
      </div>
    );
  }

  const dataMin = Math.min(...history);
  const dataMax = Math.max(...history);
  const step = niceStep(dataMax - dataMin);
  const yMin = Math.floor(dataMin / step) * step;
  let yMax = Math.ceil(dataMax / step) * step;
  if (yMax === yMin) yMax = yMin + step;
  const yTicks: number[] = [];
  for (let v = yMin; v <= yMax + 0.5; v += step) yTicks.push(v);

  const n = history.length;
  const firstGame = Math.max(1, games - n + 1); // question # of history[0]
  const x = (i: number) => ML + (n === 1 ? 0 : (i / (n - 1)) * plotW);
  const y = (v: number) => MT + (1 - (v - yMin) / (yMax - yMin)) * plotH;
  const pts = history.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const last = history[n - 1];
  const rising = last >= history[0];
  const stroke = rising ? "#16a34a" : "#dc2626";

  // Question-axis ticks at round numbers only — every 10, or every 100 once
  // there's a long history — so labels stay clean instead of arbitrary counts.
  const xStep = games - firstGame > 80 ? 100 : 10;
  const xForGame = (g: number) =>
    ML + (n === 1 ? 0 : ((g - firstGame) / (n - 1)) * plotW);
  const xTicks: number[] = [];
  for (let g = Math.ceil(firstGame / xStep) * xStep; g <= games; g += xStep) {
    xTicks.push(g);
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label="Rating over questions played"
    >
      {yTicks.map((v) => (
        <g key={v}>
          <line
            x1={ML}
            x2={W - MR}
            y1={y(v)}
            y2={y(v)}
            stroke="rgba(10,10,10,0.07)"
            strokeWidth={1}
          />
          <text
            x={ML - 6}
            y={y(v)}
            textAnchor="end"
            dominantBaseline="central"
            fill="#6b7280"
            fontSize="9"
          >
            {v}
          </text>
        </g>
      ))}
      {xTicks.map((g) => {
        const gx = xForGame(g);
        const anchor =
          gx < ML + 10 ? "start" : gx > W - MR - 10 ? "end" : "middle";
        return (
          <text
            key={g}
            x={gx}
            y={H - 4}
            textAnchor={anchor}
            fill="#6b7280"
            fontSize="9"
          >
            {g}
          </text>
        );
      })}
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
  onReset,
}: {
  state: EloState;
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
  const status = STATUS[eloStatus(state)];
  const StatusIcon = status.Icon;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative flex shrink-0 items-center gap-1.5 rounded-full border border-white/70 bg-white/55 px-3 py-1.5 text-xs backdrop-blur transition hover:bg-white/85 focus-ring"
        aria-label={`Your rating ${state.rating}, ${status.label} — open history`}
        title={`Your rating — ${status.label}. Tap for history`}
      >
        <StatusIcon size={13} className={status.cls} strokeWidth={2.2} />
        <span className="text-ink-muted">Elo</span>
        <span className="font-semibold tabular-nums text-ink">{state.rating}</span>
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
              <RatingChart history={state.history} games={state.games} />
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
