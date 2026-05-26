"use client";

import { useEffect, useMemo } from "react";
import { X, Check, User, Type, Brush, Globe2, Calendar } from "lucide-react";
import {
  GAME_MODES,
  modeTarget,
  paintingsFor,
  paintingsForMode,
  type CategoryKey,
  type GameMode,
  type Painting,
} from "@/lib/paintings";

const MODE_ICONS: Record<GameMode, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  painter: User,
  title: Type,
  movement: Brush,
  country: Globe2,
  decade: Calendar,
};

export function ModePicker({
  paintings,
  category,
  current,
  onPick,
  onClose,
}: {
  paintings: Painting[];
  category: CategoryKey;
  current: GameMode;
  onPick: (m: GameMode) => void;
  onClose: () => void;
}) {
  const stats = useMemo(() => {
    const inCategory = paintingsFor(paintings, category);
    const m: Record<string, { count: number; distinct: number }> = {};
    for (const g of GAME_MODES) {
      const pool = paintingsForMode(inCategory, g.key);
      const distinct = new Set<string>();
      for (const p of pool) {
        const t = modeTarget(p, g.key);
        if (t) distinct.add(t);
      }
      m[g.key] = { count: pool.length, distinct: distinct.size };
    }
    return m;
  }, [paintings, category]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center p-2 sm:items-center sm:p-6 animate-fade-in"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 frost-backdrop"
      />

      <div className="relative w-full max-w-md animate-fade-up">
        <div className="frost overflow-hidden rounded-3xl">
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                Game mode
              </div>
              <div className="text-lg font-semibold text-ink">What are we guessing?</div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="grid h-9 w-9 place-items-center rounded-full bg-black/[0.05] text-ink/70 hover:bg-black/[0.08] hover:text-ink focus-ring"
            >
              <X size={16} />
            </button>
          </div>

          <ul className="px-3 pb-4">
            {GAME_MODES.map((m) => {
              const Icon = MODE_ICONS[m.key];
              const active = m.key === current;
              const s = stats[m.key];
              // Need at least 4 distinct answers (for the four choices) and a
              // pool big enough to keep variety across a session.
              const disabled = s.count < 8 || s.distinct < 4;
              const reason = s.distinct < 4
                ? "Only one possible answer"
                : s.count < 8
                  ? "Not enough paintings"
                  : null;
              return (
                <li key={m.key}>
                  <button
                    onClick={() => !disabled && onPick(m.key)}
                    disabled={disabled}
                    className={
                      "mb-1.5 flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition focus-ring " +
                      (active
                        ? "border-ink/15 bg-ink text-white"
                        : disabled
                          ? "cursor-not-allowed border-black/[0.06] bg-white/40 text-ink-muted"
                          : "border-black/[0.06] bg-white/90 hover:bg-white")
                    }
                  >
                    <span
                      className={
                        "grid h-9 w-9 shrink-0 place-items-center rounded-xl " +
                        (active ? "bg-white/15" : "bg-black/[0.05]")
                      }
                    >
                      <Icon size={16} strokeWidth={2} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={"block text-sm font-semibold " + (active ? "text-white" : "text-ink")}>
                        {m.label}
                      </span>
                      <span className={"block text-[11px] " + (active ? "text-white/70" : "text-ink-muted")}>
                        {disabled && reason ? reason : m.hint}
                      </span>
                    </span>
                    <span
                      className={
                        "text-[11px] tabular-nums " +
                        (active ? "text-white/75" : "text-ink-muted")
                      }
                    >
                      {disabled ? "—" : `${s.count.toLocaleString()}`}
                    </span>
                    {active && <Check size={14} className="ml-1 text-white" />}
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="border-t border-black/[0.05] bg-white/40 px-5 py-2.5 text-[11px] text-ink-muted">
            Counts are paintings in the current category that have the data for that mode.
          </div>
        </div>
      </div>
    </div>
  );
}
