"use client";

import { useEffect, useRef } from "react";
import type { AudioLevels, CallPhase } from "@/lib/voice/call-controller";

/**
 * Audio-reactive particle ring, after Byotone's particle fields.
 * Reads `levels` (mutated by the audio worklets) every animation frame, so
 * it animates at 60fps without causing React renders.
 */

interface Params {
  radius: number; // ring radius as a fraction of the half-size
  spin: number; // rad/s
  wave: number; // noise displacement amplitude
  pulse: number; // reaction to audio level
  mint: number; // 0..1 accent intensity
  scatter: number; // outward drift (ended)
}

const TARGETS: Record<CallPhase, Params> = {
  idle: { radius: 0.74, spin: 0.03, wave: 0.05, pulse: 0, mint: 0.15, scatter: 0 },
  connecting: { radius: 0.62, spin: 0.5, wave: 0.03, pulse: 0, mint: 0.35, scatter: 0 },
  listening: { radius: 0.72, spin: 0.05, wave: 0.05, pulse: 1.4, mint: 0.45, scatter: 0 },
  thinking: { radius: 0.6, spin: 0.9, wave: 0.12, pulse: 0.2, mint: 0.6, scatter: 0 },
  speaking: { radius: 0.76, spin: 0.12, wave: 0.06, pulse: 2.2, mint: 0.9, scatter: 0 },
  ended: { radius: 0.9, spin: 0.01, wave: 0.03, pulse: 0, mint: 0.05, scatter: 0.25 },
  error: { radius: 0.8, spin: 0.01, wave: 0.02, pulse: 0, mint: 0, scatter: 0.1 },
};

interface Particle {
  theta: number;
  r0: number; // base radius multiplier
  size: number;
  alpha: number;
  speed: number; // individual spin multiplier
  accent: boolean;
  seed: number;
}

function gaussian() {
  return (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
}

function makeParticles(count: number): Particle[] {
  return Array.from({ length: count }, () => {
    const dust = Math.random() < 0.12;
    return {
      theta: Math.random() * Math.PI * 2,
      r0: dust ? 0.3 + Math.random() * 1.1 : 1 + gaussian() * 0.11,
      size: Math.random() < 0.85 ? 0.6 + Math.random() * 0.9 : 1.6 + Math.random() * 0.9,
      alpha: dust ? 0.12 + Math.random() * 0.25 : 0.25 + Math.random() * 0.65,
      speed: 0.6 + Math.random() * 0.8,
      accent: Math.random() < 0.14,
      seed: Math.random() * 1000,
    };
  });
}

export function ParticleOrb({ phase, levels }: { phase: CallPhase; levels: AudioLevels }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef(phase);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let particles: Particle[] = [];
    let width = 0;
    let height = 0;
    let raf = 0;
    const current: Params = { ...TARGETS[phaseRef.current] };
    let level = 0;
    let last = performance.now();
    let time = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(Math.min(2600, Math.max(900, (width * height) / 140)));
      if (Math.abs(count - particles.length) > 200) particles = makeParticles(count);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      time += dt * (reduceMotion ? 0.25 : 1);

      const p = phaseRef.current;
      const target = TARGETS[p];
      const ease = 1 - Math.pow(0.02, dt); // ~frame-rate independent lerp
      for (const k of Object.keys(current) as (keyof Params)[]) current[k] += (target[k] - current[k]) * ease;

      const raw = p === "speaking" ? levels.output * 3.2 : p === "listening" ? levels.input * 4 : 0;
      level += (Math.min(1, raw) - level) * (raw > level ? 0.35 : 0.08);

      ctx.clearRect(0, 0, width, height);
      const cx = width / 2;
      const cy = height / 2;
      const half = Math.min(width, height) / 2;
      const R = half * current.radius;

      // Three brightness buckets + accent: four fills per frame instead of thousands.
      const buckets = [new Path2D(), new Path2D(), new Path2D()];
      const accent = new Path2D();

      for (const pt of particles) {
        pt.theta += current.spin * pt.speed * dt * (1 / Math.max(0.6, pt.r0));
        const th = pt.theta;
        const noise =
          Math.sin(3 * th + time * 0.7 + pt.seed) * 0.5 +
          Math.sin(5 * th - time * 1.1) * 0.3 +
          Math.sin(9 * th + time * 1.7) * 0.2;
        const ripple = Math.sin(6 * th - time * 5) * 0.5 + 0.5;
        const r =
          R * pt.r0 * (1 + current.scatter * (pt.seed % 1)) +
          half * current.wave * noise +
          half * 0.16 * current.pulse * level * (0.4 + ripple);
        const x = cx + Math.cos(th) * r;
        const y = cy + Math.sin(th) * r * 0.96;
        const path = pt.accent && current.mint > 0.1 ? accent : buckets[pt.alpha < 0.4 ? 0 : pt.alpha < 0.7 ? 1 : 2];
        path.rect(x, y, pt.size, pt.size);
      }

      [0.22, 0.48, 0.8].forEach((a, i) => {
        ctx.fillStyle = `rgba(214, 210, 198, ${a})`;
        ctx.fill(buckets[i]);
      });
      ctx.fillStyle = `rgba(168, 245, 200, ${0.25 + current.mint * 0.7})`;
      ctx.fill(accent);

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [levels]);

  return <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full" />;
}
