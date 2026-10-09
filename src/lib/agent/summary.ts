/**
 * Post-call structured outcome.
 *
 * The zod schema is the contract: it generates the JSON Schema we pass to the
 * model as `responseJsonSchema`, and it validates what comes back. If the LLM
 * call fails, `fallbackSummary` derives a usable outcome from the tool log so
 * the post-call screen never comes up empty.
 */

import { z } from "zod";

export const INTENTS = [
  "ORDER_TRACKING",
  "RETURN_REQUEST",
  "REPLACEMENT_REQUEST",
  "CANCELLATION_REQUEST",
  "SHIPPING_POLICY_QUERY",
  "PAYMENT_COD_QUERY",
  "PRODUCT_QUERY",
  "COMPLAINT",
  "HUMAN_HANDOFF",
  "OUT_OF_SCOPE",
  "GENERAL_ENQUIRY",
  "NO_INTERACTION",
] as const;

export const RESOLUTION_STATUSES = [
  "RESOLVED",
  "PARTIALLY_RESOLVED",
  "POLICY_DECLINED",
  "ESCALATED",
  "UNRESOLVED",
] as const;

export const CallOutcomeSchema = z.object({
  customer_intent: z.enum(INTENTS).describe("Primary reason for the call."),
  secondary_intents: z.array(z.enum(INTENTS)).describe("Other topics raised, if any."),
  order_id: z.string().nullable().describe("Main order discussed, normalised like ORD-101, or null."),
  resolution_status: z
    .enum(RESOLUTION_STATUSES)
    .describe(
      "RESOLVED = need met. POLICY_DECLINED = request correctly refused under policy. ESCALATED = ticket raised. PARTIALLY_RESOLVED = some needs met. UNRESOLVED = need not met.",
    ),
  call_summary: z.string().describe("Two or three sentences, past tense, factual, for a support lead."),
  customer_sentiment: z.enum(["POSITIVE", "NEUTRAL", "NEGATIVE"]),
  actions_taken: z.array(z.string()).describe("Concrete actions, e.g. 'Looked up ORD-101', 'Cancelled ORD-103 (ref CXL-103-AB12)'."),
  policy_flags: z
    .array(z.string())
    .describe("Policy or guardrail events in UPPER_SNAKE_CASE, e.g. RETURN_WINDOW_EXCEEDED, OUT_OF_SCOPE_REQUEST, ORDER_NOT_FOUND."),
  follow_up_required: z.boolean(),
  follow_up_notes: z.string().nullable(),
  language: z.string().describe("Language(s) the customer used, e.g. 'English', 'Hinglish'."),
});

export type CallOutcome = z.infer<typeof CallOutcomeSchema>;

export const TranscriptEntrySchema = z.object({
  role: z.enum(["customer", "agent"]),
  text: z.string().max(4000),
  at: z.number(),
});

export const ToolLogEntrySchema = z.object({
  name: z.string(),
  args: z.record(z.string(), z.unknown()),
  result: z.record(z.string(), z.unknown()),
  at: z.number(),
});

export const SummaryRequestSchema = z.object({
  callId: z.string().min(1).max(64),
  startedAt: z.number(),
  endedAt: z.number(),
  transcript: z.array(TranscriptEntrySchema).max(400),
  toolLog: z.array(ToolLogEntrySchema).max(100),
});

export type SummaryRequest = z.infer<typeof SummaryRequestSchema>;
export type TranscriptEntry = z.infer<typeof TranscriptEntrySchema>;
export type ToolLogEntry = z.infer<typeof ToolLogEntrySchema>;

export function summaryPrompt(req: SummaryRequest): string {
  const transcript = req.transcript
    .map((t) => `${t.role === "agent" ? "AGENT" : "CUSTOMER"}: ${t.text}`)
    .join("\n");
  const tools = req.toolLog
    .map((t) => `${t.name}(${JSON.stringify(t.args)}) -> ${JSON.stringify(t.result)}`)
    .join("\n");

  return `You are a QA analyst for a customer support team. Produce the structured outcome for this voice call.
Base it ONLY on the transcript and tool results below. Tool results are ground truth; customer speech transcription may contain recognition errors.
If the customer never spoke, use NO_INTERACTION and UNRESOLVED.

TOOL CALLS:
${tools || "(none)"}

TRANSCRIPT:
${transcript || "(empty)"}`;
}

/** Deterministic outcome from the tool log, used if the LLM is unavailable. */
export function fallbackSummary(req: SummaryRequest): CallOutcome {
  const spoke = req.transcript.some((t) => t.role === "customer");
  const statusOf = (r: Record<string, unknown>) => String(r.status ?? "");
  const last = (name: string) => [...req.toolLog].reverse().find((t) => t.name === name);

  const orderIds = req.toolLog
    .map((t) => (t.result.order_id ?? (t.result.order as { order_id?: string } | undefined)?.order_id) as string | undefined)
    .filter(Boolean);

  const cancel = last("cancel_order");
  const ret = last("check_return_eligibility");
  const escalation = last("escalate_to_human");
  const order = last("get_order_details");

  let intent: CallOutcome["customer_intent"] = spoke ? "GENERAL_ENQUIRY" : "NO_INTERACTION";
  let status: CallOutcome["resolution_status"] = spoke ? "RESOLVED" : "UNRESOLVED";
  const flags: string[] = [];

  if (order) intent = "ORDER_TRACKING";
  if (ret) {
    intent = ret.args.issue_type === "change_of_mind" ? "RETURN_REQUEST" : "REPLACEMENT_REQUEST";
    if (statusOf(ret.result) === "NOT_ELIGIBLE") {
      status = "POLICY_DECLINED";
      flags.push("RETURN_NOT_ELIGIBLE");
    }
  }
  if (cancel) {
    intent = "CANCELLATION_REQUEST";
    if (statusOf(cancel.result) === "CANCELLATION_NOT_ALLOWED") {
      status = "POLICY_DECLINED";
      flags.push("CANCELLATION_NOT_ALLOWED");
    }
  }
  if (req.toolLog.some((t) => statusOf(t.result) === "ORDER_NOT_FOUND")) flags.push("ORDER_NOT_FOUND");
  if (escalation) status = "ESCALATED";

  return {
    customer_intent: intent,
    secondary_intents: [],
    order_id: orderIds.at(-1) ?? null,
    resolution_status: status,
    call_summary: spoke ? describeToolLog(req.toolLog) : "The call ended before the customer spoke.",
    customer_sentiment: "NEUTRAL",
    actions_taken: req.toolLog.map((t) => `${t.name}: ${statusOf(t.result)}`),
    policy_flags: flags,
    follow_up_required: Boolean(escalation),
    follow_up_notes: escalation ? String(escalation.args.reason ?? "") : null,
    language: "Unknown",
  };
}

/** One factual sentence per meaningful tool result, for the fallback summary. */
function describeToolLog(log: ToolLogEntry[]): string {
  const lines = log.flatMap((t): string[] => {
    const r = t.result as Record<string, string | undefined> & { order?: Record<string, string | undefined> };
    switch (`${t.name}:${r.status}`) {
      case "get_order_details:FOUND": {
        const o = r.order ?? {};
        const when = o.expected_delivery ? `, expected ${o.expected_delivery}` : o.delivered ? `, delivered ${o.delivered}` : "";
        return [`Customer asked about ${o.order_id}, which is ${o.status}${when}.`];
      }
      case "get_order_details:ORDER_NOT_FOUND":
        return [`Customer gave order ID ${r.searched_for}, which could not be found.`];
      case "cancel_order:CANCELLED":
        return [`Order ${r.order_id} was cancelled (ref ${r.cancellation_reference}).`];
      case "cancel_order:CANCELLATION_NOT_ALLOWED":
        return [`Cancellation of ${r.order_id} was declined: ${r.reason}`];
      case "escalate_to_human:TICKET_CREATED":
        return [`Escalated to the support team (ticket ${r.ticket_id}).`];
      default:
        return t.name === "check_return_eligibility" && r.reason
          ? [`Return/replacement check returned ${String(r.status).toLowerCase().replace(/_/g, " ")}: ${r.reason}`]
          : [];
    }
  });
  return lines.length ? lines.join(" ") : "Customer spoke with Aria; no order actions were needed.";
}
