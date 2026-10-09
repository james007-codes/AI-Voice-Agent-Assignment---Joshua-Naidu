import type { CallPhase } from "@/lib/voice/call-controller";

const STEPS: { phase: CallPhase; letter: string; label: string }[] = [
  { phase: "connecting", letter: "C", label: "Connecting" },
  { phase: "listening", letter: "L", label: "Listening" },
  { phase: "thinking", letter: "T", label: "Thinking" },
  { phase: "speaking", letter: "S", label: "Speaking" },
];

/** Byotone-style lettered stepper doubling as the live state indicator. */
export function PhaseStepper({ phase }: { phase: CallPhase }) {
  return (
    <ol className="flex items-start" aria-label="Agent state">
      {STEPS.map((step, i) => {
        const active = step.phase === phase;
        return (
          <li key={step.phase} className="flex items-start">
            {i > 0 && <span className="mt-[13px] h-px w-3 bg-mint-dim/60 sm:w-5" aria-hidden />}
            <span className="flex flex-col items-center gap-1" style={{ marginTop: i % 2 ? 0 : 6 }}>
              <span
                aria-current={active ? "step" : undefined}
                className={`grid h-[26px] w-[26px] place-items-center rounded-full border font-mono text-[11px] transition-all duration-300 ${
                  active ? "border-mint bg-mint text-void shadow-[0_0_18px_rgba(168,245,200,.55)]" : "border-mint-dim/70 text-fog/80"
                }`}
              >
                {step.letter}
              </span>
              <span
                className={`font-mono text-[9px] uppercase tracking-[0.14em] transition-opacity ${
                  active ? "text-mint opacity-100" : "opacity-0"
                }`}
              >
                {step.label}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
