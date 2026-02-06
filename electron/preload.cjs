const { contextBridge, ipcRenderer } = require('electron');

const windowTypeArg = process.argv.find(arg => arg.startsWith('--window-type='));
const windowType = windowTypeArg ? windowTypeArg.split('=')[1] : null;

contextBridge.exposeInMainWorld('electronAPI', {
  startDrag: () => {
    ipcRenderer.invoke('start-window-drag');
  },
  resizeWindow: (width, height) => {
    ipcRenderer.invoke('resize-window', { width, height });
  },
  openWindow: (type, payload) => {
    ipcRenderer.invoke('open-window', { type, payload });
  },
  updateContextWindow: (payload) => {
    ipcRenderer.invoke('update-context-window', payload);
  },
  closeCurrentWindow: () => {
    ipcRenderer.invoke('close-current-window');
  },
  minimizeCurrentWindow: () => {
    ipcRenderer.invoke('minimize-current-window');
  },
  getContextData: () => {
    return ipcRenderer.invoke('get-context-data');
  },
  getWindowType: () => windowType,
  onContextData: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('context-data', handler);
    return () => ipcRenderer.removeListener('context-data', handler);
  },
  askAI: (prompt) => {
    return ipcRenderer.invoke('ask-ai', prompt);
  },
  saveMemory: (text, metadata) => {
    return ipcRenderer.invoke('save-memory', { text, metadata });
  },
  saveTranscription: ({ text, metadata }) => {
    return ipcRenderer.invoke('save-transcription', { text, metadata });
  },
  transcribeAudio: ({ audioBuffer, options }) => {
    return ipcRenderer.invoke('transcribe-audio', { audioBuffer, options });
  },
  getDesktopSources: (options) => {
    return ipcRenderer.invoke('get-desktop-sources', options);
  }
});
