// The site wordmark, top-left on every page. A plain <a href="/"> on purpose:
// it does a full document navigation (hard reload), so clicking it resets the
// quiz to a fresh state rather than a soft client-side route change.
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <a
      href="/"
      aria-label="artguessr — reload"
      title="artguessr — back to start"
      className={
        "font-display select-none text-[17px] font-bold lowercase tracking-tight leading-none text-ink transition hover:opacity-70 focus-ring rounded-md " +
        className
      }
    >
      art<span className="text-ink-muted">guessr</span>
    </a>
  );
}
