#!/usr/bin/env node
// Re-tag paintings with modern country categories.
//
// Wikidata records pre-unification states (Papal States, Republic of Venice,
// Prussia, Holy Roman Empire, …) as the painter's citizenship, so Caravaggio
// never lands in "italian" and Dürer never lands in "german". This script
// queries each painting's creator for citizenship (P27) and birthplace's
// modern country (P19→P17), maps any historical state to its modern
// equivalent, and tags the painting accordingly.
//
// Pure addition — never strips existing tags.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const FILE = path.resolve(ROOT, "public", "paintings.json");

const ENDPOINT = "https://query.wikidata.org/sparql";
const UA = "ArtQuizApp/1.0 (https://github.com/egil10/art; country re-tag)";
const CHUNK = 200;

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

// Rules tested against country labels. The output cat key is the in-app
// category, except the synthetic `nordic_*` keys which only add "nordic".
const COUNTRY_RULES = [
  // Italian — pre-1861 states (Papal, Florence, Venice, Genoa, Naples,
  // Sicily, Tuscany, Milan, …) and modern Italy.
  { match: /\bital(y|ian)\b|papal states|holy see|vatican|republic of (?:florence|venice|genoa|siena|lucca|pisa|ragusa)|duchy of (?:florence|milan|mantua|modena|parma|urbino|ferrara|savoy|saluzzo|tuscany|spoleto)|grand duchy of tuscany|kingdom of (?:naples|sicily|sardinia|two sicilies|italy|lombardy[–-]venetia|piedmont)|tuscany|lombardy|piedmont|kingdom of sardinia|venetian republic|florentine republic|cisalpine republic|italian republic|kingdom of etruria|principality of monaco|republic of saint mark/i, cat: "italian" },

  // German — pre-1871 states + modern. HRE/Austrian Empire handled separately.
  { match: /\bgerman(y|ic)?\b|prussia|bavaria|saxony|saxon|w(ü|u)rttemberg|hesse|hessian|hanover|hannover|brandenburg|rhineland|schleswig|baden|nassau|mecklenburg|pomerania|silesia|thuringia|electorate of (?:cologne|mainz|trier|the palatinate)|duchy of (?:cleves|j(ü|u)lich|berg|holstein|brunswick)|kingdom of (?:prussia|bavaria|saxony|hanover|w(ü|u)rttemberg)|german empire|weimar republic|north german confederation|german confederation|federal republic of germany|east germany|west germany|gdr|nazi germany|free city of (?:hamburg|bremen|l(ü|u)beck|danzig|frankfurt)/i, cat: "german" },

  // French
  { match: /\bfrance\b|french|kingdom of france|french republic|french empire|vichy france|second french empire|first french empire/i, cat: "french" },

  // Dutch / Flemish — pre-1830 Low Countries + modern NL & BE.
  { match: /\bdutch\b|netherlands|flemish|flanders|belgium|belgian|kingdom of the netherlands|dutch republic|spanish netherlands|habsburg netherlands|austrian netherlands|burgundian netherlands|seventeen provinces|united provinces|county of (?:holland|flanders|hainaut|brabant)|duchy of (?:brabant|limburg|luxembourg|gelre|guelders)|principality of li(è|e)ge|prince-bishopric of li(è|e)ge|holland|brabant|frisia|united kingdom of the netherlands|united belgian states/i, cat: "dutch" },

  // Spanish
  { match: /\bspain\b|spanish|kingdom of (?:castile|aragon|le(ó|o)n|navarre|granada|valencia|majorca)|crown of (?:castile|aragon)|spanish empire|new spain|cataloni(a|an)|kingdom of asturias|al-andalus|second spanish republic|spanish state|francoist spain/i, cat: "spanish" },

  // British — England / Scotland / Wales / UK.
  { match: /\bunited kingdom\b|britain|british|kingdom of (?:england|scotland|great britain|ireland)|england|english|scotland|scottish|wales|welsh|commonwealth of england|protectorate of england/i, cat: "british" },

  // Russian
  { match: /\brussia\b|russian|russian empire|tsardom of russia|grand duchy of moscow|kievan rus|russian sfsr|soviet union|ussr|principality of moscow|imperial russia/i, cat: "russian" },

  // American
  { match: /\bunited states\b|usa|u\.s\.a\.|america(n)?|thirteen colonies|colony of (?:virginia|massachusetts|new york|pennsylvania|connecticut|maryland|carolina|georgia|new jersey|delaware|rhode island|new hampshire)|confederate states/i, cat: "american" },

  // Norwegian (also implies Nordic)
  { match: /\bnorway\b|norwegian|kingdom of norway|denmark[–-]norway|sweden[–-]norway|union between sweden and norway/i, cat: "norwegian" },

  // Other Nordic — these only contribute to "nordic".
  { match: /\bsweden\b|swedish|kingdom of sweden/i, cat: "nordic_swe" },
  { match: /\bdenmark\b|danish|kingdom of denmark/i, cat: "nordic_dnk" },
  { match: /\bfinland\b|finnish|grand duchy of finland/i, cat: "nordic_fin" },
  { match: /\biceland\b|icelandic|kingdom of iceland/i, cat: "nordic_isl" },
];

// "Holy Roman Empire" / "Austrian Empire" can mean German *or* Italian *or*
// Dutch lands. Only fall back to German if none of the other Latin/Germanic
// rules already fired for the painter.
const HRE_RE = /holy roman empire|german confederation|austrian empire|austria-hungary|austro-hungarian|archduchy of austria|cisleithania/i;
const HRE_FALLBACK_CAT = "german";

function categoriesForLabels(labels) {
  const cats = new Set();
  for (const label of labels) {
    for (const r of COUNTRY_RULES) {
      if (r.match.test(label)) {
        if (r.cat.startsWith("nordic_")) {
          cats.add("nordic");
        } else {
          cats.add(r.cat);
          if (r.cat === "norwegian") cats.add("nordic");
        }
      }
    }
  }
  // HRE fallback — only if nothing more specific matched in the painter's set.
  const hasSpecific = ["italian", "german", "dutch", "spanish", "french", "british"].some((c) => cats.has(c));
  if (!hasSpecific) {
    for (const label of labels) {
      if (HRE_RE.test(label)) {
        cats.add(HRE_FALLBACK_CAT);
        break;
      }
    }
  }
  return cats;
}

async function fetchCreatorCountries(paintingIds) {
  const values = paintingIds.map((id) => `wd:${id}`).join(" ");
  const query = `
SELECT ?painting ?creator ?countryLabel ?birthCountryLabel WHERE {
  VALUES ?painting { ${values} }
  ?painting wdt:P170 ?creator .
  OPTIONAL { ?creator wdt:P27 ?country . }
  OPTIONAL { ?creator wdt:P19 ?birthplace . ?birthplace wdt:P17 ?birthCountry . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
`;
  const data = await sparql(query);
  const paintingToCreator = new Map();
  const creatorLabels = new Map();
  for (const b of data.results.bindings) {
    const pid = b.painting.value.split("/").pop();
    const cid = b.creator.value;
    paintingToCreator.set(pid, cid);
    const set = creatorLabels.get(cid) || new Set();
    if (b.countryLabel?.value && !/^Q\d+$/.test(b.countryLabel.value)) set.add(b.countryLabel.value);
    if (b.birthCountryLabel?.value && !/^Q\d+$/.test(b.birthCountryLabel.value)) set.add(b.birthCountryLabel.value);
    creatorLabels.set(cid, set);
  }
  return { paintingToCreator, creatorLabels };
}

async function main() {
  const paintings = JSON.parse(await fs.readFile(FILE, "utf8"));
  console.log(`Loaded ${paintings.length} paintings.`);

  const COUNTRY_CATS = ["french","italian","dutch","spanish","german","british","american","russian","norwegian","nordic"];
  function tally(list) {
    const m = {};
    for (const k of COUNTRY_CATS) m[k] = 0;
    for (const p of list) for (const k of COUNTRY_CATS) if (p.cats.includes(k)) m[k]++;
    return m;
  }
  const pre = tally(paintings);
  console.log("Before:", pre);

  // Pass 1 — fetch every creator's country labels.
  const allPaintingToCreator = new Map();
  const allCreatorLabels = new Map();
  const ids = paintings.map((p) => p.id);
  for (let off = 0; off < ids.length; off += CHUNK) {
    const batch = ids.slice(off, off + CHUNK);
    process.stdout.write(`  chunk ${off + batch.length}/${ids.length}\r`);
    try {
      const { paintingToCreator, creatorLabels } = await fetchCreatorCountries(batch);
      for (const [k, v] of paintingToCreator) allPaintingToCreator.set(k, v);
      for (const [k, v] of creatorLabels) {
        const m = allCreatorLabels.get(k) || new Set();
        for (const x of v) m.add(x);
        allCreatorLabels.set(k, m);
      }
    } catch (err) {
      console.warn(`\n  ! chunk @${off} failed: ${err.message}`);
    }
    await sleep(400);
  }
  process.stdout.write("\n");

  // Pass 2 — resolve modern country cats per creator.
  const creatorCats = new Map();
  for (const [cid, labels] of allCreatorLabels) {
    creatorCats.set(cid, categoriesForLabels(labels));
  }

  // Apply.
  let touched = 0;
  let added = 0;
  for (const p of paintings) {
    const cid = allPaintingToCreator.get(p.id);
    if (!cid) continue;
    const cats = creatorCats.get(cid);
    if (!cats || cats.size === 0) continue;
    const have = new Set(p.cats);
    let didAdd = false;
    for (const c of cats) {
      if (!have.has(c)) {
        p.cats.push(c);
        have.add(c);
        added++;
        didAdd = true;
      }
    }
    if (didAdd) touched++;
  }
  console.log(`Touched ${touched} paintings, added ${added} country tags.`);

  const post = tally(paintings);
  console.log("After: ", post);
  const delta = {};
  for (const k of COUNTRY_CATS) delta[k] = (post[k] || 0) - (pre[k] || 0);
  console.log("Delta: ", delta);

  await fs.writeFile(FILE, JSON.stringify(paintings));
  console.log(`Wrote ${FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
