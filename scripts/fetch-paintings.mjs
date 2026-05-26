#!/usr/bin/env node
// Fetch a curated set of ~1000 famous paintings from Wikidata via SPARQL.
// Saves to src/data/paintings.json with categories assigned.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, "..", "src", "data", "paintings.json");

const ENDPOINT = "https://query.wikidata.org/sparql";
const UA = "ArtQuizApp/1.0 (https://github.com/egil10/art; quiz dataset build)";

async function sparql(query) {
  const res = await fetch(ENDPOINT + "?format=json&query=" + encodeURIComponent(query), {
    headers: { Accept: "application/sparql-results+json", "User-Agent": UA },
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`SPARQL ${res.status}: ${t.slice(0, 300)}`);
  }
  return res.json();
}

// Famous paintings: instance of painting (Q3305213), has image, has creator (single human),
// ranked by number of sitelinks (proxy for fame).
function buildQuery(limit) {
  return `
SELECT ?painting ?paintingLabel ?image ?creator ?creatorLabel ?inception ?movementLabel ?countryLabel ?sitelinks WHERE {
  ?painting wdt:P31 wd:Q3305213 ;
            wdt:P18 ?image ;
            wdt:P170 ?creator ;
            wikibase:sitelinks ?sitelinks .
  ?creator wdt:P31 wd:Q5 .
  OPTIONAL { ?painting wdt:P571 ?inception . }
  OPTIONAL { ?painting wdt:P135 ?movement . }
  OPTIONAL { ?creator wdt:P27 ?country . }
  FILTER (?sitelinks > 8)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
ORDER BY DESC(?sitelinks)
LIMIT ${limit}
`;
}

function thumbUrl(commonsUrl, size = 900) {
  // Convert e.g. https://commons.wikimedia.org/wiki/Special:FilePath/X.jpg
  // to a sized thumbnail via Special:FilePath?width=N (server redirects to /thumb/).
  try {
    const u = new URL(commonsUrl);
    u.searchParams.set("width", String(size));
    return u.toString();
  } catch {
    return commonsUrl;
  }
}

// Map known movements + country into our category buckets.
function categorize({ movement, country, year }) {
  const cats = new Set(["all"]);
  const m = (movement || "").toLowerCase();
  const c = (country || "").toLowerCase();

  if (
    m.includes("impression") ||
    m.includes("post-impression") ||
    m.includes("pointillism") ||
    m.includes("fauvism")
  ) {
    cats.add("impressionism");
  }
  if (
    m.includes("renaissance") ||
    m.includes("mannerism") ||
    m.includes("high renaissance") ||
    m.includes("baroque")
  ) {
    cats.add("renaissance");
  }
  if (
    m.includes("modernism") ||
    m.includes("cubism") ||
    m.includes("surreal") ||
    m.includes("expression") ||
    m.includes("abstract") ||
    m.includes("pop art") ||
    m.includes("dada")
  ) {
    cats.add("modern");
  }
  if (c === "france" || c.includes("french")) cats.add("french");
  if (c === "italy" || c.includes("italian")) cats.add("italian");
  if (c === "netherlands" || c.includes("dutch") || c.includes("flemish")) cats.add("dutch");

  if (year) {
    const y = Number(year.slice(0, 4));
    if (!cats.has("renaissance") && y >= 1400 && y <= 1600) cats.add("renaissance");
    if (!cats.has("impressionism") && y >= 1860 && y <= 1910) cats.add("impressionism");
    if (!cats.has("modern") && y >= 1905 && y <= 1970) cats.add("modern");
  }
  return [...cats];
}

function looksLikeQ(label) {
  return /^Q\d+$/.test(label);
}

async function main() {
  console.log("Querying Wikidata SPARQL…");
  const data = await sparql(buildQuery(3000));
  const seenPaintings = new Set();
  const byCreator = new Map();

  // Group rows by painting to collect multiple movements
  const rowsByPainting = new Map();
  for (const b of data.results.bindings) {
    const id = b.painting.value;
    if (!rowsByPainting.has(id)) {
      rowsByPainting.set(id, {
        id,
        title: b.paintingLabel?.value,
        image: b.image?.value,
        creator: b.creator.value,
        creatorName: b.creatorLabel?.value,
        year: b.inception?.value || null,
        country: b.countryLabel?.value || null,
        sitelinks: Number(b.sitelinks?.value || 0),
        movements: new Set(),
      });
    }
    if (b.movementLabel?.value) {
      rowsByPainting.get(id).movements.add(b.movementLabel.value);
    }
  }

  const paintings = [];
  for (const row of rowsByPainting.values()) {
    if (!row.title || looksLikeQ(row.title)) continue;
    if (!row.creatorName || looksLikeQ(row.creatorName)) continue;
    if (!row.image) continue;
    if (seenPaintings.has(row.id)) continue;
    seenPaintings.add(row.id);

    // Cap paintings per artist so quiz doesn't get monotonous.
    const cnt = byCreator.get(row.creator) || 0;
    if (cnt >= 25) continue;
    byCreator.set(row.creator, cnt + 1);

    const movementJoined = [...row.movements].join(" | ");
    const categories = categorize({
      movement: movementJoined,
      country: row.country || "",
      year: row.year,
    });

    paintings.push({
      id: row.id.split("/").pop(),
      title: row.title,
      artist: row.creatorName,
      artistId: row.creator.split("/").pop(),
      year: row.year ? row.year.slice(0, 4) : null,
      image: thumbUrl(row.image, 1024),
      thumb: thumbUrl(row.image, 320),
      country: row.country,
      movements: [...row.movements],
      categories,
      fame: row.sitelinks,
    });

    if (paintings.length >= 1200) break;
  }

  // Mark top ~250 by sitelinks as "popular"
  const sortedByFame = [...paintings].sort((a, b) => b.fame - a.fame);
  const popularIds = new Set(sortedByFame.slice(0, 250).map((p) => p.id));
  for (const p of paintings) {
    if (popularIds.has(p.id)) p.categories.push("popular");
  }

  // Stats
  const distinctArtists = new Set(paintings.map((p) => p.artist));
  console.log(`Paintings: ${paintings.length}`);
  console.log(`Distinct artists: ${distinctArtists.size}`);
  const catCounts = {};
  for (const p of paintings) for (const c of p.categories) catCounts[c] = (catCounts[c] || 0) + 1;
  console.log("Category counts:", catCounts);

  // Strip to runtime-only fields to keep the client bundle lean.
  const slim = paintings.map((p) => ({
    id: p.id,
    title: p.title,
    artist: p.artist,
    year: p.year,
    image: p.image,
    categories: p.categories,
  }));

  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, JSON.stringify(slim, null, 0));
  console.log(`Wrote ${OUT} (${(JSON.stringify(slim).length / 1024).toFixed(1)} KB)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
