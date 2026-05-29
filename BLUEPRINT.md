# Quiz Site Blueprint

A portable spec for rebuilding a quiz website with the same look, feel, and
architecture as **Canvas** (a "guess the painter" art quiz). Drop this file into
a fresh repo and hand it to a coding agent: it captures the design system,
UX principles, and code patterns so you can re-skin the framework for any
multiple-choice topic (flags, capitals, logos, movies, pokémon, etc.).

> When adapting: keep the **design system** and **architecture** verbatim, and
> swap only the **data model** + **game modes** for your topic. The whole feel
> comes from the glass/pill language and the "instant, keyboard-first, no layout
> jump" interaction rules below — preserve those.

---

## 1. What this is

An **endless multiple-choice quiz**. One question at a time: a prompt (here, a
painting image) plus four answer pills. Pick one → instant reveal (correct /
not quite) with context → next. No scoring screen, no "game over" — you just
keep going. A searchable **gallery** browses the full dataset, and an **Elo
rating** (per-device) tracks skill over time.

Core feeling to preserve:
- **Instant.** Data is bundled/preloaded; the next few questions' images
  prefetch so advancing never waits on the network.
- **Keyboard-first.** `1`–`4` to answer, `Enter`/`Space`/`→` for next.
- **No layout jump.** The reveal panel is fixed-height; answering never shifts
  the page. Auto-advance is optional and user-controlled.
- **Calm, glassy, paper-warm.** Frosted translucent surfaces floating over a
  soft warm-paper gradient. No hard chrome, no solid toolbars.

---

## 2. Tech stack

- **Next.js (App Router)** + **React 19**, all `"use client"` components — it's
  a client-side SPA-style app served statically.
- **TypeScript**, strict.
- **Tailwind CSS** with a small custom design-token layer (below).
- **lucide-react** for icons.
- **No backend, no database.** Data is a static JSON file in `public/`.
  Per-user state (rating, prefs, reports) lives in `localStorage`.
- **Deploys to Vercel** as fully static pages.

```
src/
  app/
    layout.tsx        # root html/body, metadata, viewport
    globals.css       # design tokens + component classes (the design system)
    page.tsx          # quiz route — owns category/mode state, renders <Quiz>
    gallery/page.tsx  # searchable grid + filter strip + detail modal
  components/
    Quiz.tsx          # the game: reducer state machine, reveal panels, streaks
    EloBadge.tsx      # top-right rating badge + history sparkline panel
    CategoryPicker.tsx / ModePicker.tsx  # full-screen choosers
    ReportsModal.tsx  # queue of user-flagged items
  lib/
    paintings.ts      # data types, category/mode defs, choice builder, seeded RNG
    usePaintings.ts   # fetch + in-memory cache of the dataset
    elo.ts            # pure Elo maths + localStorage persistence
    reports.ts        # localStorage-backed "report this item" queue
  scripts/
    fetch-*.mjs       # data pipeline (queries a source, writes public/data.json)
public/
  paintings.json      # the dataset, sorted by "fame" (most notable first)
```

---

## 3. Design system (copy this verbatim)

The entire visual identity is ~170 lines of CSS plus a handful of Tailwind
tokens. Reproduce both files and you have the look.

### 3.1 Tailwind tokens (`tailwind.config.ts`)

```ts
theme: {
  extend: {
    fontFamily: {
      sans: ["ui-sans-serif","-apple-system","BlinkMacSystemFont","Inter","SF Pro Text","Segoe UI","sans-serif"],
    },
    colors: {
      ink:    { DEFAULT: "#0a0a0a", soft: "#1c1c1e", muted: "#6b7280" },
      canvas: { DEFAULT: "#fafaf7", warm: "#f3efe7" },
    },
    backdropBlur: { xs: "2px" },
    animation: {
      "fade-in": "fadeIn 220ms ease-out both",
      "fade-up": "fadeUp 260ms cubic-bezier(.2,.7,.2,1) both",
      "pop":     "pop 260ms cubic-bezier(.2,.9,.3,1.2) both",
    },
    keyframes: {
      fadeIn: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
      fadeUp: { "0%": { opacity:"0", transform:"translateY(6px)" }, "100%": { opacity:"1", transform:"translateY(0)" } },
      pop:    { "0%": { transform:"scale(.98)", opacity:"0" }, "100%": { transform:"scale(1)", opacity:"1" } },
    },
  },
}
```

### 3.2 Tokens + component classes (`globals.css`)

```css
@tailwind base; @tailwind components; @tailwind utilities;

:root {
  --canvas: #fafaf7;        --canvas-warm: #f3efe7;
  --ink: #0a0a0a;           --ink-soft: #1c1c1e;   --ink-muted: #6b7280;
  --hairline: rgba(10,10,10,0.08);
  --glass-bg: rgba(255,255,255,0.55);
  --glass-bg-strong: rgba(255,255,255,0.78);
  --glass-stroke: rgba(255,255,255,0.7);
  --accent: #0a0a0a;        --good: #16a34a;       --bad: #dc2626;
}

/* The signature backdrop: warm + cool radial glows over near-white paper. */
html, body {
  background:
    radial-gradient(1200px 600px at 80% -10%, #ffeed8 0%, transparent 60%),
    radial-gradient(900px 500px at 10% 100%, #e7eaff 0%, transparent 55%),
    var(--canvas);
  background-attachment: fixed;
  color: var(--ink);
  -webkit-font-smoothing: antialiased;
  font-feature-settings: "ss01", "cv11";
}
* { -webkit-tap-highlight-color: transparent; }
button { font: inherit; }

@layer components {
  /* Translucent floating surfaces. `glass` for pills/cards, `glass-strong`
     for the main content card, `frost` for modals (near-opaque so text reads). */
  .glass {
    background: var(--glass-bg);
    backdrop-filter: saturate(180%) blur(20px); -webkit-backdrop-filter: saturate(180%) blur(20px);
    border: 1px solid var(--glass-stroke);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.7), 0 1px 2px rgba(10,10,10,.04), 0 12px 32px -12px rgba(10,10,10,.18);
  }
  .glass-strong {
    background: var(--glass-bg-strong);
    backdrop-filter: saturate(180%) blur(24px); -webkit-backdrop-filter: saturate(180%) blur(24px);
    border: 1px solid var(--glass-stroke);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.8), 0 1px 2px rgba(10,10,10,.05), 0 16px 40px -16px rgba(10,10,10,.2);
  }
  .frost {
    background: rgba(252,251,247,.94);
    backdrop-filter: saturate(180%) blur(32px); -webkit-backdrop-filter: saturate(180%) blur(32px);
    border: 1px solid rgba(255,255,255,.85);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.9), 0 1px 2px rgba(10,10,10,.04), 0 28px 80px -24px rgba(10,10,10,.35);
  }
  .frost-backdrop {
    background: rgba(20,20,25,.32);
    backdrop-filter: saturate(150%) blur(18px); -webkit-backdrop-filter: saturate(150%) blur(18px);
  }
  /* Pills are the universal control. One base, three fills. */
  .pill       { @apply inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium select-none transition; }
  .pill-ghost { @apply pill text-ink/80 hover:text-ink hover:bg-black/[0.04]; }
  .pill-solid { @apply pill bg-black text-white hover:bg-black/85; }
  .pill-glass { @apply pill glass text-ink/90 hover:text-ink; }
  .focus-ring { @apply outline-none focus-visible:ring-2 focus-visible:ring-black/30 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas; }
}

/* Thin floating-capsule scrollbars (replaces chunky Windows default). */
*::-webkit-scrollbar { width: 12px; height: 12px; }
*::-webkit-scrollbar-track { background: transparent; }
*::-webkit-scrollbar-thumb { background: rgba(10,10,10,.16); border: 3px solid transparent; border-radius: 999px; background-clip: padding-box; }
*::-webkit-scrollbar-thumb:hover { background-color: rgba(10,10,10,.32); background-clip: padding-box; }
* { scrollbar-width: thin; scrollbar-color: rgba(10,10,10,.18) transparent; }
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
```

### 3.3 Visual rules of thumb

- **Surfaces float; nothing is a solid bar.** Toolbars are a row of individual
  frosted pills over the scrolling content (`sticky top-0 z-30`, no background
  band). Cards use `glass-strong` with large soft shadows and `rounded-[28px]`.
- **Radii are generous:** pills are full `rounded-full`; cards `rounded-[28px]`
  / `rounded-3xl`; inner chips `rounded-2xl`.
- **Color is restrained.** Almost everything is `ink` on `canvas`. Use
  `text-ink-muted` (#6b7280) for secondary text. Reserve green (`--good`) and
  red (`--bad`) strictly for correct/incorrect feedback. One amber accent for
  streaks/achievements.
- **Type:** system sans stack, tight headings (`font-bold leading-tight`), tiny
  uppercase labels (`text-[11px] font-semibold uppercase tracking-wider text-ink-muted`).
- **Numbers use `tabular-nums`** so scores/ratings don't jitter.
- **Motion is brief and soft:** `animate-pop` for entering cards, `animate-fade-up`
  for reveals/flashes, `animate-fade-in` for modal backdrops. Always respect
  `prefers-reduced-motion`.

---

## 4. UX patterns (the parts that make it feel good)

1. **Fixed-height reveal, no jump.** Desktop uses a fixed-width side panel that
   swaps between an "idle" state (round number, mode, best streak) and a
   "reveal" state (correct/not + the answer + context). The prompt card never
   resizes. Mobile shows the reveal as an overlay pinned to the bottom of the
   image.
2. **Keyboard-first.** Global `keydown`: digits `1`–`4` answer while idle;
   `Enter`/`Space`/`→` advance after answering. Ignore keys when focus is in an
   input.
3. **Optional auto-advance.** A pill cycles Manual → 1s → 3s → 5s; persisted to
   `localStorage`. A timer fires `next` after the reveal.
4. **Image preloading.** Maintain a small look-ahead queue (the next ~3
   questions). On each render, `new Image()` their sources so advancing is
   instant. The dataset itself is fetched once and cached in a module-level
   variable.
5. **Streaks + celebration.** Track current/best streak; a dot tracker fills
   toward a goal (10), and crossing a multiple fires a confetti "diploma" modal.
6. **Review mode.** Wrong answers go into a capped queue; when "Review" is on,
   there's a probability each round re-surfaces an item you missed.
7. **Report flow.** Every item has a flag button that copies a markdown line to
   the clipboard and queues it in `localStorage` — a zero-backend way to collect
   data-quality feedback ("paste it back in chat").
8. **Per-device Elo (see §6).** Top-right badge; click for a sparkline history.

---

## 5. Data model + pipeline

The dataset is a flat JSON array in `public/`, **sorted by notability** (most
famous first) — that ordering is itself a signal (used for "Popular" tagging and
Elo difficulty). Each item is small and self-describing:

```ts
type Item = {
  id: string;            // stable source id (e.g. Wikidata Q-number)
  title: string;
  artist: string;        // the primary "answer" field
  year: string | null;
  image: string;         // source filename, resolved to a URL at render
  cats: string[];        // category tags this item belongs to
  mv: string | null;     // extra facets usable as alternate answer modes
  loc: string | null;
  g: string | null;
};
```

**Categories** are declared as a typed list (`key`, `label`, `hint`, `group`),
grouped for the picker UI (e.g. "starts", "movement", "subject", "origin").
Filtering is just `items.filter(i => i.cats.includes(key))`.

**Game modes** turn different fields into the answer. Each mode is `(item) =>
answerString | null`; items lacking that field are filtered out of the pool for
that mode. Modes here: painter / title / movement / country / decade.

**Choice builder:** take the correct answer, then pull 3 distinct distractors of
the same type from the pool, shuffle. Use a **seeded RNG** (small mulberry32-style
PRNG) so question generation is deterministic per seed — important for the
weighted picker and reproducibility.

**Smart question picker** (the thing that stops it feeling repetitive): sample K
candidates and weight them by
- strong penalty if the item was shown recently,
- decaying penalty if the *answer* (artist) appeared recently,
- a `1/sqrt(frequency)` boost so under-represented answers surface more —
then pick proportionally. Keep a recency window for items and for answers,
scaled to pool size.

**Pipeline (`scripts/fetch-*.mjs`):** queries a structured source (here Wikidata
SPARQL, tiered by sitelink count as a fame proxy), keeps the top N per answer to
avoid one painter dominating, sorts by fame, tags categories, writes
`public/data.json`. Bump a `DATA_VERSION` constant in the loader to bust browser
cache when you regenerate. For a new topic, replace this script with whatever
yields your `Item[]`.

---

## 6. Elo rating (per-device, no backend)

Each question is a "match": the player (rating starts 1200) vs the item's
**difficulty**, derived from its fame rank (obscure = stronger opponent, worth
more). Standard logistic Elo:

```
expected = 1 / (1 + 10^((opponent - rating) / 400))
rating   = rating + K * ((won ? 1 : 0) - expected)   // floored at 100
```

- **Opponent rating** from rank: `MIN_OPP + (rank/(total-1)) * (MAX_OPP-MIN_OPP)`,
  e.g. 700→2000.
- **K-factor** tapers as you settle: 40 (<30 games) → 24 (<100) → 16.
- **Persistence:** all state (`rating, peak, games, wins, history[]`) in
  `localStorage` under a versioned key, behind `loadElo()/saveElo()` so it's
  trivial to swap in a server later for cross-device accounts + leaderboards.
- **UI:** a top-right pill shows the live rating with a `+N/-N` flash per answer;
  clicking opens a `frost` panel with an inline SVG **sparkline** of the rating
  history, plus peak / games / accuracy and a reset.

**Persistence pattern (reuse for everything device-local):**

```ts
const KEY = "app.feature.v1";          // always versioned
export function load(): T {
  if (typeof window === "undefined") return def();   // SSR-safe
  try { return { ...def(), ...JSON.parse(localStorage.getItem(KEY) || "") }; }
  catch { return def(); }
}
export function save(s: T) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
}
```

Hydrate after mount (`useState(def)` then `useEffect(() => setState(load()), [])`)
so server and client render the same default and avoid hydration mismatch.

---

## 7. Game state shape

`Quiz` is a `useReducer` state machine — keep it **pure** (no `localStorage`/IO
in the reducer; do side effects in effects). Sketch:

```ts
type Phase = "idle" | "answered";
type State = {
  current: Round | null;     // { item, choices[], target }
  queue: Round[];            // look-ahead for preloading
  recent: Set<string>;       // item recency window
  recentArtists: string[];   // answer recency window
  wrong: string[];           // review queue (capped)
  picked: string | null;
  phase: Phase;
  score: number; streak: number; best: number; total: number;
  seed: number;
};
type Action =
  | { type: "answer"; choice: string }
  | { type: "next";  pool; mode; artistFreq; review: boolean }
  | { type: "reset"; pool; mode; artistFreq; seed: number };
```

On `answer`: mark phase answered, update score/streak/best, push/clear the
review queue. On `next`: maybe inject a review item, else shift from the
look-ahead queue and top it back up (weighted picker), advance recency windows.
Score Elo in an **effect** keyed on the phase transition, guarded by a ref so
each round scores exactly once.

---

## 8. Component inventory

- **`<Quiz>`** — owns the game; renders prompt card + reveal panel + 4 choice
  pills + streak dots + the Elo badge + status pills (category/mode/gallery/
  auto-advance/review/report).
- **`<EloBadge>`** — rating pill + history modal with SVG sparkline.
- **`<CategoryPicker>` / `<ModePicker>`** — full-screen `frost` overlays listing
  options grouped with counts.
- **Gallery page** — sticky pill toolbar (back, search input, horizontally
  scrollable **filter strip**), responsive image grid (2→5 cols) with infinite
  scroll via `IntersectionObserver`, and a `glass-strong` detail modal.

### Gotcha worth copying: drag-to-scroll vs click

The filter strip supports mouse drag-to-scroll. **Do not call
`setPointerCapture` on pointer-down** — capturing routes the subsequent `click`
to the container instead of the child button, silently breaking plain clicks.
Capture **lazily**, only after movement exceeds a threshold (~4px), and use a
`moved` flag to suppress the click that ends a real drag:

```ts
function onPointerDown(e){ if (e.pointerType!=="mouse") return;
  drag.current = { active:true, startX:e.clientX, startScroll:el.scrollLeft, moved:false, captured:false }; }
function onPointerMove(e){ if(!drag.current.active) return;
  const dx = e.clientX - drag.current.startX;
  if (Math.abs(dx) > 4) {
    drag.current.moved = true;
    if (!drag.current.captured) { el.setPointerCapture(e.pointerId); drag.current.captured = true; }
    el.scrollLeft = drag.current.startScroll - dx;
  } }
function onPointerUp(e){ if(!drag.current.active) return; drag.current.active=false;
  if (drag.current.captured) { el.releasePointerCapture(e.pointerId); drag.current.captured=false; } }
// pill onClick: if (drag.current.moved) return; else select(...)
```

---

## 9. Re-skinning checklist for a new topic

1. Write `scripts/fetch-*.mjs` to produce `public/data.json` as `Item[]`, sorted
   by your notability metric. Keep ids stable.
2. Update the `Item` type + `CATEGORIES` + the `modeTarget(item, mode)` map for
   your facets. Everything downstream (pool filtering, choice building, Elo
   difficulty) is generic.
3. Replace the prompt rendering (here an `<img>`) with whatever your question is
   — text, audio, a flag, a map. The 4-pill answer UI stays.
4. Rename tokens/metadata (title, theme color) — but keep the glass/pill CSS.
5. `npx vercel --prod`.

That's it. The framework is topic-agnostic; the personality is in §3–4.
