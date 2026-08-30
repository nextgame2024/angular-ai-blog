class SophiaPcm16Processor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const processorOptions = options.processorOptions || {};
    this.targetSampleRate = processorOptions.targetSampleRate || 16000;
    this.frame = new Int16Array(processorOptions.frameSamples || 3000);
    this.frameIndex = 0;
    this.rateAccumulator = 0;
    this.sampleAccumulator = 0;
    this.sampleCount = 0;
  }

  process(inputs) {
    const inputChannel = inputs[0] && inputs[0][0];
    if (!inputChannel) return true;

    for (let index = 0; index < inputChannel.length; index += 1) {
      this.sampleAccumulator += inputChannel[index];
      this.sampleCount += 1;
      this.rateAccumulator += this.targetSampleRate;

      if (this.rateAccumulator < sampleRate) continue;

      const sample = this.sampleAccumulator / this.sampleCount;
      const clamped = Math.max(-1, Math.min(1, sample));
      this.frame[this.frameIndex] = Math.round(
        clamped < 0 ? clamped * 32768 : clamped * 32767,
      );
      this.frameIndex += 1;
      this.rateAccumulator -= sampleRate;
      this.sampleAccumulator = 0;
      this.sampleCount = 0;

      if (this.frameIndex === this.frame.length) {
        const completedFrame = this.frame;
        const frameLength = completedFrame.length;
        this.port.postMessage(completedFrame.buffer, [completedFrame.buffer]);
        this.frame = new Int16Array(frameLength);
        this.frameIndex = 0;
      }
    }

    return true;
  }
}

registerProcessor('sophia-pcm16-processor', SophiaPcm16Processor);
