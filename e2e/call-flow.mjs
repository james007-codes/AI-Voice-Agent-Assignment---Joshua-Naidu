/**
 * End-to-end call flow against a simulated Gemini Live server.
 *
 * Runs the real page, real AudioWorklets (Chrome's fake mic), real /api/tools
 * and /api/summary. Only /api/session and the Gemini WebSocket are stubbed,
 * so it needs no API key and is deterministic.
 *
 *   npm run build && npm start   # in one terminal
 *   npm run e2e                  # in another
 *
 * Env: BASE_URL (default http://localhost:3000), CHROME_PATH (system Chrome).
 */
import { chromium } from "playwright-core";
import assert from "node:assert/strict";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const CHROME_PATH =
  process.env.CHROME_PATH ??
  (process.platform === "win32"
    ? "C:/Program Files/Google/Chrome/Application/chrome.exe"
    : process.platform === "darwin"
      ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
      : "/usr/bin/google-chrome");

function tone(seconds) {
  const n = Math.round(24000 * seconds);
  const buf = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.sin((i / 24000) * 2 * Math.PI * 220) * 8000), i * 2);
  return buf.toString("base64");
}
const audio = (s) => ({ serverContent: { modelTurn: { parts: [{ inlineData: { mimeType: "audio/pcm;rate=24000", data: tone(s) } }] } } });
const said = (t) => ({ serverContent: { outputTranscription: { text: t } } });
const heard = (t) => ({ serverContent: { inputTranscription: { text: t } } });
const turnComplete = { serverContent: { turnComplete: true } };

const browser = await chromium.launch({
  executablePath: CHROME_PATH,
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"],
});
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

await page.route("**/api/session", (r) =>
  r.fulfill({ json: { token: "auth_tokens/e2e", model: "gemini-3.8-live", apiVersion: "v1alpha", callId: "e2e-call-0001", maxCallSeconds: 120 } }),
);

const seen = { audioFrames: 0, cue: null, toolResponses: [] };
await page.routeWebSocket(/generativelanguage/, (ws) => {
  const send = (m) => ws.send(JSON.stringify(m));
  ws.onMessage((raw) => {
    const msg = JSON.parse(String(raw));
    if (msg.setup) return send({ setupComplete: {} });
    if (msg.realtimeInput?.audio) return void seen.audioFrames++;
    if (msg.realtimeInput?.text) {
      seen.cue = msg.realtimeInput.text;
      send(audio(0.5));
      send(said("Hi, this is Aria from Aura Skincare. How can I help you today?"));
      send(turnComplete);
      setTimeout(() => {
        // Raw Gemini API shape for server-side VAD events.
        send({ voiceActivity: { type: "ACTIVITY_START" } });
        send(heard("Where is my order ORD-101?"));
        send({ voiceActivity: { type: "ACTIVITY_END" } });
        send({ toolCall: { functionCalls: [{ id: "fc1", name: "get_order_details", args: { order_id: "ORD-101" } }] } });
      }, 1500);
      return;
    }
    const response = msg.toolResponse?.functionResponses?.[0];
    if (!response) return;
    seen.toolResponses.push(response);
    if (response.name === "get_order_details") {
      send(audio(0.5));
      send(said("It's out for delivery with BlueDart, expected today by 6 PM."));
      send(turnComplete);
      setTimeout(() => {
        send(heard("That's all, thanks."));
        send({ toolCall: { functionCalls: [{ id: "fc2", name: "end_call", args: {} }] } });
      }, 1500);
    } else if (response.name === "end_call") {
      send(audio(0.3));
      send(said("Have a lovely day!"));
      send(turnComplete);
    }
  });
});

try {
  await page.goto(`${BASE_URL}/call`);
  await page.getByRole("button", { name: /start call/i }).click();
  await page.getByText("Call complete").waitFor({ timeout: 20_000 });
  await page.getByText(/outcome json/i).waitFor({ timeout: 10_000 });

  assert.equal(seen.cue, "[The call has just connected. Greet the customer.]");
  assert.ok(seen.audioFrames > 20, `expected mic audio to stream, got ${seen.audioFrames} frames`);
  assert.deepEqual(seen.toolResponses.map((r) => [r.name, r.response.status]), [
    ["get_order_details", "FOUND"],
    ["end_call", "ENDING"],
  ]);
  assert.equal(seen.toolResponses[0].response.order.courier, "BlueDart");

  const json = JSON.parse(await page.locator("pre").textContent());
  assert.equal(json.order_id, "ORD-101");
  assert.equal(json.metadata.call_id, "e2e-call-0001");
  assert.deepEqual(json.metadata.tools_used, ["get_order_details", "end_call"]);
  assert.deepEqual(errors, []);

  console.log(`✓ call flow passed (${seen.audioFrames} mic frames, summary source: ${json.metadata.summary_source})`);
} finally {
  await browser.close();
}
