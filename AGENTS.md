<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Mobile-first, fully responsive

This app must be 100% mobile responsive. Design for mobile first, but every page must still look good on desktop.

- Write base styles for small screens, then scale up with breakpoints (`sm:`, `md:`, `lg:`). Do not design for desktop and patch mobile afterwards.
- No horizontal page scroll at any width down to 320px. Use fluid widths, and let long content wrap or scroll inside its own container.
- Tap targets are at least 44×44px, with enough spacing that adjacent controls aren't mis-tapped. Don't rely on hover for anything essential.
- Body text stays readable on phones (16px base; inputs at least 16px so iOS doesn't zoom on focus).
- On wide screens, constrain content with max-width containers and use extra columns where it helps, instead of stretching lines edge to edge.
- Respect safe-area insets (`env(safe-area-inset-*)`) for fixed or full-bleed elements.
- Verify every UI change at phone width (~375px) and at desktop width before calling it done.
