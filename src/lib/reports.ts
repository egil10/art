import type { Painting } from "./paintings";

const KEY = "canvas.reports.v1";
const FILEPATH = "https://commons.wikimedia.org/wiki/Special:FilePath/";

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

function save(list: ReportEntry[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function reportPainting(p: Painting): ReportEntry {
  const entry: ReportEntry = {
    id: p.id,
    title: p.title,
    artist: p.artist,
    image: p.image,
    reportedAt: new Date().toISOString(),
  };
  const list = getReports();
  if (!list.some((r) => r.id === p.id)) {
    list.push(entry);
    save(list);
  }
  return entry;
}

export function removeReport(id: string) {
  save(getReports().filter((r) => r.id !== id));
}

export function clearReports() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}

export function isReported(id: string): boolean {
  if (typeof window === "undefined") return false;
  return getReports().some((r) => r.id === id);
}

/** Markdown-flavoured block ready to paste back in chat. */
export function formatReport(r: ReportEntry): string {
  const url = `${FILEPATH}${encodeURIComponent(r.image)}`;
  return `- **${r.id}** — "${r.title}" by ${r.artist}\n  ${url}`;
}

export function formatAllReports(reports: ReportEntry[]): string {
  if (reports.length === 0) return "";
  return `Reports queued (${reports.length}):\n` + reports.map(formatReport).join("\n");
}

/** Best-effort clipboard copy with a textarea fallback for older browsers. */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
