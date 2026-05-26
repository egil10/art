"use client";

import { useEffect, useState } from "react";
import type { Painting } from "./paintings";

let cache: Painting[] | null = null;
let inflight: Promise<Painting[]> | null = null;

async function load(): Promise<Painting[]> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = fetch("/paintings.json", { cache: "force-cache" })
    .then((r) => {
      if (!r.ok) throw new Error(`Failed to load paintings: ${r.status}`);
      return r.json();
    })
    .then((data: Painting[]) => {
      cache = data;
      return data;
    });
  return inflight;
}

export function usePaintings() {
  const [paintings, setPaintings] = useState<Painting[] | null>(cache);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (cache) {
      setPaintings(cache);
      return;
    }
    let cancelled = false;
    load()
      .then((data) => {
        if (!cancelled) setPaintings(data);
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
