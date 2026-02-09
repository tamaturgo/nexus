module.exports = {
  CHANNELS: {
    WINDOW: {
      START_DRAG: "start-window-drag",
      RESIZE: "resize-window",
      OPEN: "open-window",
      UPDATE_CONTEXT: "update-context-window",
      CLOSE_CURRENT: "close-current-window",
      MINIMIZE_CURRENT: "minimize-current-window",
      GET_CONTEXT_DATA: "get-context-data"
    },
    CONTEXT: {
      DATA_EVENT: "context-data"
    },
    ASSISTANT: {
      ASK_AI: "ask-ai",
      SAVE_MEMORY: "save-memory",
      SAVE_TRANSCRIPTION: "save-transcription"
    },
    TRANSCRIPTION: {
      TRANSCRIBE_AUDIO: "transcribe-audio"
    },
    SYSTEM_CAPTURE: {
      START: "system-capture-start",
      STOP: "system-capture-stop",
      DEVICES: "system-capture-devices",
      STATUS_EVENT: "system-capture-status",
      ERROR_EVENT: "system-capture-error",
      TRANSCRIPTION_EVENT: "system-transcription",
      PROCESSING_EVENT: "system-transcription-status"
    },
    DESKTOP_CAPTURE: {
      GET_SOURCES: "get-desktop-sources"
    }
  }
};
