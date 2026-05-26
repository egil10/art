"use client";

import { useEffect, useState } from "react";
import { Copy, Trash2, X, Check, ExternalLink, Flag } from "lucide-react";
import {
  clearReports,
  copyToClipboard,
  formatAllReports,
  formatReport,
  getReports,
  removeReport,
  type ReportEntry,
} from "@/lib/reports";
import { imageUrl } from "@/lib/paintings";

export function ReportsModal({ onClose }: { onClose: () => void }) {
  const [reports, setReports] = useState<ReportEntry[]>(() => getReports());
  const [justCopied, setJustCopied] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleCopyAll() {
    const text = formatAllReports(reports);
    const ok = await copyToClipboard(text);
    if (ok) {
      setJustCopied(true);
      setTimeout(() => setJustCopied(false), 1500);
    }
  }

  async function handleCopyOne(r: ReportEntry) {
    await copyToClipboard(formatReport(r));
    setJustCopied(true);
    setTimeout(() => setJustCopied(false), 1200);
  }

  function handleRemove(id: string) {
    removeReport(id);
    setReports(getReports());
  }

  function handleClearAll() {
    clearReports();
    setReports([]);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center p-2 sm:items-center sm:p-6 animate-fade-in"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 frost-backdrop"
      />

      <div className="relative w-full max-w-xl animate-fade-up">
        <div className="frost overflow-hidden rounded-3xl">
          <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                Your queue
              </div>
              <div className="text-lg font-semibold text-ink">
                Reports ({reports.length})
              </div>
              <p className="mt-0.5 max-w-md text-[12px] text-ink-muted">
                Paste these in our chat and I&rsquo;ll drop or fix the matching
                paintings in the dataset.
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="grid h-9 w-9 place-items-center rounded-full bg-black/[0.05] text-ink/70 hover:bg-black/[0.08] hover:text-ink focus-ring"
            >
              <X size={16} />
            </button>
          </div>

          {reports.length === 0 ? (
            <div className="grid place-items-center px-6 py-10 text-sm text-ink-muted">
              <Flag size={18} className="mb-2 opacity-60" />
              No reports yet. Tap{" "}
              <span className="mx-1 inline-flex items-center gap-1 rounded-full bg-black/[0.05] px-2 py-0.5 text-[11px]">
                <Flag size={11} /> Report
              </span>{" "}
              on any painting.
            </div>
          ) : (
            <>
              <div className="flex items-center gap-1.5 px-5 pb-3">
                <button
                  onClick={handleCopyAll}
                  className="pill-solid focus-ring"
                >
                  {justCopied ? (
                    <>
                      <Check size={14} strokeWidth={2.2} />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy size={14} strokeWidth={2.2} />
                      Copy all
                    </>
                  )}
                </button>
                <button
                  onClick={handleClearAll}
                  className="pill-glass focus-ring"
                >
                  <Trash2 size={14} strokeWidth={2} />
                  Clear
                </button>
              </div>

              <ul className="max-h-[55vh] divide-y divide-black/[0.06] overflow-y-auto px-2 pb-2">
                {reports.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center gap-3 rounded-2xl px-3 py-2 hover:bg-white/40"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageUrl(r.image, 96)}
                      alt=""
                      loading="lazy"
                      className="h-12 w-12 shrink-0 rounded-lg object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-ink">
                        {r.title}
                      </div>
                      <div className="truncate text-[11px] text-ink-muted">
                        {r.artist} ·{" "}
                        <span className="font-mono">{r.id}</span>
                      </div>
                    </div>
                    <a
                      href={imageUrl(r.image, 1600)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="grid h-8 w-8 place-items-center rounded-full text-ink-muted hover:bg-black/[0.06] hover:text-ink focus-ring"
                      title="Open image"
                    >
                      <ExternalLink size={14} />
                    </a>
                    <button
                      onClick={() => handleCopyOne(r)}
                      className="grid h-8 w-8 place-items-center rounded-full text-ink-muted hover:bg-black/[0.06] hover:text-ink focus-ring"
                      title="Copy this report"
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      onClick={() => handleRemove(r.id)}
                      className="grid h-8 w-8 place-items-center rounded-full text-ink-muted hover:bg-red-50 hover:text-red-700 focus-ring"
                      title="Remove"
                    >
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
