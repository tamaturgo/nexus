import { computeRms, mergeChunks } from "./signal.js";

export class AudioChunker {
  constructor({ sampleRate, silenceThreshold, silenceMs, maxChunkMs, minChunkMs }) {
    this.sampleRate = sampleRate;
    this.silenceThreshold = silenceThreshold;
    this.silenceMs = silenceMs;
    this.maxChunkMs = maxChunkMs;
    this.minChunkMs = minChunkMs;

    this.buffers = [];
    this.totalSamples = 0;
    this.hasSound = false;
    this.lastSoundSample = 0;
  }

  push(float32Chunk) {
    if (!float32Chunk || float32Chunk.length === 0) return null;

    this.buffers.push(float32Chunk);
    this.totalSamples += float32Chunk.length;

    const rms = computeRms(float32Chunk);
    if (rms > this.silenceThreshold) {
      this.hasSound = true;
      this.lastSoundSample = this.totalSamples;
    }

    const durationMs = this.getDurationMs();
    if (this.maxChunkMs && durationMs >= this.maxChunkMs) {
      return this.flush({ force: true, reason: "max_chunk" });
    }

    if (this.hasSound && this.silenceMs) {
      const silenceMs = ((this.totalSamples - this.lastSoundSample) / this.sampleRate) * 1000;
      if (silenceMs >= this.silenceMs) {
        return this.flush({ reason: "silence" });
      }
    }

    return null;
  }

  flush({ force = false, reason = "manual" } = {}) {
    if (this.totalSamples === 0) return null;

    const durationMs = this.getDurationMs();
    const shouldDiscard = !this.hasSound || (!force && this.minChunkMs && durationMs < this.minChunkMs);

    const buffers = this.buffers;
    this.reset();

    if (shouldDiscard) {
      return null;
    }

    const merged = mergeChunks(buffers);

    return {
      samples: merged,
      durationMs,
      reason
    };
  }

  reset() {
    this.buffers = [];
    this.totalSamples = 0;
    this.hasSound = false;
    this.lastSoundSample = 0;
  }

  getDurationMs() {
    return (this.totalSamples / this.sampleRate) * 1000;
  }
}