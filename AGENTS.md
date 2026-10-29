# Prototype Instructions

## Project decisions

- GitHub repository: https://github.com/yuunium/triangle. Primary deployment is Cloudflare Workers at https://sankaku.linetoslack.workers.dev/, with D1 for rankings. The user authorized migration and Workers/D1 creation and updates. GitHub Pages is a redirect preserving the shape query. Preserve relative asset URLs.
- Selected visual: latest option 1, warm white canvas, orange geometry, charcoal action button. Use restrained Japanese sans-serif typography and generous space. User subsequently requested removing the background dot grid; keep the board plain.
- Preserve the loop: select a regular polygon with 3–7 vertices, place its points in perimeter order, explicitly score, then freeze that round. Every placed point is immediately fixed: no dragging, keyboard movement, or single-point undo, including before scoring. Keyboard arrows move only the next-point cursor. Restarting or switching shape begins a new round.
- Make the heptagon the main challenge: initial title "正七角形、つくれる？" and a primary start action for 7 points. Put triangles through hexagons in a collapsed practice section. The user removed the octagon; do not offer or score it, and old octagon links fall back to the heptagon entry. Keep SANKAKU branding. The root URL defaults to 7; shared links for other shapes must include an explicit sides parameter and have a matching entry action.
- Restart immediately with the same shape, without asking again. Show the nearest regular polygon by default after each valid score; retain the checkbox to hide it.
- Result sharing stays static: generate a PNG locally, offer native file sharing where supported, and provide PNG saving plus an X composer link with clear manual-attachment instructions. Do not add API secrets or automatic posting.
- Apply Emil Kowalski's design-engineering principles: immediate point placement, 120ms press feedback, brief purposeful result transitions, keyboard and reduced-motion support.
- The interactive geometry is functional canvas graphics, not a decorative image asset.
- Keep scoring in src/geometry.mjs independent of React and any future ranking service.
- Ranking applies only to the main heptagon challenge. Recompute scores from submitted coordinates on the server; never trust a submitted score. Use a one-use, expiring server round tied to an HttpOnly player cookie. Store one best per browser, rank equal displayed percentages equally, and keep names public only after an explicit registration action. Keep anti-abuse limits and explain browser-local identity. This casual ranking cannot prove that submitted coordinates were placed manually.
- Cloudflare backend lives in cloudflare/index.mjs; keep the Sites starter worker intact. Use npm test and npm run build:cloudflare before npm exec -- wrangler deploy. D1 migrations live in cloudflare/migrations; never commit credentials, .wrangler state or .dev.vars.

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.
