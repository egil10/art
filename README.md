# Canvas

An endless multiple-choice quiz over thousands of the world's most famous paintings, plus a searchable gallery. Pick a painting, guess the painter.

- **~10,200 paintings · 530+ distinct artists** — sourced from Wikidata + Wikimedia Commons, ≥4 paintings per painter
- **20 collections** — popular, all, plus filters by movement (Renaissance, Baroque, Impressionism…), subject (portraits, landscapes, still life, religious) and origin (French, Italian, Dutch, Spanish, German, British, American, Russian)
- **Quiz** with keyboard-first controls (`1`–`4`, `Enter`), image preloading, glass UI, fixed-height reveal panel (no layout jump), per-painting report flag
- **/gallery** — searchable thumbnail grid with category filters and a painting detail view
- Built with Next.js 16, React 19, Tailwind, Lucide icons — deploys to Vercel

## Develop

```bash
npm install
npm run dev          # http://localhost:3000
```

## Refresh the painting set

```bash
npm run fetch:paintings   # re-queries Wikidata SPARQL → public/paintings.json (+ popular seed)
```

The fetch script pulls the most-linked paintings from Wikidata (sitelink count as a fame proxy), keeps at most 25 per artist, and tags each painting with one or more categories (`popular`, `impressionism`, `renaissance`, `modern`, `french`, `dutch`, `italian`, `all`). It then runs `derive-popular.mjs` to write `public/paintings-popular.json` — the ~300 "popular" paintings, loaded first for a near-instant first paint while the full set streams in behind it. Both files are served `immutable` and busted via a `?v=` version in `usePaintings`. Images preload in a small look-ahead queue and use responsive `srcset`.

## Deploy

```bash
npx vercel --prod
```
