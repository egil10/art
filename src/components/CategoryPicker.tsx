"use client";

import { CATEGORIES, paintingsFor, type CategoryKey, type Painting } from "@/lib/paintings";
import { X, Check } from "lucide-react";
import { useEffect, useMemo } from "react";

const GROUP_TITLES: Record<string, string> = {
  starts: "Start here",
  movement: "By movement",
  subject: "By subject",
  origin: "By origin",
};

export function CategoryPicker({
  paintings,
  current,
  onPick,
  onClose,
}: {
  paintings: Painting[];
  current: CategoryKey;
  onPick: (c: CategoryKey) => void;
  onClose: () => void;
}) {
  const stats = useMemo(() => {
    const m: Record<string, { count: number; artists: number }> = {};
    for (const c of CATEGORIES) {
      const list = paintingsFor(paintings, c.key);
      const a = new Set(list.map((p) => p.artist));
      m[c.key] = { count: list.length, artists: a.size };
    }
    return m;
  }, [paintings]);

  const grouped = useMemo(() => {
    const g: Record<string, typeof CATEGORIES> = {};
    for (const c of CATEGORIES) {
      (g[c.group] = g[c.group] || []).push(c);
    }
    return g;
  }, []);

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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-2 sm:p-6 animate-fade-in"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 frost-backdrop"
      />

      <div className="relative w-full max-w-2xl animate-fade-up">
        <div className="frost rounded-3xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                Collections
              </div>
              <div className="text-lg font-semibold text-ink">Pick a set</div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="grid h-9 w-9 place-items-center rounded-full bg-black/[0.05] text-ink/70 transition hover:bg-black/[0.08] hover:text-ink focus-ring"
            >
              <X size={16} />
            </button>
          </div>

          <div className="max-h-[70vh] overflow-y-auto px-3 pb-4">
            {(["starts", "movement", "subject", "origin"] as const).map((group) => (
              <div key={group} className="mb-3">
                <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                  {GROUP_TITLES[group]}
                </div>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {grouped[group].map((c) => {
                    const s = stats[c.key];
                    const active = current === c.key;
                    return (
                      <button
                        key={c.key}
                        onClick={() => onPick(c.key)}
                        className={
                          "group flex items-center justify-between rounded-2xl border px-3 py-2.5 text-left transition focus-ring " +
                          (active
                            ? "border-ink/15 bg-ink text-white"
                            : "border-black/[0.06] bg-white/90 hover:bg-white")
                        }
                      >
                        <div className="min-w-0">
                          <div
                            className={
                              "text-sm font-semibold " +
                              (active ? "text-white" : "text-ink")
                            }
                          >
                            {c.label}
                          </div>
                          <div
                            className={
                              "text-[11px] " +
                              (active ? "text-white/70" : "text-ink-muted")
                            }
                          >
                            {c.hint}
                          </div>
                        </div>
                        <div
                          className={
                            "flex items-center gap-2 text-[11px] tabular-nums " +
                            (active ? "text-white/70" : "text-ink-muted")
                          }
                        >
                          <span>
                            {s.count.toLocaleString()} · {s.artists}
                          </span>
                          {active && <Check size={14} />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
