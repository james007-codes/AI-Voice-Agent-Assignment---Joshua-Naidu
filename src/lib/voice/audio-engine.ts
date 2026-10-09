/**
 * Browser audio I/O: microphone capture (16 kHz PCM out) and streaming
 * playback (24 kHz PCM in). Knows nothing about the AI provider.
 */

export const INPUT_SAMPLE_RATE = 16000;
export const OUTPUT_SAMPLE_RATE = 24000;

export interface AudioEngineEvents {
  /** 32 ms of 16 kHz Int16 PCM, base64-encoded, plus its RMS level. */
  onMicFrame: (base64Pcm: string, rms: number) => void;
  onPlaybackStarted: () => void;
  onPlaybackDrained: (cleared: boolean) => void;
  onOutputLevel: (rms: number) => void;
}

export class MicPermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MicPermissionError";
  }
}

export class AudioEngine {
  private stream: MediaStream | null = null;
  private captureCtx: AudioContext | null = null;
  private playbackCtx: AudioContext | null = null;
  private player: AudioWorkletNode | null = null;
  private muted = false;

  constructor(private readonly events: AudioEngineEvents) {}

  /** Must be called from a user gesture (Start Call) so autoplay is allowed. */
  async start(): Promise<void> {
    // Create both contexts synchronously inside the gesture before any await,
    // otherwise Safari may leave them suspended.
    this.captureCtx = new AudioContext();
    this.playbackCtx = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          // Echo cancellation is what lets the agent talk through speakers
          // without hearing (and interrupting) itself.
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (err) {
      await this.stop();
      const name = (err as DOMException)?.name;
      throw new MicPermissionError(
        name === "NotAllowedError"
          ? "Microphone access was blocked. Allow it in your browser's site settings and try again."
          : name === "NotFoundError"
            ? "No microphone was found. Plug one in and try again."
            : "Couldn't access the microphone.",
      );
    }

    await Promise.all([
      this.captureCtx.audioWorklet.addModule("/worklets/pcm-capture.js"),
      this.playbackCtx.audioWorklet.addModule("/worklets/pcm-player.js"),
    ]);
    await Promise.all([this.captureCtx.resume(), this.playbackCtx.resume()]);

    // Capture graph: mic -> capture worklet (no output to speakers)
    const source = this.captureCtx.createMediaStreamSource(this.stream);
    const capture = new AudioWorkletNode(this.captureCtx, "pcm-capture", { numberOfOutputs: 0 });
    capture.port.onmessage = (e: MessageEvent<{ type: "frame"; pcm: ArrayBuffer; rms: number }>) => {
      if (this.muted) return;
      this.events.onMicFrame(arrayBufferToBase64(e.data.pcm), e.data.rms);
    };
    source.connect(capture);

    // Playback graph: player worklet -> speakers
    this.player = new AudioWorkletNode(this.playbackCtx, "pcm-player", { outputChannelCount: [1] });
    this.player.port.onmessage = (e: MessageEvent<{ type: string; rms?: number; cleared?: boolean }>) => {
      const msg = e.data;
      if (msg.type === "started") this.events.onPlaybackStarted();
      else if (msg.type === "drained") this.events.onPlaybackDrained(Boolean(msg.cleared));
      else if (msg.type === "level") this.events.onOutputLevel(msg.rms ?? 0);
    };
    this.player.connect(this.playbackCtx.destination);
  }

  /** Queue base64 Int16 PCM (24 kHz) for playback. */
  play(base64Pcm: string) {
    if (!this.player) return;
    const samples = int16Base64ToFloat32(base64Pcm);
    this.player.port.postMessage({ type: "push", samples }, [samples.buffer]);
  }

  /** Drop all queued agent audio immediately (barge-in). */
  flush() {
    this.player?.port.postMessage({ type: "clear" });
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    this.stream?.getAudioTracks().forEach((t) => (t.enabled = !muted));
  }

  async stop() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.player?.disconnect();
    this.player = null;
    await Promise.allSettled([this.captureCtx?.close(), this.playbackCtx?.close()]);
    this.captureCtx = null;
    this.playbackCtx = null;
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function int16Base64ToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const int16 = new Int16Array(bytes.buffer, 0, bytes.length >> 1);
  const out = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) out[i] = int16[i] / 0x8000;
  return out;
}
