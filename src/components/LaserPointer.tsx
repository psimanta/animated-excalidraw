import { useEffect, useRef } from "react";

interface Props {
  /** Laser is lit while the modifier is held; trail still fades after. */
  active: boolean;
}

interface Point {
  x: number;
  y: number;
  t: number;
}

/** How long a trail point stays visible. */
const TRAIL_MS = 450;
const RED = "255, 64, 64";

/**
 * Canvas overlay drawing a laser dot + fading trail at the pointer.
 * Stays mounted for the whole show (pointer-events: none) so the trail
 * can finish fading after the modifier is released.
 */
export function LaserPointer({ active }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeRef = useRef(active);
  const lastPos = useRef<Point | null>(null);
  const points = useRef<Point[]>([]);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  // One window-level move listener: always remembers the pointer position
  // (so the dot appears instantly on activation), records trail points
  // only while lit. Coordinates are relative to the canvas, which fills
  // the stage — anything outside is clipped away naturally.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const p: Point = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        t: performance.now(),
      };
      lastPos.current = p;
      if (activeRef.current) points.current.push(p);
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    const clear = () => {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    };

    let raf = 0;
    let idle = false;
    const tick = () => {
      const now = performance.now();
      points.current = points.current.filter((p) => now - p.t < TRAIL_MS);

      // Nothing lit and nothing fading: clear once, then no-op frames.
      if (!activeRef.current && points.current.length === 0) {
        if (!idle) {
          clear();
          idle = true;
        }
        raf = requestAnimationFrame(tick);
        return;
      }
      idle = false;
      clear();

      // Trail: per-segment stroke, thinning and fading with age.
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      const pts = points.current;
      for (let i = 1; i < pts.length; i++) {
        const age = (now - pts[i].t) / TRAIL_MS;
        ctx.strokeStyle = `rgba(${RED}, ${(1 - age) * 0.85})`;
        ctx.lineWidth = 1 + (1 - age) * 3.5;
        ctx.beginPath();
        ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
        ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
      }

      // Dot: soft glow, red disc, white-hot core.
      if (activeRef.current && lastPos.current) {
        const { x, y } = lastPos.current;
        const glow = ctx.createRadialGradient(x, y, 0, x, y, 18);
        glow.addColorStop(0, `rgba(${RED}, 0.8)`);
        glow.addColorStop(1, `rgba(${RED}, 0)`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgb(${RED})`;
        ctx.beginPath();
        ctx.arc(x, y, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(x, y, 2.25, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className="laser-canvas" aria-hidden="true" />;
}
