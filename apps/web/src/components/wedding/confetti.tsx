"use client";

import { useEffect, useRef } from "react";
import type { ConfettiProps } from "./props";

const BURST_DURATION_MS = 4000;
const PARTICLE_COUNT = 130;

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  rot: number;
  vr: number;
  color: string;
  circle: boolean;
}

const FALLBACK_COLORS = ["#8b5a2b", "#c9a227", "#b76e79", "#6b6b6b"];

/**
 * Confetti — one-shot full-viewport canvas burst in the theme's CSS-variable
 * colors. Fires when `active` becomes true, self-stops after ~4s, and skips
 * entirely under prefers-reduced-motion.
 */
export default function Confetti({ active = false }: ConfettiProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!active) return;

    // Respect reduced motion: no particle animation at all.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    // Setting canvas.width resets the transform, so a plain scale is safe.
    ctx.scale(dpr, dpr);

    // Read theme colors at runtime from the element (inherits theme-scoped vars).
    const styles = window.getComputedStyle(canvas);
    const colors = FALLBACK_COLORS.map((fallback, i) => {
      const names = ["--c-primary", "--c-secondary", "--c-accent", "--c-muted"];
      return styles.getPropertyValue(names[i]).trim() || fallback;
    });

    const pieces: Piece[] = [];
    const originX = width / 2;
    const originY = height * 0.4;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 6 + Math.random() * 10;
      pieces.push({
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 4,
        w: 6 + Math.random() * 7,
        h: 8 + Math.random() * 8,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.3,
        color: colors[Math.floor(Math.random() * colors.length)],
        circle: Math.random() > 0.65,
      });
    }

    const start = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const gravity = 0.22;
      const damp = 0.995;
      for (const p of pieces) {
        p.vy += gravity;
        p.vx *= damp;
        p.vy *= damp;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
      }

      ctx.clearRect(0, 0, width, height);
      for (const p of pieces) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        if (p.circle) {
          ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
        } else {
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        }
        ctx.fill();
        ctx.restore();
      }

      if (now - start < BURST_DURATION_MS) {
        raf = window.requestAnimationFrame(tick);
      } else {
        // Burst over — clear the canvas and leave the (transparent) element in place.
        ctx.clearRect(0, 0, width, height);
      }
    };
    raf = window.requestAnimationFrame(tick);

    return () => window.cancelAnimationFrame(raf);
  }, [active]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[95]"
    />
  );
}
