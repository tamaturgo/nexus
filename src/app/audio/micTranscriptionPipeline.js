import { AudioChunker } from "../../../shared/audio/chunker.js";
import { downsampleFloat32 } from "../../../shared/audio/signal.js";
import { encodeWav } from "../../../shared/audio/wav.js";
import { DEFAULT_LANGUAGE, MIC_CHUNK_OPTIONS, TARGET_SAMPLE_RATE } from "../../../shared/audio/constants.js";

export const createMicTranscriptionPipeline = ({
  sampleRate,
  transcribe,
  onTranscription,
  onError,
  onProcessingChange,
  language = DEFAULT_LANGUAGE,
  silenceThreshold,
  silenceMs
}) => {
  const chunker = new AudioChunker({
    sampleRate,
    silenceThreshold: typeof silenceThreshold === "number"
      ? silenceThreshold
      : MIC_CHUNK_OPTIONS.silenceThreshold,
    silenceMs: typeof silenceMs === "number"
      ? silenceMs
      : MIC_CHUNK_OPTIONS.silenceMs,
    maxChunkMs: MIC_CHUNK_OPTIONS.maxChunkMs,
    minChunkMs: MIC_CHUNK_OPTIONS.minChunkMs
  });

  let processing = false;
  const queue = [];
  let chunkIndex = 0;
  let idleWaiters = [];

  const resolveIdleWaiters = () => {
    if (processing || queue.length > 0) return;
    if (!idleWaiters.length) return;
    const waiters = idleWaiters;
    idleWaiters = [];
    waiters.forEach((resolve) => resolve());
  };

  const emitProcessing = () => {
    if (onProcessingChange) {
      onProcessingChange(processing || queue.length > 0);
    }
    resolveIdleWaiters();
  };

  const processQueue = async () => {
    if (processing) return;
    processing = true;
    emitProcessing();

    while (queue.length) {
      const item = queue.shift();
      try {
        const downsampled = downsampleFloat32(item.samples, sampleRate, TARGET_SAMPLE_RATE);
        const wavBytes = encodeWav(downsampled, TARGET_SAMPLE_RATE, 1);
        const result = await transcribe(wavBytes, { language });

        if (result?.text && result.text.trim().length > 0) {
          onTranscription?.({
            ...result,
            chunkIndex: item.chunkIndex,
            timestamp: item.timestamp,
            durationMs: item.durationMs,
            reason: item.reason
          });
        }
      } catch (error) {
        onError?.(error);
      }
    }

    processing = false;
    emitProcessing();
  };

  const enqueueChunk = (chunk) => {
    queue.push({
      ...chunk,
      chunkIndex: chunkIndex += 1,
      timestamp: Date.now()
    });

    processQueue();
  };

  return {
    handlePcmChunk(pcmChunk) {
      const ready = chunker.push(pcmChunk);
      if (ready) {
        enqueueChunk(ready);
      }
    },
    flush({ force = false, reason = "stop" } = {}) {
      const ready = chunker.flush({ force, reason });
      if (ready) {
        enqueueChunk(ready);
      }
    },
    waitForIdle(timeoutMs = 2500) {
      if (!processing && queue.length === 0) {
        return Promise.resolve();
      }

      return new Promise((resolve) => {
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          resolve();
        };
        idleWaiters.push(finish);
        if (typeof timeoutMs === "number" && timeoutMs > 0) {
          setTimeout(finish, timeoutMs);
        }
      });
    }
  };
};
