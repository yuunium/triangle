# Prototype Instructions

## Project decisions

- GitHub repository: https://github.com/yuunium/triangle. Target GitHub Pages; preserve relative asset URLs.
- Selected visual: latest option 1, warm white canvas, orange geometry, charcoal action button. Use restrained Japanese sans-serif typography and generous space. User subsequently requested removing the background dot grid; keep the board plain.
- Preserve the loop: select a regular polygon with 3–8 vertices, place its points in perimeter order, adjust before scoring, explicitly score, then freeze that round. Scored vertices must never respond to drag or keyboard editing; restarting or switching shape begins a new round.
- Result sharing stays static: generate a PNG locally, offer native file sharing where supported, and provide PNG saving plus an X composer link with clear manual-attachment instructions. Do not add API secrets or automatic posting.
- Apply Emil Kowalski's design-engineering principles: immediate functional dragging, 120ms press feedback, brief purposeful result transitions, keyboard and reduced-motion support.
- The interactive geometry is functional canvas graphics, not a decorative image asset.
- Keep scoring in src/geometry.mjs independent of React and any future ranking service.

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.
