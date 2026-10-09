import { env } from "@/lib/server/env";
import { gemini, liveSessionConfig } from "@/lib/server/gemini";
import { MemoryRateLimiter, clientIp } from "@/lib/server/rate-limit";

const limiter = new MemoryRateLimiter(env.sessionsPerIpPer10Min, 10 * 60 * 1000);

/**
 * Mints a single-use, short-lived Gemini Live token.
 *
 * The browser connects to Gemini directly (lowest latency: no audio relay
 * hop through our server), but only with a token whose model, prompt, tools
 * and voice are locked here. The real API key never leaves the server.
 */
export async function POST(req: Request) {
  const ip = clientIp(req);
  const { allowed, retryAfterSeconds } = await limiter.check(ip);
  if (!allowed) {
    return Response.json(
      { error: "RATE_LIMITED", message: "Too many calls started. Please wait a few minutes." },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
    );
  }

  const callId = crypto.randomUUID();
  const now = Date.now();

  try {
    const token = await gemini().authTokens.create({
      config: {
        uses: 1,
        expireTime: new Date(now + (env.maxCallSeconds + 60) * 1000).toISOString(),
        newSessionExpireTime: new Date(now + 60 * 1000).toISOString(),
        // The constraints are the session config. We deliberately don't pass
        // lockAdditionalFields: the SDK derives a field mask from the config
        // two levels deep, which turns the `tools` array into "tools.0" and
        // the API rejects it. Without a mask, the constrained config still
        // takes precedence over the client's (verified: a client-sent system
        // instruction is ignored; see README).
        liveConnectConstraints: { model: env.liveModel, config: liveSessionConfig() },
      },
    });

    console.log(JSON.stringify({ event: "session_created", callId, model: env.liveModel }));

    return Response.json({
      token: token.name,
      model: env.liveModel,
      apiVersion: env.apiVersion,
      callId,
      maxCallSeconds: env.maxCallSeconds,
    });
  } catch (err) {
    console.error(JSON.stringify({ event: "session_error", callId, error: String(err) }));
    return Response.json(
      { error: "SESSION_UNAVAILABLE", message: "Couldn't start the voice session. Please try again." },
      { status: 502 },
    );
  }
}
