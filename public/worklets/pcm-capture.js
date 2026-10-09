/**
 * Mic capture worklet.
 * Input: Float32 mono at the AudioContext's native rate (usually 48 kHz).
 * Output: Int16 PCM at 16 kHz in 512-sample frames (32 ms), the format and
 * chunk size the Gemini Live API recommends, plus an RMS level per frame.
 *
 * Downsampling averages every input sample that falls inside one output
 * period (a box filter), which doubles as a cheap anti-aliasing low-pass.
 * Done in the worklet so the main thread never touches raw audio.
 */
const TARGET_RATE = 16000;
const FRAME_SIZE = 512;

class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / TARGET_RATE;
    this.acc = 0; // running sum for the current output sample
    this.accCount = 0;
    this.pos = 0; // fractional progress through the current output period
    this.frame = new Int16Array(FRAME_SIZE);
    this.frameIndex = 0;
    this.sumSquares = 0;
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (!channel) return true;

    for (let i = 0; i < channel.length; i++) {
      this.acc += channel[i];
      this.accCount++;
      this.pos += 1;
      if (this.pos >= this.ratio) {
        this.pos -= this.ratio;
        const sample = Math.max(-1, Math.min(1, this.acc / this.accCount));
        this.acc = 0;
        this.accCount = 0;
        this.sumSquares += sample * sample;
        this.frame[this.frameIndex++] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
        if (this.frameIndex === FRAME_SIZE) this.flush();
      }
    }
    return true;
  }

  flush() {
    const rms = Math.sqrt(this.sumSquares / FRAME_SIZE);
    const out = this.frame;
    this.port.postMessage({ type: "frame", pcm: out.buffer, rms }, [out.buffer]);
    this.frame = new Int16Array(FRAME_SIZE);
    this.frameIndex = 0;
    this.sumSquares = 0;
  }
}

registerProcessor("pcm-capture", PcmCaptureProcessor);
