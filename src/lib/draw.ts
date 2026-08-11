/**
 * Draw-in animation: replays a unit layer's SVG as if it were being drawn.
 * Stroked paths are traced with the stroke-dashoffset technique; everything
 * else (text, images, fill-only paths such as freedraw) fades in when its
 * turn comes. Runs on the inline-injected SVG DOM, in document order, so a
 * shape's outline appears before its hachure fill and its label.
 */

/** Stroke length drawn per second; total is clamped to [MIN_MS, MAX_MS]. */
const INK_PER_SECOND = 1600;
/** Pseudo-length charged for nodes that fade instead of tracing. */
const FADE_INK = 320;
const MIN_MS = 450;
const MAX_MS = 2400;

export interface DrawAnimation {
  /** Resolves when the layer has settled (finished or cancelled). */
  finished: Promise<void>;
  /** Jump to the settled (fully drawn) state immediately. */
  cancel: () => void;
}

interface Drawable {
  node: SVGGraphicsElement;
  kind: "trace" | "fade";
  length: number;
}

/**
 * Hidden elements in a unit layer carry stroke-opacity="0" fill-opacity="0"
 * on their group (that's how Excalidraw exports element opacity). Both are
 * inherited, so the computed style of any descendant tells the truth.
 */
function isHidden(node: SVGGraphicsElement): boolean {
  const cs = getComputedStyle(node);
  const strokeGone =
    cs.stroke === "none" || parseFloat(cs.strokeOpacity) === 0;
  const fillGone = cs.fill === "none" || parseFloat(cs.fillOpacity) === 0;
  return (strokeGone && fillGone) || parseFloat(cs.opacity) === 0;
}

/**
 * Collect drawables grouped per scene element. Excalidraw exports one
 * top-level `<g>` per element, so a unit with several elements (a group)
 * yields several buckets — they animate in parallel so the whole group is
 * drawn together, while paths inside one element still trace in order.
 */
function collectDrawables(svg: SVGSVGElement): Drawable[][] {
  const buckets = new Map<Element, Drawable[]>();
  for (const node of svg.querySelectorAll<SVGGraphicsElement>(
    "path, text, image",
  )) {
    // Mask/defs internals are plumbing, not ink.
    if (node.closest("mask, defs, metadata")) continue;
    if (isHidden(node)) continue;
    let drawable: Drawable;
    if (
      node instanceof SVGPathElement &&
      getComputedStyle(node).stroke !== "none"
    ) {
      let length = 0;
      try {
        length = node.getTotalLength();
      } catch {
        // Unmeasurable path: fall through to a fade.
      }
      drawable =
        length > 0
          ? { node, kind: "trace", length }
          : { node, kind: "fade", length: FADE_INK };
    } else {
      drawable = { node, kind: "fade", length: FADE_INK };
    }
    // The element root is the outermost <g> below the svg itself.
    let root: Element = node;
    while (true) {
      const parent: Element | null = root.parentElement;
      if (!parent || parent === svg) break;
      root = parent;
    }
    const bucket = buckets.get(root);
    if (bucket) bucket.push(drawable);
    else buckets.set(root, [drawable]);
  }
  return [...buckets.values()];
}

/**
 * Animate every visible shape in `container`'s SVG being drawn. Elements of
 * the unit start together (a group is one component, drawn as one); within
 * an element, paths trace sequentially in document order at a shared pace,
 * so the reveal lasts as long as the element with the most ink. Start
 * states are applied synchronously, so calling this before paint
 * (useLayoutEffect) guarantees no flash of the finished drawing. Returns
 * null when there is nothing to animate.
 */
export function animateDrawIn(container: HTMLElement): DrawAnimation | null {
  const svg = container.querySelector("svg");
  if (!svg) return null;
  const elements = collectDrawables(svg);
  if (elements.length === 0) return null;
  const drawables = elements.flat();

  // Normalize pace: the inkiest element sets the clamped total; everything
  // draws at the same (scaled) speed and shorter elements finish early.
  const inkOf = (bucket: Drawable[]) =>
    bucket.reduce((sum, d) => sum + d.length, 0);
  const maxInk = Math.max(...elements.map(inkOf));
  const totalMs = Math.min(
    MAX_MS,
    Math.max(MIN_MS, (maxInk / INK_PER_SECOND) * 1000),
  );
  const msPerInk = totalMs / maxInk;

  const animations: Animation[] = [];
  for (const bucket of elements) {
    let at = 0;
    for (const d of bucket) {
      const duration = Math.max(1, d.length * msPerInk);
      if (d.kind === "trace") {
        const path = d.node as SVGPathElement;
        // Inline styles override any authored dash pattern for the duration
        // of the trace; settling removes them, restoring dashed strokes.
        path.style.strokeDasharray = `${d.length}`;
        path.style.strokeDashoffset = `${d.length}`;
        animations.push(
          path.animate(
            [{ strokeDashoffset: d.length }, { strokeDashoffset: 0 }],
            { delay: at, duration, easing: "linear", fill: "both" },
          ),
        );
      } else {
        d.node.style.opacity = "0";
        animations.push(
          d.node.animate([{ opacity: 0 }, { opacity: 1 }], {
            delay: at,
            duration,
            easing: "ease",
            fill: "both",
          }),
        );
      }
      at += duration;
    }
  }

  let settled = false;
  const settle = () => {
    if (settled) return;
    settled = true;
    for (const a of animations) a.cancel();
    for (const d of drawables) {
      if (d.kind === "trace") {
        d.node.style.strokeDasharray = "";
        d.node.style.strokeDashoffset = "";
      } else {
        d.node.style.opacity = "";
      }
    }
  };

  const finished = Promise.all(animations.map((a) => a.finished)).then(
    settle,
    () => {
      // Cancelled mid-flight: `settle` already ran via cancel().
    },
  );
  return { finished, cancel: settle };
}
