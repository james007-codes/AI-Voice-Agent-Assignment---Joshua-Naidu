"use client";

import { useEffect, useRef } from "react";
import type { ToolEvent, TranscriptItem } from "@/lib/voice/call-controller";

type Row = { kind: "msg"; at: number; item: TranscriptItem } | { kind: "tool"; at: number; tool: ToolEvent };

function toolTarget(tool: ToolEvent): string {
  const id = tool.args.order_id;
  return typeof id === "string" ? ` · ${id}` : "";
}

export function Transcript({
  items,
  tools,
  live,
  emptyHint,
}: {
  items: TranscriptItem[];
  tools: ToolEvent[];
  live: boolean;
  emptyHint?: string;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  const rows: Row[] = [
    ...items.filter((i) => i.text.trim()).map((item) => ({ kind: "msg" as const, at: item.at, item })),
    ...tools.map((tool) => ({ kind: "tool" as const, at: tool.at, tool })),
  ].sort((a, b) => a.at - b.at);

  const lastText = items.at(-1)?.text;
  useEffect(() => {
    if (live) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [live, rows.length, lastText]);

  if (!rows.length) {
    return <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-smoke/70">{emptyHint ?? "Transcript appears here as you talk."}</p>;
  }

  return (
    <ol className="flex flex-col gap-5" aria-live={live ? "polite" : undefined}>
      {rows.map((row) =>
        row.kind === "tool" ? (
          <li key={row.tool.id} className="dash-frame self-start rounded-md px-2.5 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-mint/80">
            <span className="text-smoke">↳ </span>
            {row.tool.name}
            {toolTarget(row.tool)}
            <span className="text-smoke">
              {" → "}
              {row.tool.status === "running" ? (
                <span className="animate-blink">running</span>
              ) : row.tool.status === "cancelled" ? (
                "cancelled"
              ) : (
                String(row.tool.result?.status ?? "done").toLowerCase().replace(/_/g, " ")
              )}
              {row.tool.durationMs != null && ` · ${row.tool.durationMs}ms`}
            </span>
          </li>
        ) : row.item.role === "agent" ? (
          <li key={row.item.id} className="flex gap-3">
            <span className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-mint/40 text-mint" aria-hidden>
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor">
                <rect x="2" y="6" width="1.6" height="4" rx=".8" />
                <rect x="5.5" y="3.5" width="1.6" height="9" rx=".8" />
                <rect x="9" y="5" width="1.6" height="6" rx=".8" />
                <rect x="12.4" y="6.5" width="1.6" height="3" rx=".8" />
              </svg>
            </span>
            <div className="min-w-0">
              <p className="text-[15px] leading-relaxed text-fog">{row.item.text.trim()}</p>
              <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-smoke">
                <span className="text-fog">Aria</span> · Aura Skincare
                {row.item.interrupted && <span className="text-mint"> · interrupted</span>}
              </p>
            </div>
          </li>
        ) : (
          <li key={row.item.id} className="ml-8 flex flex-col items-end text-right">
            <p className="rounded-2xl rounded-tr-sm bg-void-3 px-3.5 py-2 text-[14.5px] leading-relaxed text-fog/85">{row.item.text.trim()}</p>
            <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-smoke">You</p>
          </li>
        ),
      )}
      <div ref={endRef} />
    </ol>
  );
}
