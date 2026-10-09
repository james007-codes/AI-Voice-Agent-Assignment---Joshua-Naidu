/**
 * Provider-neutral realtime voice transport.
 *
 * The call controller (useVoiceCall) only talks to this interface. Gemini Live
 * is the implementation today; an OpenAI Realtime or a custom STT→LLM→TTS
 * pipeline could implement the same surface without touching the UI.
 */

export interface ToolCallRequest {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface ToolCallResponse {
  id: string;
  name: string;
  response: Record<string, unknown>;
}

export interface TransportEvents {
  onOpen: () => void;
  onClose: (reason: string) => void;
  onError: (message: string) => void;
  /** Base64 Int16 PCM at 24 kHz. */
  onAudio: (base64Pcm: string) => void;
  onInputTranscript: (textDelta: string) => void;
  onOutputTranscript: (textDelta: string) => void;
  /** Customer barged in; queued agent audio must be dropped. */
  onInterrupted: () => void;
  onTurnComplete: () => void;
  onToolCalls: (calls: ToolCallRequest[]) => void;
  onToolCallsCancelled: (ids: string[]) => void;
  /** Server will close soon; seconds remaining if known. */
  onGoAway: (secondsLeft: number | null) => void;
}

export interface SessionCredentials {
  token: string;
  model: string;
  apiVersion: string;
  callId: string;
  maxCallSeconds: number;
}

export interface VoiceTransport {
  connect(creds: SessionCredentials, events: TransportEvents): Promise<void>;
  sendAudio(base64Pcm: string): void;
  /** Text turn from the "user" side, e.g. the call-connected greeting cue. */
  sendText(text: string): void;
  sendToolResponses(responses: ToolCallResponse[]): void;
  close(): void;
}
