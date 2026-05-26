import type { Painting } from "./paintings";

const KEY = "canvas.reports.v1";

export type ReportEntry = {
  id: string;
  title: string;
  artist: string;
  image: string;
  reportedAt: string;
};

export function getReports(): ReportEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function reportPainting(p: Painting) {
  if (typeof window === "undefined") return;
  const list = getReports();
  if (list.some((r) => r.id === p.id)) return;
  list.push({
    id: p.id,
    title: p.title,
    artist: p.artist,
    image: p.image,
    reportedAt: new Date().toISOString(),
  });
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function clearReports() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}
