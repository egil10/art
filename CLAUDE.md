# CLAUDE.md

Guidance for Claude Code when working in this repo.

## Project

**Canvas / artguessr** — an endless multiple-choice art quiz (guess the painter)
plus a searchable gallery, built with Next.js 16 (App Router), React 19,
Tailwind, lucide-react. No backend: the dataset is a static `public/paintings.json`
and per-user state (Elo rating, prefs, reports) lives in `localStorage`. Deploys
to Vercel. Domain: **artguessr.com**.

See `BLUEPRINT.md` for the full design-system + architecture spec.

## Working agreements

- **Always `git push` after committing.** When a change is complete and
  committed, push it to the remote without waiting to be asked. This is a
  continuously-deployed solo project — pushing to `main` triggers the Vercel
  deploy.
- Run `npx tsc --noEmit` and `npm run build` to validate changes (`next lint`
  was removed in Next 16 and is non-functional here).
- Keep the reducer in `Quiz.tsx` pure — do side effects (localStorage, timers)
  in effects, not in the reducer.
- Preserve the glass/pill design language and the "instant, keyboard-first, no
  layout jump" UX rules described in `BLUEPRINT.md`.
