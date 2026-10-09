"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { WaveMark } from "@/components/brand/logo";
import { average, formatClock } from "@/lib/format";
import type { CallPhase } from "@/lib/voice/call-controller";
import { useVoiceCall } from "@/lib/voice/use-voice-call";
import { ParticleOrb } from "./particle-orb";
import { PhaseStepper } from "./phase-stepper";
import { SummaryView } from "./summary-view";
import { TestOrders } from "./test-orders";
import { Transcript } from "./transcript";

const HEADLINE: Record<CallPhase, string[]> = {
  idle: ["Talk", "to", "Aria"],
  connecting: ["Connecting"],
  listening: ["Listening"],
  thinking: ["Thinking"],
  speaking: ["Speaking"],
  ended: ["Call", "ended"],
  error: ["No", "signal"],
};

const ORB_TAGS = [
  { text: "Mic · 16 kHz", className: "left-[8%] top-[18%]" },
  { text: "Gemini Live", className: "right-[6%] top-[22%]" },
  { text: "Voice · 24 kHz", className: "right-[12%] bottom-[24%]" },
  { text: "EN-IN · Hinglish", className: "left-[4%] bottom-[30%]" },
];

function useElapsed(startedAt: number | null, running: boolean) {
  // Read the clock only in effects: a render-time Date.now() would be frozen into the prerendered shell.
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!running) return;
    const tick = () => setNow(Date.now());
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [running]);
  return startedAt && now ? Math.max(0, (now - startedAt) / 1000) : 0;
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-smoke">
      <span className="text-mint">■</span> {children}
    </p>
  );
}

export function CallExperience() {
  const call = useVoiceCall();
  const { phase, controller } = call;
  const live = phase === "connecting" || phase === "listening" || phase === "thinking" || phase === "speaking";
  const elapsed = useElapsed(call.startedAt, live);
  const lastLatency = call.latencies.at(-1);
  const avgLatency = average(call.latencies);

  // Escape ends a live call; handy during demos.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && live) void controller.end();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [live, controller]);

  return (
    <div className="relative flex min-h-dvh flex-col bg-void text-fog selection:bg-mint selection:text-void">
      {/* subtle grain grid */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-[0.035]"
        style={{ backgroundImage: "radial-gradient(#fff 1px, transparent 1px)", backgroundSize: "4px 4px" }}
      />

      <header className="relative z-10 flex items-start justify-between gap-4 px-4 pt-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2 text-fog">
          <WaveMark className="h-6 w-8" />
          <span className="font-sans text-[15px] font-semibold tracking-[0.12em]">AURA</span>
        </Link>
        <div className="flex items-start gap-4">
          <PhaseStepper phase={phase} />
          <nav className="mt-1.5 hidden gap-3 font-mono text-[11px] uppercase tracking-[0.14em] text-fog/80 sm:flex">
            <Link href="/" className="hover:text-mint">· Home</Link>
            <Link href="/#how" className="hover:text-mint">· How it works</Link>
          </nav>
        </div>
      </header>

      {phase === "ended" ? (
        <SummaryView call={call} onRetrySummary={() => void controller.requestSummary()} onNewCall={() => controller.reset()} />
      ) : (
        <main className="relative z-10 grid flex-1 grid-cols-1 gap-6 px-4 pb-4 pt-4 sm:px-8 lg:grid-cols-[290px_minmax(0,1fr)_360px] lg:gap-8">
          {/* Test orders */}
          <aside className="order-3 lg:order-1 lg:max-h-[calc(100dvh-140px)] lg:overflow-y-auto scroll-thin">
            {/* Open by default everywhere: the brief wants sample IDs visible without hunting. */}
            <details open className="group">
              <summary className="cursor-pointer list-none lg:pointer-events-none">
                <Label>
                  Test orders <span className="lg:hidden">· tap to toggle</span>
                </Label>
              </summary>
              <div className="mt-3">
                <TestOrders />
              </div>
            </details>
          </aside>

          {/* Orb + controls */}
          <section className="relative order-1 flex min-h-[440px] flex-col items-center justify-center lg:order-2 lg:min-h-0">
            <div className="relative aspect-square w-full max-w-[620px]">
              <ParticleOrb phase={phase} levels={call.levels} />
              {ORB_TAGS.map((t) => (
                <span
                  key={t.text}
                  className={`absolute hidden items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-fog/80 md:flex ${t.className}`}
                >
                  <span className="h-1.5 w-1.5 bg-mint" /> {t.text}
                </span>
              ))}

              <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
                <h1
                  className="flex flex-wrap justify-center gap-x-[0.6em] font-serif text-[clamp(2.2rem,6vw,4.6rem)] uppercase leading-[1.05] tracking-[0.06em] text-mint"
                  aria-live="polite"
                >
                  {HEADLINE[phase].map((w) => (
                    <span key={w}>{w}</span>
                  ))}
                </h1>
                <p className="mt-3 h-4 font-mono text-[11px] uppercase tracking-[0.16em] text-fog/70">
                  {call.activity ?? (phase === "listening" ? "Go ahead, I'm listening" : "")}
                </p>
                {phase === "idle" && (
                  <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-fog/80">
                    Aria handles Aura Skincare support by voice. Ask about an order, a return, or our policies. English, Hindi or
                    Hinglish.
                  </p>
                )}
                {phase === "error" && (
                  <p role="alert" className="mt-4 max-w-sm text-[15px] leading-relaxed text-[#ff8a75]">
                    {call.error}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-2 flex items-center gap-3">
              {live ? (
                <>
                  <button
                    onClick={() => controller.toggleMute()}
                    aria-pressed={call.muted}
                    className={`dash-frame rounded-full px-4 py-2.5 font-mono text-[12px] uppercase tracking-[0.14em] transition ${
                      call.muted ? "bg-fog text-void" : "bg-void-2 text-fog hover:bg-void-3"
                    }`}
                  >
                    {call.muted ? "Unmute" : "Mute"}
                  </button>
                  <button
                    onClick={() => void controller.end()}
                    className="inline-flex items-center gap-2 rounded-full bg-[#ff6b52] px-5 py-2.5 font-mono text-[12px] font-semibold uppercase tracking-[0.14em] text-void transition hover:brightness-110"
                  >
                    <span className="h-2 w-2 rounded-[2px] bg-void" /> End call
                  </button>
                </>
              ) : (
                <button
                  onClick={() => void controller.start()}
                  className="dash-frame group inline-flex items-center gap-3 rounded-full bg-void-2 py-2 pl-2 pr-5 font-mono text-[12.5px] uppercase tracking-[0.14em] text-mint transition hover:bg-void-3"
                >
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-mint text-void transition group-hover:scale-105">
                    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden>
                      <rect x="5.5" y="1.5" width="5" height="8.5" rx="2.5" />
                      <path d="M3.5 7.5a4.5 4.5 0 0 0 9 0" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" />
                      <path d="M8 12v2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                  </span>
                  {phase === "error" ? "Try again" : "Start call"}
                </button>
              )}
            </div>
            {phase === "idle" && (
              <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-smoke/80">
                Allow mic access · headphones recommended
              </p>
            )}
            {call.notice && live && <p className="mt-3 text-[13px] text-[#f5d26b]">{call.notice}</p>}
          </section>

          {/* Transcript */}
          <aside className="order-2 flex min-h-[200px] flex-col lg:order-3 lg:max-h-[calc(100dvh-140px)]">
            <Label>Live transcript</Label>
            <div className="scroll-thin mt-4 flex-1 overflow-y-auto pr-1">
              <Transcript items={call.transcript} tools={call.tools} live={live} />
            </div>
          </aside>
        </main>
      )}

      {phase !== "ended" && (
        <footer className="relative z-10 flex items-center justify-between gap-4 px-4 pb-5 font-mono text-[10px] uppercase tracking-[0.16em] text-smoke/70 sm:px-8">
          <span className="hidden sm:inline">Built for Datastraw · Aura is fictional</span>
          <span className="flex items-center gap-3">
            <span>
              Latency <span className="text-fog/60">·</span>{" "}
              <span className="text-mint">{lastLatency ? `${lastLatency} ms` : "— ms"}</span>
              {avgLatency && call.latencies.length > 1 && <span className="text-fog/50"> (avg {avgLatency})</span>}
            </span>
            <span className="text-fog/30">|</span>
            <span className={live ? "text-fog" : ""}>
              {formatClock(elapsed)}
              {call.maxCallSeconds && <span className="text-fog/40"> / {formatClock(call.maxCallSeconds)}</span>}
            </span>
          </span>
        </footer>
      )}
    </div>
  );
}
