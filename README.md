# Canvas

An endless multiple-choice quiz over a thousand of the world's most famous paintings. Pick a painting, guess the painter.

- **1,200 paintings** sourced from Wikidata + Wikimedia Commons
- **250+ distinct artists** across Renaissance, Impressionism, Modern, Dutch, French and more
- Light, minimal, glass-morphism UI · keyboard-first (`1`–`4`, `Enter`)
- Built with Next.js 16, React 19, Tailwind, Lucide icons — deploys to Vercel

## Develop

```bash
npm install
npm run dev          # http://localhost:3000
```

## Refresh the painting set

```bash
npm run fetch:paintings   # re-queries Wikidata SPARQL → src/data/paintings.json
```

The fetch script pulls the most-linked paintings from Wikidata (sitelink count as a fame proxy), keeps at most 25 per artist, and tags each painting with one or more categories (`popular`, `impressionism`, `renaissance`, `modern`, `french`, `dutch`, `italian`, `all`). The dataset is bundled at build time so the quiz feels instant — images preload in a small look-ahead queue.

## Deploy

```bash
npx vercel --prod
```
