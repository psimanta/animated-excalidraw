import { useCallback, useEffect, useState } from "react";
import type { LoadedScene, Unit } from "./types";
import { computeUnits, loadScene } from "./lib/scene";
import { withThumbnails } from "./lib/render";
import { UploadScreen } from "./components/UploadScreen";
import { SetupScreen } from "./components/SetupScreen";
import { PresentScreen } from "./components/PresentScreen";

export const DEFAULT_DURATION = 3;

type Theme = "light" | "dark";

export default function App() {
  const [scene, setScene] = useState<LoadedScene | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [order, setOrder] = useState<string[]>([]);
  const [durations, setDurations] = useState<Record<string, number>>({});
  const [presenting, setPresenting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Render the drawing itself with Excalidraw's dark filter. */
  const [darkCanvas, setDarkCanvas] = useState(false);
  /** Dim earlier steps to 30% so the newest reveal stands out. */
  const [spotlight, setSpotlight] = useState(false);
  // The inline script in index.html resolves the initial theme (saved
  // preference, else OS setting) before first paint; pick it up from there.
  const [theme, setTheme] = useState<Theme>(() =>
    document.documentElement.dataset.theme === "dark" ? "dark" : "light",
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("presenter-theme", theme);
  }, [theme]);

  const toggleTheme = useCallback(
    () => setTheme((t) => (t === "dark" ? "light" : "dark")),
    [],
  );

  const openFile = useCallback(async (blob: Blob, name: string) => {
    setLoading(true);
    setError(null);
    try {
      const loaded = await loadScene(blob, name);
      const bare = computeUnits(loaded.elements);
      const withThumbs = await withThumbnails(loaded, bare);
      setScene(loaded);
      setUnits(withThumbs);
      setOrder(withThumbs.map((u) => u.id));
      setDurations(
        Object.fromEntries(withThumbs.map((u) => [u.id, DEFAULT_DURATION])),
      );
      setPresenting(false);
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "That file couldn't be read as an Excalidraw drawing.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setScene(null);
    setUnits([]);
    setOrder([]);
    setDurations({});
    setPresenting(false);
    setError(null);
  }, []);

  if (!scene) {
    return (
      <UploadScreen
        onFile={openFile}
        loading={loading}
        error={error}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    );
  }

  if (presenting) {
    return (
      <PresentScreen
        scene={scene}
        units={units}
        order={order}
        durations={durations}
        darkCanvas={darkCanvas}
        spotlight={spotlight}
        onExit={() => setPresenting(false)}
      />
    );
  }

  return (
    <SetupScreen
      scene={scene}
      units={units}
      order={order}
      durations={durations}
      darkCanvas={darkCanvas}
      onDarkCanvasChange={setDarkCanvas}
      spotlight={spotlight}
      onSpotlightChange={setSpotlight}
      onOrderChange={setOrder}
      onDurationsChange={setDurations}
      onPresent={() => setPresenting(true)}
      onReplaceFile={reset}
      theme={theme}
      onToggleTheme={toggleTheme}
    />
  );
}
