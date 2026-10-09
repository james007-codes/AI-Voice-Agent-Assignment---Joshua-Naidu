"use client";

import { useState } from "react";
import type { CallSnapshot } from "@/lib/voice/call-controller";
import { average, formatClock, humanize } from "@/lib/format";
import { Transcript } from "./transcript";

const RESOLUTION_COLOR: Record<string, string> = {
  RESOLVED: "text-mint border-mint/50",
  POLICY_DECLINED: "text-[#f5d26b] border-[#f5d26b]/50",
  ESCALATED: "text-[#b5aaff] border-[#b5aaff]/50",
  PARTIALLY_RESOLVED: "text-[#f5d26b] border-[#f5d26b]/50",
  UNRESOLVED: "text-[#ff8a75] border-[#ff8a75]/50",
};

const END_REASONS: Record<string, string> = {
  customer_hung_up: "You ended the call",
  agent_ended_call: "Aria ended the call",
  time_limit: "Time limit reached",
  connection_lost: "Connection lost",
};

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-smoke">
      <span className="text-mint">■</span> {children}
    </p>
  );
}

export function SummaryView({
  call,
  onRetrySummary,
  onNewCall,
}: {
  call: CallSnapshot;
  onRetrySummary: () => void;
  onNewCall: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const duration = call.startedAt && call.endedAt ? (call.endedAt - call.startedAt) / 1000 : 0;
  const avgLatency = average(call.latencies);
  const outcome = call.summary?.outcome;
  const json = call.summary ? JSON.stringify({ ...call.summary.outcome, metadata: call.summary.metadata }, null, 2) : "";

  const copy = async () => {
    await navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `aura-call-${call.callId?.slice(0, 8)}.json` });
    a.click();
    URL.revokeObjectURL(url);
  };

  const metrics = [
    { k: "Duration", v: formatClock(duration) },
    { k: "Customer turns", v: String(call.transcript.filter((t) => t.role === "customer" && t.text.trim()).length) },
    { k: "Avg response", v: avgLatency ? `${avgLatency} ms` : "—" },
    { k: "Tool calls", v: String(call.tools.filter((t) => t.status === "done").length) },
  ];

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-20 pt-6 sm:px-8">
      <div className="flex flex-col gap-6 border-b border-line pb-8 md:flex-row md:items-end md:justify-between">
        <div>
          <Label>{END_REASONS[call.endReason ?? ""] ?? "Call ended"}</Label>
          <h1 className="mt-3 font-serif text-4xl uppercase tracking-[0.08em] text-mint sm:text-6xl">Call complete</h1>
          {call.notice && <p className="mt-2 text-sm text-smoke">{call.notice}</p>}
        </div>
        <button
          onClick={onNewCall}
          className="dash-frame inline-flex items-center gap-2 self-start rounded-full bg-void-2 px-5 py-2.5 font-mono text-[12px] uppercase tracking-[0.14em] text-mint transition hover:bg-void-3 md:self-auto"
        >
          <span className="h-2 w-2 rounded-full bg-mint" /> Start new call
        </button>
      </div>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-4">
        {metrics.map((m) => (
          <div key={m.k} className="bg-void px-4 py-4">
            <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-smoke">{m.k}</dt>
            <dd className="mt-1 font-serif text-2xl text-fog">{m.v}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-8">
          <div>
            <Label>Structured outcome</Label>
            {call.summaryStatus === "loading" && (
              <p className="mt-4 animate-blink font-mono text-[12px] uppercase tracking-[0.14em] text-mint">Analysing call…</p>
            )}
            {call.summaryStatus === "error" && (
              <div className="mt-4 flex items-center gap-3 text-sm text-smoke">
                Couldn&apos;t generate the summary.
                <button onClick={onRetrySummary} className="font-mono text-[11px] uppercase tracking-[0.14em] text-mint underline">
                  Retry
                </button>
              </div>
            )}
            {outcome && (
              <div className="mt-4 flex flex-col gap-5">
                <div className="flex flex-wrap gap-2">
                  <span className={`rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-[0.12em] ${RESOLUTION_COLOR[outcome.resolution_status] ?? "text-fog"}`}>
                    {humanize(outcome.resolution_status)}
                  </span>
                  <span className="rounded-full border border-line px-3 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-fog">
                    {humanize(outcome.customer_intent)}
                  </span>
                  {outcome.order_id && (
                    <span className="rounded-full border border-line px-3 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-mint">{outcome.order_id}</span>
                  )}
                  <span className="rounded-full border border-line px-3 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-smoke">
                    {humanize(outcome.customer_sentiment)} · {outcome.language}
                  </span>
                </div>
                <p className="text-xl leading-relaxed text-fog sm:text-2xl">{outcome.call_summary}</p>
                {outcome.actions_taken.length > 0 && (
                  <ul className="flex flex-col gap-1.5">
                    {outcome.actions_taken.map((a) => (
                      <li key={a} className="text-[14px] text-fog/80">
                        <span className="font-mono text-mint-dim">↳ </span>
                        {a}
                      </li>
                    ))}
                  </ul>
                )}
                {outcome.policy_flags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {outcome.policy_flags.map((f) => (
                      <span key={f} className="dash-frame rounded px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-[#f5d26b]">
                        {f}
                      </span>
                    ))}
                  </div>
                )}
                {outcome.follow_up_required && (
                  <p className="text-[14px] text-[#b5aaff]">Follow-up: {outcome.follow_up_notes ?? "required"}</p>
                )}
              </div>
            )}
          </div>

          {call.summary && (
            <div>
              <div className="flex items-center justify-between">
                <Label>Outcome JSON {call.summary.metadata.summary_source === "fallback" && "· rule-based fallback"}</Label>
                <div className="flex gap-3 font-mono text-[10.5px] uppercase tracking-[0.14em]">
                  <button onClick={copy} className="text-mint hover:underline">{copied ? "Copied" : "Copy"}</button>
                  <button onClick={download} className="text-mint hover:underline">Download</button>
                </div>
              </div>
              <pre className="scroll-thin mt-3 max-h-[420px] overflow-auto rounded-xl border border-line bg-void-2 p-4 font-mono text-[12px] leading-relaxed text-fog/85">
                {json}
              </pre>
            </div>
          )}
        </div>

        <div>
          <Label>Transcript</Label>
          <div className="mt-5">
            <Transcript items={call.transcript} tools={call.tools} live={false} emptyHint="Nothing was said on this call." />
          </div>
        </div>
      </div>
    </section>
  );
}
