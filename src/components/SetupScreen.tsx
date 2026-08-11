import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { LoadedScene, Unit } from "../types";
import { renderStep } from "../lib/render";
import { serializeScene } from "../lib/scene";
import { DEFAULT_DURATION } from "../App";
import { ThemeToggle } from "./ThemeToggle";

interface Props {
  scene: LoadedScene;
  units: Unit[];
  order: string[];
  durations: Record<string, number>;
  darkCanvas: boolean;
  onDarkCanvasChange: (dark: boolean) => void;
  spotlight: boolean;
  onSpotlightChange: (spotlight: boolean) => void;
  onOrderChange: (order: string[]) => void;
  onDurationsChange: (durations: Record<string, number>) => void;
  onPresent: () => void;
  onReplaceFile: () => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}

function moveItem<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** A contiguous run of steps in `order` sharing a frame (or all of them,
 * as one anonymous section, when the scene has no frames). */
interface Section {
  frameId: string | null;
  name: string | null;
  ids: string[];
}

export function SetupScreen({
  scene,
  units,
  order,
  durations,
  darkCanvas,
  onDarkCanvasChange,
  spotlight,
  onSpotlightChange,
  onOrderChange,
  onDurationsChange,
  onPresent,
  onReplaceFile,
  theme,
  onToggleTheme,
}: Props) {
  const unitById = useMemo(() => new Map(units.map((u) => [u.id, u])), [units]);
  const hasFrames = scene.frames.length > 0;
  // Steps stay grouped by frame (an invariant every reorder path preserves),
  // so contiguous runs of `order` sharing a frame form the sections.
  const sections = useMemo<Section[]>(() => {
    const frameName = new Map(scene.frames.map((f) => [f.id, f.name]));
    const out: Section[] = [];
    for (const id of order) {
      const frameId = unitById.get(id)?.frameId ?? null;
      const last = out[out.length - 1];
      if (last && last.frameId === frameId) {
        last.ids.push(id);
      } else {
        out.push({
          frameId,
          name: frameId ? (frameName.get(frameId) ?? "Frame") : null,
          ids: [id],
        });
      }
    }
    return out;
  }, [order, unitById, scene.frames]);
  const indexOfId = useMemo(
    () => new Map(order.map((id, i) => [id, i])),
    [order],
  );
  const [selected, setSelected] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [bulkDuration, setBulkDuration] = useState(DEFAULT_DURATION);

  const selectedIndex = Math.min(selected, order.length - 1);

  // Render the cumulative build state for the selected step; cancel stale runs.
  useEffect(() => {
    let cancelled = false;
    renderStep(scene, units, order, selectedIndex, { darkCanvas, spotlight })
      .then((svg) => {
        if (!cancelled) setPreview(svg);
      })
      .catch(() => {
        if (!cancelled) setPreview(null);
      });
    return () => {
      cancelled = true;
    };
  }, [scene, units, order, selectedIndex, darkCanvas, spotlight]);

  const totalSeconds =
    order.reduce((sum, id) => sum + (durations[id] ?? DEFAULT_DURATION), 0) +
    // Spotlight shows add a final full-drawing frame.
    (spotlight ? DEFAULT_DURATION : 0);

  const setDuration = (id: string, value: number) => {
    onDurationsChange({ ...durations, [id]: value });
  };

  const commitDrop = () => {
    if (dragIndex !== null && dropIndex !== null && dragIndex !== dropIndex) {
      const target = dropIndex > dragIndex ? dropIndex - 1 : dropIndex;
      onOrderChange(moveItem(order, dragIndex, target));
      setSelected(target);
    }
    setDragIndex(null);
    setDropIndex(null);
  };

  /** Move a whole frame section, keeping the same unit selected. */
  const moveSection = (from: number, to: number) => {
    const selectedId = order[selectedIndex];
    const nextOrder = moveItem(sections, from, to).flatMap((s) => s.ids);
    onOrderChange(nextOrder);
    setSelected(nextOrder.indexOf(selectedId));
  };

  /** Download the scene as .excalidraw with the arrangement stamped in. */
  const saveFile = () => {
    const json = serializeScene(scene, units, order, durations, DEFAULT_DURATION);
    const url = URL.createObjectURL(
      new Blob([json], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${scene.name}.excalidraw`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const listRef = useRef<HTMLOListElement>(null);

  return (
    <div className="setup-screen">
      <header className="topbar">
        <span className="wordmark">Excalidraw Presenter</span>
        <span className="topbar-file" title={scene.name}>
          {scene.name} ·{" "}
          {hasFrames ? `${scene.frames.length} frames · ` : ""}
          {order.length} steps ·{" "}
          <span className="mono">{formatSeconds(totalSeconds)}</span> on
          autoplay
        </span>
        <div className="topbar-actions">
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          <button
            className="btn btn-ghost"
            onClick={saveFile}
            title="Download as .excalidraw with the reveal order and timings saved in"
          >
            Save file
          </button>
          <button className="btn btn-ghost" onClick={onReplaceFile}>
            Replace file
          </button>
          <button className="btn btn-primary" onClick={onPresent}>
            Present&ensp;▸
          </button>
        </div>
      </header>

      <div className="setup-body">
        <aside className="filmstrip">
          <div className="filmstrip-head">
            <h2>Reveal order</h2>
            <p>
              {hasFrames
                ? "Drag steps to reorder within a frame; ▲▼ on a frame moves the whole section. Times set the autoplay pace."
                : "Drag steps to reorder. Times set the autoplay pace."}
            </p>
          </div>

          <ol className="step-list" ref={listRef} onDragOver={(e) => e.preventDefault()}>
            {sections.map((section, si) => (
              <Fragment key={section.frameId ?? "unframed"}>
                {hasFrames && (
                  <li className="frame-head">
                    <span className="frame-name" title={section.name ?? undefined}>
                      {section.name}
                    </span>
                    <span className="frame-count">
                      {section.ids.length}{" "}
                      {section.ids.length === 1 ? "step" : "steps"}
                    </span>
                    <div className="frame-nudge">
                      <button
                        aria-label={`Move frame ${section.name} up`}
                        disabled={si === 0}
                        onClick={() => moveSection(si, si - 1)}
                      >
                        ▲
                      </button>
                      <button
                        aria-label={`Move frame ${section.name} down`}
                        disabled={si === sections.length - 1}
                        onClick={() => moveSection(si, si + 1)}
                      >
                        ▼
                      </button>
                    </div>
                  </li>
                )}
                {section.ids.map((id, pos) => {
                  const unit = unitById.get(id);
                  if (!unit) return null;
                  const i = indexOfId.get(id)!;
                  return (
                <li
                  key={id}
                  className={[
                    "step-card",
                    i === selectedIndex ? "is-selected" : "",
                    i === dragIndex ? "is-dragging" : "",
                    i === dropIndex ? "is-drop-target" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  draggable
                  onDragStart={() => setDragIndex(i)}
                  onDragEnd={commitDrop}
                  onDragOver={(e) => {
                    e.preventDefault();
                    // Steps live inside their frame: only offer drop gaps
                    // within the dragged card's own section.
                    if (
                      dragIndex !== null &&
                      unitById.get(order[dragIndex])?.frameId !== unit.frameId
                    ) {
                      return;
                    }
                    const rect = e.currentTarget.getBoundingClientRect();
                    const before = e.clientY < rect.top + rect.height / 2;
                    setDropIndex(before ? i : i + 1);
                  }}
                  onClick={() => setSelected(i)}
                >
                  <span className="step-index mono">{i + 1}</span>
                  <div className="step-thumb" aria-hidden="true">
                    {unit.thumbnail ? (
                      <div
                        className="thumb-svg"
                        dangerouslySetInnerHTML={{ __html: unit.thumbnail }}
                      />
                    ) : (
                      <span className="thumb-empty">?</span>
                    )}
                  </div>
                  <div className="step-meta">
                    <span className="step-label" title={unit.label}>
                      {unit.label}
                    </span>
                    <span className="step-kind">{unit.kind}</span>
                  </div>
                  <div className="step-side">
                    <label className="duration-field">
                      <input
                        type="number"
                        className="mono"
                        min={0.5}
                        step={0.5}
                        value={durations[id] ?? DEFAULT_DURATION}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          if (!Number.isNaN(v) && v > 0) setDuration(id, v);
                        }}
                        aria-label={`Seconds for step ${i + 1}`}
                      />
                      <span>s</span>
                    </label>
                    <div className="step-nudge">
                      <button
                        aria-label="Move step up"
                        disabled={pos === 0}
                        onClick={(e) => {
                          e.stopPropagation();
                          onOrderChange(moveItem(order, i, i - 1));
                          setSelected(i - 1);
                        }}
                      >
                        ▲
                      </button>
                      <button
                        aria-label="Move step down"
                        disabled={pos === section.ids.length - 1}
                        onClick={(e) => {
                          e.stopPropagation();
                          onOrderChange(moveItem(order, i, i + 1));
                          setSelected(i + 1);
                        }}
                      >
                        ▼
                      </button>
                    </div>
                  </div>
                </li>
                  );
                })}
              </Fragment>
            ))}
          </ol>

          <div className="filmstrip-foot">
            <button
              className="btn btn-ghost btn-small"
              onClick={() => {
                onOrderChange(units.map((u) => u.id));
                setSelected(0);
              }}
            >
              Reset to drawing order
            </button>
            <label className="bulk-duration">
              <span>All steps</span>
              <input
                type="number"
                className="mono"
                min={0.5}
                step={0.5}
                value={bulkDuration}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (!Number.isNaN(v) && v > 0) setBulkDuration(v);
                }}
              />
              <span>s</span>
              <button
                className="btn btn-ghost btn-small"
                onClick={() =>
                  onDurationsChange(
                    Object.fromEntries(order.map((id) => [id, bulkDuration])),
                  )
                }
              >
                Apply
              </button>
            </label>
          </div>
        </aside>

        <main className="stage-preview">
          <div className="preview-paper">
            {preview ? (
              <div
                className="canvas-svg"
                dangerouslySetInnerHTML={{ __html: preview }}
              />
            ) : (
              <span className="preview-loading">Rendering…</span>
            )}
          </div>
          <div className="preview-foot">
            <p className="preview-caption">
              After step {selectedIndex + 1} of {order.length} — click any
              step to preview the build up to it.
            </p>
            <label
              className="canvas-mode"
              title="Dim earlier steps to 30% so the newest one stands out; the show ends on the full drawing."
            >
              <input
                type="checkbox"
                checked={spotlight}
                onChange={(e) => onSpotlightChange(e.target.checked)}
              />
              Spotlight current step
            </label>
            <label className="canvas-mode">
              <input
                type="checkbox"
                checked={darkCanvas}
                onChange={(e) => onDarkCanvasChange(e.target.checked)}
              />
              Dark canvas
            </label>
          </div>
        </main>
      </div>
    </div>
  );
}

function formatSeconds(total: number): string {
  const mins = Math.floor(total / 60);
  const secs = Math.round((total % 60) * 10) / 10;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}
