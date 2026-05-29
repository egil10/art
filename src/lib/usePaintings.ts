"use client";

import { useEffect, useState } from "react";
import { formatMovement, type Painting } from "./paintings";

// Bump this when the dataset is regenerated. It's a query-string cache-buster:
// the JSON files are served `immutable` (see next.config), so a new version is
// the only thing that makes browsers refetch. Applies to both files below.
const DATA_VERSION = "3";

// Module-level caches so navigating between the quiz and gallery (or remounting)
// never refetches. `full` is the authoritative 10k set; `seed` is the ~300
// "popular" paintings shipped as a tiny file for a near-instant first paint.
let full: Painting[] | null = null;
let seed: Painting[] | null = null;
let inflightFull: Promise<Painting[]> | null = null;
let inflightSeed: Promise<Painting[]> | null = null;

function normalize(data: Painting[]): Painting[] {
  for (const p of data) p.mv = formatMovement(p.mv);
  return data;
}

function fetchJSON(path: string): Promise<Painting[]> {
  // force-cache + the versioned, immutable URL means a warm cache is reused
  // with no revalidation round-trip — repeat visits load the data instantly.
  return fetch(`${path}?v=${DATA_VERSION}`, { cache: "force-cache" }).then(
    (r) => {
      if (!r.ok) throw new Error(`Failed to load paintings: ${r.status}`);
      return r.json();
    },
  );
}

function loadFull(): Promise<Painting[]> {
  if (full) return Promise.resolve(full);
  if (!inflightFull) {
    inflightFull = fetchJSON("/paintings.json").then((d) => (full = normalize(d)));
  }
  return inflightFull;
}

function loadSeed(): Promise<Painting[]> {
  if (seed) return Promise.resolve(seed);
  if (!inflightSeed) {
    inflightSeed = fetchJSON("/paintings-popular.json").then(
      (d) => (seed = normalize(d)),
    );
  }
  return inflightSeed;
}

export function usePaintings() {
  const [paintings, setPaintings] = useState<Painting[] | null>(full);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (full) {
      setPaintings(full);
      return;
    }
    let cancelled = false;
    // Show the popular seed the moment it lands so the quiz is playable fast…
    loadSeed()
      .then((s) => {
        if (!cancelled && !full) setPaintings((prev) => prev ?? s);
      })
      .catch(() => {
        /* seed is an optimization only — the full load below is authoritative */
      });
    // …then swap in the complete set (kicked off in parallel) when ready.
    loadFull()
      .then((d) => {
        if (!cancelled) setPaintings(d);
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { paintings, error, loading: !paintings && !error };
}
