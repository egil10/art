// Derives public/paintings-popular.json — the ~300 "popular" paintings — from
// the full dataset. This tiny file is loaded first by the app for a near-instant
// first paint (the default quiz only needs the popular pool); the full set
// streams in behind it. Run after regenerating paintings.json (the fetch script
// chains this automatically), or standalone: `node scripts/derive-popular.mjs`.
import { readFileSync, writeFileSync } from "node:fs";

const fullUrl = new URL("../public/paintings.json", import.meta.url);
const outUrl = new URL("../public/paintings-popular.json", import.meta.url);

const all = JSON.parse(readFileSync(fullUrl, "utf8"));
const popular = all.filter(
  (p) => Array.isArray(p.cats) && p.cats.includes("popular"),
);
// Preserve the full set's fame ordering (it's already sorted) — no re-sort.
writeFileSync(outUrl, JSON.stringify(popular));
console.log(
  `Wrote ${popular.length} popular paintings to public/paintings-popular.json`,
);
