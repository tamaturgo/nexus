export const DEFAULT_SETTINGS = {
  audio: {
    inputDevice: "mic",
    silenceThreshold: 0.01,
    silenceMs: 700
  },
  ai: {
    provider: "openrouter",
    model: "arcee-ai/trinity-large-preview:free",
    temperature: 0.7
  },
  memory: {
    autoSaveTranscription: true,
    maxItems: 500,
    retentionDays: 30,
    shortTermTurns: 10,
    semanticContextItems: 8
  }
};
