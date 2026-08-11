# src/lib — scene parsing & SVG rendering

## scene.ts

- `loadScene` wraps Excalidraw's `loadFromBlob` — never hand-parse
  `.excalidraw` JSON; restore/validation (and re-measuring text) is theirs.
  Deleted elements are filtered out here, once; downstream code assumes it.
- **Frames**: if the file contains frame elements (`frame`/`magicframe`),
  `loadScene` drops every element that isn't inside one (bound text follows
  its container's `frameId` — editors don't always stamp the text itself).
  The frame elements stay in `scene.elements`: exportToSvg sizes the canvas
  from them (frames are "root" elements), so bounds cover all frames on
  every step, and it clips children to them. `LoadedScene.frames` lists
  them in drawing order with display names (`name` or "Frame N").
- **Save round-trip**: `serializeScene` writes the file back via
  Excalidraw's `serializeAsJSON` with the arrangement stamped into each
  element's `customData.presenter` (`{step, duration}`) — the element
  array keeps its original z-order (reveal order must never change
  stacking), and `omittedElements` (outside-frame content dropped at load)
  are appended back so saving never deletes user content. On load,
  `readSavedPresentation` orders units by their stamps (restore preserves
  `customData`), appends unstamped units at the end, and re-groups by
  frame to restore the contiguity invariant; files without stamps get the
  natural order.
- `computeUnits` partitions elements into reveal units:
  - outermost group id (`groupIds[last]`) = one unit (`id: "group:<gid>"`);
  - ungrouped element = its own unit (`id: "el:<id>"`);
  - bound text (`type === "text" && containerId`) always joins its
    *container's* unit, even when the container is grouped — labels must
    never appear before their shape.
  - frame elements are never units; each unit carries the `frameId` of its
    members, and when frames exist units are stable-sorted by frame (frames
    in drawing order) so the default order is frame-contiguous — z-order in
    the file may interleave children of different frames.
  - Unit order preserves element (z/drawing) order; that's the default
    reveal order shown to the user.

## render.ts

- `renderStep`/`renderAllSteps` take a `RenderOptions` object
  (`darkCanvas`, `spotlight`). Spotlight gives three opacity tiers: current
  unit at its own opacity, earlier units at 30% of theirs
  (`SPOTLIGHT_DIM`), future units at 0. `renderAllSteps` appends one extra
  final frame with spotlight lifted (full drawing) — the presenter counts
  slides as `order.length + 1` in that mode.
- **Core invariant**: `renderStep` exports *all* scene elements every time —
  not-yet-revealed ones get `opacity: 0`, they are never filtered out.
  `exportToSvg` fits its canvas to the elements it receives, so including
  everything keeps the bounds/viewBox identical across steps. The
  presenter's crossfade stacks step SVGs on top of each other and relies on
  this pixel-perfect alignment. If you filter elements instead, steps will
  shift and zoom.
- **Framed scenes present frame by frame**: `renderStep` passes the current
  step's frame as `exportingFrame`, so the canvas *is* that frame's rect
  (padding 0, children clipped, exportToSvg selects overlapping elements
  itself). The alignment invariant then holds *per frame* — steps of one
  frame share the frame-rect viewBox; crossing a frame boundary is a
  deliberate dissolve between two slide crops.
- **clipPath ids must be scoped per export** (`scopeClipPathIds`):
  exportToSvg names clipPaths after frame ids, several step SVGs are
  mounted at once (crossfade layers + preview), and `url(#id)` resolves
  document-wide to the first match. With per-frame viewports the same
  frame's clip rect sits at different coordinates in different steps, so
  an unscoped collision clips content with another slide's geometry and
  blanks it.
- Z-order is also preserved by this: we map over `scene.elements` in place,
  so reveal order never changes stacking order.
- **Frame opacity is load-bearing**: the SVG renderer multiplies every
  child's opacity by its containing frame's (`frameOpacity × elOpacity`),
  so `renderStep` must pass frame elements through *untouched* — zeroing a
  frame blanks its whole section. They draw nothing themselves because
  `exportAppState` sets `frameRendering: {name: false, outline: false}`;
  names especially must stay off — exportToSvg injects them as synthetic
  full-opacity text elements that would ignore the reveal. `clip: true`
  keeps children clipped to their frame like in the editor.
- `toResponsiveSvg` strips fixed width/height (keeping/synthesizing
  `viewBox`, `preserveAspectRatio="xMidYMid meet"`) so SVGs letterbox into
  any container. Callers inject the returned markup with
  `dangerouslySetInnerHTML`.
- **Dark canvas**: `renderStep`/`renderAllSteps` take a `darkCanvas` flag →
  `exportWithDarkMode`. Excalidraw expresses it as a `filter` *attribute* on
  the svg root, which any stylesheet `filter` rule on the svg would silently
  override — `toResponsiveSvg` promotes it to an inline style, and all
  drop-shadows in `index.css` live on wrapper elements, never on the svg.
  Thumbnails intentionally ignore the flag (always light, on white tiles).
- Thumbnails are the exception to the all-elements rule: they render only
  the unit's own elements, tightly cropped, without background.
- `exportToSvg` is async and fetches fonts via `EXCALIDRAW_ASSET_PATH`
  (see root CLAUDE.md); it inlines used fonts into each SVG, which is why
  exported text renders correctly inside `<img>`-less inline injection.
