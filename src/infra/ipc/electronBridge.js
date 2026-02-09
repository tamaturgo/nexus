export const isElectron = () => typeof window !== "undefined" && !!window.electronAPI;

export const getWindowType = () => {
  if (!isElectron()) return null;
  return window.electronAPI?.getWindowType?.() || null;
};

export const resizeWindow = (width, height) => {
  return window.electronAPI?.resizeWindow?.(width, height);
};

export const openWindow = (type, payload) => {
  return window.electronAPI?.openWindow?.(type, payload);
};

export const updateContextWindow = (payload) => {
  return window.electronAPI?.updateContextWindow?.(payload);
};

export const closeCurrentWindow = () => {
  return window.electronAPI?.closeCurrentWindow?.();
};

export const minimizeCurrentWindow = () => {
  return window.electronAPI?.minimizeCurrentWindow?.();
};

export const getContextData = () => {
  return window.electronAPI?.getContextData?.();
};

export const onContextData = (callback) => {
  return window.electronAPI?.onContextData?.(callback);
};

export const askAI = (prompt) => {
  return window.electronAPI?.askAI?.(prompt);
};

export const saveMemory = (text, metadata) => {
  return window.electronAPI?.saveMemory?.(text, metadata);
};

export const saveTranscription = ({ text, metadata }) => {
  return window.electronAPI?.saveTranscription?.({ text, metadata });
};

export const transcribeAudio = ({ audioBuffer, options }) => {
  return window.electronAPI?.transcribeAudio?.({ audioBuffer, options });
};

export const startSystemCapture = (options) => {
  return window.electronAPI?.startSystemCapture?.(options);
};

export const stopSystemCapture = () => {
  return window.electronAPI?.stopSystemCapture?.();
};

export const getSystemCaptureDevices = () => {
  return window.electronAPI?.getSystemCaptureDevices?.();
};

export const getDesktopSources = (options) => {
  return window.electronAPI?.getDesktopSources?.(options);
};

export const getSettings = () => {
  return window.electronAPI?.getSettings?.();
};

export const saveSettings = (partial) => {
  return window.electronAPI?.saveSettings?.(partial);
};

export const resetSettings = () => {
  return window.electronAPI?.resetSettings?.();
};

export const clearAllMemory = () => {
  return window.electronAPI?.clearAllMemory?.();
};

export const listContextHistory = () => {
  return window.electronAPI?.listContextHistory?.();
};

export const getContextHistoryItem = (contextId) => {
  return window.electronAPI?.getContextHistoryItem?.(contextId);
};

export const saveContextHistory = (payload) => {
  return window.electronAPI?.saveContextHistory?.(payload);
};

export const toggleContextFavorite = (contextId) => {
  return window.electronAPI?.toggleContextFavorite?.(contextId);
};

export const deleteContextHistory = (contextId) => {
  return window.electronAPI?.deleteContextHistory?.(contextId);
};

export const onSystemTranscription = (callback) => {
  return window.electronAPI?.onSystemTranscription?.(callback);
};

export const onSystemTranscriptionStatus = (callback) => {
  return window.electronAPI?.onSystemTranscriptionStatus?.(callback);
};

export const onSystemCaptureStatus = (callback) => {
  return window.electronAPI?.onSystemCaptureStatus?.(callback);
};

export const onSystemCaptureError = (callback) => {
  return window.electronAPI?.onSystemCaptureError?.(callback);
};
