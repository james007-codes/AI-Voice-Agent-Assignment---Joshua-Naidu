import { EDGE_CASE_PROMPTS, SAMPLE_ORDER_CARDS } from "@/lib/agent/orders/sample-cards";
import { formatInr } from "@/lib/format";

const STATUS_STYLE: Record<string, string> = {
  "Out for Delivery": "text-[#f5d26b] border-[#f5d26b]/40",
  Delivered: "text-mint border-mint/40",
  Processing: "text-[#b5aaff] border-[#b5aaff]/40",
};

export function TestOrders() {
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-3">
        {SAMPLE_ORDER_CARDS.map((o) => (
          <li key={o.id} className="rounded-xl border border-line bg-void-2/80 p-3.5 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-serif text-lg tracking-wider text-mint">{o.id}</span>
              <span className={`rounded-full border px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.12em] ${STATUS_STYLE[o.status] ?? "text-fog"}`}>
                {o.status}
              </span>
            </div>
            <p className="mt-2 text-[13.5px] text-fog">{o.product}</p>
            <p className="mt-0.5 text-[12.5px] text-smoke">
              {o.customer} · {formatInr(o.value)}
            </p>
            <p className="mt-0.5 text-[12px] text-smoke/80">{o.note}</p>
            <div className="mt-2.5 flex flex-col gap-1 border-t border-line pt-2.5">
              {o.trySaying.map((t) => (
                <p key={t} className="font-mono text-[10.5px] leading-snug text-fog/70">
                  <span className="text-mint-dim">TRY ›</span> “{t}”
                </p>
              ))}
            </div>
          </li>
        ))}
      </ul>

      <div>
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-smoke">
          <span className="text-mint">■</span> Edge cases
        </p>
        <ul className="flex flex-col gap-1.5">
          {EDGE_CASE_PROMPTS.map((p) => (
            <li key={p.text} className="text-[12.5px] leading-snug text-fog/75">
              <span className="font-mono text-[10px] uppercase tracking-wider text-mint-dim">{p.label} › </span>“{p.text}”
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
