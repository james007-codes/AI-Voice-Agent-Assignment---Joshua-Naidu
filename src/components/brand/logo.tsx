/** Aura mark: concentric "sound" arcs over a dot. */
export function AuraMark({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden>
      <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="2.5" />
      <path d="M9 18.5a7 7 0 0 1 14 0" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="16" cy="19" r="3" fill="currentColor" />
    </svg>
  );
}

export function WaveMark({ className = "h-7 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 28" fill="none" className={className} aria-hidden>
      <path d="M2 14c4-10 10-10 14 0s10 10 14 0 6-6 8-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M2 20c4-8 10-8 14 0s10 8 14 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity=".6" />
      <path d="M6 8c3-5 7-5 10 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity=".35" />
    </svg>
  );
}
