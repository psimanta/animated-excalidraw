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

/**
 * Render the cumulative state of one step: every element is included so the
 * canvas bounds never shift between steps, but elements belonging to units
 * that haven't been revealed yet are exported fully transparent.
 */
export async function renderStep(
  scene: LoadedScene,
  units: Unit[],
  order: string[],
  upToIndex: number,
  darkCanvas = false,
): Promise<string> {
  const unitById = new Map(units.map((u) => [u.id, u]));
  const visible = new Set<string>();
  for (let i = 0; i <= upToIndex && i < order.length; i++) {
    for (const id of unitById.get(order[i])?.elementIds ?? []) {
      visible.add(id);
    }
  }
  const elements = scene.elements.map((el) =>
    visible.has(el.id) ? el : { ...el, opacity: 0 },
  );
  const svg = await exportToSvg({
    elements: elements as unknown as AnyElements,
    appState: exportAppState(scene, darkCanvas),
    files: scene.files as AnyFiles,
    exportPadding: 24,
  });
  return toResponsiveSvg(svg);
}

/** Render every cumulative step for presenting. */
export async function renderAllSteps(
  scene: LoadedScene,
  units: Unit[],
  order: string[],
  darkCanvas = false,
  onProgress?: (done: number, total: number) => void,
): Promise<string[]> {
  const out: string[] = [];
  for (let i = 0; i < order.length; i++) {
    out.push(await renderStep(scene, units, order, i, darkCanvas));
    onProgress?.(i + 1, order.length);
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
