export const DEFAULT_SETTINGS = {
  audio: {
    inputDevice: "both",
    systemCaptureMode: "loopback",
    silenceThreshold: 0.01,
    silenceMs: 700
  },
  ai: {
    provider: "gemini",
    model: "gemini-2.5-flash",
    temperature: 0.7
  },
  memory: {
    autoSaveTranscription: true,
    maxItems: 500,
    retentionDays: 30
  }
};
