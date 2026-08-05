import { exportToSvg } from "@excalidraw/excalidraw";
import type { LoadedScene, SceneElement, Unit } from "../types";

type AnyElements = Parameters<typeof exportToSvg>[0]["elements"];
type AnyFiles = Parameters<typeof exportToSvg>[0]["files"];

function exportAppState(scene: LoadedScene, darkCanvas: boolean) {
  return {
    ...scene.appState,
    exportBackground: true,
    // Excalidraw applies its dark-theme inversion filter at export time;
    // the stored scene colors are always the light ones.
    exportWithDarkMode: darkCanvas,
    exportEmbedScene: false,
    viewBackgroundColor:
      (scene.appState.viewBackgroundColor as string) || "#ffffff",
  };
}

/** Serialize an exported SVG so it scales to its container (letterboxed). */
function toResponsiveSvg(svg: SVGSVGElement): string {
  const width = svg.getAttribute("width");
  const height = svg.getAttribute("height");
  if (!svg.getAttribute("viewBox") && width && height) {
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  }
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  // Excalidraw applies its dark-mode inversion as a `filter` *attribute* on
  // the root; any stylesheet `filter` on the svg would override it (CSS
  // beats presentation attributes). Promote it to an inline style so it
  // always survives — which is also why our drop-shadows live on wrapper
  // elements, never on the svg itself.
  const themeFilter = svg.getAttribute("filter");
  if (themeFilter) {
    svg.removeAttribute("filter");
    svg.style.filter = themeFilter;
  }
  return svg.outerHTML;
}

export interface RenderOptions {
  /** Render the drawing with Excalidraw's dark-theme filter. */
  darkCanvas?: boolean;
  /** Dim already-revealed units to 30% so the newest unit stands out. */
  spotlight?: boolean;
}

/** How much of their own opacity dimmed units keep in spotlight mode. */
const SPOTLIGHT_DIM = 0.3;

/**
 * Render the cumulative state of one step: every element is included so the
 * canvas bounds never shift between steps, but elements belonging to units
 * that haven't been revealed yet are exported fully transparent. With
 * `spotlight`, units revealed before this step keep only 30% of their own
 * opacity, putting the current step's unit in focus.
 */
export async function renderStep(
  scene: LoadedScene,
  units: Unit[],
  order: string[],
  upToIndex: number,
  { darkCanvas = false, spotlight = false }: RenderOptions = {},
): Promise<string> {
  const unitById = new Map(units.map((u) => [u.id, u]));
  // Element id → position of its unit in the reveal order.
  const revealIndex = new Map<string, number>();
  for (let i = 0; i < order.length; i++) {
    for (const id of unitById.get(order[i])?.elementIds ?? []) {
      revealIndex.set(id, i);
    }
  }
  const elements = scene.elements.map((el) => {
    const idx = revealIndex.get(el.id);
    if (idx === undefined || idx > upToIndex) return { ...el, opacity: 0 };
    if (spotlight && idx < upToIndex) {
      return { ...el, opacity: el.opacity * SPOTLIGHT_DIM };
    }
    return el;
  });
  const svg = await exportToSvg({
    elements: elements as unknown as AnyElements,
    appState: exportAppState(scene, darkCanvas),
    files: scene.files as AnyFiles,
    exportPadding: 24,
  });
  return toResponsiveSvg(svg);
}

/**
 * Render every cumulative step for presenting. In spotlight mode one extra
 * final frame is appended with the dimming lifted, so the show ends on the
 * complete drawing at full strength.
 */
export async function renderAllSteps(
  scene: LoadedScene,
  units: Unit[],
  order: string[],
  options: RenderOptions = {},
  onProgress?: (done: number, total: number) => void,
): Promise<string[]> {
  const total = order.length + (options.spotlight ? 1 : 0);
  const out: string[] = [];
  for (let i = 0; i < order.length; i++) {
    out.push(await renderStep(scene, units, order, i, options));
    onProgress?.(out.length, total);
  }
  if (options.spotlight) {
    out.push(
      await renderStep(scene, units, order, order.length - 1, {
        ...options,
        spotlight: false,
      }),
    );
    onProgress?.(out.length, total);
  }
  return out;
}

/** Render a unit alone, tightly cropped, for filmstrip thumbnails. */
export async function renderUnitThumbnail(
  scene: LoadedScene,
  unit: Omit<Unit, "thumbnail">,
): Promise<string | null> {
  const ids = new Set(unit.elementIds);
  const elements = scene.elements.filter((el) => ids.has(el.id));
  if (elements.length === 0) return null;
  try {
    // Thumbnails are always rendered light: they sit on white tiles in the
    // filmstrip regardless of chrome theme or the canvas setting.
    const svg = await exportToSvg({
      elements: elements as unknown as AnyElements,
      appState: {
        ...exportAppState(scene, false),
        exportBackground: false,
      },
      files: scene.files as AnyFiles,
      exportPadding: 8,
    });
    return toResponsiveSvg(svg);
  } catch {
    return null;
  }
}

/** Attach thumbnails to computed units. */
export async function withThumbnails(
  scene: LoadedScene,
  units: Omit<Unit, "thumbnail">[],
): Promise<Unit[]> {
  return Promise.all(
    units.map(async (unit) => ({
      ...unit,
      thumbnail: await renderUnitThumbnail(scene, unit),
    })),
  );
}

export type { SceneElement };
