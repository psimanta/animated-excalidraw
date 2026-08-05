import { useCallback, useEffect, useRef, useState } from "react";
import type { LoadedScene, Unit } from "../types";
import { renderAllSteps } from "../lib/render";
import { DEFAULT_DURATION } from "../App";

interface Props {
  scene: LoadedScene;
  units: Unit[];
  order: string[];
  durations: Record<string, number>;
  darkCanvas: boolean;
  onExit: () => void;
}

export function PresentScreen({
  scene,
  units,
  order,
  durations,
  darkCanvas,
  onExit,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [slides, setSlides] = useState<string[] | null>(null);
  const [prepProgress, setPrepProgress] = useState(0);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(false);
  /** 0..1 through the current step while autoplaying. */
  const [progress, setProgress] = useState(0);
  // Mirror of `progress` so the autoplay clock can resume from a pause
  // without re-running its effect on every frame.
  const progressRef = useRef(0);
  const updateProgress = useCallback((p: number) => {
    progressRef.current = p;
    setProgress(p);
  }, []);

  const count = order.length;
  const durationOf = useCallback(
    (i: number) => durations[order[i]] ?? DEFAULT_DURATION,
    [durations, order],
  );

  // Pre-render every cumulative step once on entry.
  useEffect(() => {
    let cancelled = false;
    setSlides(null);
    renderAllSteps(scene, units, order, darkCanvas, (done, total) => {
      if (!cancelled) setPrepProgress(done / total);
    })
      .then((svgs) => {
        if (!cancelled) setSlides(svgs);
      })
      .catch(() => {
        if (!cancelled) setSlides([]);
      });
    return () => {
      cancelled = true;
    };
  }, [scene, units, order, darkCanvas]);

  const goTo = useCallback(
    (i: number) => {
      updateProgress(0);
      setIndex(Math.max(0, Math.min(count - 1, i)));
    },
    [count, updateProgress],
  );

  const next = useCallback(() => {
    updateProgress(0);
    setIndex((i) => (i < count - 1 ? i + 1 : loop ? 0 : i));
  }, [count, loop, updateProgress]);

  const prev = useCallback(() => {
    updateProgress(0);
    setIndex((i) => Math.max(0, i - 1));
  }, [updateProgress]);

  // Autoplay clock: fills `progress` for the current step, then moves on.
  // Timestamp-based so pausing keeps partial progress and resumes exactly
  // where it left off; changing steps resets it via next()/prev()/goTo().
  useEffect(() => {
    if (!playing || !slides) return;
    let raf = 0;
    const base = progressRef.current >= 1 ? 0 : progressRef.current;
    const durationMs = durationOf(index) * 1000;
    const start = performance.now();
    const tick = (now: number) => {
      const p = base + (now - start) / durationMs;
      if (p >= 1) {
        if (index === count - 1 && !loop) {
          updateProgress(1);
          setPlaying(false);
        } else {
          next();
        }
        return;
      }
      updateProgress(p);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, slides, index, count, loop, durationOf, next, updateProgress]);

  const togglePlay = useCallback(() => {
    // Pressing play on the finished last step restarts from the top.
    if (!playing && index === count - 1 && !loop) {
      goTo(0);
    }
    setPlaying((p) => !p);
  }, [playing, index, count, loop, goTo]);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void rootRef.current?.requestFullscreen?.();
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowRight":
        case "Enter":
        case " ":
          e.preventDefault();
          next();
          break;
        case "ArrowLeft":
          e.preventDefault();
          prev();
          break;
        case "p":
        case "P":
        case "k":
          togglePlay();
          break;
        case "f":
        case "F":
          toggleFullscreen();
          break;
        case "l":
        case "L":
          setLoop((v) => !v);
          break;
        case "Escape":
          if (!document.fullscreenElement) onExit();
          break;
        case "Home":
          goTo(0);
          break;
        case "End":
          goTo(count - 1);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, togglePlay, toggleFullscreen, onExit, goTo, count]);

  if (!slides) {
    return (
      <div className="present-screen" ref={rootRef}>
        <div className="present-loading" role="status">
          <span>Preparing {count} steps…</span>
          <div className="prep-bar">
            <div
              className="prep-bar-fill"
              style={{ width: `${Math.round(prepProgress * 100)}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (slides.length === 0) {
    return (
      <div className="present-screen" ref={rootRef}>
        <div className="present-loading" role="alert">
          <span>These steps couldn't be rendered.</span>
          <button className="btn btn-ghost" onClick={onExit}>
            Back to setup
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="present-screen" ref={rootRef}>
      <div className="present-stage" onClick={next}>
        {/* Only neighbours of the current step stay mounted; opacity
            transitions between them produce the crossfade. */}
        {slides.map((svg, i) =>
          Math.abs(i - index) <= 1 ? (
            <div
              key={i}
              className="present-layer"
              style={{ opacity: i <= index ? 1 : 0, zIndex: i }}
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          ) : null,
        )}
      </div>

      <footer className="present-controls" onClick={(e) => e.stopPropagation()}>
        <div className="control-cluster">
          <button
            className="ctl"
            onClick={prev}
            disabled={index === 0}
            aria-label="Previous step"
            title="Previous (←)"
          >
            ⟨
          </button>
          <button
            className="ctl ctl-play"
            onClick={togglePlay}
            aria-label={playing ? "Pause autoplay" : "Start autoplay"}
            title={playing ? "Pause (P)" : "Autoplay (P)"}
          >
            {playing ? "❚❚" : "▶"}
          </button>
          <button
            className="ctl"
            onClick={next}
            disabled={index === count - 1 && !loop}
            aria-label="Next step"
            title="Next (→ or Space)"
          >
            ⟩
          </button>
        </div>

        <span className="present-counter mono">
          {index + 1} / {count}
        </span>

        <div className="timeline" role="tablist" aria-label="Steps">
          {order.map((id, i) => (
            <button
              key={id}
              role="tab"
              aria-selected={i === index}
              aria-label={`Go to step ${i + 1}`}
              className="timeline-seg"
              style={{ flexGrow: durationOf(i) }}
              onClick={() => goTo(i)}
            >
              <span
                className="timeline-fill"
                style={{
                  transform: `scaleX(${
                    i < index
                      ? 1
                      : i > index
                        ? 0
                        : // Current step: track autoplay progress, keep it when
                          // paused mid-step, read as "arrived" when navigating.
                          playing || progress > 0
                          ? progress
                          : 1
                  })`,
                }}
              />
            </button>
          ))}
        </div>

        <div className="control-cluster">
          <button
            className={`ctl ctl-text${loop ? " is-on" : ""}`}
            onClick={() => setLoop((v) => !v)}
            aria-pressed={loop}
            title="Loop (L)"
          >
            Loop
          </button>
          <button
            className="ctl ctl-text"
            onClick={toggleFullscreen}
            title="Fullscreen (F)"
          >
            Full
          </button>
          <button className="ctl ctl-text" onClick={onExit} title="Exit (Esc)">
            Exit
          </button>
        </div>
      </footer>
    </div>
  );
}
