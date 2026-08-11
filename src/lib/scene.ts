import { loadFromBlob, serializeAsJSON } from "@excalidraw/excalidraw";
import type { FrameInfo, LoadedScene, SceneElement, Unit } from "../types";

type AnySerializeElements = Parameters<typeof serializeAsJSON>[0];
type AnySerializeAppState = Parameters<typeof serializeAsJSON>[1];
type AnySerializeFiles = Parameters<typeof serializeAsJSON>[2];

export function isFrameElement(el: SceneElement): boolean {
  return el.type === "frame" || el.type === "magicframe";
}

/** The frame an element belongs to; bound text follows its container. */
function frameIdOf(
  el: SceneElement,
  byId: Map<string, SceneElement>,
): string | null {
  if (el.type === "text" && el.containerId) {
    const container = byId.get(el.containerId);
    if (container) return container.frameId ?? null;
  }
  return el.frameId ?? null;
}

/** Parse and normalize an .excalidraw file via Excalidraw's own restore logic. */
export async function loadScene(blob: Blob, name: string): Promise<LoadedScene> {
  const restored = await loadFromBlob(blob, null, null);
  let elements = (restored.elements as unknown as SceneElement[]).filter(
    (el) => !el.isDeleted,
  );
  if (elements.length === 0) {
    throw new Error("This file has no visible elements to present.");
  }

  // When the file uses frames they act as sections: only elements that live
  // inside a frame are presented; everything outside is set aside (kept for
  // save, never rendered). The frame elements themselves stay in the scene —
  // exportToSvg sizes the canvas from them (constant bounds) and clips
  // children to them — but they never become reveal units.
  const frameElements = elements.filter(isFrameElement);
  const omittedElements: SceneElement[] = [];
  if (frameElements.length > 0) {
    const byId = new Map(elements.map((el) => [el.id, el]));
    const frameIds = new Set(frameElements.map((f) => f.id));
    elements = elements.filter((el) => {
      if (isFrameElement(el)) return true;
      const frameId = frameIdOf(el, byId);
      if (frameId !== null && frameIds.has(frameId)) return true;
      omittedElements.push(el);
      return false;
    });
    if (elements.length === frameElements.length) {
      throw new Error("This file's frames are empty — nothing to present.");
    }
  }

  const frames: FrameInfo[] = frameElements.map((f, i) => ({
    id: f.id,
    name: f.name?.trim() || `Frame ${i + 1}`,
  }));

  return {
    name,
    elements,
    frames,
    omittedElements,
    appState: (restored.appState ?? {}) as Record<string, unknown>,
    files: (restored.files ?? {}) as Record<string, unknown>,
  };
}

interface PresenterStamp {
  step: number;
  duration: number;
}

function stampOf(el: SceneElement | undefined): Partial<PresenterStamp> | null {
  const presenter = el?.customData?.presenter;
  return presenter && typeof presenter === "object"
    ? (presenter as Partial<PresenterStamp>)
    : null;
}

/**
 * Serialize the scene back to .excalidraw JSON. The element array keeps its
 * original z-order (reveal order must never change stacking); instead each
 * element gets its unit's reveal position and duration stamped into
 * `customData.presenter`, which Excalidraw's restore preserves, so
 * re-uploading the file restores the arrangement. Elements that were outside
 * every frame are appended back unstamped.
 */
export function serializeScene(
  scene: LoadedScene,
  units: Unit[],
  order: string[],
  durations: Record<string, number>,
  defaultDuration: number,
): string {
  const unitById = new Map(units.map((u) => [u.id, u]));
  const stampByElement = new Map<string, PresenterStamp>();
  order.forEach((unitId, step) => {
    const duration = durations[unitId] ?? defaultDuration;
    for (const id of unitById.get(unitId)?.elementIds ?? []) {
      stampByElement.set(id, { step, duration });
    }
  });
  const elements = [
    ...scene.elements.map((el) => {
      const stamp = stampByElement.get(el.id);
      if (!stamp) return el;
      return { ...el, customData: { ...el.customData, presenter: stamp } };
    }),
    ...scene.omittedElements,
  ];
  return serializeAsJSON(
    elements as unknown as AnySerializeElements,
    scene.appState as AnySerializeAppState,
    scene.files as AnySerializeFiles,
    "local",
  );
}

/**
 * Initial reveal order + durations for a freshly loaded scene. Units carrying
 * `customData.presenter` stamps (written by serializeScene) are ordered by
 * their saved step; without stamps this is the computed natural order.
 * Stamped order is re-grouped frame by frame afterwards, in case the file
 * was rearranged in Excalidraw between save and reload.
 */
export function readSavedPresentation(
  elements: SceneElement[],
  units: Unit[],
  defaultDuration: number,
): { order: string[]; durations: Record<string, number> } {
  const byId = new Map(elements.map((el) => [el.id, el]));
  const stamps = new Map<string, Partial<PresenterStamp> | null>(
    units.map((u) => {
      for (const id of u.elementIds) {
        const stamp = stampOf(byId.get(id));
        if (typeof stamp?.step === "number") return [u.id, stamp];
      }
      return [u.id, null];
    }),
  );
  const durations = Object.fromEntries(
    units.map((u) => {
      const saved = stamps.get(u.id)?.duration;
      return [u.id, typeof saved === "number" && saved > 0 ? saved : defaultDuration];
    }),
  );

  if (![...stamps.values()].some((s) => s !== null)) {
    return { order: units.map((u) => u.id), durations };
  }

  // Saved step order; unstamped units (added after the save) keep their
  // natural position at the end, stably.
  const natural = new Map(units.map((u, i) => [u.id, i]));
  const stepFor = (id: string) =>
    stamps.get(id)?.step ?? Number.MAX_SAFE_INTEGER;
  const sorted = [...units].sort(
    (a, b) =>
      stepFor(a.id) - stepFor(b.id) || natural.get(a.id)! - natural.get(b.id)!,
  );
  // Restore the frame-contiguity invariant (frames ranked by first unit).
  const frameRank = new Map<string, number>();
  for (const u of sorted) {
    if (u.frameId !== null && !frameRank.has(u.frameId)) {
      frameRank.set(u.frameId, frameRank.size);
    }
  }
  if (frameRank.size > 0) {
    sorted.sort(
      (a, b) =>
        (frameRank.get(a.frameId ?? "") ?? 0) -
        (frameRank.get(b.frameId ?? "") ?? 0),
    );
  }
  return { order: sorted.map((u) => u.id), durations };
}

const TYPE_LABELS: Record<string, string> = {
  rectangle: "Rectangle",
  ellipse: "Ellipse",
  diamond: "Diamond",
  arrow: "Arrow",
  line: "Line",
  freedraw: "Drawing",
  image: "Image",
  frame: "Frame",
  magicframe: "Frame",
  embeddable: "Embed",
  iframe: "Embed",
};

function labelFor(members: SceneElement[]): { label: string; kind: string } {
  if (members.length > 1) {
    // Prefer the group's most meaningful text as its name.
    const text = members
      .filter((el) => el.type === "text" && el.text?.trim())
      .sort((a, b) => (b.text?.length ?? 0) - (a.text?.length ?? 0))[0];
    const label = text?.text
      ? truncate(text.text)
      : `${members.length} elements`;
    return { label, kind: "Group" };
  }
  const el = members[0];
  if (el.type === "text" && el.text?.trim()) {
    return { label: truncate(el.text), kind: "Text" };
  }
  return { label: TYPE_LABELS[el.type] ?? el.type, kind: TYPE_LABELS[el.type] ?? el.type };
}

function truncate(text: string): string {
  const line = text.trim().split("\n")[0];
  return line.length > 32 ? `${line.slice(0, 32)}…` : line;
}

/**
 * Partition the scene into reveal units, preserving drawing (z) order.
 * - Elements sharing an outermost group id form one unit.
 * - Text bound to a container (labels inside shapes / on arrows) travels
 *   with its container's unit.
 * - Everything else is its own unit.
 * - Frame elements are sections, never units; when frames exist, units are
 *   regrouped frame by frame (frames in drawing order, element order kept
 *   within each frame).
 */
export function computeUnits(elements: SceneElement[]): Omit<Unit, "thumbnail">[] {
  const byId = new Map(elements.map((el) => [el.id, el]));

  const unitKeyOf = (el: SceneElement): string => {
    // Bound text belongs with its container, which may itself be grouped.
    if (el.type === "text" && el.containerId) {
      const container = byId.get(el.containerId);
      if (container) {
        return container.groupIds.length > 0
          ? `group:${container.groupIds[container.groupIds.length - 1]}`
          : `el:${container.id}`;
      }
    }
    return el.groupIds.length > 0
      ? `group:${el.groupIds[el.groupIds.length - 1]}`
      : `el:${el.id}`;
  };

  const members = new Map<string, SceneElement[]>();
  const orderedKeys: string[] = [];
  for (const el of elements) {
    if (isFrameElement(el)) continue;
    const key = unitKeyOf(el);
    if (!members.has(key)) {
      members.set(key, []);
      orderedKeys.push(key);
    }
    members.get(key)!.push(el);
  }

  const units = orderedKeys.map((key) => {
    const els = members.get(key)!;
    const { label, kind } = labelFor(els);
    return {
      id: key,
      label,
      kind,
      frameId: frameIdOf(els[0], byId),
      elementIds: els.map((el) => el.id),
    };
  });

  // Element z-order may interleave children of different frames; a stable
  // sort by frame rank groups units frame by frame without disturbing the
  // in-frame order.
  const frameRank = new Map<string, number>();
  for (const el of elements) {
    if (isFrameElement(el)) frameRank.set(el.id, frameRank.size);
  }
  if (frameRank.size > 0) {
    units.sort(
      (a, b) =>
        (frameRank.get(a.frameId ?? "") ?? 0) -
        (frameRank.get(b.frameId ?? "") ?? 0),
    );
  }
  return units;
}
