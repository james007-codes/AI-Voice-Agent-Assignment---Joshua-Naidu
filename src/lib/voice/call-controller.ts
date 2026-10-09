/**
 * CallController: the client-side state machine for one voice call.
 *
 *   idle → connecting → (thinking ⇄ speaking ⇄ listening)* → ended
 *                    ↘ error
 *
 * It wires the AudioEngine (mic/speaker) to a VoiceTransport (Gemini Live),
 * runs tool calls through /api/tools, builds the transcript, measures
 * response latency and requests the post-call summary. React subscribes via
 * useSyncExternalStore; high-frequency audio levels live in a mutable object
 * the visualiser reads each animation frame, so they never trigger renders.
 */

import { CALL_CONNECTED_CUE } from "@/lib/agent/prompt";
import type { CallOutcome } from "@/lib/agent/summary";
import { AudioEngine, MicPermissionError } from "./audio-engine";
import { GeminiLiveTransport } from "./gemini-live";
import type { SessionCredentials, ToolCallRequest, ToolCallResponse, VoiceTransport } from "./transport";

export type CallPhase = "idle" | "connecting" | "listening" | "thinking" | "speaking" | "ended" | "error";

export interface TranscriptItem {
  id: string;
  role: "customer" | "agent";
  text: string;
  at: number;
  interrupted?: boolean;
}

export interface ToolEvent {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: Record<string, unknown>;
  status: "running" | "done" | "cancelled";
  at: number;
  durationMs?: number;
}

export interface CallSummary {
  outcome: CallOutcome;
  metadata: Record<string, unknown> & { summary_source: "llm" | "fallback"; duration_seconds: number };
}

export interface CallSnapshot {
  phase: CallPhase;
  /** Human label for what the agent is doing, e.g. "Looking up ORD-101". */
  activity: string | null;
  transcript: TranscriptItem[];
  tools: ToolEvent[];
  callId: string | null;
  startedAt: number | null;
  endedAt: number | null;
  maxCallSeconds: number | null;
  latencies: number[];
  muted: boolean;
  error: string | null;
  notice: string | null;
  endReason: string | null;
  summary: CallSummary | null;
  summaryStatus: "idle" | "loading" | "done" | "error";
}

export interface AudioLevels {
  input: number;
  output: number;
}

const INITIAL: CallSnapshot = {
  phase: "idle",
  activity: null,
  transcript: [],
  tools: [],
  callId: null,
  startedAt: null,
  endedAt: null,
  maxCallSeconds: null,
  latencies: [],
  muted: false,
  error: null,
  notice: null,
  endReason: null,
  summary: null,
  summaryStatus: "idle",
};

const TOOL_LABELS: Record<string, (args: Record<string, unknown>) => string> = {
  get_order_details: (a) => `Looking up ${a.order_id ?? "order"}`,
  check_return_eligibility: () => "Checking return policy",
  cancel_order: (a) => `Processing cancellation ${a.order_id ?? ""}`.trim(),
  escalate_to_human: () => "Raising a support ticket",
  end_call: () => "Wrapping up",
};

// Local voice-activity detection. It marks when the customer actually stopped
// speaking (for the latency meter) and drives the Thinking state only until
// Gemini's own VAD events arrive. Turn-taking itself is always server-side.
const VAD_MIN_THRESHOLD = 0.02;
const VAD_START_FRAMES = 3; // ~100 ms of speech
const VAD_HANGOVER_MS = 450;
const THINKING_WATCHDOG_MS = 4000;
const DRAIN_DEBOUNCE_MS = 300;

export class CallController {
  private snapshot: CallSnapshot = INITIAL;
  private listeners = new Set<() => void>();
  readonly levels: AudioLevels = { input: 0, output: 0 };

  private engine: AudioEngine | null = null;
  private transport: VoiceTransport | null = null;
  private live = false;
  private playing = false;

  // transcript assembly
  private openCustomerId: string | null = null;
  private openAgentId: string | null = null;

  // VAD / latency
  private noiseFloor = 0.01;
  private speechFrames = 0;
  private userSpeaking = false;
  private lastSpeechAt = 0;
  private userTurnEndedAt: number | null = null;
  private awaitingFirstAudio = false;
  /** Set once the server sends VAD events; local VAD then stops driving state. */
  private serverVad = false;

  // tools / hangup
  private cancelledToolIds = new Set<string>();
  private pendingHangup = false;
  private turnCompleteSinceHangup = false;

  private timers = new Map<string, ReturnType<typeof setTimeout>>();

  // ---- store plumbing -----------------------------------------------------

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.snapshot;
  getServerSnapshot = () => INITIAL;

  private set(patch: Partial<CallSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((l) => l());
  }

  private get active() {
    const p = this.snapshot.phase;
    return p === "connecting" || p === "listening" || p === "thinking" || p === "speaking";
  }

  private setPhase(phase: CallPhase, activity: string | null = null) {
    if (!this.active && phase !== "connecting") return;
    if (this.snapshot.phase === phase && this.snapshot.activity === activity) return;
    this.set({ phase, activity });
  }

  private timer(key: string, ms: number, fn: () => void) {
    this.clearTimer(key);
    this.timers.set(key, setTimeout(() => { this.timers.delete(key); fn(); }, ms));
  }

  private clearTimer(key: string) {
    const t = this.timers.get(key);
    if (t) clearTimeout(t);
    this.timers.delete(key);
  }

  // ---- lifecycle ----------------------------------------------------------

  /** Call directly from the click handler: audio must start inside a user gesture. */
  async start() {
    if (this.active) return;
    this.resetInternals();
    this.snapshot = { ...INITIAL };
    this.set({ phase: "connecting", activity: "Connecting" });

    const engine = new AudioEngine({
      onMicFrame: (pcm, rms) => this.onMicFrame(pcm, rms),
      onPlaybackStarted: () => this.onPlaybackStarted(),
      onPlaybackDrained: () => this.onPlaybackDrained(),
      onOutputLevel: (rms) => (this.levels.output = rms),
    });
    this.engine = engine;

    try {
      const enginePromise = engine.start(); // sync part runs inside the gesture
      const credsPromise = this.fetchSession();
      // Wake the serverless functions now so the first lookup isn't a cold start.
      for (const route of ["/api/tools", "/api/summary"]) void fetch(route).catch(() => {});
      const [creds] = await Promise.all([credsPromise, enginePromise]);
      if (this.snapshot.phase !== "connecting") return; // ended while connecting

      this.set({ callId: creds.callId, maxCallSeconds: creds.maxCallSeconds });
      const transport = new GeminiLiveTransport();
      this.transport = transport;
      await transport.connect(creds, {
        onOpen: () => {},
        onClose: (reason) => this.end("connection_lost", `The voice connection closed: ${reason}`),
        onError: (message) => this.set({ notice: message }),
        onAudio: (pcm) => this.onAudio(pcm),
        onInputTranscript: (t) => this.appendTranscript("customer", t),
        onUserActivity: (speaking) => this.onUserActivity(speaking),
        onOutputTranscript: (t) => this.appendTranscript("agent", t),
        onInterrupted: () => this.onInterrupted(),
        onTurnComplete: () => this.onTurnComplete(),
        onToolCalls: (calls) => void this.onToolCalls(calls),
        onToolCallsCancelled: (ids) => this.onToolCallsCancelled(ids),
        onGoAway: () => this.set({ notice: "The session is about to time out." }),
      });
      if (this.snapshot.phase !== "connecting") {
        transport.close();
        return;
      }

      this.live = true;
      this.set({ startedAt: Date.now() });
      this.awaitingFirstAudio = true;
      this.setPhase("thinking", "Aria is joining");
      transport.sendText(CALL_CONNECTED_CUE);
      this.timer("maxCall", creds.maxCallSeconds * 1000, () =>
        this.end("time_limit", `Demo calls are limited to ${Math.round(creds.maxCallSeconds / 60)} minutes.`),
      );
    } catch (err) {
      await this.teardown();
      const message =
        err instanceof MicPermissionError ? err.message : err instanceof Error ? err.message : "Couldn't start the call.";
      this.set({ phase: "error", activity: null, error: message });
    }
  }

  private async fetchSession(): Promise<SessionCredentials> {
    const res = await fetch("/api/session", { method: "POST" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.message ?? "Couldn't start the voice session.");
    return body as SessionCredentials;
  }

  async end(reason = "customer_hung_up", notice: string | null = null) {
    if (!this.active) return;
    const wasLive = this.live;
    this.closeOpenItems();
    this.set({
      phase: "ended",
      activity: null,
      endedAt: Date.now(),
      endReason: reason,
      notice: notice ?? this.snapshot.notice,
      summaryStatus: wasLive ? "loading" : "idle",
    });
    await this.teardown();
    if (wasLive) await this.requestSummary();
  }

  toggleMute() {
    const muted = !this.snapshot.muted;
    this.engine?.setMuted(muted);
    this.set({ muted });
  }

  reset() {
    if (this.active) return;
    this.snapshot = { ...INITIAL };
    this.listeners.forEach((l) => l());
  }

  dispose() {
    void this.teardown();
  }

  private async teardown() {
    this.live = false;
    this.timers.forEach((t) => clearTimeout(t));
    this.timers.clear();
    this.transport?.close();
    this.transport = null;
    const engine = this.engine;
    this.engine = null;
    this.levels.input = 0;
    this.levels.output = 0;
    await engine?.stop();
  }

  private resetInternals() {
    this.openCustomerId = null;
    this.openAgentId = null;
    this.noiseFloor = 0.01;
    this.speechFrames = 0;
    this.userSpeaking = false;
    this.userTurnEndedAt = null;
    this.awaitingFirstAudio = false;
    this.serverVad = false;
    this.playing = false;
    this.cancelledToolIds.clear();
    this.pendingHangup = false;
    this.turnCompleteSinceHangup = false;
  }

  // ---- microphone ---------------------------------------------------------

  private onMicFrame(pcm: string, rms: number) {
    this.levels.input = rms;
    if (!this.live) return;
    this.transport?.sendAudio(pcm);

    // Adaptive noise floor: fall fast, rise slowly.
    this.noiseFloor = rms < this.noiseFloor ? this.noiseFloor * 0.9 + rms * 0.1 : this.noiseFloor * 0.998 + rms * 0.002;
    const threshold = Math.max(VAD_MIN_THRESHOLD, this.noiseFloor * 2.5);
    const now = performance.now();

    if (rms > threshold) {
      this.speechFrames++;
      if (this.speechFrames >= VAD_START_FRAMES) {
        this.userSpeaking = true;
        this.lastSpeechAt = now;
      }
    } else {
      this.speechFrames = 0;
      if (this.userSpeaking && now - this.lastSpeechAt > VAD_HANGOVER_MS) {
        this.userSpeaking = false;
        if (this.snapshot.phase === "listening" || this.serverVad) {
          this.userTurnEndedAt = this.lastSpeechAt;
          this.awaitingFirstAudio = true;
        }
        if (!this.serverVad && this.snapshot.phase === "listening") this.enterThinking();
      }
    }
  }

  private enterThinking() {
    this.setPhase("thinking");
    // If that was just noise, the server never responds: drop back.
    this.timer("thinkingWatchdog", THINKING_WATCHDOG_MS, () => {
      if (this.snapshot.phase === "thinking" && !this.snapshot.activity) this.setPhase("listening");
    });
  }

  /** Gemini's VAD: the authoritative signal for when the customer's turn ends. */
  private onUserActivity(speaking: boolean) {
    this.serverVad = true;
    if (speaking) {
      this.cancelPendingHangup();
      this.clearTimer("thinkingWatchdog");
      if (this.snapshot.phase === "thinking" && !this.snapshot.activity) this.setPhase("listening");
      return;
    }
    if (this.snapshot.phase === "listening") {
      // Fall back to "now" if local VAD missed the speech (e.g. very quiet mic).
      this.userTurnEndedAt ??= performance.now();
      this.awaitingFirstAudio = true;
      this.enterThinking();
    }
  }

  // ---- agent audio --------------------------------------------------------

  private onAudio(pcm: string) {
    if (this.awaitingFirstAudio) {
      this.awaitingFirstAudio = false;
      if (this.userTurnEndedAt !== null) {
        const latency = Math.round(performance.now() - this.userTurnEndedAt);
        // Ignore implausible values (e.g. VAD fired on noise long before).
        if (latency > 0 && latency < 15000) this.set({ latencies: [...this.snapshot.latencies, latency] });
      }
      this.userTurnEndedAt = null;
    }
    this.clearTimer("thinkingWatchdog");
    this.engine?.play(pcm);
  }

  private onPlaybackStarted() {
    this.playing = true;
    this.clearTimer("drain");
    this.setPhase("speaking");
  }

  private onPlaybackDrained() {
    this.playing = false;
    // Network jitter can briefly starve the buffer mid-sentence; debounce so
    // the indicator doesn't flicker between Speaking and Listening.
    this.timer("drain", DRAIN_DEBOUNCE_MS, () => {
      if (this.playing) return;
      if (this.pendingHangup && this.turnCompleteSinceHangup) {
        void this.end("agent_ended_call");
        return;
      }
      if (this.snapshot.phase === "speaking") this.setPhase("listening");
    });
  }

  private onInterrupted() {
    // Barge-in: customer started talking over Aria.
    this.cancelPendingHangup();
    this.engine?.flush();
    this.playing = false;
    if (this.openAgentId) this.patchItem(this.openAgentId, { interrupted: true });
    this.closeOpenItems();
    this.awaitingFirstAudio = false;
    this.setPhase("listening");
  }

  private onTurnComplete() {
    this.closeOpenItems();
    if (this.pendingHangup) {
      this.turnCompleteSinceHangup = true;
      if (!this.playing) this.timer("drain", DRAIN_DEBOUNCE_MS, () => void this.end("agent_ended_call"));
      return;
    }
    const toolsRunning = this.snapshot.tools.some((t) => t.status === "running");
    if (!this.playing && !toolsRunning) this.setPhase("listening");
  }

  // ---- transcript ---------------------------------------------------------

  private appendTranscript(role: "customer" | "agent", delta: string) {
    if (!delta) return;
    const key = role === "customer" ? "openCustomerId" : "openAgentId";
    let id = this[key];
    if (!id) {
      id = crypto.randomUUID();
      this[key] = id;
      this.set({ transcript: [...this.snapshot.transcript, { id, role, text: delta, at: Date.now() }] });
      return;
    }
    const targetId = id;
    this.set({
      transcript: this.snapshot.transcript.map((t) => (t.id === targetId ? { ...t, text: t.text + delta } : t)),
    });
  }

  private patchItem(id: string, patch: Partial<TranscriptItem>) {
    this.set({ transcript: this.snapshot.transcript.map((t) => (t.id === id ? { ...t, ...patch } : t)) });
  }

  private closeOpenItems() {
    this.openCustomerId = null;
    this.openAgentId = null;
  }

  // ---- tools --------------------------------------------------------------

  private async onToolCalls(calls: ToolCallRequest[]) {
    this.clearTimer("thinkingWatchdog");
    const first = calls[0];
    this.setPhase(this.playing ? "speaking" : "thinking", TOOL_LABELS[first.name]?.(first.args) ?? "Working on it");

    this.set({
      tools: [
        ...this.snapshot.tools,
        ...calls.map((c) => ({ id: c.id, name: c.name, args: c.args, status: "running" as const, at: Date.now() })),
      ],
    });

    const responses = await Promise.all(calls.map((c) => this.runTool(c)));
    if (!this.live) return;

    const toSend = responses.filter((r): r is ToolCallResponse => r !== null);
    if (toSend.length) {
      this.awaitingFirstAudio = true;
      this.transport?.sendToolResponses(toSend);
    }
    if (calls.some((c) => c.name === "end_call")) {
      this.pendingHangup = true;
      this.turnCompleteSinceHangup = false;
      // Safety net in case the model never sends turnComplete.
      this.timer("hangupFallback", 8000, () => void this.end("agent_ended_call"));
    }
    if (this.snapshot.phase === "thinking") this.set({ activity: null });
  }

  /**
   * The model can misjudge "all right…" as a goodbye. If the customer keeps
   * talking after end_call, stay on the line: code has the final say.
   */
  private cancelPendingHangup() {
    if (!this.pendingHangup) return;
    this.pendingHangup = false;
    this.turnCompleteSinceHangup = false;
    this.clearTimer("hangupFallback");
    this.clearTimer("drain");
  }

  private async runTool(call: ToolCallRequest): Promise<ToolCallResponse | null> {
    let result: Record<string, unknown>;
    let durationMs: number | undefined;
    try {
      const res = await fetch("/api/tools", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ callId: this.snapshot.callId, name: call.name, args: call.args }),
      });
      const body = await res.json();
      result = body.result ?? { status: "ERROR" };
      durationMs = body.durationMs;
    } catch {
      result = {
        status: "ERROR",
        guidance: "The lookup system is unavailable. Apologise and offer to raise a ticket.",
      };
    }

    if (this.cancelledToolIds.has(call.id)) return null;
    this.set({
      tools: this.snapshot.tools.map((t) => (t.id === call.id ? { ...t, result, status: "done", durationMs } : t)),
    });
    return { id: call.id, name: call.name, response: result };
  }

  private onToolCallsCancelled(ids: string[]) {
    ids.forEach((id) => this.cancelledToolIds.add(id));
    this.set({ tools: this.snapshot.tools.map((t) => (ids.includes(t.id) ? { ...t, status: "cancelled" } : t)) });
  }

  // ---- summary ------------------------------------------------------------

  async requestSummary() {
    const s = this.snapshot;
    if (!s.callId || !s.startedAt) return;
    this.set({ summaryStatus: "loading" });
    try {
      const res = await fetch("/api/summary", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          callId: s.callId,
          startedAt: s.startedAt,
          endedAt: s.endedAt ?? Date.now(),
          transcript: s.transcript
            .filter((t) => t.text.trim())
            .map((t) => ({ role: t.role, text: t.text.trim(), at: t.at })),
          toolLog: s.tools
            .filter((t) => t.status === "done" && t.result)
            .map((t) => ({ name: t.name, args: t.args, result: t.result, at: t.at })),
        }),
      });
      if (!res.ok) throw new Error(`Summary failed (${res.status})`);
      this.set({ summary: (await res.json()) as CallSummary, summaryStatus: "done" });
    } catch {
      this.set({ summaryStatus: "error" });
    }
  }
}
