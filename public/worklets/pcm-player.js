/**
 * Streaming PCM player worklet.
 * Receives Float32 chunks (already at the context rate, 24 kHz) and plays
 * them back-to-back. "clear" drops everything instantly, which is what makes
 * barge-in feel immediate: the agent stops mid-word when the customer talks.
 *
 * Emits: "started" when audio begins after silence, "drained" when the
 * queue runs dry, and a ~30 Hz RMS level for the visualiser.
 */
class PcmPlayerProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.queue = [];
    this.current = null;
    this.offset = 0;
    this.playing = false;
    this.levelAcc = 0;
    this.levelFrames = 0;

    this.port.onmessage = (e) => {
      const msg = e.data;
      if (msg.type === "push") {
        this.queue.push(msg.samples);
      } else if (msg.type === "clear") {
        this.queue = [];
        this.current = null;
        this.offset = 0;
        if (this.playing) {
          this.playing = false;
          this.port.postMessage({ type: "drained", cleared: true });
        }
      }
    };
  }

  process(_inputs, outputs) {
    const out = outputs[0][0];
    let written = 0;
    let sumSquares = 0;

    while (written < out.length) {
      if (!this.current || this.offset >= this.current.length) {
        this.current = this.queue.shift() || null;
        this.offset = 0;
        if (!this.current) break;
      }
      const n = Math.min(out.length - written, this.current.length - this.offset);
      for (let i = 0; i < n; i++) {
        const s = this.current[this.offset + i];
        out[written + i] = s;
        sumSquares += s * s;
      }
      written += n;
      this.offset += n;
    }
    for (let i = written; i < out.length; i++) out[i] = 0;

    if (written > 0 && !this.playing) {
      this.playing = true;
      this.port.postMessage({ type: "started" });
    } else if (written === 0 && this.playing) {
      this.playing = false;
      this.port.postMessage({ type: "drained", cleared: false });
    }

    this.levelAcc += sumSquares / out.length;
    if (++this.levelFrames >= 6) {
      this.port.postMessage({ type: "level", rms: Math.sqrt(this.levelAcc / this.levelFrames) });
      this.levelAcc = 0;
      this.levelFrames = 0;
    }
    return true;
  }
}

registerProcessor("pcm-player", PcmPlayerProcessor);
