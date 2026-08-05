# Excalidraw Presenter

Turn an Excalidraw sketch into a step-by-step presentation. Upload an
`.excalidraw` file, choose the order and timing of each piece like Google
Slides builds, then present with next/previous controls or autoplay.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:5173. Click **Try the sample sketch** to see the flow
without a file.

## How it works

- **Upload** — files are parsed with Excalidraw's own `loadFromBlob`, so
  anything the editor can open works here (including images).
- **Steps** — the scene is split into reveal units: elements that share a
  group become **one step**, text bound inside a shape travels with its
  container, and every other element is its own step. Default order is
  drawing (z) order.
- **Arrange** — drag steps in the filmstrip (or use ▲▼) to reorder, set
  per-step seconds for autoplay, and click any step to preview the build up
  to that point.
- **Present** — each step is pre-rendered with `exportToSvg`; hidden units
  are exported at zero opacity so the canvas never shifts between steps, and
  consecutive steps crossfade. Autoplay honours per-step timing, with an
  optional loop.

## Presenting shortcuts

| Key | Action |
| --- | --- |
| `→` / `Space` / `Enter` / click | Next step |
| `←` | Previous step |
| `P` or `K` | Play / pause autoplay |
| `L` | Toggle loop |
| `F` | Fullscreen |
| `Home` / `End` | First / last step |
| `Esc` | Exit to setup |

## Spotlight

**Spotlight current step** (checkbox under the setup preview) dims every
already-revealed step to 30% while the newest one appears at full strength —
ideal for walking through architecture diagrams. Spotlight shows get one
extra final frame with the dimming lifted, so you end on the complete
drawing.

## Dark mode

- The app chrome follows your OS theme by default; use the ☀︎/☾ button
  (upload screen or setup top bar) to override. The choice is remembered.
- **Dark canvas** (checkbox under the setup preview) renders the drawing
  itself with Excalidraw's dark-theme filter, for presenting in dark rooms.
  It's independent of the chrome theme and off by default.

## Notes

- Excalidraw's scene fonts are served locally from `public/fonts` (copied
  from `@excalidraw/excalidraw/dist/prod/fonts`); `EXCALIDRAW_ASSET_PATH` is
  set in `index.html`. If you upgrade the package, re-copy the fonts.
- Grouped elements are treated as a single component: group things in
  Excalidraw to reveal them together.
