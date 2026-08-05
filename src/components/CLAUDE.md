# src/components — screens

One file per screen; all are controlled components. `App.tsx` owns `scene`,
`units`, `order`, and `durations` — screens receive them plus callbacks and
keep only transient UI state (selection, drag state, autoplay progress).
`order` is an array of unit ids; `durations` is keyed by unit id, with
`DEFAULT_DURATION` (from `App.tsx`) as the fallback everywhere.

## UploadScreen.tsx

Drop zone + file picker + "Try the sample sketch" (fetches
`/sample.excalidraw`). Errors from parsing surface here via props.

## SetupScreen.tsx

- Drag reorder: `dragIndex` is the dragged card, `dropIndex` is an
  *insertion gap* (before/after decided by cursor vs. card midpoint), and
  the move commits on `dragEnd`. When dropping after the drag source, the
  target index is decremented because the source was removed first.
- The main preview renders the cumulative build up to the selected step via
  `renderStep`; the effect uses a `cancelled` flag so stale async renders
  never overwrite newer ones.
- Inputs inside step cards call `stopPropagation` on click so they don't
  change the selected step.

## PresentScreen.tsx

- Pre-renders every cumulative step SVG on mount (`renderAllSteps`) with a
  progress bar; nothing is rendered live during the show.
- Crossfade: only layers within ±1 of the current index stay mounted,
  stacked absolutely; stepping toggles CSS `opacity`. Correct alignment of
  the stack depends on the all-elements export invariant in
  `src/lib/CLAUDE.md`.
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
  Space/arrows keeps focused buttons from double-triggering.
- The timeline is duration-weighted: each segment's `flexGrow` is its
  step's duration; the current segment's fill shows autoplay progress, or
  reads "arrived" (full) when navigating manually.
