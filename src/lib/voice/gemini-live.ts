/**
 * Gemini Live implementation of VoiceTransport.
 *
 * The browser connects straight to Gemini over WebSocket using the ephemeral
 * token from /api/session. Model, prompt, tools and voice are locked into that
 * token, so the config sent here is only what the token already allows.
 */

import type { LiveServerMessage, Session } from "@google/genai";
import type {
  SessionCredentials,
  ToolCallResponse,
  TransportEvents,
  VoiceTransport,
} from "./transport";

export class GeminiLiveTransport implements VoiceTransport {
  private session: Session | null = null;
  private events: TransportEvents | null = null;
  private closedByClient = false;

  async connect(creds: SessionCredentials, events: TransportEvents): Promise<void> {
    this.events = events;
    // Loaded on demand so the landing page doesn't ship the SDK.
    const { GoogleGenAI, Modality } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey: creds.token, httpOptions: { apiVersion: creds.apiVersion } });

    this.session = await ai.live.connect({
      model: creds.model,
      config: { responseModalities: [Modality.AUDIO] },
      callbacks: {
        onopen: () => events.onOpen(),
        onmessage: (msg) => this.handleMessage(msg),
        onerror: (e) => events.onError(e.message || "Voice connection error"),
        onclose: (e) => {
          if (!this.closedByClient) events.onClose(e.reason || `Connection closed (${e.code})`);
        },
      },
    });
  }

  private handleMessage(msg: LiveServerMessage) {
    const ev = this.events;
    if (!ev) return;

    const content = msg.serverContent;
    if (content) {
      // Interruption first: any audio in the same message belongs to a turn
      // that's already been cancelled.
      if (content.interrupted) ev.onInterrupted();

      for (const part of content.modelTurn?.parts ?? []) {
        const data = part.inlineData?.data;
        if (data && part.inlineData?.mimeType?.startsWith("audio/")) ev.onAudio(data);
      }
      if (content.inputTranscription?.text) ev.onInputTranscript(content.inputTranscription.text);
      if (content.outputTranscription?.text) ev.onOutputTranscript(content.outputTranscription.text);
      if (content.turnComplete) ev.onTurnComplete();
    }

    // The SDK only normalises this field for Vertex; on the Gemini API path the
    // raw shape comes through, so accept either key.
    const activity = msg.voiceActivity as { voiceActivityType?: string; type?: string } | undefined;
    const activityType = activity?.voiceActivityType ?? activity?.type;
    if (activityType === "ACTIVITY_START") ev.onUserActivity(true);
    else if (activityType === "ACTIVITY_END") ev.onUserActivity(false);

    if (msg.toolCall?.functionCalls?.length) {
      ev.onToolCalls(
        msg.toolCall.functionCalls.map((fc) => ({
          id: fc.id ?? crypto.randomUUID(),
          name: fc.name ?? "unknown",
          args: (fc.args as Record<string, unknown>) ?? {},
        })),
      );
    }

    if (msg.toolCallCancellation?.ids?.length) ev.onToolCallsCancelled(msg.toolCallCancellation.ids);

    if (msg.goAway) {
      const secs = parseFloat(String(msg.goAway.timeLeft ?? "").replace("s", ""));
      ev.onGoAway(Number.isFinite(secs) ? secs : null);
    }
  }

  sendAudio(base64Pcm: string) {
    this.session?.sendRealtimeInput({ audio: { data: base64Pcm, mimeType: "audio/pcm;rate=16000" } });
  }

  sendText(text: string) {
    this.session?.sendRealtimeInput({ text });
  }

  sendToolResponses(responses: ToolCallResponse[]) {
    this.session?.sendToolResponse({ functionResponses: responses });
  }

  close() {
    this.closedByClient = true;
    try {
      this.session?.close();
    } catch {
      // already closed
    }
    this.session = null;
  }
}
