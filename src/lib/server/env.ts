import "server-only";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}. See .env.example.`);
  return value;
}

export const env = {
  get geminiApiKey() {
    return required("GEMINI_API_KEY");
  },
  liveModel: process.env.GEMINI_LIVE_MODEL ?? "gemini-3.8-live",
  summaryModel: process.env.GEMINI_SUMMARY_MODEL ?? "gemini-3.5-flash-lite",
  /** The SDK's ephemeral-token path targets v1alpha. */
  apiVersion: process.env.GEMINI_API_VERSION ?? "v1alpha",
  voice: process.env.GEMINI_VOICE,
  maxCallSeconds: Number(process.env.MAX_CALL_SECONDS ?? 480),
  sessionsPerIpPer10Min: Number(process.env.RATE_LIMIT_SESSIONS ?? 8),
};
