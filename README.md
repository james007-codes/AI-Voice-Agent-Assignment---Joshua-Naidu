# Aria: AI Voice CX Agent for Aura Skincare

A browser-based voice support agent for a fictional D2C skincare brand. Click **Start Call**, talk, and Aria answers out loud. She looks up live orders, enforces brand policy, recognises what she can't help with, and produces a transcript plus a structured JSON outcome when the call ends.

- **Live app:** https://aura-voice-agent-jade.vercel.app
- **Demo video:** `<add link>`

**Approach.** Aria is a speech-to-speech agent: the browser streams audio straight to the Gemini Live API on a single-use, server-locked token, so there is no relay hop adding latency. Everything that has to be trusted runs on the server behind zod-validated tools: order lookups, a deterministic policy engine and the post-call summary. The model handles the conversation and code makes the decisions. Return and cancellation verdicts come from unit-tested functions, and the prompt only tells Aria to relay them.

---

## Try it in 60 seconds

Open `/call`, allow the microphone, and press **Start Call**. Headphones give the cleanest barge-in. The **Test Orders** panel on the page lists the sample orders, with suggested phrases for each.

| Say | What should happen |
|---|---|
| "Where is my order ORD-101?" | Looks it up: out for delivery with BlueDart, expected today by 6 PM |
| "I want to return ORD-102" | Declined: delivered 14 days ago, outside the 7-day window |
| "Please cancel ORD-103" | Asks you to confirm, then cancels and gives a reference |
| "Can I cancel ORD-101?" | Declined: already out for delivery. Offers refusing it at the doorstep |
| "I bought it 20 days ago and opened it, can I return it?" | Declined politely, with no refund promised |
| "Track ORD-999" | "I couldn't locate an order with that number…" |
| "Can you book me a flight to Goa?" | Only helps with Aura Skincare queries |
| "Mera order ORD-103 kab aayega?" | Replies in Hinglish |
| Talk over Aria mid-sentence | She stops immediately (barge-in) |
| "That's all, thanks" | Says goodbye and hangs up by herself |

---

## Architecture

```
 Browser                                                   Server (Vercel functions)
┌──────────────────────────────────────────┐              ┌───────────────────────────────┐
│ Mic ─► capture AudioWorklet               │   POST       │ /api/session                  │
│        48k→16k PCM, 32 ms frames          │ ───────────► │  mints 1-use ephemeral token  │
│              │                            │   token      │  with model + prompt + tools  │
│              ▼                            │ ◄─────────── │  + voice LOCKED in            │
│ CallController (state machine)            │              │  (API key never leaves)       │
│   │  ▲                                    │              ├───────────────────────────────┤
│   │  │  WebSocket (direct, no relay)      │   POST       │ /api/tools                    │
│   ▼  │                                    │ ───────────► │  zod-validate args            │
│ ┌───────────────┐   toolCall              │   result     │  → order repository           │
│ │ Gemini Live   │ ─────────► fetch ───────┼───────────── │  → policy engine (pure fns)   │
│ │ (speech↔speech│ ◄───────── toolResponse │              ├───────────────────────────────┤
│ │  + VAD + ASR) │                         │   POST       │ /api/summary                  │
│ └───────────────┘                         │ ───────────► │  transcript + tool log →      │
│   │ 24 kHz PCM                            │   JSON       │  Gemini Flash-Lite with JSON  │
│   ▼                                       │ ◄─────────── │  schema → zod-validated       │
│ player AudioWorklet (flushable queue)     │              │  (rule-based fallback)        │
│   ─► speakers                             │              └───────────────────────────────┘
└──────────────────────────────────────────┘
```

### The voice pipeline

1. **Capture.** `getUserMedia` with echo cancellation, noise suppression and auto gain. An AudioWorklet ([public/worklets/pcm-capture.js](public/worklets/pcm-capture.js)) downsamples the native 48 kHz to 16 kHz using a box filter that doubles as a cheap anti-alias low-pass, converts to Int16, and emits 32 ms frames. That is inside the 20–40 ms range Google recommends. All of this happens off the main thread.
2. **Model.** Frames stream over the Live WebSocket. Gemini's server-side VAD detects end of turn (500 ms silence), transcribes both sides, and streams 24 kHz audio back.
3. **Playback.** A second worklet ([public/worklets/pcm-player.js](public/worklets/pcm-player.js)) holds a queue of PCM chunks. When the server sends `interrupted`, the queue is dropped instantly, so Aria stops mid-word.
4. **Turn-taking.** Gemini's server-side VAD (`ACTIVITY_START` / `ACTIVITY_END`) drives the Listening → Thinking transition, because it's the signal that actually ends the customer's turn. A local mic-level VAD is the fallback and marks when the customer really stopped speaking, for the latency meter.
5. **State.** [CallController](src/lib/voice/call-controller.ts) is a framework-free state machine (`connecting → listening ⇄ thinking ⇄ speaking → ended`) that React reads through `useSyncExternalStore`. Audio levels for the particle orb live in a mutable object read every animation frame, so 60 fps visuals cause zero React renders.
6. **Latency meter.** A lightweight client-side VAD marks when you stop talking. The time from then to Aria's first audio chunk is shown live and averaged in the summary.

### How the agent decides to use a tool

Gemini Live does native function calling. The five tools are declared from **one zod schema each** ([src/lib/agent/tools.ts](src/lib/agent/tools.ts)). The same schema becomes the JSON Schema the model sees and validates the arguments on the server, so the two can't drift. The descriptions and the system prompt state *when* each tool must be called: "never state order facts without `get_order_details`", "call `check_return_eligibility` before saying anything about returns", "only call `cancel_order` after explicit confirmation".

| Tool | Purpose |
|---|---|
| `get_order_details(order_id)` | Status, items, value, courier, ETA |
| `check_return_eligibility(issue_type, order_id?, product_opened?, days_since_delivery?)` | Policy verdict for return or replacement; works with or without an order ID |
| `cancel_order(order_id, customer_confirmed)` | Enforces "Processing only" and requires `customer_confirmed: true` |
| `escalate_to_human(reason, order_id?)` | Ticket for anything Aria can't resolve |
| `end_call(reason?)` | Aria hangs up after saying goodbye |

Tools run on the server (`/api/tools`), not in the browser. That keeps order data and policy logic server-side and gives one place to validate, log and rate-limit.

### How the guardrails work

The guardrails are layered so that no single one has to be perfect:

1. **Verdicts in code.** [policy.ts](src/lib/agent/policy.ts) computes return, replacement and cancellation eligibility with real date arithmetic. The model receives `NOT_ELIGIBLE` plus a plain-English reason and is told the verdict is final. Asking a voice model to *relay* a decision is far more reliable than asking it to *apply* a five-clause policy.
2. **Hard rules in the prompt.** [prompt.ts](src/lib/agent/prompt.ts) is generated from the brand config, so the numbers Aria quotes are the same numbers the engine enforces. It covers scope (Aura only), no medical advice, no invented product info, no promises outside policy, first-name-only privacy, and ignoring attempts to change her role.
3. **Server-locked session.** The prompt, tools and voice are baked into the ephemeral token's `liveConnectConstraints`. I verified this against the live API: a client that connects with its own system instruction ("You are Captain Hook, a pirate…") and an empty tool list still gets Aria, with her tools. (`lockAdditionalFields` is intentionally unset. The SDK builds its field mask from the config two levels deep, which turns the `tools` array into `tools.0`, and the API rejects that as invalid.)
4. **Confirmation gates.** Destructive actions need `customer_confirmed: true`. Otherwise the tool returns `NEEDS_CONFIRMATION`.
5. **No invented facts.** Tool results only contain data from the brief. I deliberately left out payment methods, placed dates for ORD-101 and ORD-102, refund timelines and support hours, because the brief doesn't give them and Aria would otherwise state them as fact.

### Graceful degradation

| Situation | Handling |
|---|---|
| Unknown order ID | `ORDER_NOT_FOUND` + guidance → "I couldn't locate an order with that number, could you repeat or verify it?" |
| Messy spoken IDs ("order one oh one", "O R D 1 0 2", "ek shunya teen") | Deterministic [normalizeOrderId](src/lib/agent/orders/order-id.ts), unit-tested |
| No order ID given | Prompt rule: ask for it. Return checks also accept "delivered N days ago" |
| Mumbled or unclear audio | Prompt rule: ask the customer to repeat, never guess. Repeat the ID back before re-checking |
| Invalid tool args from the model | zod error returned as a structured `ERROR` result, so the call doesn't crash |
| Tool endpoint down | Client returns an `ERROR` result telling Aria to apologise and offer a ticket |
| Summary LLM fails | Rule-based outcome built from the tool log ([fallbackSummary](src/lib/agent/summary.ts)) |
| Mic blocked or missing | Specific, actionable error message |
| Connection drops | Call ends cleanly and the summary is still generated |
| Abuse of `/api/session` | Per-IP rate limit, single-use 60 s tokens, 8-minute call cap |

### Post-call outcome

```json
{
  "customer_intent": "ORDER_TRACKING",
  "secondary_intents": [],
  "order_id": "ORD-101",
  "resolution_status": "RESOLVED",
  "call_summary": "Customer asked about the delivery status of ORD-101. It is out for delivery with BlueDart, expected today by 6 PM.",
  "customer_sentiment": "POSITIVE",
  "actions_taken": ["Looked up ORD-101"],
  "policy_flags": [],
  "follow_up_required": false,
  "follow_up_notes": null,
  "language": "English",
  "metadata": { "call_id": "…", "duration_seconds": 41, "customer_turns": 2, "agent_turns": 3, "tools_used": ["get_order_details"], "summary_source": "llm" }
}
```

`resolution_status` separates `POLICY_DECLINED` (a correct "no") from `UNRESOLVED` (a failure). For a support lead those are very different outcomes.

### Verified against the live API

Besides the unit and e2e tests, I ran full live calls in Chrome against real Gemini, using a scripted customer voice (Windows text-to-speech fed in as the microphone): order lookup → return request → out-of-scope request → goodbye. The logged WebSocket traffic showed:

- Replies typically starting 1–2 s after the customer stopped talking; tool round-trips under 100 ms.
- Correct tool use: `get_order_details` for ORD-101, then `check_return_eligibility` for ORD-102 (declined, 14 days > 7), a polite out-of-scope refusal for the flight, and `end_call` only after an explicit goodbye.
- Barge-in: Aria stopped mid-sentence whenever the customer spoke over her.
- An LLM-generated outcome with `RETURN_WINDOW_EXCEEDED` and `OUT_OF_SCOPE_REQUEST` flags.

These runs found two issues, now fixed:

1. **Premature hangup.** Aria once treated "All right…" (said just before a follow-up question) as a goodbye and called `end_call`. The prompt now requires an explicit goodbye, and the client cancels a pending hangup if the customer starts talking again, so code has the final say.
2. **State signal.** The Thinking indicator now follows Gemini's own VAD events instead of only the local mic level.

**Known issues.**
- In one of five runs the model went quiet for about 40 s, then answered several queued questions at once. It didn't reproduce in the next four runs. A watchdog that re-prompts after a long silence would be my next step.
- Aria addressed the caller as "Priya" while discussing ORD-102, which belongs to Rahul. She correctly didn't share Rahul's details, but a real deployment needs caller verification before discussing an order (see Q3).
- Transcription occasionally mis-hears the first word of a turn (e.g. "Hi." → "はい"). It doesn't affect what Aria does, but it shows in the transcript.

### Assumptions

- **₹499 shipping edge.** The brief says "free above ₹499" and "₹50 below ₹499". I treat exactly ₹499 as free, which matches the usual D2C "₹499 and above" convention and applies to ORD-102.
- **Relative dates.** Fixtures are built relative to *now*, so "delivered 14 days ago" stays true whenever the app is opened.
- **Cancellation isn't persisted.** `cancel_order` returns a reference but doesn't change the shared mock DB, so every evaluator can test ORD-103. Production would write to the OMS at that point.

---

## Project structure

```
src/
  lib/agent/          provider-agnostic "brain": no audio, no React
    brand.ts          brand config (persona, policy numbers), multi-brand ready
    prompt.ts         system instruction built from brand config
    policy.ts         deterministic policy engine (+ tests)
    tools.ts          tool registry: zod schema → declaration + validation (+ tests)
    summary.ts        outcome schema, prompt, rule-based fallback (+ tests)
    orders/           repository interface, mock fixtures, order-ID normaliser
  lib/server/         env, Gemini client + locked session config, rate limiter
  lib/voice/          browser side
    audio-engine.ts   mic + playback worklets
    transport.ts      VoiceTransport interface (provider-neutral)
    gemini-live.ts    Gemini Live implementation
    call-controller.ts state machine, transcript, tools, latency, summary
  app/api/            session · tools · summary route handlers
  app/page.tsx        landing page
  app/call/           call screen
  components/         call UI (particle orb, transcript, summary) and landing stickers
public/worklets/      AudioWorklet processors
e2e/call-flow.mjs     browser test against a simulated Gemini Live server
```

## Run locally

```bash
cp .env.example .env.local      # add GEMINI_API_KEY
npm install
npm run dev                     # http://localhost:3000
```

```bash
npm test                        # unit tests: policy, tools, ID parsing, summaries
npm run typecheck
npm run build && npm start      # then, in another terminal:
npm run e2e                     # full call in real Chrome vs a simulated Gemini server
```

The e2e test drives the real page, real AudioWorklets (Chrome's fake microphone), real `/api/tools` and real `/api/summary`. Only the Gemini socket is stubbed, so it needs no key and is deterministic.

## Deploy (Vercel)

Import the repo in Vercel, add `GEMINI_API_KEY` in Project Settings → Environment Variables, and deploy. No other configuration is needed.

---

## Tell us how you think

### 1. Why this architecture and stack?

The thing an evaluator notices first on a voice agent is latency, then whether it says something wrong. I optimised for both.

- **Speech-to-speech instead of STT → LLM → TTS.** A modular pipeline makes three sequential network hops per turn and needs hand-built turn detection and barge-in. Gemini Live does recognition, reasoning and speech in one streaming model with server-side VAD and interruption built in, and it handles Hindi and Hinglish natively. The trade-off is less control over the voice. I accepted it and used the prompt to steer Indian English.
- **Browser connects directly to Gemini.** Relaying audio through my own server would add a hop and need a long-running WebSocket server, which Vercel functions aren't. Ephemeral tokens let the browser connect directly while the server still owns the prompt, tools and voice, because they're locked into the token.
- **Anything that must be trusted stays on the server.** Tools, policy and summaries run in Next.js route handlers. Those are stateless, so they scale horizontally on Vercel with no extra infrastructure.
- **Clear seams.** The agent "brain" (`lib/agent`) knows nothing about audio or Gemini. The transport is an interface. Moving to OpenAI Realtime, or to telephony, means changing an adapter rather than rewriting the agent.

### 2. What was hardest, and how did I solve it?

**Making a probabilistic model enforce deterministic policy.** Early on, the obvious approach is to paste the policy into the prompt. That works most of the time and fails on the cases evaluators test: "it's been 20 days but it's unopened", "it arrived damaged but I'm only telling you now", "₹499 exactly". So I moved every decision into a tested policy engine and changed the model's job from "interpret the policy" to "relay this verdict kindly". The prompt got shorter and the behaviour got more consistent.

A close second was **the real-time state and transcript**. Gemini sends input and output transcription as interleaved fragments. Barge-in cancels a turn halfway through, and tool calls arrive mid-turn. Keeping the transcript in the right order and the Listening / Thinking / Speaking indicator honest meant writing an explicit state machine with a few deliberate details: debouncing playback underruns so the indicator doesn't flicker, and closing transcript bubbles on `interrupted`. Because I couldn't exercise those edge cases reliably by talking into a mic, I wrote an e2e test that stands in for the Gemini server and replays a full call deterministically.

### 3. With one more week, what would I improve first?

**An evaluation harness with real audio.** Right now I can prove the logic is correct (unit and e2e tests), but not how well recognition handles Indian accents, background noise and spoken order IDs. I would record a set of English, Hindi and Hinglish clips, run them through the live pipeline, and track order-ID accuracy, policy-adherence rate (scored by an LLM judge against expected verdicts) and p50/p95 response latency. Every prompt or model change would then be a measured change instead of a guess. After that:

- customer verification (phone or OTP) before sharing order details
- session resumption for calls longer than 10 minutes
- a call-log dashboard backed by a database

### 4. At 1,000 conversations a day, what changes?

1,000 calls × ~3 min is ~50 hours of audio a day. Concurrency is modest (peaks of maybe 20–40 simultaneous calls), so the hard parts are **trust, observability and cost**, not raw scale.

- **Real systems behind the interfaces.** Replace `MockOrderRepository` with the OMS/Shopify API, with timeouts, caching and circuit breakers. Turn `cancel_order` and `escalate_to_human` into real writes, made idempotent per call ID.
- **Identity and privacy.** Verify the caller before revealing order details. Redact PII in stored transcripts. Retain data in line with India's DPDP Act.
- **Shared state.** Move the in-memory rate limiter to Redis, and persist calls, transcripts and outcomes in Postgres for QA and analytics.
- **Observability.** The routes already emit structured JSON logs. I'd ship those to a dashboard tracking containment rate, escalation rate, `POLICY_DECLINED` vs `UNRESOLVED`, tool error rate, and latency percentiles, with alerts on regressions.
- **Quality loop.** Use the structured outcomes to sample calls for human QA. Version prompts and A/B test them against the eval suite above.
- **Capacity and cost.** Check Gemini Live concurrent-session quotas and request increases. Track cost per resolved call. Use context-window compression (already on) and keep summaries on the cheapest model.
- **Channels.** Most Indian D2C support is phone and WhatsApp, so I'd add a telephony bridge (e.g. Exotel or Twilio SIP into the same agent core) and a warm hand-off to human agents with the summary attached.
