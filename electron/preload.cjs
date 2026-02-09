const { contextBridge, ipcRenderer } = require("electron");
let CHANNELS;

try {
  ({ CHANNELS } = require("../shared/ipc/channels.cjs"));
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
