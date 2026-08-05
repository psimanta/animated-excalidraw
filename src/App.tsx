import { useCallback, useState } from "react";
import type { LoadedScene, Unit } from "./types";
import { computeUnits, loadScene } from "./lib/scene";
import { withThumbnails } from "./lib/render";
import { UploadScreen } from "./components/UploadScreen";
import { SetupScreen } from "./components/SetupScreen";
import { PresentScreen } from "./components/PresentScreen";

export const DEFAULT_DURATION = 3;

export default function App() {
  const [scene, setScene] = useState<LoadedScene | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [order, setOrder] = useState<string[]>([]);
  const [durations, setDurations] = useState<Record<string, number>>({});
  const [presenting, setPresenting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    return <UploadScreen onFile={openFile} loading={loading} error={error} />;
  }

  if (presenting) {
    return (
      <PresentScreen
        scene={scene}
        units={units}
        order={order}
        durations={durations}
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
      onOrderChange={setOrder}
      onDurationsChange={setDurations}
      onPresent={() => setPresenting(true)}
      onReplaceFile={reset}
    />
  );
}
