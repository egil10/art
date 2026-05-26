"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Search,
  X as XIcon,
  Loader2,
  Filter,
  ExternalLink,
  Flag,
} from "lucide-react";
import {
  CATEGORIES,
  categoryLabel,
  imageUrl,
  paintingsFor,
  wikipediaUrl,
  type CategoryKey,
  type Painting,
} from "@/lib/paintings";
import { usePaintings } from "@/lib/usePaintings";
import { reportPainting } from "@/lib/reports";

const PAGE = 90; // paintings per "page" — infinite scroll

export default function GalleryPage() {
  const { paintings, error, loading } = usePaintings();
  const [category, setCategory] = useState<CategoryKey>("popular");
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(PAGE);
  const [selected, setSelected] = useState<Painting | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const filtered = useMemo(() => {
    if (!paintings) return [];
    const cat = paintingsFor(paintings, category);
    const q = query.trim().toLowerCase();
    if (!q) return cat;
    return cat.filter(
      (p) =>
        p.artist.toLowerCase().includes(q) ||
        p.title.toLowerCase().includes(q) ||
        (p.mv && p.mv.toLowerCase().includes(q)) ||
        (p.loc && p.loc.toLowerCase().includes(q)),
    );
  }, [paintings, category, query]);

  useEffect(() => {
    setVisible(PAGE);
  }, [category, query]);

  // Infinite scroll
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisible((v) => Math.min(v + PAGE, filtered.length));
        }
      },
      { rootMargin: "600px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [filtered.length]);

  useEffect(() => {
    if (!selected) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSelected(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  return (
    <main className="min-h-dvh">
      {/* Sticky top toolbar */}
      <header className="sticky top-0 z-30">
        <div className="mx-auto max-w-6xl px-4 pt-3">
          <div className="glass-strong flex flex-col gap-2 rounded-2xl px-2 py-2 sm:flex-row sm:items-center">
            <div className="flex items-center gap-1.5 pl-1">
              <Link
                href="/"
                className="pill-glass focus-ring"
                aria-label="Back to quiz"
              >
                <ArrowLeft size={15} strokeWidth={2} />
                <span className="hidden sm:inline">Quiz</span>
              </Link>
              <span className="hidden text-xs text-ink-muted sm:inline">Gallery</span>
            </div>

            <div className="flex flex-1 items-center gap-1.5">
              <label className="relative flex-1">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
                />
                <input
                  type="search"
                  inputMode="search"
                  autoComplete="off"
                  placeholder="Search painters, paintings, museums…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full rounded-full border border-white/70 bg-white/60 py-2 pl-9 pr-9 text-sm text-ink placeholder:text-ink-muted backdrop-blur focus:outline-none focus:ring-2 focus:ring-black/15"
                />
                {query && (
                  <button
                    onClick={() => setQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 grid h-6 w-6 place-items-center rounded-full text-ink-muted hover:bg-black/[0.06]"
                    aria-label="Clear search"
                  >
                    <XIcon size={13} />
                  </button>
                )}
              </label>
            </div>
          </div>

          {/* Category strip */}
          <div className="mt-2 -mx-1 flex items-center gap-1.5 overflow-x-auto pb-2 px-1 no-scrollbar">
            <span className="pill-glass shrink-0 text-ink-muted">
              <Filter size={13} />
              <span className="text-[11px]">Filter</span>
            </span>
            {CATEGORIES.map((c) => {
              const active = c.key === category;
              return (
                <button
                  key={c.key}
                  onClick={() => setCategory(c.key)}
                  className={
                    "pill shrink-0 focus-ring border transition " +
                    (active
                      ? "bg-ink text-white border-ink"
                      : "bg-white/55 text-ink/85 border-white/70 backdrop-blur hover:bg-white/80")
                  }
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Grid */}
      <section className="mx-auto max-w-6xl px-4 pt-2">
        {loading && (
          <div className="grid place-items-center py-24 text-sm text-ink-muted">
            <div className="flex items-center gap-2">
              <Loader2 className="animate-spin" size={16} /> Loading the gallery…
            </div>
          </div>
        )}
        {error && (
          <div className="py-24 text-center text-sm text-red-700">{error.message}</div>
        )}
        {!loading && !error && (
          <>
            <div className="mb-3 px-1 text-[11px] text-ink-muted">
              <span className="tabular-nums font-semibold text-ink">
                {filtered.length.toLocaleString()}
              </span>{" "}
              {filtered.length === 1 ? "painting" : "paintings"}
              {query && (
                <>
                  {" "}
                  matching <span className="text-ink">&ldquo;{query}&rdquo;</span>
                </>
              )}{" "}
              in <span className="text-ink">{categoryLabel(category)}</span>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {filtered.slice(0, visible).map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelected(p)}
                  className="group relative overflow-hidden rounded-2xl border border-white/60 bg-white/60 text-left backdrop-blur transition hover:shadow-lg focus-ring"
                >
                  <div className="aspect-[4/5] w-full bg-canvas-warm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageUrl(p.image, 320)}
                      alt={p.title}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                    />
                  </div>
                  <div className="px-2.5 py-2">
                    <div className="truncate text-[12px] font-medium text-ink">
                      {p.title}
                    </div>
                    <div className="truncate text-[11px] text-ink-muted">
                      {p.artist}
                      {p.year ? ` · ${p.year}` : ""}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {filtered.length === 0 && (
              <div className="grid place-items-center py-20 text-sm text-ink-muted">
                Nothing matches that search.
              </div>
            )}

            <div ref={sentinelRef} className="h-12" />
          </>
        )}
      </section>

      {selected && (
        <PaintingDetail painting={selected} onClose={() => setSelected(null)} />
      )}

      <div className="h-10" />
    </main>
  );
}

function PaintingDetail({
  painting,
  onClose,
}: {
  painting: Painting;
  onClose: () => void;
}) {
  const [reported, setReported] = useState(false);
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 animate-fade-in"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/35 backdrop-blur"
      />
      <div className="relative w-full max-w-3xl animate-fade-up">
        <div className="glass-strong overflow-hidden rounded-3xl">
          <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                {painting.cats.filter((c) => c !== "all").slice(0, 3).map(categoryLabel).join(" · ")}
              </div>
              <h2 className="mt-1 truncate text-xl font-semibold text-ink">
                {painting.title}
              </h2>
              <div className="mt-0.5 text-sm text-ink/80">
                {painting.artist}
                {painting.year ? ` · ${painting.year}` : ""}
              </div>
            </div>
            <button
              onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-full bg-black/[0.06] text-ink/70 hover:bg-black/[0.1] hover:text-ink focus-ring"
              aria-label="Close"
            >
              <XIcon size={16} />
            </button>
          </div>
          <div className="relative aspect-[16/11] w-full bg-canvas-warm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl(painting.image, 1600)}
              alt={painting.title}
              className="h-full w-full object-contain"
            />
          </div>
          <div className="px-5 py-3 text-[12px] text-ink-muted">
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {painting.mv && (
                <span>
                  <span>Movement </span>
                  <span className="text-ink/85">{painting.mv}</span>
                </span>
              )}
              {painting.g && (
                <span>
                  <span>Genre </span>
                  <span className="text-ink/85">{painting.g}</span>
                </span>
              )}
              {painting.loc && (
                <span>
                  <span>Location </span>
                  <span className="text-ink/85">{painting.loc}</span>
                </span>
              )}
            </div>
            <div className="mt-3 flex items-center gap-1.5">
              <a
                href={wikipediaUrl(painting.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="pill-glass focus-ring text-[12px]"
              >
                <ExternalLink size={13} />
                Wikipedia
              </a>
              <button
                onClick={() => {
                  reportPainting(painting);
                  setReported(true);
                }}
                disabled={reported}
                className={
                  "pill focus-ring text-[12px] " +
                  (reported
                    ? "bg-black/5 text-ink-muted cursor-default"
                    : "glass text-ink/80 hover:text-ink")
                }
              >
                <Flag size={13} />
                {reported ? "Reported" : "Report"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
