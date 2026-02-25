export const CHANNELS = {
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
    TRANSCRIBE_AUDIO: "transcribe-audio",
    PROCESS_INSIGHT: "transcription-process-insight",
    RESET_INSIGHT_SESSION: "transcription-reset-insight-session",
    INSIGHT_EVENT: "transcription-insight"
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
  SETTINGS: {
    GET: "settings-get",
    SAVE: "settings-save",
    RESET: "settings-reset"
  },
  MEMORY: {
    CLEAR_ALL: "memory-clear-all"
  },
  NOTES: {
    LIST: "notes-list",
    GET: "notes-get",
    CREATE: "notes-create",
    UPDATE: "notes-update",
    DELETE: "notes-delete",
    PROCESS_QUICK_NOTE: "notes-process-quick-note"
  },
  CONTEXT_HISTORY: {
    LIST: "context-history-list",
    GET: "context-history-get",
    SAVE: "context-history-save",
    FAVORITE: "context-history-favorite",
    DELETE: "context-history-delete"
  },
  DESKTOP_CAPTURE: {
    GET_SOURCES: "get-desktop-sources"
  }
};
