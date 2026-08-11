# src/components — screens

One file per screen; all are controlled components. `App.tsx` owns `scene`,
`units`, `order`, `durations`, plus `theme` (chrome light/dark),
`darkCanvas` (drawing rendered with Excalidraw's dark filter — independent
of chrome theme), and `spotlight` (dim earlier steps to 30%) — screens
receive them plus callbacks and keep only transient UI state (selection,
drag state, autoplay progress). `order` is an
array of unit ids; `durations` is keyed by unit id, with `DEFAULT_DURATION`
(from `App.tsx`) as the fallback everywhere. `ThemeToggle.tsx` is the shared
chrome-theme button (upload corner + setup topbar; the presenter has no
chrome theme).

## UploadScreen.tsx

Drop zone + file picker + "Try the sample sketch" (fetches
`/sample.excalidraw`). Errors from parsing surface here via props.

## SetupScreen.tsx

- Drag reorder: `dragIndex` is the dragged card, `dropIndex` is an
  *insertion gap* (before/after decided by cursor vs. card midpoint), and
  the move commits on `dragEnd`. When dropping after the drag source, the
  target index is decremented because the source was removed first.
- **Frames**: sections are derived as contiguous runs of `order` sharing a
  `frameId` (one anonymous section when the scene has none). `order` staying
  frame-contiguous is an invariant every reorder path preserves: card drags
  only offer drop gaps inside the dragged card's own frame, card ▲▼ disables
  at section edges (not list edges), and frame-header ▲▼ moves the whole
  section's ids as a block. Step indices stay global (`indexOfId`) — cards
  are numbered across sections.
- The main preview renders the cumulative build up to the selected step via
  `renderStep`; the effect uses a `cancelled` flag so stale async renders
  never overwrite newer ones.
- "Save file" downloads `serializeScene`'s JSON as `<scene.name>.excalidraw`
  (anchor-click download; arrangement persistence semantics live in
  `src/lib/CLAUDE.md`).
- Inputs inside step cards call `stopPropagation` on click so they don't
  change the selected step.

## PresentScreen.tsx

- Pre-renders every cumulative step SVG on mount (`renderAllSteps`) with a
  progress bar; nothing is rendered live during the show.
- In spotlight mode the deck has `order.length + 1` slides — the extra last
  one is the full drawing with dimming lifted. `count` (not `order.length`)
  is the source of truth for navigation, the counter, and the timeline;
  `durationOf` falls back to `DEFAULT_DURATION` for the restore frame.
- Crossfade: only layers within ±1 of the current index stay mounted,
  stacked absolutely; stepping toggles CSS `opacity`. Correct alignment of
  the stack depends on the all-elements export invariant in
  `src/lib/CLAUDE.md` — with frames, alignment holds within a frame and a
  frame boundary dissolves between two differently-cropped slides (each
  step's SVG is its frame's viewport; no PresentScreen code is
  frame-aware).
- Autoplay is a timestamp-based rAF clock. Two hard rules, both from a real
  StrictMode double-advance bug:
  1. No side effects inside setState updaters (React may invoke updaters
     twice) — advance/stop decisions happen in the rAF tick, not in
     updaters.
  2. `progressRef` mirrors the `progress` state so pausing keeps partial
     progress and resuming continues from it without the effect depending
     on `progress` (which would restart the clock every frame).
- Keyboard map lives in one `keydown` handler (documented in README);
  `Escape` exits setup only when not fullscreen, `preventDefault` on
  Space/arrows keeps focused buttons from double-triggering. Combos with
  ⌘/Ctrl are ignored (they're browser shortcuts, and F would otherwise
  fire on ⌘F).
- Laser pointer (`LaserPointer.tsx`): lit while ⌘/Ctrl is held. Keyup
  *and* window blur release it — ⌘Tab away swallows the Meta keyup. While
  lit, stage clicks don't advance and the stage cursor is hidden
  (`.laser-on`). The canvas overlay stays mounted for the whole show
  (`pointer-events: none`, above all slide layers) so the trail finishes
  fading after release; it idles to no-op frames when there's nothing to
  draw.
- The timeline is duration-weighted: each segment's `flexGrow` is its
  step's duration; the current segment's fill shows autoplay progress, or
  reads "arrived" (full) when navigating manually.
