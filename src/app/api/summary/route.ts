import { z } from "zod";
import {
  CallOutcomeSchema,
  SummaryRequestSchema,
  fallbackSummary,
  summaryPrompt,
  type CallOutcome,
} from "@/lib/agent/summary";
import { toModelJsonSchema } from "@/lib/agent/json-schema";
import { env } from "@/lib/server/env";
import { gemini } from "@/lib/server/gemini";

const outcomeJsonSchema = toModelJsonSchema(CallOutcomeSchema);

/**
 * Post-call structured outcome. Uses a small, fast text model with a JSON
 * schema constraint, validates the result, and degrades to a deterministic
 * summary built from the tool log if anything fails.
 */
export async function POST(req: Request) {
  const parsed = SummaryRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "BAD_REQUEST", issues: z.prettifyError(parsed.error) }, { status: 400 });
  }
  const call = parsed.data;

  let outcome: CallOutcome;
  let source: "llm" | "fallback" = "llm";

  if (!call.transcript.some((t) => t.role === "customer")) {
    outcome = fallbackSummary(call);
    source = "fallback";
  } else {
    try {
      const response = await gemini().models.generateContent({
        model: env.summaryModel,
        contents: summaryPrompt(call),
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: outcomeJsonSchema,
          temperature: 0.1,
        },
      });
      outcome = CallOutcomeSchema.parse(JSON.parse(response.text ?? ""));
    } catch (err) {
      console.error(JSON.stringify({ event: "summary_error", callId: call.callId, error: String(err) }));
      outcome = fallbackSummary(call);
      source = "fallback";
    }
  }

  const metadata = {
    call_id: call.callId,
    started_at: new Date(call.startedAt).toISOString(),
    duration_seconds: Math.max(0, Math.floor((call.endedAt - call.startedAt) / 1000)),
    customer_turns: call.transcript.filter((t) => t.role === "customer").length,
    agent_turns: call.transcript.filter((t) => t.role === "agent").length,
    tools_used: call.toolLog.map((t) => t.name),
    summary_source: source,
  };

  console.log(JSON.stringify({ event: "call_summarised", ...metadata, intent: outcome.customer_intent, resolution: outcome.resolution_status }));

  return Response.json({ outcome, metadata });
}
