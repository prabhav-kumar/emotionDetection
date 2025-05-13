class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 4096;
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
    this.sampleRate = 48000; // Match the sample rate in DeepgramService.js
  }

  process(inputs) {
    const input = inputs[0];
    if (input && input.length > 0) {
      const float32 = input[0];
      for (let i = 0; i < float32.length; i++) {
        this.buffer[this.bufferIndex++] = float32[i];
        
        if (this.bufferIndex >= this.bufferSize) {
          // Convert to Int16 format as required by Deepgram
          const int16 = new Int16Array(this.bufferSize);
          for (let j = 0; j < this.bufferSize; j++) {
            // Ensure values are clamped between -1 and 1
            const s = Math.max(-1, Math.min(1, this.buffer[j]));
            // Convert to 16-bit PCM
            int16[j] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }
          // Transfer the buffer to the main thread
          this.port.postMessage(int16.buffer, [int16.buffer]);
          this.bufferIndex = 0;
        }
      }
    }
    return true;
  }
}

registerProcessor('audio-processor', AudioProcessor);