# artguessr

An endless multiple-choice quiz over thousands of the world's most famous paintings, plus a searchable gallery. Pick a painting, guess the painter (or the title, movement, country, decade). Live at **[artguessr.com](https://artguessr.com)**.

- **~10,600 paintings · 530+ distinct artists** — sourced from Wikidata + Wikimedia Commons, ≥4 paintings per painter, sorted by fame (Wikidata sitelink count).
- **22 collections** — popular, all, plus filters by movement (Renaissance, Baroque, Impressionism…), subject (portraits, landscapes, still life, religious) and origin (French, Italian, Dutch, Spanish, German, British, American, Russian, Norwegian, Nordic).
- **5 game modes** — guess the Painter, Title, Movement, Country, or Decade.
- **Quiz** — keyboard-first (`1`–`4` to answer, `Enter`/`Space`/`→` for next), blur-up image loading (never a blank frame), glass UI, fixed-height reveal panel (no layout jump), optional auto-advance, review-wrong-answers mode, and a per-painting report flag.
- **Per-device Elo rating** — each answer is a match against the painting's obscurity; the top-right badge shows your rating with a trend/all-time-high/low icon, and clicking it opens a charted history. The rating change shows in the green/red answer feedback.
- **HD / data-saver image toggle** — auto-defaults to data-saver on slow connections.
- **/gallery** — searchable thumbnail grid with scrollable category filters and a painting detail view.
- Built with **Next.js 16 (App Router) · React 19 · Tailwind · lucide-react**, no backend (static JSON + `localStorage`), deployed to **Vercel**.

> **Want to build a similar quiz site?** Read [`BLUEPRINT.md`](./BLUEPRINT.md) — a deep, portable spec of the design system, architecture, performance tricks, and every pitfall we hit, so you can reskin this framework for any topic.

## Develop

```bash
npm install
npm run dev          # http://localhost:3000
```

Validate changes with `npx tsc --noEmit` and `npm run build`. (`next lint` was removed in Next 16 — it's non-functional here.)

## Refresh the painting set

```bash
npm run fetch:paintings   # re-queries Wikidata SPARQL → public/paintings.json (+ popular seed)
```

The fetch script pulls the most-linked paintings from Wikidata (sitelink count as a fame proxy), keeps at most ~25 per artist, sorts by fame, and tags each painting with one or more categories. It then chains `derive-popular.mjs` to write `public/paintings-popular.json` — the ~300 "popular" paintings, loaded first for a near-instant first paint while the full 2.75 MB set streams in behind it. Both files are served `immutable` (see `next.config.mjs`) and cache-busted via a `?v=` version in `src/lib/usePaintings.ts` — **bump `DATA_VERSION` there whenever you regenerate the data**, or browsers will keep the cached copy.

## Deploy

Pushing to `main` auto-deploys via the connected Vercel project. Manual:

```bash
npx vercel --prod
```

Custom domain (artguessr.com) is registered at Squarespace with DNS pointed at Vercel — see the "Deployment & custom domains" section of `BLUEPRINT.md` for the exact records and gotchas.
