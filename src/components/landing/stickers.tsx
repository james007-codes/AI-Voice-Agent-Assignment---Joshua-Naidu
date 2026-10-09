/**
 * Flat, ink-outlined product stickers in the Creatorspace illustration style.
 * Hand-built SVG so the landing page ships zero image assets.
 */

const INK = "#121212";
const S = { stroke: INK, strokeWidth: 3, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

export function SerumBottle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 90 170" className={className} aria-hidden>
      <rect x="33" y="6" width="24" height="34" rx="11" fill={INK} />
      <rect x="28" y="38" width="34" height="14" rx="3" fill="#2a2a2a" {...S} />
      <path d="M18 64c0-7 6-12 13-12h28c7 0 13 5 13 12v88c0 7-6 12-13 12H31c-7 0-13-5-13-12z" fill="#e8442a" {...S} />
      <rect x="27" y="86" width="36" height="46" rx="4" fill="#efede6" {...S} />
      <text x="45" y="105" textAnchor="middle" fontFamily="var(--font-anton)" fontSize="13" fill={INK}>VIT C</text>
      <text x="45" y="122" textAnchor="middle" fontFamily="var(--font-anton)" fontSize="9" fill={INK}>30 ML</text>
      <path d="M26 70v10" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity=".6" />
    </svg>
  );
}

export function SunscreenTube({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 90 190" className={className} aria-hidden>
      <path d="M14 10h62l-6 140H20z" fill="#f0508a" {...S} />
      <path d="M14 10h62" {...S} />
      <path d="M16 18h58" stroke={INK} strokeWidth="2" strokeDasharray="3 4" />
      <rect x="26" y="150" width="38" height="30" rx="5" fill="#7b6cf6" {...S} />
      <rect x="26" y="58" width="38" height="56" rx="3" fill="#efede6" {...S} />
      <text x="45" y="80" textAnchor="middle" fontFamily="var(--font-anton)" fontSize="12" fill={INK}>SPF</text>
      <text x="45" y="104" textAnchor="middle" fontFamily="var(--font-anton)" fontSize="22" fill={INK}>50</text>
    </svg>
  );
}

export function PumpBottle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 180" className={className} aria-hidden>
      <path d="M40 8h34v10H52v14" fill="none" {...S} />
      <rect x="40" y="30" width="22" height="20" rx="3" fill={INK} />
      <rect x="18" y="50" width="66" height="122" rx="16" fill="#2f9e5b" {...S} />
      <circle cx="51" cy="108" r="20" fill="#efede6" {...S} />
      <path d="M43 110c4-12 14-14 16-14-1 9-6 18-16 14zM43 110l8-7" fill="#2f9e5b" {...S} strokeWidth={2} />
      <path d="M28 64v18" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity=".5" />
    </svg>
  );
}

export function Parcel({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 130 120" className={className} aria-hidden>
      <path d="M10 38l55-26 55 26v52l-55 26-55-26z" fill="#f2a43a" {...S} />
      <path d="M10 38l55 26 55-26M65 64v52" fill="none" {...S} />
      <path d="M37 25l55 26v20" fill="none" stroke={INK} strokeWidth="3" />
      <rect x="20" y="66" width="30" height="18" rx="2" transform="rotate(25 35 75)" fill="#efede6" {...S} strokeWidth={2} />
    </svg>
  );
}

export function Sparkle({ className, color = INK }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <path d="M20 2c2 11 7 16 18 18-11 2-16 7-18 18-2-11-7-16-18-18C13 18 18 13 20 2z" fill={color} />
    </svg>
  );
}

export function Plus({ className, color = "#f0508a" }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden>
      <path d="M10 1v18M1 10h18" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

/** Phone showing the live call screen: the hero's centrepiece. */
export function CallPhone({ className }: { className?: string }) {
  const dots = Array.from({ length: 140 }, (_, i) => {
    const a = (i / 140) * Math.PI * 2;
    const r = 52 + Math.sin(i * 7.3) * 6 + Math.cos(i * 3.1) * 4;
    return { x: 110 + Math.cos(a) * r, y: 190 + Math.sin(a) * r, o: 0.35 + ((i * 37) % 10) / 16, mint: i % 7 === 0 };
  });
  return (
    <svg viewBox="0 0 220 432" className={className} aria-hidden>
      <rect x="6" y="6" width="208" height="420" rx="34" fill={INK} />
      <rect x="16" y="16" width="188" height="400" rx="26" fill="#141414" />
      <rect x="82" y="26" width="56" height="14" rx="7" fill={INK} />
      <text x="34" y="74" fontFamily="var(--font-jetbrains)" fontSize="8" fill="#8b8b86" letterSpacing="1.5">■ ARIA · AURA</text>
      <g fill="#a8f5c8">
        <circle cx="150" cy="71" r="7" />
      </g>
      <text x="150" y="74" textAnchor="middle" fontFamily="var(--font-jetbrains)" fontSize="8" fill="#141414">S</text>
      {dots.map((d, i) => (
        <rect key={i} x={d.x} y={d.y} width="2" height="2" fill={d.mint ? "#a8f5c8" : "#d6d2c6"} opacity={d.o} />
      ))}
      <text x="110" y="196" textAnchor="middle" fontFamily="var(--font-xanh)" fontSize="19" fill="#a8f5c8" letterSpacing="2">SPEAKING</text>
      <rect x="32" y="280" width="156" height="38" rx="10" fill="#232323" />
      <text x="42" y="297" fontFamily="var(--font-instrument)" fontSize="9.5" fill="#e9e8e3">Your Vitamin C Serum is out</text>
      <text x="42" y="310" fontFamily="var(--font-instrument)" fontSize="9.5" fill="#e9e8e3">for delivery, by 6 PM today.</text>
      <rect x="66" y="350" width="88" height="28" rx="14" fill="#ff6b52" />
      <text x="110" y="368" textAnchor="middle" fontFamily="var(--font-jetbrains)" fontSize="9" fill="#141414" letterSpacing="1.5">END CALL</text>
    </svg>
  );
}
