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
  frameId?: string | null;
  isDeleted?: boolean;
  containerId?: string | null;
  text?: string;
  /** Frames carry a user-given name (may be null). */
  name?: string | null;
  /** Excalidraw's app-extension field; survives save/load round-trips. */
  customData?: Record<string, unknown>;
  [key: string]: unknown;
}

/** A frame in the scene, in drawing order, with a display-ready name. */
export interface FrameInfo {
  id: string;
  name: string;
}

export interface LoadedScene {
  name: string;
  elements: SceneElement[];
  /** Frames in drawing order; empty when the scene has none. */
  frames: FrameInfo[];
  /** Elements outside every frame — never presented, but written back on
   * save so downloading the file doesn't silently delete user content. */
  omittedElements: SceneElement[];
  appState: Record<string, unknown>;
  files: Record<string, unknown>;
}

/** One reveal step: a top-level group, or a single ungrouped element. */
export interface Unit {
  id: string;
  label: string;
  kind: string;
  /** Frame this unit lives in, or null when the scene has no frames. */
  frameId: string | null;
  elementIds: string[];
  /** Standalone SVG markup for the filmstrip thumbnail. */
  thumbnail: string | null;
}
