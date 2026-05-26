#!/usr/bin/env node
// 2-phase scrape of famous paintings from Wikidata.
//
// Phase A: lightweight query — paintings with sitelinks ≥ 4, basics only.
// Phase B: chunked enrichment — movement / location / genre / artist country.
//
// Output: public/paintings.json (slim, lazy-loaded by the client).

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.resolve(ROOT, "public", "paintings.json");

const ENDPOINT = "https://query.wikidata.org/sparql";
const UA = "ArtQuizApp/1.0 (https://github.com/egil10/art; quiz dataset build)";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function sparql(query, attempts = 4) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      const body = new URLSearchParams({ query, format: "json" });
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          Accept: "application/sparql-results+json",
          "User-Agent": UA,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`SPARQL ${res.status}: ${t.slice(0, 200)}`);
      }
      return await res.json();
    } catch (err) {
      lastErr = err;
      const wait = 1500 * Math.pow(2, i);
      console.warn(`  ! ${err.message} — retry in ${wait}ms`);
      await sleep(wait);
    }
  }
  throw lastErr;
}

const TARGET_PAINTINGS = 12000;
const PER_ARTIST_MIN = 4;
const PER_ARTIST_MAX = 55;
const PAINTER_SEED_LIMIT = 3500;

// Sitelink tiers — each query is small enough to finish under Wikidata's 60s timeout.
const TIERS = [
  { min: 30, max: null, limit: 8000, order: true },
  { min: 15, max: 29, limit: 10000, order: true },
  { min: 8, max: 14, limit: 12000, order: true },
  { min: 4, max: 7, limit: 14000, order: false },
  { min: 2, max: 3, limit: 18000, order: false },
];

const FILEPATH_PREFIX = "https://commons.wikimedia.org/wiki/Special:FilePath/";

function looksLikeQ(s) {
  return !s || /^Q\d+$/.test(s);
}

function imageFilename(url) {
  try {
    const u = new URL(url);
    // upload.wikimedia.org direct file → just basename
    if (u.hostname === "upload.wikimedia.org") {
      return decodeURIComponent(u.pathname.split("/").pop() || "");
    }
    // Special:FilePath/Filename.jpg
    const idx = u.pathname.indexOf("Special:FilePath/");
    if (idx >= 0) {
      return decodeURIComponent(u.pathname.slice(idx + "Special:FilePath/".length));
    }
    return decodeURIComponent(u.pathname.split("/").pop() || "");
  } catch {
    return url;
  }
}

async function phaseA() {
  const byId = new Map();
  console.log("Phase A — fetching paintings tier by tier");
  for (const tier of TIERS) {
    const filter =
      tier.max == null
        ? `FILTER(?sitelinks >= ${tier.min})`
        : `FILTER(?sitelinks >= ${tier.min} && ?sitelinks <= ${tier.max})`;
    const orderBy = tier.order ? "ORDER BY DESC(?sitelinks)" : "";
    const query = `
SELECT ?painting ?paintingLabel ?image ?creator ?creatorLabel ?inception ?sitelinks WHERE {
  ?painting wdt:P31 wd:Q3305213 ;
            wdt:P18 ?image ;
            wdt:P170 ?creator ;
            wikibase:sitelinks ?sitelinks .
  ?creator wdt:P31 wd:Q5 .
  ${filter}
  OPTIONAL { ?painting wdt:P571 ?inception . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
${orderBy}
LIMIT ${tier.limit}
`;
    const label = tier.max == null ? `≥${tier.min}` : `${tier.min}–${tier.max}`;
    console.log(`  tier ${label} (limit ${tier.limit})…`);
    const data = await sparql(query);
    const rows = data.results.bindings;
    let added = 0;
    for (const b of rows) {
      const id = b.painting.value.split("/").pop();
      if (byId.has(id)) continue;
      const title = b.paintingLabel?.value;
      const artist = b.creatorLabel?.value;
      if (looksLikeQ(title) || looksLikeQ(artist)) continue;
      if (!b.image?.value) continue;
      byId.set(id, {
        id,
        qid: b.painting.value,
        title,
        artist,
        creatorQid: b.creator.value,
        year: b.inception?.value?.slice(0, 4) || null,
        image: imageFilename(b.image.value),
        sitelinks: Number(b.sitelinks?.value || 0),
      });
      added++;
    }
    console.log(`    ↳ ${rows.length} rows, +${added} unique paintings (total ${byId.size})`);
    await sleep(800);
  }
  return [...byId.values()];
}

function selectPaintings(all) {
  // Group by creator, keep only creators with ≥ PER_ARTIST_MIN paintings.
  const byCreator = new Map();
  for (const p of all) {
    const arr = byCreator.get(p.creatorQid) || [];
    arr.push(p);
    byCreator.set(p.creatorQid, arr);
  }
  const kept = [];
  let droppedArtists = 0;
  for (const [, arr] of byCreator) {
    if (arr.length < PER_ARTIST_MIN) {
      droppedArtists++;
      continue;
    }
    // Sort by fame, take up to PER_ARTIST_MAX
    arr.sort((a, b) => b.sitelinks - a.sitelinks);
    for (const p of arr.slice(0, PER_ARTIST_MAX)) kept.push(p);
  }
  // Sort overall by fame and cap to TARGET_PAINTINGS — but in a way that
  // preserves the ≥4 invariant: after capping, re-check and re-trim.
  kept.sort((a, b) => b.sitelinks - a.sitelinks);
  let trimmed = kept.slice(0, TARGET_PAINTINGS);
  for (let iter = 0; iter < 3; iter++) {
    const counts = new Map();
    for (const p of trimmed) counts.set(p.creatorQid, (counts.get(p.creatorQid) || 0) + 1);
    const next = trimmed.filter((p) => counts.get(p.creatorQid) >= PER_ARTIST_MIN);
    if (next.length === trimmed.length) break;
    trimmed = next;
  }
  console.log(`  ↳ ${droppedArtists} artists dropped (< ${PER_ARTIST_MIN} paintings)`);
  console.log(`  ↳ ${trimmed.length} paintings kept`);
  return trimmed;
}

async function phaseB(paintings) {
  // Chunked enrichment: country (of creator), movement, location, genre.
  const CHUNK = 350;
  const meta = new Map(); // id -> { country, movement(s), location(s), genre(s) }
  console.log(`Phase B — enriching ${paintings.length} paintings in chunks of ${CHUNK}…`);

  for (let off = 0; off < paintings.length; off += CHUNK) {
    const batch = paintings.slice(off, off + CHUNK);
    const values = batch.map((p) => `wd:${p.id}`).join(" ");
    const query = `
SELECT ?painting ?countryLabel ?movementLabel ?locationLabel ?genreLabel WHERE {
  VALUES ?painting { ${values} }
  ?painting wdt:P170 ?creator .
  OPTIONAL { ?creator wdt:P27 ?country . }
  OPTIONAL { ?painting wdt:P135 ?movement . }
  OPTIONAL { ?painting wdt:P276 ?location . }
  OPTIONAL { ?painting wdt:P136 ?genre . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
`;
    try {
      const data = await sparql(query);
      for (const b of data.results.bindings) {
        const id = b.painting.value.split("/").pop();
        const m = meta.get(id) || { country: null, movements: new Set(), locations: new Set(), genres: new Set() };
        if (b.countryLabel?.value && !looksLikeQ(b.countryLabel.value)) m.country = b.countryLabel.value;
        if (b.movementLabel?.value && !looksLikeQ(b.movementLabel.value)) m.movements.add(b.movementLabel.value);
        if (b.locationLabel?.value && !looksLikeQ(b.locationLabel.value)) m.locations.add(b.locationLabel.value);
        if (b.genreLabel?.value && !looksLikeQ(b.genreLabel.value)) m.genres.add(b.genreLabel.value);
        meta.set(id, m);
      }
      process.stdout.write(`  ↳ ${Math.min(off + CHUNK, paintings.length)}/${paintings.length}\r`);
    } catch (err) {
      console.warn(`\n  ! chunk @${off} failed: ${err.message}`);
    }
  }
  process.stdout.write("\n");
  return meta;
}

function categorize({ movements, country, year, genres }) {
  const cats = new Set(["all"]);
  const m = [...(movements || [])].join(" | ").toLowerCase();
  const g = [...(genres || [])].join(" | ").toLowerCase();
  const c = (country || "").toLowerCase();
  const y = year ? Number(year) : null;

  if (m.includes("impression") || m.includes("post-impression") || m.includes("pointillism") || m.includes("fauvism") || m.includes("neo-impressionism")) cats.add("impressionism");
  if (m.includes("renaissance") || m.includes("mannerism") || m.includes("high renaissance")) cats.add("renaissance");
  if (m.includes("baroque") || m.includes("rococo")) cats.add("baroque");
  if (m.includes("romantic")) cats.add("romanticism");
  if (m.includes("realism") || m.includes("realist") || m.includes("naturalism")) cats.add("realism");
  if (m.includes("modernism") || m.includes("cubism") || m.includes("surreal") || m.includes("expression") || m.includes("abstract") || m.includes("pop art") || m.includes("dada") || m.includes("futurism") || m.includes("constructivism") || m.includes("bauhaus") || m.includes("art deco") || m.includes("art nouveau")) cats.add("modern");
  if (m.includes("symbolism") || m.includes("pre-raphaelite") || m.includes("academicism")) cats.add("symbolism");

  if (c === "france" || c.includes("french")) cats.add("french");
  if (c === "italy" || c.includes("italian")) cats.add("italian");
  if (c === "netherlands" || c === "dutch republic" || c.includes("dutch") || c.includes("flemish") || c === "belgium" || c === "kingdom of the netherlands") cats.add("dutch");
  if (c === "spain" || c.includes("spanish")) cats.add("spanish");
  if (c === "united states of america" || c === "united states" || c.includes("american")) cats.add("american");
  if (c.includes("german") || c === "germany") cats.add("german");
  if (c.includes("russian") || c === "russia" || c.includes("soviet")) cats.add("russian");
  if (c.includes("united kingdom") || c.includes("british") || c.includes("england") || c.includes("scotland")) cats.add("british");

  if (g.includes("portrait")) cats.add("portraits");
  if (g.includes("landscape")) cats.add("landscapes");
  if (g.includes("still life")) cats.add("stilllife");
  if (g.includes("religious") || g.includes("biblical") || g.includes("mythological") || g.includes("history painting")) cats.add("religious");

  // Time-based fallbacks
  if (y) {
    if (!cats.has("renaissance") && y >= 1400 && y <= 1600) cats.add("renaissance");
    if (!cats.has("baroque") && y >= 1600 && y <= 1750) cats.add("baroque");
    if (!cats.has("impressionism") && y >= 1860 && y <= 1910) cats.add("impressionism");
    if (!cats.has("modern") && y >= 1905 && y <= 1980) cats.add("modern");
    if (!cats.has("romanticism") && y >= 1790 && y <= 1860) cats.add("romanticism");
  }
  return [...cats];
}

async function phaseTopPainters() {
  // Query the most-linked painters directly so we don't miss artists whose
  // individual works are well-known but never crossed our headline tiers.
  console.log(`Phase A0 — top painters by sitelinks (limit ${PAINTER_SEED_LIMIT})…`);
  const query = `
SELECT ?painter ?painterLabel WHERE {
  ?painter wdt:P31 wd:Q5 ;
           wdt:P106 wd:Q1028181 ;
           wikibase:sitelinks ?sitelinks .
  FILTER (?sitelinks >= 5)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
ORDER BY DESC(?sitelinks)
LIMIT ${PAINTER_SEED_LIMIT}
`;
  const data = await sparql(query);
  const ids = new Set();
  for (const b of data.results.bindings) {
    if (b.painter?.value) ids.add(b.painter.value);
  }
  console.log(`  ↳ ${ids.size} painters`);
  return ids;
}

async function phaseArtistExpansion(creatorQids) {
  const ids = [...creatorQids];
  console.log(`Phase A2 — expanding ${ids.length} artists for deep catalog…`);
  const byId = new Map();
  const CHUNK = 60;
  for (let off = 0; off < ids.length; off += CHUNK) {
    const batch = ids.slice(off, off + CHUNK);
    const values = batch.map((q) => `<${q}>`).join(" ");
    const query = `
SELECT ?painting ?paintingLabel ?image ?creator ?creatorLabel ?inception ?sitelinks WHERE {
  VALUES ?creator { ${values} }
  ?painting wdt:P31 wd:Q3305213 ;
            wdt:P18 ?image ;
            wdt:P170 ?creator .
  OPTIONAL { ?painting wikibase:sitelinks ?sitelinks . }
  OPTIONAL { ?painting wdt:P571 ?inception . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT 8000
`;
    try {
      const data = await sparql(query);
      for (const b of data.results.bindings) {
        const id = b.painting.value.split("/").pop();
        if (byId.has(id)) continue;
        const title = b.paintingLabel?.value;
        const artist = b.creatorLabel?.value;
        if (looksLikeQ(title) || looksLikeQ(artist)) continue;
        if (!b.image?.value) continue;
        byId.set(id, {
          id,
          qid: b.painting.value,
          title,
          artist,
          creatorQid: b.creator.value,
          year: b.inception?.value?.slice(0, 4) || null,
          image: imageFilename(b.image.value),
          sitelinks: Number(b.sitelinks?.value || 0),
        });
      }
      process.stdout.write(`  ↳ ${Math.min(off + CHUNK, ids.length)}/${ids.length} (total ${byId.size})\r`);
    } catch (err) {
      console.warn(`\n  ! chunk @${off} failed: ${err.message}`);
    }
    await sleep(250);
  }
  process.stdout.write("\n");
  return [...byId.values()];
}

async function main() {
  const [phaseAList, topPainterIds] = await Promise.all([
    phaseA(),
    phaseTopPainters(),
  ]);

  // Union of seed painters: those who surfaced in the headline tiers,
  // plus the top-N painters by sitelinks (regardless of any single work's fame).
  const seedPainters = new Set(topPainterIds);
  for (const p of phaseAList) seedPainters.add(p.creatorQid);
  console.log(`Seed painters: ${seedPainters.size}`);

  const expanded = await phaseArtistExpansion(seedPainters);

  // Merge: dedup by id, prefer the higher sitelinks count
  const merged = new Map();
  for (const p of [...phaseAList, ...expanded]) {
    const prev = merged.get(p.id);
    if (!prev || p.sitelinks > prev.sitelinks) merged.set(p.id, p);
  }
  console.log(`Merged: ${merged.size} unique paintings before per-artist filter`);

  const selected = selectPaintings([...merged.values()]);
  const enrich = await phaseB(selected);

  const out = selected.map((p) => {
    const e = enrich.get(p.id) || {};
    const movements = [...(e.movements || [])];
    const locations = [...(e.locations || [])];
    const genres = [...(e.genres || [])];
    const categories = categorize({
      movements,
      country: e.country,
      year: p.year,
      genres,
    });
    return {
      id: p.id,
      title: p.title,
      artist: p.artist,
      year: p.year,
      image: p.image,
      cats: categories,
      mv: movements[0] || null,
      loc: locations[0] || null,
      g: genres[0] || null,
    };
  });

  // Mark popular: top 300 by fame (preserve original ordering by sitelinks)
  const POPULAR = 300;
  for (let i = 0; i < Math.min(POPULAR, out.length); i++) out[i].cats.push("popular");

  // Final stats
  const distinctArtists = new Set(out.map((p) => p.artist));
  const catCounts = {};
  for (const p of out) for (const c of p.cats) catCounts[c] = (catCounts[c] || 0) + 1;
  console.log(`\nFinal: ${out.length} paintings, ${distinctArtists.size} distinct artists`);
  console.log("Category counts:", catCounts);

  await fs.mkdir(path.dirname(OUT), { recursive: true });
  const json = JSON.stringify(out);
  await fs.writeFile(OUT, json);
  console.log(`Wrote ${OUT} (${(json.length / 1024).toFixed(1)} KB)`);

  // Remove the old in-bundle copy if present so it doesn't bloat the JS bundle
  const stale = path.resolve(ROOT, "src", "data", "paintings.json");
  try {
    await fs.unlink(stale);
    console.log(`Removed stale ${stale}`);
  } catch {}
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
