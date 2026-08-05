/**
 * Minimal structural types for the Excalidraw data we touch.
 * The full element types live in @excalidraw/excalidraw; we only rely on the
 * fields below and pass elements back to its APIs otherwise untouched.
 */
export interface SceneElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  groupIds: string[];
  isDeleted?: boolean;
  containerId?: string | null;
  text?: string;
  [key: string]: unknown;
}

export interface LoadedScene {
  name: string;
  elements: SceneElement[];
  appState: Record<string, unknown>;
  files: Record<string, unknown>;
}

/** One reveal step: a top-level group, or a single ungrouped element. */
export interface Unit {
  id: string;
  label: string;
  kind: string;
  elementIds: string[];
  /** Standalone SVG markup for the filmstrip thumbnail. */
  thumbnail: string | null;
}
