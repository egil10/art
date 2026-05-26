#!/usr/bin/env node
// Tiny additive fetch — top Nordic & Norwegian painters not already present.
//
// Strategy:
//   1. Read public/paintings.json to learn which artists we already have.
//   2. SPARQL for painters by citizenship (Norway / wider Nordic), ranked by
//      sitelinks, skipping names already in the JSON.
//   3. For each new painter, pull their paintings (P31=Q3305213, P18, P170)
//      until we have at least PER_ARTIST_MIN with images and clean labels.
//   4. Enrich (movement / location / genre / country) in one chunk.
//   5. Categorize using the existing rules, then append + dedupe by id.
//
// Target: ~10 new Norwegian + ~10 new other-Nordic painters, ≥ 4 paintings each.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.resolve(ROOT, "public", "paintings.json");

const ENDPOINT = "https://query.wikidata.org/sparql";
const UA = "ArtQuizApp/1.0 (https://github.com/egil10/art; quiz dataset build)";

const NORWAY_QID = "Q20";
const OTHER_NORDIC_QIDS = [
  "Q34",     // Sweden
  "Q35",     // Denmark
  "Q33",     // Finland
  "Q189",    // Iceland
  "Q70802",  // Denmark–Norway
  "Q170072", // Sweden–Norway
];

const TARGET_NEW_NORWAY = 10;
const TARGET_NEW_OTHER_NORDIC = 10;
const PER_ARTIST_MIN = 4;
const PER_ARTIST_MAX = 12;
const PAINTER_CANDIDATES = 80; // pull this many per pool; we'll filter & pick.

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

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

const FILEPATH_PREFIX = "https://commons.wikimedia.org/wiki/Special:FilePath/";

function looksLikeQ(s) {
  return !s || /^Q\d+$/.test(s);
}

function imageFilename(url) {
  try {
    const u = new URL(url);
    if (u.hostname === "upload.wikimedia.org") {
      return decodeURIComponent(u.pathname.split("/").pop() || "");
    }
    const idx = u.pathname.indexOf("Special:FilePath/");
    if (idx >= 0) {
      return decodeURIComponent(u.pathname.slice(idx + "Special:FilePath/".length));
    }
    return decodeURIComponent(u.pathname.split("/").pop() || "");
  } catch {
    return url;
  }
}

async function topPaintersByCountry(countryQids, limit) {
  const values = countryQids.map((q) => `wd:${q}`).join(" ");
  // Citizenship in a Nordic country alone gives false positives — Dutch painters
  // like Peter Lely / Jan van der Heyden show up because Wikidata records some
  // honorary or secondary tie. Require the birthplace's country to also be
  // Nordic so we only get painters who were actually born there.
  const query = `
SELECT ?painter ?painterLabel ?sitelinks WHERE {
  VALUES ?country { ${values} }
  VALUES ?birthCountry { ${values} }
  ?painter wdt:P31 wd:Q5 ;
           wdt:P106 wd:Q1028181 ;
           wdt:P27 ?country ;
           wdt:P19 ?birthplace ;
           wikibase:sitelinks ?sitelinks .
  ?birthplace wdt:P17 ?birthCountry .
  FILTER (?sitelinks >= 5)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
ORDER BY DESC(?sitelinks)
LIMIT ${limit}
`;
  const data = await sparql(query);
  const out = [];
  const seen = new Set();
  for (const b of data.results.bindings) {
    const qid = b.painter.value;
    if (seen.has(qid)) continue;
    seen.add(qid);
    const label = b.painterLabel?.value;
    if (looksLikeQ(label)) continue;
    out.push({
      qid,
      label,
      sitelinks: Number(b.sitelinks?.value || 0),
    });
  }
  return out;
}

async function paintingsForPainter(painterQid) {
  const query = `
SELECT ?painting ?paintingLabel ?image ?inception ?sitelinks WHERE {
  ?painting wdt:P31 wd:Q3305213 ;
            wdt:P18 ?image ;
            wdt:P170 <${painterQid}> .
  OPTIONAL { ?painting wikibase:sitelinks ?sitelinks . }
  OPTIONAL { ?painting wdt:P571 ?inception . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
ORDER BY DESC(?sitelinks)
LIMIT 60
`;
  const data = await sparql(query);
  const out = [];
  const seen = new Set();
  for (const b of data.results.bindings) {
    const id = b.painting.value.split("/").pop();
    if (seen.has(id)) continue;
    seen.add(id);
    const title = b.paintingLabel?.value;
    if (looksLikeQ(title)) continue;
    if (!b.image?.value) continue;
    out.push({
      id,
      qid: b.painting.value,
      title,
      year: b.inception?.value?.slice(0, 4) || null,
      image: imageFilename(b.image.value),
      sitelinks: Number(b.sitelinks?.value || 0),
    });
  }
  return out;
}

async function enrichBatch(paintingIds) {
  if (paintingIds.length === 0) return new Map();
  const values = paintingIds.map((id) => `wd:${id}`).join(" ");
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
  const data = await sparql(query);
  const meta = new Map();
  for (const b of data.results.bindings) {
    const id = b.painting.value.split("/").pop();
    const m = meta.get(id) || {
      country: null,
      movements: new Set(),
      locations: new Set(),
      genres: new Set(),
    };
    if (b.countryLabel?.value && !looksLikeQ(b.countryLabel.value)) m.country = b.countryLabel.value;
    if (b.movementLabel?.value && !looksLikeQ(b.movementLabel.value)) m.movements.add(b.movementLabel.value);
    if (b.locationLabel?.value && !looksLikeQ(b.locationLabel.value)) m.locations.add(b.locationLabel.value);
    if (b.genreLabel?.value && !looksLikeQ(b.genreLabel.value)) m.genres.add(b.genreLabel.value);
    meta.set(id, m);
  }
  return meta;
}

function categorize({ movements, country, year, genres, originHint }) {
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

  const isNorway =
    c === "norway" ||
    c.includes("norwegian") ||
    c === "denmark–norway" ||
    c === "denmark-norway" ||
    c === "union between sweden and norway" ||
    c === "sweden–norway" ||
    c === "sweden-norway";
  const isSweden = c === "sweden" || c.includes("swedish");
  const isDenmark = c === "denmark" || c.includes("danish");
  const isFinland = c === "finland" || c.includes("finnish");
  const isIceland = c === "iceland" || c.includes("icelandic");
  const enrichSaysNordic = isNorway || isSweden || isDenmark || isFinland || isIceland;
  // Trust the painter's recorded primary citizenship over the origin hint when
  // they disagree — keeps Dutch/German painters out of the Nordic bucket even
  // if Wikidata listed them with a Nordic citizenship.
  const enrichSaysNonNordic = !!c && !enrichSaysNordic;
  if (isNorway || (originHint === "norwegian" && !enrichSaysNonNordic)) cats.add("norwegian");
  if (enrichSaysNordic || ((originHint === "nordic" || originHint === "norwegian") && !enrichSaysNonNordic)) cats.add("nordic");

  if (g.includes("portrait")) cats.add("portraits");
  if (g.includes("landscape")) cats.add("landscapes");
  if (g.includes("still life")) cats.add("stilllife");
  if (g.includes("religious") || g.includes("biblical") || g.includes("mythological") || g.includes("history painting")) cats.add("religious");

  if (y) {
    if (!cats.has("renaissance") && y >= 1400 && y <= 1600) cats.add("renaissance");
    if (!cats.has("baroque") && y >= 1600 && y <= 1750) cats.add("baroque");
    if (!cats.has("impressionism") && y >= 1860 && y <= 1910) cats.add("impressionism");
    if (!cats.has("modern") && y >= 1905 && y <= 1980) cats.add("modern");
    if (!cats.has("romanticism") && y >= 1790 && y <= 1860) cats.add("romanticism");
  }
  return [...cats];
}

async function pickNewPainters(pool, existingArtists, target) {
  const chosen = [];
  for (const cand of pool) {
    if (chosen.length >= target) break;
    if (existingArtists.has(cand.label)) continue;
    // Pull works; if we get enough good ones, count them in.
    process.stdout.write(`  trying ${cand.label} (sitelinks ${cand.sitelinks})… `);
    let works;
    try {
      works = await paintingsForPainter(cand.qid);
    } catch (err) {
      console.log(`failed: ${err.message}`);
      await sleep(400);
      continue;
    }
    if (works.length < PER_ARTIST_MIN) {
      console.log(`only ${works.length} works, skip`);
      await sleep(300);
      continue;
    }
    console.log(`${works.length} works — keep`);
    chosen.push({ painter: cand, works: works.slice(0, PER_ARTIST_MAX) });
    await sleep(400);
  }
  return chosen;
}

async function main() {
  console.log("Reading existing paintings.json…");
  const existing = JSON.parse(await fs.readFile(OUT, "utf8"));
  const existingArtists = new Set(existing.map((p) => p.artist));
  const existingIds = new Set(existing.map((p) => p.id));
  console.log(`  ↳ ${existing.length} paintings, ${existingArtists.size} distinct artists`);

  console.log("Fetching top Norwegian painters (citizenship Q20)…");
  const norwayPool = await topPaintersByCountry([NORWAY_QID], PAINTER_CANDIDATES);
  console.log(`  ↳ ${norwayPool.length} candidates`);

  console.log("Fetching top other-Nordic painters (SE/DK/FI/IS + unions)…");
  const otherPool = await topPaintersByCountry(OTHER_NORDIC_QIDS, PAINTER_CANDIDATES);
  console.log(`  ↳ ${otherPool.length} candidates`);

  console.log(`\nSelecting up to ${TARGET_NEW_NORWAY} new Norwegian painters…`);
  const norwayChosen = await pickNewPainters(norwayPool, existingArtists, TARGET_NEW_NORWAY);
  // Update the in-memory set so we don't double-count if a painter appears
  // in both Norwegian and the broader Nordic pool.
  for (const c of norwayChosen) existingArtists.add(c.painter.label);

  console.log(`\nSelecting up to ${TARGET_NEW_OTHER_NORDIC} new other-Nordic painters…`);
  const otherChosen = await pickNewPainters(otherPool, existingArtists, TARGET_NEW_OTHER_NORDIC);

  // Flatten to paintings with an origin hint so categorize tags them right
  // even when enrichment doesn't fill in the country.
  const collected = [];
  for (const { painter, works } of norwayChosen) {
    for (const w of works) {
      if (existingIds.has(w.id)) continue;
      collected.push({ ...w, artist: painter.label, origin: "norwegian" });
    }
  }
  for (const { painter, works } of otherChosen) {
    for (const w of works) {
      if (existingIds.has(w.id)) continue;
      collected.push({ ...w, artist: painter.label, origin: "nordic" });
    }
  }
  console.log(`\nCollected ${collected.length} new paintings before enrichment.`);

  // Enrich in chunks of ~150 to stay under the SPARQL timeout.
  const CHUNK = 150;
  const enrichMap = new Map();
  for (let off = 0; off < collected.length; off += CHUNK) {
    const ids = collected.slice(off, off + CHUNK).map((p) => p.id);
    console.log(`Enriching ${off + ids.length}/${collected.length}…`);
    const meta = await enrichBatch(ids);
    for (const [k, v] of meta) enrichMap.set(k, v);
    await sleep(400);
  }

  const finalNew = collected.map((p) => {
    const e = enrichMap.get(p.id) || {};
    const movements = [...(e.movements || [])];
    const locations = [...(e.locations || [])];
    const genres = [...(e.genres || [])];
    const cats = categorize({
      movements,
      country: e.country,
      year: p.year,
      genres,
      originHint: p.origin,
    });
    return {
      id: p.id,
      title: p.title,
      artist: p.artist,
      year: p.year,
      image: p.image,
      cats,
      mv: movements[0] || null,
      loc: locations[0] || null,
      g: genres[0] || null,
    };
  });

  const merged = [...existing, ...finalNew];
  // Dedupe by id again (belt + braces in case existingIds missed anything).
  const seen = new Set();
  const deduped = [];
  for (const p of merged) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    deduped.push(p);
  }

  // Stats
  const norw = deduped.filter((p) => p.cats.includes("norwegian"));
  const nord = deduped.filter((p) => p.cats.includes("nordic"));
  const norwArtists = new Set(norw.map((p) => p.artist));
  const nordArtists = new Set(nord.map((p) => p.artist));
  console.log(`\nFinal: ${deduped.length} paintings`);
  console.log(`  Norwegian: ${norw.length} paintings · ${norwArtists.size} artists`);
  console.log(`  Nordic:    ${nord.length} paintings · ${nordArtists.size} artists`);
  console.log(`  Added new artists:`);
  for (const c of [...norwayChosen, ...otherChosen]) {
    console.log(`    + ${c.painter.label} (${c.works.length} works)`);
  }

  await fs.writeFile(OUT, JSON.stringify(deduped));
  const kb = (await fs.stat(OUT)).size / 1024;
  console.log(`\nWrote ${OUT} (${kb.toFixed(1)} KB)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
