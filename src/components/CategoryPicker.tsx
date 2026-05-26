"use client";

import { CATEGORIES, paintingsFor, type CategoryKey } from "@/lib/paintings";
import { Brush, ArrowRight } from "lucide-react";
import { useMemo } from "react";

const ICON_SIZE = 16;

export function CategoryPicker({
  onPick,
}: {
  onPick: (c: CategoryKey) => void;
}) {
  const stats = useMemo(() => {
    const m: Record<string, { count: number; artists: number }> = {};
    for (const c of CATEGORIES) {
      const list = paintingsFor(c.key);
      const a = new Set(list.map((p) => p.artist));
      m[c.key] = { count: list.length, artists: a.size };
    }
    return m;
  }, []);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:py-14">
      <div className="mb-8 sm:mb-12 animate-fade-up">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/55 px-3 py-1 text-xs font-medium text-ink/80 backdrop-blur border border-white/70">
          <Brush size={ICON_SIZE - 2} />
          Canvas
        </div>
        <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight text-ink">
          Guess the painter.
        </h1>
        <p className="mt-2 max-w-md text-sm sm:text-base text-ink-muted">
          An endless multiple-choice quiz over a thousand of the world&rsquo;s most famous
          paintings. Pick a collection to begin.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 animate-fade-up">
        {CATEGORIES.map((c) => {
          const s = stats[c.key];
          return (
            <button
              key={c.key}
              onClick={() => onPick(c.key)}
              className="group relative overflow-hidden rounded-2xl border border-white/70 bg-white/60 p-4 text-left backdrop-blur transition hover:bg-white/85 focus-ring"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-ink">
                    {c.label}
                  </div>
                  <div className="text-xs text-ink-muted">{c.hint}</div>
                </div>
                <ArrowRight
                  size={16}
                  className="mt-1 text-ink-muted transition group-hover:translate-x-0.5 group-hover:text-ink"
                />
              </div>
              <div className="mt-4 flex items-center gap-3 text-[11px] text-ink-muted">
                <span>
                  <span className="tabular-nums font-semibold text-ink">
                    {s.count.toLocaleString()}
                  </span>{" "}
                  paintings
                </span>
                <span className="h-1 w-1 rounded-full bg-black/15" />
                <span>
                  <span className="tabular-nums font-semibold text-ink">
                    {s.artists.toLocaleString()}
                  </span>{" "}
                  artists
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <p className="mt-10 text-center text-[11px] text-ink-muted">
        Paintings &amp; metadata from Wikimedia · Press a number or tap to answer
      </p>
    </div>
  );
}
