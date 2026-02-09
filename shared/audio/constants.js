export const TARGET_SAMPLE_RATE = 16000;
export const DEFAULT_LANGUAGE = "pt";

export const MIC_CHUNK_OPTIONS = {
  silenceThreshold: 0.02,
  silenceMs: 1500,
  maxChunkMs: 30000,
  minChunkMs: 1200
};

export const SYSTEM_CHUNK_OPTIONS = {
  silenceThreshold: 0.003,
  silenceMs: 1500,
  maxChunkMs: 20000,
  minChunkMs: 2000
};