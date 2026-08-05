import { useEffect, useMemo, useRef, useState } from "react";
import type { LoadedScene, Unit } from "../types";
import { renderStep } from "../lib/render";
import { DEFAULT_DURATION } from "../App";

interface Props {
  scene: LoadedScene;
  units: Unit[];
  order: string[];
  durations: Record<string, number>;
  onOrderChange: (order: string[]) => void;
  onDurationsChange: (durations: Record<string, number>) => void;
  onPresent: () => void;
  onReplaceFile: () => void;
}

function moveItem(list: string[], from: number, to: number): string[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function SetupScreen({
  scene,
  units,
  order,
  durations,
  onOrderChange,
  onDurationsChange,
  onPresent,
  onReplaceFile,
}: Props) {
  const unitById = useMemo(() => new Map(units.map((u) => [u.id, u])), [units]);
  const [selected, setSelected] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [bulkDuration, setBulkDuration] = useState(DEFAULT_DURATION);

  const selectedIndex = Math.min(selected, order.length - 1);

  // Render the cumulative build state for the selected step; cancel stale runs.
  useEffect(() => {
    let cancelled = false;
    renderStep(scene, units, order, selectedIndex)
      .then((svg) => {
        if (!cancelled) setPreview(svg);
      })
      .catch(() => {
        if (!cancelled) setPreview(null);
      });
    return () => {
      cancelled = true;
    };
  }, [scene, units, order, selectedIndex]);

  const totalSeconds = order.reduce(
    (sum, id) => sum + (durations[id] ?? DEFAULT_DURATION),
    0,
  );

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

  const listRef = useRef<HTMLOListElement>(null);

  return (
    <div className="setup-screen">
      <header className="topbar">
        <span className="wordmark">Excalidraw Presenter</span>
        <span className="topbar-file" title={scene.name}>
          {scene.name} · {order.length} steps ·{" "}
          <span className="mono">{formatSeconds(totalSeconds)}</span> on
          autoplay
        </span>
        <div className="topbar-actions">
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
            <p>Drag steps to reorder. Times set the autoplay pace.</p>
          </div>

          <ol className="step-list" ref={listRef} onDragOver={(e) => e.preventDefault()}>
            {order.map((id, i) => {
              const unit = unitById.get(id);
              if (!unit) return null;
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
                        disabled={i === 0}
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
                        disabled={i === order.length - 1}
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
          <p className="preview-caption">
            After step {selectedIndex + 1} of {order.length} — click any step
            to preview the build up to it.
          </p>
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
