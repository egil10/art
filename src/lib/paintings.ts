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
  | "russian";

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

export function buildChoices(
  correct: Painting,
  pool: Painting[],
  rng: () => number = Math.random,
): string[] {
  const seen = new Set<string>();
  const candidates: string[] = [];
  for (const p of pool) {
    if (p.artist !== correct.artist && !seen.has(p.artist)) {
      seen.add(p.artist);
      candidates.push(p.artist);
    }
  }
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const distractors = candidates.slice(0, 3);
  const choices = [correct.artist, ...distractors];
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  return choices;
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
