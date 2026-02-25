const { contextBridge, ipcRenderer } = require("electron");
let CHANNELS;

try {
  const channelsPath = `${__dirname}/../shared/ipc/channels.cjs`;
  ({ CHANNELS } = require(channelsPath));
} catch (error) {
  console.error("preload: failed to load shared channels, using fallback", error);
  CHANNELS = {
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
}

const windowTypeArg = process.argv.find(arg => arg.startsWith("--window-type="));
const windowType = windowTypeArg ? windowTypeArg.split("=")[1] : null;

contextBridge.exposeInMainWorld("electronAPI", {
  startDrag: () => {
    ipcRenderer.invoke(CHANNELS.WINDOW.START_DRAG);
  },
  resizeWindow: (width, height) => {
    ipcRenderer.invoke(CHANNELS.WINDOW.RESIZE, { width, height });
  },
  openWindow: (type, payload) => {
    ipcRenderer.invoke(CHANNELS.WINDOW.OPEN, { type, payload });
  },
  updateContextWindow: (payload) => {
    ipcRenderer.invoke(CHANNELS.WINDOW.UPDATE_CONTEXT, payload);
  },
  closeCurrentWindow: () => {
    ipcRenderer.invoke(CHANNELS.WINDOW.CLOSE_CURRENT);
  },
  minimizeCurrentWindow: () => {
    ipcRenderer.invoke(CHANNELS.WINDOW.MINIMIZE_CURRENT);
  },
  getContextData: () => {
    return ipcRenderer.invoke(CHANNELS.WINDOW.GET_CONTEXT_DATA);
  },
  getWindowType: () => windowType,
  onContextData: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on(CHANNELS.CONTEXT.DATA_EVENT, handler);
    return () => ipcRenderer.removeListener(CHANNELS.CONTEXT.DATA_EVENT, handler);
  },
  askAI: (prompt) => {
    return ipcRenderer.invoke(CHANNELS.ASSISTANT.ASK_AI, prompt);
  },
  saveMemory: (text, metadata) => {
    return ipcRenderer.invoke(CHANNELS.ASSISTANT.SAVE_MEMORY, { text, metadata });
  },
  saveTranscription: ({ text, metadata }) => {
    return ipcRenderer.invoke(CHANNELS.ASSISTANT.SAVE_TRANSCRIPTION, { text, metadata });
  },
  transcribeAudio: ({ audioBuffer, options }) => {
    return ipcRenderer.invoke(CHANNELS.TRANSCRIPTION.TRANSCRIBE_AUDIO, { audioBuffer, options });
  },
  processTranscriptionInsight: (payload) => {
    return ipcRenderer.invoke(CHANNELS.TRANSCRIPTION.PROCESS_INSIGHT, payload);
  },
  resetTranscriptionInsightSession: ({ source }) => {
    return ipcRenderer.invoke(CHANNELS.TRANSCRIPTION.RESET_INSIGHT_SESSION, { source });
  },
  onTranscriptionInsight: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on(CHANNELS.TRANSCRIPTION.INSIGHT_EVENT, handler);
    return () => ipcRenderer.removeListener(CHANNELS.TRANSCRIPTION.INSIGHT_EVENT, handler);
  },
  startSystemCapture: (options) => {
    return ipcRenderer.invoke(CHANNELS.SYSTEM_CAPTURE.START, options);
  },
  stopSystemCapture: () => {
    return ipcRenderer.invoke(CHANNELS.SYSTEM_CAPTURE.STOP);
  },
  getSystemCaptureDevices: () => {
    return ipcRenderer.invoke(CHANNELS.SYSTEM_CAPTURE.DEVICES);
  },
  getDesktopSources: (options) => {
    return ipcRenderer.invoke(CHANNELS.DESKTOP_CAPTURE.GET_SOURCES, options);
  },
  getSettings: () => {
    return ipcRenderer.invoke(CHANNELS.SETTINGS.GET);
  },
  saveSettings: (partial) => {
    return ipcRenderer.invoke(CHANNELS.SETTINGS.SAVE, partial);
  },
  resetSettings: () => {
    return ipcRenderer.invoke(CHANNELS.SETTINGS.RESET);
  },
  clearAllMemory: () => {
    return ipcRenderer.invoke(CHANNELS.MEMORY.CLEAR_ALL);
  },
  listNotes: () => {
    return ipcRenderer.invoke(CHANNELS.NOTES.LIST);
  },
  getNote: (noteId) => {
    return ipcRenderer.invoke(CHANNELS.NOTES.GET, { noteId });
  },
  createNote: (payload) => {
    return ipcRenderer.invoke(CHANNELS.NOTES.CREATE, payload);
  },
  updateNote: (noteId, patch) => {
    return ipcRenderer.invoke(CHANNELS.NOTES.UPDATE, { noteId, patch });
  },
  deleteNote: (noteId) => {
    return ipcRenderer.invoke(CHANNELS.NOTES.DELETE, { noteId });
  },
  processQuickNote: (payload) => {
    return ipcRenderer.invoke(CHANNELS.NOTES.PROCESS_QUICK_NOTE, payload);
  },
  listContextHistory: () => {
    return ipcRenderer.invoke(CHANNELS.CONTEXT_HISTORY.LIST);
  },
  getContextHistoryItem: (contextId) => {
    return ipcRenderer.invoke(CHANNELS.CONTEXT_HISTORY.GET, { contextId });
  },
  saveContextHistory: (payload) => {
    return ipcRenderer.invoke(CHANNELS.CONTEXT_HISTORY.SAVE, payload);
  },
  toggleContextFavorite: (contextId) => {
    return ipcRenderer.invoke(CHANNELS.CONTEXT_HISTORY.FAVORITE, { contextId });
  },
  deleteContextHistory: (contextId) => {
    return ipcRenderer.invoke(CHANNELS.CONTEXT_HISTORY.DELETE, { contextId });
  },
  onSystemTranscription: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on(CHANNELS.SYSTEM_CAPTURE.TRANSCRIPTION_EVENT, handler);
    return () => ipcRenderer.removeListener(CHANNELS.SYSTEM_CAPTURE.TRANSCRIPTION_EVENT, handler);
  },
  onSystemTranscriptionStatus: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on(CHANNELS.SYSTEM_CAPTURE.PROCESSING_EVENT, handler);
    return () => ipcRenderer.removeListener(CHANNELS.SYSTEM_CAPTURE.PROCESSING_EVENT, handler);
  },
  onSystemCaptureStatus: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on(CHANNELS.SYSTEM_CAPTURE.STATUS_EVENT, handler);
    return () => ipcRenderer.removeListener(CHANNELS.SYSTEM_CAPTURE.STATUS_EVENT, handler);
  },
  onSystemCaptureError: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on(CHANNELS.SYSTEM_CAPTURE.ERROR_EVENT, handler);
    return () => ipcRenderer.removeListener(CHANNELS.SYSTEM_CAPTURE.ERROR_EVENT, handler);
  }
});
