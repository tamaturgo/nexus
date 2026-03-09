import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

const DEFAULT_SETTINGS = {
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

const isTauriRuntime = () => typeof window !== "undefined" && !!window.__TAURI_INTERNALS__;
const isElectronRuntime = () => typeof window !== "undefined" && !!window.electronAPI;

const tauriInvoke = async (command, payload = {}, fallback = undefined) => {
  if (!isTauriRuntime()) return fallback;
  try {
    return await invoke(command, payload);
  } catch (error) {
    console.warn(`tauri invoke failed: ${command}`, error);
    return fallback;
  }
};

export const isElectron = () => isElectronRuntime() || isTauriRuntime();

export const getWindowType = () => {
  if (isElectronRuntime()) {
    return window.electronAPI?.getWindowType?.() || null;
  }

  if (isTauriRuntime()) {
    const label = window.__TAURI_INTERNALS__?.metadata?.currentWindow?.label || null;
    if (!label) return null;
    if (label.startsWith("context-")) return "context";
    if (label === "context" || label === "settings" || label === "history" || label === "search") {
      return label;
    }
    return "search";
  }

  return null;
};

export const resizeWindow = (width, height) => {
  if (isElectronRuntime()) {
    return window.electronAPI?.resizeWindow?.(width, height);
  }
  return tauriInvoke("resize_window", { width, height });
};

export const openWindow = (type, payload) => {
  if (isElectronRuntime()) {
    return window.electronAPI?.openWindow?.(type, payload);
  }
  return tauriInvoke("open_window", { windowType: type, payload: payload ?? null });
};

export const updateContextWindow = (payload) => {
  if (isElectronRuntime()) {
    return window.electronAPI?.updateContextWindow?.(payload);
  }
  return tauriInvoke("update_context_window", { payload: payload ?? null });
};

export const closeCurrentWindow = () => {
  if (isElectronRuntime()) {
    return window.electronAPI?.closeCurrentWindow?.();
  }
  return tauriInvoke("close_current_window");
};

export const minimizeCurrentWindow = () => {
  if (isElectronRuntime()) {
    return window.electronAPI?.minimizeCurrentWindow?.();
  }
  return tauriInvoke("minimize_current_window");
};

export const getContextData = () => {
  if (isElectronRuntime()) {
    return window.electronAPI?.getContextData?.();
  }
  return tauriInvoke("get_context_data", {}, null);
};

export const startWindowDrag = async () => {
  if (isElectronRuntime()) {
    return window.electronAPI?.startDrag?.();
  }
  if (!isTauriRuntime()) return;
  try {
    await getCurrentWindow().startDragging();
  } catch (error) {
    console.warn("startWindowDrag failed", error);
  }
};

export const onContextData = (callback) => {
  if (isElectronRuntime()) {
    return window.electronAPI?.onContextData?.(callback);
  }

  if (!isTauriRuntime()) return undefined;

  const unlistenPromise = listen("context-data", (event) => {
    callback(event.payload);
  });

  return () => {
    unlistenPromise.then((unlisten) => unlisten()).catch(() => {});
  };
};

export const askAI = (prompt) => {
  if (isElectronRuntime()) {
    return window.electronAPI?.askAI?.(prompt);
  }
  return Promise.reject(new Error("askAI ainda nao migrado para Tauri."));
};

export const saveMemory = (text, metadata) => {
  if (isElectronRuntime()) {
    return window.electronAPI?.saveMemory?.(text, metadata);
  }
  return Promise.resolve(false);
};

export const saveTranscription = ({ text, metadata }) => {
  if (isElectronRuntime()) {
    return window.electronAPI?.saveTranscription?.({ text, metadata });
  }
  return Promise.resolve(false);
};

export const transcribeAudio = ({ audioBuffer, options }) => {
  if (isElectronRuntime()) {
    return window.electronAPI?.transcribeAudio?.({ audioBuffer, options });
  }
  return Promise.reject(new Error("transcribeAudio ainda nao migrado para Tauri."));
};

export const startSystemCapture = (options) => {
  if (isElectronRuntime()) {
    return window.electronAPI?.startSystemCapture?.(options);
  }
  return Promise.resolve({ started: false, reason: "not_migrated" });
};

export const stopSystemCapture = () => {
  if (isElectronRuntime()) {
    return window.electronAPI?.stopSystemCapture?.();
  }
  return Promise.resolve({ stopped: false, reason: "not_migrated" });
};

export const getSystemCaptureDevices = () => {
  if (isElectronRuntime()) {
    return window.electronAPI?.getSystemCaptureDevices?.();
  }
  return Promise.resolve([]);
};

export const getDesktopSources = (options) => {
  if (isElectronRuntime()) {
    return window.electronAPI?.getDesktopSources?.(options);
  }
  return Promise.resolve([]);
};

export const getSettings = () => {
  if (isElectronRuntime()) {
    return window.electronAPI?.getSettings?.();
  }
  return Promise.resolve({ ...DEFAULT_SETTINGS });
};

export const saveSettings = (partial) => {
  if (isElectronRuntime()) {
    return window.electronAPI?.saveSettings?.(partial);
  }
  return Promise.resolve({ ...DEFAULT_SETTINGS, ...(partial || {}) });
};

export const resetSettings = () => {
  if (isElectronRuntime()) {
    return window.electronAPI?.resetSettings?.();
  }
  return Promise.resolve({ ...DEFAULT_SETTINGS });
};

export const clearAllMemory = () => {
  if (isElectronRuntime()) {
    return window.electronAPI?.clearAllMemory?.();
  }
  return Promise.resolve({ cleared: false, reason: "not_migrated" });
};

export const listContextHistory = () => {
  if (isElectronRuntime()) {
    return window.electronAPI?.listContextHistory?.();
  }
  return Promise.resolve([]);
};

export const getContextHistoryItem = (contextId) => {
  if (isElectronRuntime()) {
    return window.electronAPI?.getContextHistoryItem?.(contextId);
  }
  return Promise.resolve(null);
};

export const saveContextHistory = (payload) => {
  if (isElectronRuntime()) {
    return window.electronAPI?.saveContextHistory?.(payload);
  }
  return Promise.resolve(null);
};

export const toggleContextFavorite = (contextId) => {
  if (isElectronRuntime()) {
    return window.electronAPI?.toggleContextFavorite?.(contextId);
  }
  return Promise.resolve(null);
};

export const deleteContextHistory = (contextId) => {
  if (isElectronRuntime()) {
    return window.electronAPI?.deleteContextHistory?.(contextId);
  }
  return Promise.resolve(false);
};

export const onSystemTranscription = (callback) => {
  if (isElectronRuntime()) {
    return window.electronAPI?.onSystemTranscription?.(callback);
  }
  return undefined;
};

export const onSystemTranscriptionStatus = (callback) => {
  if (isElectronRuntime()) {
    return window.electronAPI?.onSystemTranscriptionStatus?.(callback);
  }
  return undefined;
};

export const onSystemCaptureStatus = (callback) => {
  if (isElectronRuntime()) {
    return window.electronAPI?.onSystemCaptureStatus?.(callback);
  }
  return undefined;
};

export const onSystemCaptureError = (callback) => {
  if (isElectronRuntime()) {
    return window.electronAPI?.onSystemCaptureError?.(callback);
  }
  return undefined;
};
