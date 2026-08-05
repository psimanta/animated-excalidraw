# src/lib — scene parsing & SVG rendering

## scene.ts

- `loadScene` wraps Excalidraw's `loadFromBlob` — never hand-parse
  `.excalidraw` JSON; restore/validation (and re-measuring text) is theirs.
  Deleted elements are filtered out here, once; downstream code assumes it.
- `computeUnits` partitions elements into reveal units:
  - outermost group id (`groupIds[last]`) = one unit (`id: "group:<gid>"`);
  - ungrouped element = its own unit (`id: "el:<id>"`);
  - bound text (`type === "text" && containerId`) always joins its
    *container's* unit, even when the container is grouped — labels must
    never appear before their shape.
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
- Z-order is also preserved by this: we map over `scene.elements` in place,
  so reveal order never changes stacking order.
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
