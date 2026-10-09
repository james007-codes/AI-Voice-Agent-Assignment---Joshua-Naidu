import { z } from "zod";
import { executeTool } from "@/lib/agent/tools";
import { MemoryRateLimiter, clientIp } from "@/lib/server/rate-limit";

const limiter = new MemoryRateLimiter(120, 60 * 1000);

const BodySchema = z.object({
  callId: z.string().min(1).max(64),
  name: z.string().min(1).max(64),
  args: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Executes a tool call requested by the model.
 *
 * Tools run here rather than in the browser so that order data, policy logic
 * and (in production) OMS credentials stay server-side, and every call is
 * validated and logged in one place.
 */
export async function POST(req: Request) {
  if (!(await limiter.check(clientIp(req))).allowed) {
    return Response.json({ result: { status: "ERROR", guidance: "Too many requests." } }, { status: 429 });
  }

  const body = BodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return Response.json({ error: "BAD_REQUEST", issues: z.prettifyError(body.error) }, { status: 400 });
  }

  const { callId, name, args } = body.data;
  const execution = await executeTool(name, args, { callId });

  console.log(
    JSON.stringify({
      event: "tool_call",
      callId,
      tool: name,
      ok: execution.ok,
      status: execution.result.status,
      durationMs: execution.durationMs,
    }),
  );

  return Response.json({ result: execution.result, durationMs: execution.durationMs });
}
