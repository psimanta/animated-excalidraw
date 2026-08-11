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
- **Frames** — if the file uses Excalidraw frames, only elements inside
  frames are presented and each frame becomes a slide: the stage shows one
  frame at a time, its steps reveal within it, and stepping past a frame's
  last step dissolves to the next frame.
- **Arrange** — drag steps in the filmstrip (or use ▲▼) to reorder, set
  per-step seconds for autoplay, and click any step to preview the build up
  to that point.
- **Save** — the **Save file** button downloads a regular `.excalidraw`
  file with the reveal order and timings stamped into each element's
  `customData`. The drawing itself is untouched (z-order and all), so it
  still opens normally in Excalidraw — and re-uploading it here restores
  your arrangement.
- **Present** — each step is pre-rendered with `exportToSvg`; hidden units
  are exported at zero opacity so the canvas never shifts between steps, and
  consecutive steps crossfade. Autoplay honours per-step timing, with an
  optional loop.

## Presenting shortcuts

| Key | Action |
| --- | --- |
| `→` / `Space` / `Enter` / click | Next step |
| `←` | Previous step |
| Hold `⌘` / `Ctrl` | Laser pointer |
| `P` or `K` | Play / pause autoplay |
| `L` | Toggle loop |
| `F` | Fullscreen |
| `Home` / `End` | First / last step |
| `Esc` | Exit to setup |

## Laser pointer

Hold `⌘` (or `Ctrl`) while presenting to turn the cursor into a laser
pointer — a red dot with a fading trail for tracing over the drawing.
Clicks while the laser is lit don't advance the step; release the key to
get the normal cursor back.

## Spotlight

**Spotlight current step** (checkbox under the setup preview) dims every
already-revealed step to 30% while the newest one appears at full strength —
ideal for walking through architecture diagrams. Spotlight shows get one
extra final frame with the dimming lifted, so you end on the complete
drawing.

## Frames

Frames turn the show into sections. When a file contains frames:

- Only elements that live **inside** a frame are presented — anything on
  the loose canvas around them is dropped.
- The filmstrip groups steps under their frame (named, or "Frame N").
  Drag/▲▼ reorders steps **within** a frame; the ▲▼ on a frame header
  moves the whole frame — and all its steps — as one block.
- **Each frame is a slide**: the stage crops to the current step's frame,
  steps build up inside it, and moving past a frame's last step dissolves
  to the next frame. The setup preview follows the selected step's frame
  the same way.
- Content is clipped to its frame like in the editor, but frame names and
  outlines are not drawn.

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
