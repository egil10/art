"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Search,
  X as XIcon,
  Loader2,
  Filter,
  ExternalLink,
  Flag,
  ChevronLeft,
  ChevronRight,
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
import { Wordmark } from "@/components/Wordmark";

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
        {/* No solid band — each control is its own frosted pill floating over
            the gallery as it scrolls underneath. */}
        <div className="mx-auto max-w-6xl px-4 py-2.5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2">
                <Wordmark />
                <Link
                  href="/"
                  className="pill-glass focus-ring"
                  aria-label="Back to quiz"
                >
                  <ArrowLeft size={15} strokeWidth={2} />
                  <span className="hidden sm:inline">Quiz</span>
                </Link>
                <span className="hidden text-xs text-ink-muted sm:inline">
                  Gallery
                </span>
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
                    className="w-full rounded-full border border-white/70 bg-white/60 py-2 pl-9 pr-9 text-sm text-ink shadow-sm backdrop-blur-md placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-black/15"
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
            <FilterStrip category={category} onSelect={setCategory} />
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

function FilterStrip({
  category,
  onSelect,
}: {
  category: CategoryKey;
  onSelect: (key: CategoryKey) => void;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);
  // Tracks an in-progress mouse drag so the click that ends it doesn't also
  // trigger a category change. `captured` is set only once a drag actually
  // starts — capturing on press would route the click to this container
  // instead of the pill button, swallowing plain clicks.
  const drag = useRef({
    active: false,
    startX: 0,
    startScroll: 0,
    moved: false,
    captured: false,
    pointerId: -1,
  });

  const updateArrows = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 2);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    updateArrows();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateArrows, { passive: true });
    window.addEventListener("resize", updateArrows);
    return () => {
      el.removeEventListener("scroll", updateArrows);
      window.removeEventListener("resize", updateArrows);
    };
  }, [updateArrows]);

  // Translate a plain vertical mouse wheel into horizontal scrolling so the
  // strip is browsable without a trackpad's sideways swipe. Attached natively
  // (non-passive) because React's onWheel is passive and can't preventDefault.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      if (!el || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      if (el.scrollWidth <= el.clientWidth) return;
      el.scrollLeft += e.deltaY;
      e.preventDefault();
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  function nudge(dir: 1 | -1) {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.7, behavior: "smooth" });
  }

  // Mouse-only drag-to-scroll — touch keeps its native momentum scrolling.
  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType !== "mouse") return;
    const el = scrollRef.current;
    if (!el) return;
    // Note: no setPointerCapture here — capturing on press would make the
    // browser dispatch the click to this container rather than the pill,
    // breaking plain clicks. We capture lazily in onPointerMove once a real
    // drag begins.
    drag.current = {
      active: true,
      startX: e.clientX,
      startScroll: el.scrollLeft,
      moved: false,
      captured: false,
      pointerId: e.pointerId,
    };
  }
  function onPointerMove(e: React.PointerEvent) {
    const el = scrollRef.current;
    if (!el || !drag.current.active) return;
    const dx = e.clientX - drag.current.startX;
    if (Math.abs(dx) > 4) {
      drag.current.moved = true;
      // Now that we know it's a drag (not a click), capture the pointer so the
      // scroll keeps tracking even if the cursor leaves the strip.
      if (!drag.current.captured) {
        el.setPointerCapture(e.pointerId);
        drag.current.captured = true;
      }
      el.scrollLeft = drag.current.startScroll - dx;
    }
  }
  function onPointerUp(e: React.PointerEvent) {
    if (!drag.current.active) return;
    drag.current.active = false;
    if (drag.current.captured) {
      scrollRef.current?.releasePointerCapture(e.pointerId);
      drag.current.captured = false;
    }
  }

  return (
    <div className="mt-2 flex items-center gap-1">
      <button
        type="button"
        onClick={() => nudge(-1)}
        tabIndex={-1}
        aria-hidden={!canLeft}
        aria-label="Scroll filters left"
        className={
          "grid h-8 w-8 flex-none place-items-center rounded-full border border-white/70 bg-white/80 text-ink/70 shadow-sm backdrop-blur-md transition hover:bg-white hover:text-ink focus-ring " +
          (canLeft ? "opacity-100" : "pointer-events-none opacity-0")
        }
      >
        <ChevronLeft size={16} />
      </button>

      <div
        ref={scrollRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto px-1 pb-1 no-scrollbar cursor-grab select-none active:cursor-grabbing"
      >
        <span className="pill shrink-0 border border-white/70 bg-white/75 text-ink-muted shadow-sm backdrop-blur-md">
          <Filter size={13} />
          <span className="text-[11px]">Filter</span>
        </span>
        {CATEGORIES.map((c) => {
          const active = c.key === category;
          return (
            <button
              key={c.key}
              onClick={() => {
                if (drag.current.moved) return;
                onSelect(c.key);
              }}
              className={
                "pill shrink-0 focus-ring border transition " +
                (active
                  ? "border-ink bg-ink text-white shadow-sm"
                  : "border-white/70 bg-white/80 text-ink/85 shadow-sm backdrop-blur-md hover:bg-white")
              }
            >
              {c.label}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => nudge(1)}
        tabIndex={-1}
        aria-hidden={!canRight}
        aria-label="Scroll filters right"
        className={
          "grid h-8 w-8 flex-none place-items-center rounded-full border border-white/70 bg-white/80 text-ink/70 shadow-sm backdrop-blur-md transition hover:bg-white hover:text-ink focus-ring " +
          (canRight ? "opacity-100" : "pointer-events-none opacity-0")
        }
      >
        <ChevronRight size={16} />
      </button>
    </div>
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
