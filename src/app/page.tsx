import Link from "next/link";
import { AuraMark } from "@/components/brand/logo";
import { CallPhone, Parcel, Plus, PumpBottle, Sparkle, SerumBottle, SunscreenTube } from "@/components/landing/stickers";
import { SAMPLE_ORDER_CARDS } from "@/lib/agent/orders/sample-cards";
import { formatInr } from "@/lib/format";

// ---------------------------------------------------------------------------
// Small building blocks

function ArrowCircle({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden>
      <circle cx="10" cy="10" r="10" fill="currentColor" />
      <path d="M7 13l6-6M8 7h5v5" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Highlight({ children, tone }: { children: React.ReactNode; tone: "tomato" | "ink" | "sun" | "grape" }) {
  const styles = {
    tomato: "bg-tomato text-white",
    ink: "bg-ink text-white",
    sun: "bg-sun text-ink",
    grape: "bg-grape text-white",
  }[tone];
  return <span className={`rounded-xl px-2 py-0.5 [box-decoration-break:clone] ${styles}`}>{children}</span>;
}

function Nav() {
  return (
    <header className="sticky top-0 z-40 px-3 pt-3 sm:px-4">
      <div className="flex items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-1.5 rounded-full bg-cream/80 py-1 pl-1 pr-3 backdrop-blur">
          <AuraMark className="h-7 w-7 text-ink" />
          <span className="text-[22px] font-bold tracking-tight">aura</span>
        </Link>
        <nav className="hidden items-center gap-2 md:flex">
          {[
            ["#try", "Try an order"],
            ["#how", "How it works"],
            ["#guardrails", "Guardrails"],
          ].map(([href, label], i) => (
            <a
              key={href}
              href={href}
              className={`rounded-full px-3.5 py-1.5 text-[14px] font-medium transition hover:bg-white ${i === 0 ? "bg-white" : "bg-white/50"}`}
            >
              {label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-1.5 rounded-full bg-ink p-1.5">
          <Link href="/call" className="rounded-full bg-tomato px-4 py-1.5 text-[13px] font-semibold text-white transition hover:brightness-110">
            Talk to Aria
          </Link>
          <a href="#how" className="hidden rounded-full bg-white px-4 py-1.5 text-[13px] font-semibold sm:inline">
            Architecture
          </a>
        </div>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Sections

function Hero() {
  return (
    <section className="relative -mt-[60px] overflow-hidden bg-sun pt-[96px]">
      {/* orbit rings */}
      <svg aria-hidden className="pointer-events-none absolute left-1/2 top-[40px] w-[1500px] -translate-x-1/2" viewBox="0 0 1500 900" fill="none">
        <ellipse cx="750" cy="170" rx="720" ry="130" stroke="#121212" strokeOpacity=".22" />
        <ellipse cx="750" cy="320" rx="590" ry="110" stroke="#121212" strokeOpacity=".22" />
        <ellipse cx="750" cy="470" rx="430" ry="90" stroke="#121212" strokeOpacity=".22" />
      </svg>

      <div className="relative mx-auto max-w-6xl px-4 text-center">
        <h1 className="font-display text-[clamp(2.9rem,8.4vw,6.6rem)] uppercase leading-[0.92] tracking-tight">
          Skincare support
          <br />
          that talks back
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-[clamp(1rem,1.6vw,1.15rem)] leading-relaxed">
          Meet Aria, Aura Skincare&apos;s AI voice agent. She tracks live orders, knows every policy by heart, and never promises
          what the brand can&apos;t deliver.
        </p>
        <Link
          href="/call"
          className="mt-7 inline-flex items-center gap-2.5 rounded-full bg-white px-6 py-3 font-display text-[20px] uppercase tracking-wide shadow-[0_2px_0_#121212] transition hover:-translate-y-0.5"
        >
          Start a call <ArrowCircle />
        </Link>
      </div>

      {/* illustration stage */}
      <div className="relative mx-auto mt-10 h-[340px] max-w-5xl sm:h-[420px]">
        <CallPhone className="absolute bottom-[-150px] left-1/2 w-[200px] -translate-x-1/2 sm:bottom-[-170px] sm:w-[240px]" />

        <div className="absolute left-[4%] top-[6%] hidden animate-float [--r:-6deg] sm:block">
          <div className="rounded-2xl rounded-bl-sm border-[2.5px] border-ink bg-white px-4 py-2.5 text-left text-[14px] font-semibold shadow-[3px_3px_0_#121212]">
            “Where&apos;s my order ORD-101?”
          </div>
        </div>
        <div className="absolute right-[2%] top-[2%] hidden animate-float [--r:5deg] [animation-delay:-2s] sm:block">
          <div className="max-w-[230px] rounded-2xl rounded-br-sm border-[2.5px] border-ink bg-grape px-4 py-2.5 text-left text-[14px] font-semibold text-white shadow-[3px_3px_0_#121212]">
            Out for delivery with BlueDart, by 6 PM today ✓
          </div>
        </div>

        <SerumBottle className="absolute bottom-[8%] left-[16%] w-[62px] -rotate-12 animate-float [--r:-12deg] sm:left-[22%] sm:w-[80px]" />
        <SunscreenTube className="absolute bottom-[14%] right-[14%] w-[54px] animate-float [--r:14deg] [animation-delay:-3s] sm:right-[22%] sm:w-[70px]" />
        <PumpBottle className="absolute bottom-[0%] left-[2%] hidden w-[80px] animate-float [--r:8deg] [animation-delay:-1s] md:block" />
        <Parcel className="absolute bottom-[2%] right-[2%] hidden w-[120px] animate-float [--r:-6deg] [animation-delay:-4s] md:block" />

        <div className="absolute left-[30%] top-[18%] hidden rotate-[-8deg] rounded-lg border-[2.5px] border-ink bg-tomato px-3 py-1 font-display text-[18px] uppercase text-white shadow-[3px_3px_0_#121212] lg:block">
          Free shipping ₹499+
        </div>
        <div className="absolute right-[30%] top-[24%] hidden rotate-[6deg] rounded-lg border-[2.5px] border-ink bg-white px-3 py-1 font-display text-[18px] uppercase lg:block">
          Hinglish ✓
        </div>
        <Sparkle className="absolute left-[40%] top-[2%] w-7" />
        <Sparkle className="absolute right-[38%] top-[52%] w-5" color="#e8442a" />
        <Plus className="absolute left-[12%] top-[40%] w-4" />
        <Plus className="absolute right-[10%] top-[44%] w-4" color="#7b6cf6" />
      </div>
    </section>
  );
}

const MARQUEE_A = [
  { kind: "quote", text: "Where is my order ORD-101?", tag: "Order tracking", initials: "PS", color: "bg-tomato" },
  { kind: "icon", color: "bg-sun", icon: "box" },
  { kind: "quote", text: "Can I return an opened sunscreen?", tag: "Return policy", initials: "RV", color: "bg-grape" },
  { kind: "icon", color: "bg-grape", icon: "phone" },
  { kind: "quote", text: "Please cancel ORD-103", tag: "Cancellation", initials: "AP", color: "bg-leaf" },
  { kind: "icon", color: "bg-bubblegum", icon: "heart" },
] as const;

const MARQUEE_B = [
  { kind: "quote", text: "Mera order kab aayega?", tag: "Hinglish", initials: "AK", color: "bg-sun" },
  { kind: "icon", color: "bg-tomato", icon: "reply" },
  { kind: "quote", text: "Is COD available for ₹3,000?", tag: "Payments", initials: "NS", color: "bg-bubblegum" },
  { kind: "icon", color: "bg-grape", icon: "chat" },
  { kind: "quote", text: "Book me a flight to Goa", tag: "Out of scope · declined", initials: "VK", color: "bg-ink" },
  { kind: "icon", color: "bg-sun", icon: "spark" },
] as const;

function MarqueeIcon({ icon }: { icon: string }) {
  const paths: Record<string, React.ReactNode> = {
    box: <path d="M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8" />,
    phone: <rect x="7" y="3" width="10" height="18" rx="2.5" />,
    heart: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" fill="currentColor" />,
    reply: <path d="M10 7L5 12l5 5M5 12h9a5 5 0 0 1 5 5" />,
    chat: <path d="M5 6h14v9H10l-4 3v-3H5z" />,
    spark: <path d="M12 3c1 5 4 8 9 9-5 1-8 4-9 9-1-5-4-8-9-9 5-1 8-4 9-9z" fill="currentColor" />,
  };
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7 text-white" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
      {paths[icon]}
    </svg>
  );
}

function MarqueeRow({ items, reverse }: { items: typeof MARQUEE_A | typeof MARQUEE_B; reverse?: boolean }) {
  const loop = [...items, ...items];
  return (
    <div className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]">
      <div className={`flex w-max gap-5 ${reverse ? "animate-marquee-reverse" : "animate-marquee"}`}>
        {loop.map((item, i) =>
          item.kind === "icon" ? (
            <div key={i} className={`grid h-[66px] w-[66px] shrink-0 place-items-center rounded-xl ${item.color}`}>
              <MarqueeIcon icon={item.icon} />
            </div>
          ) : (
            <div key={i} className="flex h-[66px] shrink-0 items-center gap-3 rounded-xl bg-white py-2 pl-2 pr-6">
              <div className={`grid h-[50px] w-[50px] place-items-center rounded-lg font-display text-lg text-white ${item.color}`}>{item.initials}</div>
              <div>
                <p className="text-[16px] font-semibold leading-tight">“{item.text}”</p>
                <p className="text-[13px] text-ink/60">{item.tag}</p>
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  );
}

function Conversations() {
  return (
    <section className="bg-cream py-16 sm:py-20">
      <MarqueeRow items={MARQUEE_A} />
      <p className="mx-auto my-12 max-w-3xl px-4 text-center text-[clamp(1.35rem,3vw,2.1rem)] font-semibold leading-[1.45] text-ink/85">
        Aria answers in <Highlight tone="tomato">real time</Highlight>, looks up <Highlight tone="ink">live orders</Highlight>,
        holds the line on <Highlight tone="sun">brand policy</Highlight> and hands your team a{" "}
        <Highlight tone="grape">structured summary</Highlight> of every call.
      </p>
      <MarqueeRow items={MARQUEE_B} reverse />

      <h2 className="mx-auto mt-20 max-w-4xl px-4 text-center font-display text-[clamp(2.4rem,6vw,4.6rem)] uppercase leading-[0.95]">
        Your customers are calling.
        <br />
        Aria&apos;s already answering.
      </h2>

      <div id="guardrails" className="mx-auto mt-12 max-w-6xl scroll-mt-24 px-4">
        <div className="rounded-3xl bg-tomato p-6 text-white sm:p-10">
          <h3 className="font-display text-[clamp(2.2rem,5vw,4rem)] uppercase leading-none">Resolve calls faster</h3>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { t: "Live order lookups", d: "Status, courier and ETA pulled from the order system mid-sentence. Never guessed." },
              { t: "Policy, enforced in code", d: "Return windows and cancellation rules are decided by a policy engine, not by the model's mood." },
              { t: "Knows its limits", d: "Out-of-scope asks, unknown IDs and unclear audio get a graceful answer instead of a made-up one." },
              { t: "Interrupt anytime", d: "Talk over Aria and she stops mid-word, just like a person would." },
            ].map((c) => (
              <div key={c.t} className="rounded-2xl bg-white p-5 text-ink">
                <p className="font-display text-[22px] uppercase leading-tight">{c.t}</p>
                <p className="mt-2 text-[14.5px] leading-relaxed text-ink/70">{c.d}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

const ORDER_VISUAL: Record<string, { bg: string; Sticker: typeof SerumBottle }> = {
  "ORD-101": { bg: "bg-tomato", Sticker: SerumBottle },
  "ORD-102": { bg: "bg-bubblegum", Sticker: SunscreenTube },
  "ORD-103": { bg: "bg-leaf", Sticker: PumpBottle },
};

function TryOrders() {
  return (
    <section id="try" className="relative scroll-mt-20 overflow-hidden bg-cream pb-20">
      <svg aria-hidden className="pointer-events-none absolute left-1/2 top-24 w-[1600px] -translate-x-1/2" viewBox="0 0 1600 900" fill="none">
        <circle cx="800" cy="900" r="760" stroke="#121212" strokeOpacity=".14" />
      </svg>
      <div className="relative mx-auto max-w-6xl px-4">
        <h2 className="text-center font-display text-[clamp(2.4rem,6vw,4.6rem)] uppercase leading-[0.95]">Pick an order. Start talking.</h2>
        <p className="mt-4 text-center text-[17px] text-ink/60">Three sample orders live in the mock database. Every one behaves differently.</p>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {SAMPLE_ORDER_CARDS.map((o) => {
            const { bg, Sticker } = ORDER_VISUAL[o.id];
            return (
              <article key={o.id} className="flex flex-col rounded-2xl bg-white p-3.5 shadow-sm">
                <div className={`relative grid h-56 place-items-center overflow-hidden rounded-xl ${bg}`}>
                  <Sticker className="h-40 -rotate-6" />
                  <span className="absolute left-3 top-3 rounded-full bg-white px-3 py-1 text-[12px] font-semibold">{o.status}</span>
                  <span className="absolute bottom-3 right-3 rounded-full bg-ink px-3 py-1 text-[12px] font-semibold text-white">{formatInr(o.value)}</span>
                </div>
                <h3 className="mt-4 font-display text-[34px] uppercase leading-none">{o.id}</h3>
                <p className="mt-2 text-[15px] font-medium">{o.product}</p>
                <p className="text-[14px] text-ink/60">
                  {o.customer} · {o.note}
                </p>
                <div className="mt-4 flex flex-col gap-1.5 border-t border-ink/10 pt-3">
                  {o.trySaying.map((t) => (
                    <p key={t} className="text-[14px] text-ink/80">
                      <span className="font-semibold text-tomato">Try:</span> “{t}”
                    </p>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
        <div className="mt-10 text-center">
          <Link
            href="/call"
            className="inline-flex items-center gap-2.5 rounded-full bg-ink px-6 py-3 font-display text-[20px] uppercase tracking-wide text-white transition hover:-translate-y-0.5"
          >
            Call Aria now <ArrowCircle className="h-5 w-5 text-tomato" />
          </Link>
        </div>
      </div>
    </section>
  );
}

const PIPELINE = [
  { k: "01", t: "Your voice", d: "Mic → AudioWorklet → 16 kHz PCM, 32 ms frames, echo-cancelled" },
  { k: "02", t: "Gemini Live", d: "Speech-to-speech model with server VAD, barge-in and transcription" },
  { k: "03", t: "Tool call", d: "/api/tools validates args with zod and runs the policy engine" },
  { k: "04", t: "Aria speaks", d: "24 kHz audio streams back into a flushable playback buffer" },
  { k: "05", t: "Outcome", d: "Transcript + tool log → JSON outcome, schema-validated" },
];

const FEATURES = [
  {
    c: "bg-ink",
    icon: <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6zM9 12l2 2 4-4" />,
    t: "Guardrails in code",
    d: "Return and cancellation verdicts come from tested functions. The prompt only relays them.",
  },
  {
    c: "bg-sun",
    icon: <path d="M13 2L4 14h7l-1 8 9-12h-7z" />,
    t: "Low latency",
    d: "Direct WebSocket to the model, 32 ms audio frames, and a latency meter on every turn.",
  },
  {
    c: "bg-tomato",
    icon: <path d="M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4" />,
    t: "Locked tokens",
    d: "Single-use ephemeral tokens carry the prompt and tools. The API key never reaches the browser.",
  },
  {
    c: "bg-grape",
    icon: <path d="M8 4c-2 0-3 1-3 3v2c0 1.5-1 3-2 3 1 0 2 1.5 2 3v2c0 2 1 3 3 3M16 4c2 0 3 1 3 3v2c0 1.5 1 3 2 3-1 0-2 1.5-2 3v2c0 2-1 3-3 3" />,
    t: "Structured outcomes",
    d: "Intent, order, resolution and policy flags as schema-validated JSON, with a rule-based fallback.",
  },
];

function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-16 bg-ink pb-20 pt-20 text-white">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="text-center font-display text-[clamp(2.4rem,6vw,4.8rem)] uppercase leading-[0.95]">
          Not just a chatbot.
          <br />A real-time voice pipeline.
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-center text-[17px] leading-relaxed text-white/70">
          The browser streams audio straight to Gemini Live on a short-lived, locked token, so there&apos;s no relay hop adding latency.
          Everything that needs to be trusted (order data, policy, summaries) runs on the server.
        </p>

        <div className="relative mt-12 overflow-hidden rounded-3xl bg-gradient-to-b from-[#2a2410] to-[#161616] p-6 ring-1 ring-white/10 sm:p-10">
          <div className="absolute -right-10 -top-10 h-56 w-56 rounded-full bg-sun/20 blur-3xl" aria-hidden />
          <p className="font-display text-[clamp(1.8rem,4vw,3rem)] uppercase leading-none text-sun">From hello to resolved</p>
          <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {PIPELINE.map((s, i) => (
              <li key={s.k} className="relative">
                <span className="font-display text-[44px] leading-none text-white/20">{s.k}</span>
                <p className="mt-1 font-display text-[22px] uppercase">{s.t}</p>
                <p className="mt-1.5 text-[14px] leading-relaxed text-white/65">{s.d}</p>
                {i < PIPELINE.length - 1 && <span className="absolute right-[-14px] top-4 hidden text-sun lg:block">→</span>}
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.t} className="rounded-2xl bg-white p-5 text-ink">
              <span className={`grid h-11 w-11 place-items-center rounded-full text-white ${f.c}`}>
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  {f.icon}
                </svg>
              </span>
              <p className="mt-4 text-[18px] font-semibold">{f.t}</p>
              <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink/65">{f.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="bg-ink pb-10 text-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center px-4 pt-10 text-center">
        <div className="relative mb-6 flex items-end gap-4">
          <SerumBottle className="w-14 -rotate-12" />
          <PumpBottle className="w-20" />
          <SunscreenTube className="w-12 rotate-12" />
          <Sparkle className="absolute -right-8 -top-2 w-6" color="#e9bd16" />
          <Plus className="absolute -left-8 top-0 w-4" />
        </div>
        <h2 className="font-display text-[clamp(2.4rem,6vw,4.6rem)] uppercase leading-[0.95]">Your next call starts here</h2>
        <p className="mt-4 max-w-lg text-[17px] text-white/70">Open the call screen, allow your microphone, and ask Aria anything about your Aura order.</p>
        <Link href="/call" className="mt-7 rounded-full bg-white px-6 py-2.5 text-[15px] font-semibold text-ink transition hover:-translate-y-0.5">
          Start a call
        </Link>
      </div>

      <footer className="mx-auto mt-20 grid max-w-6xl gap-10 px-4 sm:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <p className="font-display text-[34px] uppercase leading-none">Built for Datastraw</p>
          <p className="mt-3 max-w-sm text-[14.5px] leading-relaxed text-white/60">
            An AI voice CX agent for a fictional D2C skincare brand. Aura Skincare and its customers are not real.
          </p>
        </div>
        <div>
          <p className="font-semibold">Product</p>
          <ul className="mt-3 flex flex-col gap-2 text-[15px] text-white/70">
            <li><Link href="/call" className="hover:text-white">Call Aria</Link></li>
            <li><a href="#try" className="hover:text-white">Test orders</a></li>
            <li><a href="#guardrails" className="hover:text-white">Guardrails</a></li>
          </ul>
        </div>
        <div>
          <p className="font-semibold">Built with</p>
          <ul className="mt-3 flex flex-col gap-2 text-[15px] text-white/70">
            <li>Gemini Live API</li>
            <li>Next.js on Vercel</li>
            <li>Web Audio worklets</li>
          </ul>
        </div>
      </footer>
    </section>
  );
}

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Conversations />
        <TryOrders />
        <HowItWorks />
        <FinalCta />
      </main>
    </>
  );
}
