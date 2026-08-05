# Excalidraw Presenter

Web app that turns an `.excalidraw` file into a step-by-step presentation:
upload → order/time the reveal steps → present with prev/next or autoplay.
Stack: Vite, React 19, TypeScript, `@excalidraw/excalidraw` 0.18 (rendering
only — the editor component is never mounted; we use `loadFromBlob` +
`exportToSvg`).

## Commands

- `npm run dev` — dev server on http://localhost:5173
- `npm run build` — type-check + production build
- `npm run lint` — oxlint

No test suite. Verify changes by driving the app in a browser (load the
sample from the upload screen, reorder, present, autoplay).

## Architecture

`src/App.tsx` is a three-screen state machine and the single owner of all
presentation state:

- `scene` — parsed file (`LoadedScene`), `units` — reveal units, `order` —
  unit ids in reveal order, `durations` — seconds per unit id.
- Screens (`src/components/`) are controlled: they receive state + callbacks
  and hold only local UI state. See `src/components/CLAUDE.md`.
- Scene parsing, unit computation, and SVG rendering live in `src/lib/`.
  Core invariants are documented in `src/lib/CLAUDE.md` — read it before
  touching rendering.

`src/types.ts` defines minimal structural types (`SceneElement` etc.) so we
don't depend on Excalidraw's exported types; elements are passed back to its
APIs otherwise untouched.

## Cross-cutting gotchas

- **Fonts**: `public/fonts/` is a copy of
  `node_modules/@excalidraw/excalidraw/dist/prod/fonts`. `index.html` sets
  `window.EXCALIDRAW_ASSET_PATH = "/"` in an inline script that must run
  before any Excalidraw module code, so scene fonts load from this origin
  (works offline, no CDN). After upgrading `@excalidraw/excalidraw`,
  re-copy the fonts folder — subset filenames are content-hashed. The app
  UI itself uses two of these fonts via `@font-face` in `src/index.css`
  (Excalifont Latin subset, Cascadia); those URLs contain hashes too.
- **`public/sample.excalidraw`** is hand-authored; Excalidraw's `restore`
  fills in missing element fields, so it only carries the props that matter.
  Group membership there (`groupIds`) is what makes the sample demonstrate
  grouped reveals.
- All styling is in `src/index.css` — one file, design tokens at the top
  (paper-white chrome, dark presenter stage, Excalidraw-violet accent).
