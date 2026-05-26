import data from "@/data/paintings.json";

export type Painting = {
  id: string;
  title: string;
  artist: string;
  year: string | null;
  image: string;
  categories: string[];
};

export const PAINTINGS = data as Painting[];

export type CategoryKey =
  | "popular"
  | "all"
  | "french"
  | "italian"
  | "dutch"
  | "impressionism"
  | "renaissance"
  | "modern";

export const CATEGORIES: { key: CategoryKey; label: string; hint: string }[] = [
  { key: "popular", label: "Popular", hint: "Most famous" },
  { key: "impressionism", label: "Impressionism", hint: "Monet · Van Gogh" },
  { key: "renaissance", label: "Renaissance", hint: "Da Vinci · Raphael" },
  { key: "modern", label: "Modern", hint: "Picasso · Dalí" },
  { key: "french", label: "French", hint: "École de Paris" },
  { key: "dutch", label: "Dutch & Flemish", hint: "Rembrandt · Vermeer" },
  { key: "italian", label: "Italian", hint: "Caravaggio · Titian" },
  { key: "all", label: "All", hint: "Full collection" },
];

export function paintingsFor(category: CategoryKey): Painting[] {
  if (category === "all") return PAINTINGS;
  return PAINTINGS.filter((p) => p.categories.includes(category));
}

export function uniqueArtists(list: Painting[]): string[] {
  const set = new Set<string>();
  for (const p of list) set.add(p.artist);
  return [...set];
}

// Pick 3 distractor artists similar (same category if possible).
export function buildChoices(
  correct: Painting,
  pool: Painting[],
  rng: () => number = Math.random,
): string[] {
  const candidates = new Set<string>();
  for (const p of pool) {
    if (p.artist !== correct.artist) candidates.add(p.artist);
  }
  const arr = [...candidates];
  // Fisher-Yates shuffle
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  const distractors = arr.slice(0, 3);
  const choices = [correct.artist, ...distractors];
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  return choices;
}

// Mulberry32 — small deterministic RNG for shuffles.
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

export function pickRandom<T>(arr: T[], n: number, rng: () => number = Math.random): T[] {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}
