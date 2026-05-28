export type Painting = {
  id: string;
  title: string;
  artist: string;
  year: string | null;
  /** Wikimedia Commons filename (no URL, no prefix). */
  image: string;
  cats: string[];
  /** First movement label, if known. */
  mv: string | null;
  /** First location (museum) label, if known. */
  loc: string | null;
  /** First genre label, if known. */
  g: string | null;
};

export type CategoryKey =
  | "popular"
  | "all"
  | "renaissance"
  | "baroque"
  | "romanticism"
  | "realism"
  | "impressionism"
  | "symbolism"
  | "modern"
  | "portraits"
  | "landscapes"
  | "stilllife"
  | "religious"
  | "french"
  | "italian"
  | "dutch"
  | "spanish"
  | "german"
  | "british"
  | "american"
  | "russian"
  | "norwegian"
  | "nordic";

export const CATEGORIES: {
  key: CategoryKey;
  label: string;
  hint: string;
  group: "starts" | "movement" | "subject" | "origin";
}[] = [
  { key: "popular", label: "Popular", hint: "Most famous", group: "starts" },
  { key: "all", label: "All", hint: "Full collection", group: "starts" },

  { key: "renaissance", label: "Renaissance", hint: "Da Vinci · Raphael", group: "movement" },
  { key: "baroque", label: "Baroque", hint: "Caravaggio · Vermeer", group: "movement" },
  { key: "romanticism", label: "Romanticism", hint: "Delacroix · Friedrich", group: "movement" },
  { key: "realism", label: "Realism", hint: "Courbet · Repin", group: "movement" },
  { key: "impressionism", label: "Impressionism", hint: "Monet · Van Gogh", group: "movement" },
  { key: "symbolism", label: "Symbolism", hint: "Klimt · Moreau", group: "movement" },
  { key: "modern", label: "Modern", hint: "Picasso · Dalí", group: "movement" },

  { key: "portraits", label: "Portraits", hint: "People & faces", group: "subject" },
  { key: "landscapes", label: "Landscapes", hint: "Nature & vistas", group: "subject" },
  { key: "stilllife", label: "Still life", hint: "Objects & flora", group: "subject" },
  { key: "religious", label: "Religious & myth", hint: "Sacred subjects", group: "subject" },

  { key: "french", label: "French", hint: "École de Paris", group: "origin" },
  { key: "italian", label: "Italian", hint: "Caravaggio · Titian", group: "origin" },
  { key: "dutch", label: "Dutch & Flemish", hint: "Rembrandt · Vermeer", group: "origin" },
  { key: "spanish", label: "Spanish", hint: "Velázquez · Goya", group: "origin" },
  { key: "german", label: "German", hint: "Dürer · Friedrich", group: "origin" },
  { key: "british", label: "British", hint: "Turner · Constable", group: "origin" },
  { key: "american", label: "American", hint: "Sargent · Hopper", group: "origin" },
  { key: "russian", label: "Russian", hint: "Repin · Kandinsky", group: "origin" },
  { key: "norwegian", label: "Norwegian", hint: "Munch · Dahl · Werenskiold", group: "origin" },
  { key: "nordic", label: "Nordic", hint: "Norway · Sweden · Denmark · Finland", group: "origin" },
];

const CAT_LABELS: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, c.label]),
);
export function categoryLabel(key: string): string {
  return CAT_LABELS[key] ?? key;
}

const FILEPATH = "https://commons.wikimedia.org/wiki/Special:FilePath/";
export function imageUrl(filename: string, width: number): string {
  return `${FILEPATH}${encodeURIComponent(filename)}?width=${width}`;
}

export function wikipediaUrl(id: string) {
  // Wikidata Q-id → "Special:GoToLinkedPage" picks the English Wikipedia article if one exists.
  return `https://www.wikidata.org/wiki/Special:GoToLinkedPage?site=enwiki&itemid=${id}`;
}

export function paintingsFor(all: Painting[], category: CategoryKey): Painting[] {
  if (category === "all") return all;
  return all.filter((p) => p.cats.includes(category));
}

export type GameMode = "painter" | "title" | "movement" | "country" | "decade";

export const GAME_MODES: {
  key: GameMode;
  label: string;
  question: string;
  hint: string;
}[] = [
  { key: "painter", label: "Painter", question: "Who painted this?", hint: "Guess the artist" },
  { key: "title", label: "Title", question: "What's it called?", hint: "Guess the painting's name" },
  { key: "movement", label: "Movement", question: "What movement is this?", hint: "Style or school" },
  { key: "country", label: "Country", question: "Where is it from?", hint: "Country of the artist" },
  { key: "decade", label: "Decade", question: "When was it painted?", hint: "Pick the decade" },
];

const MODE_BY_KEY: Record<GameMode, (typeof GAME_MODES)[number]> = Object.fromEntries(
  GAME_MODES.map((m) => [m.key, m]),
) as Record<GameMode, (typeof GAME_MODES)[number]>;
export function modeMeta(m: GameMode) {
  return MODE_BY_KEY[m];
}

// Category-derived country labels — Wikidata's artist nationality, mapped to
// a quiz-friendly country name. Keys are the CategoryKey origin buckets.
const COUNTRY_FROM_CAT: Record<string, string> = {
  french: "France",
  italian: "Italy",
  dutch: "Netherlands",
  spanish: "Spain",
  german: "Germany",
  british: "United Kingdom",
  american: "United States",
  russian: "Russia",
  norwegian: "Norway",
};

function paintingCountry(p: Painting): string | null {
  for (const c of p.cats) if (COUNTRY_FROM_CAT[c]) return COUNTRY_FROM_CAT[c];
  return null;
}

const NATIONALITY_FROM_CAT: Record<string, string> = {
  french: "French",
  italian: "Italian",
  dutch: "Dutch",
  spanish: "Spanish",
  german: "German",
  british: "British",
  american: "American",
  russian: "Russian",
  norwegian: "Norwegian",
};

export function paintingNationality(p: Painting): string | null {
  for (const c of p.cats) if (NATIONALITY_FROM_CAT[c]) return NATIONALITY_FROM_CAT[c];
  return null;
}

/** Standardise a movement label to sentence case — uppercase the first
    letter, leave the rest untouched (so "Pre-Raphaelite", "De Stijl" and
    other intentional internal capitals survive). Collapses case-only
    variants like "realism"/"Realism" into one consistent answer. */
export function formatMovement(mv: string | null | undefined): string | null {
  if (!mv) return null;
  return mv.charAt(0).toUpperCase() + mv.slice(1);
}

function paintingDecade(p: Painting): string | null {
  if (!p.year) return null;
  const y = parseInt(p.year, 10);
  if (Number.isNaN(y) || y < 1000 || y > 2030) return null;
  const decade = Math.floor(y / 10) * 10;
  return `${decade}s`;
}

/** Returns the answer string for a painting under a given mode, or null
    if the painting lacks the data required for that mode. */
export function modeTarget(p: Painting, mode: GameMode): string | null {
  switch (mode) {
    case "painter": return p.artist || null;
    case "title": return p.title || null;
    case "movement": return p.mv || null;
    case "country": return paintingCountry(p);
    case "decade": return paintingDecade(p);
  }
}

/** Restricts the pool to paintings that have a valid target for the mode. */
export function paintingsForMode(pool: Painting[], mode: GameMode): Painting[] {
  if (mode === "painter" || mode === "title") return pool; // every painting has these
  return pool.filter((p) => modeTarget(p, mode) !== null);
}

/** Builds 4 mutually-distinct choices (correct target + 3 distractors). */
export function buildChoicesForMode(
  correct: Painting,
  pool: Painting[],
  mode: GameMode,
  rng: () => number = Math.random,
): { choices: string[]; target: string } {
  const target = modeTarget(correct, mode);
  if (!target) {
    // Defensive fallback — caller should have filtered.
    return { choices: [correct.artist, "?", "?", "?"], target: correct.artist };
  }
  const seen = new Set<string>([target]);
  const candidates: string[] = [];
  for (const p of pool) {
    const t = modeTarget(p, mode);
    if (!t || seen.has(t)) continue;
    seen.add(t);
    candidates.push(t);
  }
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const distractors = candidates.slice(0, 3);
  // Pad with placeholders if the pool is tiny (shouldn't really happen).
  while (distractors.length < 3) distractors.push("—");
  const choices = [target, ...distractors];
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  return { choices, target };
}

/** Back-compat for painter-mode callers. */
export function buildChoices(
  correct: Painting,
  pool: Painting[],
  rng: () => number = Math.random,
): string[] {
  return buildChoicesForMode(correct, pool, "painter", rng).choices;
}

export function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
