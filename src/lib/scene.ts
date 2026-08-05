import { loadFromBlob } from "@excalidraw/excalidraw";
import type { LoadedScene, SceneElement, Unit } from "../types";

/** Parse and normalize an .excalidraw file via Excalidraw's own restore logic. */
export async function loadScene(blob: Blob, name: string): Promise<LoadedScene> {
  const restored = await loadFromBlob(blob, null, null);
  const elements = (restored.elements as unknown as SceneElement[]).filter(
    (el) => !el.isDeleted,
  );
  if (elements.length === 0) {
    throw new Error("This file has no visible elements to present.");
  }
  return {
    name,
    elements,
    appState: (restored.appState ?? {}) as Record<string, unknown>,
    files: (restored.files ?? {}) as Record<string, unknown>,
  };
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
    const key = unitKeyOf(el);
    if (!members.has(key)) {
      members.set(key, []);
      orderedKeys.push(key);
    }
    members.get(key)!.push(el);
  }

  return orderedKeys.map((key) => {
    const els = members.get(key)!;
    const { label, kind } = labelFor(els);
    return { id: key, label, kind, elementIds: els.map((el) => el.id) };
  });
}
