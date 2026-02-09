import { useState, useRef, useEffect, useCallback } from "react";
import { askAi } from "../../app/ai/askAi.js";
import { useMicTranscription } from "./useMicTranscription.js";
import { useSystemTranscription } from "./useSystemTranscription.js";
import { DEFAULT_SETTINGS } from "../../../shared/settings/defaults.js";
import { createId } from "../../app/context/uuid.js";
import { saveHistoryItem } from "../../app/context/contextHistory.js";
import {
  openWindow,
  resizeWindow,
  getSettings,
  saveSettings,
  resetSettings,
  clearAllMemory
} from "../../infra/ipc/electronBridge.js";

export const useAssistant = ({ windowType = "single", isElectron = false } = {}) => {
  const [inputValue, setInputValue] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [interactionCount, setInteractionCount] = useState(0);
  const [screenStatus, setScreenStatus] = useState(false);
  const [viewMode, setViewMode] = useState("collapsed");
  const [mockData, setMockData] = useState({ query: "", answer: "", sections: [], citations: [], voiceContext: null });
  const [lastVoiceCapture, setLastVoiceCapture] = useState(null);
  const [liveVoiceContext, setLiveVoiceContext] = useState(null);
  const [historyRefreshToken, setHistoryRefreshToken] = useState(0);
  const inputRef = useRef(null);
  const historyIdsRef = useRef({});
  const [searchContentHeight, setSearchContentHeight] = useState(0);

  const [settingsState, setSettingsState] = useState({ ...DEFAULT_SETTINGS });
  const [activePlugins, setActivePlugins] = useState([
    { id: "gcal", name: "Google Calendar", active: true },
    { id: "slack", name: "Slack Connect", active: false },
    { id: "notion", name: "Notion", active: true }
  ]);

  const {
    isListening: micActive,
    transcription: micTranscription,
    fullTranscription: micFullTranscription,
    isProcessing: micProcessing,
    error: micError,
    permissionDenied,
    chunksProcessed: micChunks,
    startListening: startMic,
    stopListening: stopMic
  } = useMicTranscription({
    autoSaveTranscription: settingsState.memory?.autoSaveTranscription,
    audioSettings: settingsState.audio
  });

  const {
    isCapturing: systemActive,
    isProcessing: systemProcessing,
    error: systemError,
    transcription: systemTranscription,
    fullTranscription: systemFullTranscription,
    chunksProcessed: systemChunks,
    lastEvent: systemLastEvent,
    startCapture: startSystemCapture,
    stopCapture: stopSystemCapture
  } = useSystemTranscription({
    audioSettings: settingsState.audio
  });

  const updateLiveVoiceContext = useCallback((source, text, chunks, timestamp) => {
    const voiceCtx = {
      timestamp: timestamp || Date.now(),
      text,
      chunksProcessed: chunks,
      source,
      isLive: true
    };

    if (isElectron) {
      const key = `transcription-${source}`;
      const contextId = historyIdsRef.current[key] || createId();
      historyIdsRef.current[key] = contextId;

      const payload = {
        query: source === "system" ? "Captura do Sistema" : "Captura do Microfone",
        answer: text,
        sections: [],
        citations: [],
        voiceContext: voiceCtx,
        contextKey: key,
        contextId
      };

      openWindow("context", payload);
      saveHistoryItem?.({
        contextId,
        contextKey: key,
        payload: {
          ...payload,
          voiceContext: {
            ...voiceCtx,
            isLive: false
          }
        }
      }).then(() => setHistoryRefreshToken(prev => prev + 1));
      return;
    }
    setLiveVoiceContext(voiceCtx);
    setViewMode("context");
  }, [isElectron]);

  useEffect(() => {
    if (!isElectron || windowType !== "search") return;

    const COLLAPSED_HEIGHT = 180;
    const EXPANDED_HEIGHT = 600;

    if (viewMode === "collapsed") {
      resizeWindow(600, COLLAPSED_HEIGHT);
    } else {
      resizeWindow(600, EXPANDED_HEIGHT);
    }
  }, [viewMode, windowType, isElectron]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    if (!inputRef.current) return;
    if (viewMode !== "collapsed") return;
    if (windowType !== "search") return;
    if (!document.hasFocus()) return;
    inputRef.current.focus({ preventScroll: true });
  }, [micActive, systemActive, micProcessing, systemProcessing, isProcessing, windowType, viewMode]);

  useEffect(() => {
    if (!isElectron || !getSettings) return;
    let mounted = true;

    getSettings().then((data) => {
      if (!mounted || !data) return;
      setSettingsState({ ...DEFAULT_SETTINGS, ...data });
    });

    return () => {
      mounted = false;
    };
  }, [isElectron]);

  useEffect(() => {
    if (!micFullTranscription) return;
    updateLiveVoiceContext("mic", micFullTranscription, micChunks, Date.now());
  }, [micFullTranscription, micChunks, updateLiveVoiceContext]);

  useEffect(() => {
    if (!systemFullTranscription) return;
    const timestamp = systemLastEvent?.timestamp || Date.now();
    updateLiveVoiceContext("system", systemFullTranscription, systemChunks, timestamp);
  }, [systemFullTranscription, systemChunks, systemLastEvent, updateLiveVoiceContext]);

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === "Escape") {
      if (viewMode !== "collapsed") {
        setViewMode("collapsed");
      }
    }
  };

  const handleSubmit = async () => {
    if (!inputValue.trim() || isProcessing) return;

    const queryText = inputValue;
    const voiceCtx = lastVoiceCapture;

    setIsProcessing(true);
    setInteractionCount(prev => prev + 1);

    try {
      const response = await askAi(queryText, {
        model: settingsState.ai?.model,
        temperature: settingsState.ai?.temperature
      });

      const contextId = createId();
      const payload = {
        query: queryText,
        answer: response.answer || response,
        sections: response.sections || [],
        citations: response.citations || [],
        voiceContext: voiceCtx,
        contextKey: "ask",
        contextId
      };

      setMockData(payload);

      if (isElectron) {
        openWindow("context", payload);
        saveHistoryItem?.({
          contextId,
          contextKey: "ask",
          payload: {
            ...payload,
            voiceContext: voiceCtx ? { ...voiceCtx, isLive: false } : null
          }
        }).then(() => setHistoryRefreshToken(prev => prev + 1));
        setViewMode("collapsed");
      } else {
        setViewMode("context");
      }

      setLastVoiceCapture(null);
    } catch (error) {
      console.error("Failed to get AI response:", error);
    } finally {
      setIsProcessing(false);
      setInputValue("");
    }
  };

  const copyToClipboard = async () => {
    if (inputValue) {
      await navigator.clipboard.writeText(inputValue);
    }
  };

  const clearInput = () => {
    setInputValue("");
    inputRef.current?.focus();
    setViewMode("collapsed");
  };

  const showSettings = () => {
    if (isElectron) {
      openWindow("settings");
      setViewMode("collapsed");
      return;
    }

    setViewMode(prev => prev === "settings" ? "collapsed" : "settings");
  };

  const showHistory = () => {
    if (isElectron) {
      openWindow("history");
      setViewMode("collapsed");
      return;
    }
    setViewMode(prev => prev === "history" ? "collapsed" : "history");
  };

  const toggleScreenVision = () => {
    setScreenStatus(prev => !prev);
  };

  const toggleMicrophone = async () => {
    if (micActive || systemActive) {
      if (settingsState.audio?.inputDevice !== "system") {
        await stopMic();
      }
      if (settingsState.audio?.inputDevice !== "mic") {
        await stopSystemCapture();
      }
      return;
    }

    if (settingsState.audio?.inputDevice !== "system") {
      await startMic();
    }
    if (settingsState.audio?.inputDevice !== "mic") {
      await startSystemCapture();
    }
  };

  const togglePlugin = (id) => {
    setActivePlugins(prev => prev.map(p => p.id === id ? { ...p, active: !p.active } : p));
  };

  const updateSettings = async (partial) => {
    const next = {
      ...settingsState,
      ...partial,
      audio: { ...settingsState.audio, ...(partial?.audio || {}) },
      ai: { ...settingsState.ai, ...(partial?.ai || {}) },
      memory: { ...settingsState.memory, ...(partial?.memory || {}) }
    };
    setSettingsState(next);
    if (isElectron) {
      await saveSettings?.(next);
    }
  };

  const resetSettingsState = async () => {
    if (isElectron) {
      const data = await resetSettings?.();
      if (data) {
        setSettingsState({ ...DEFAULT_SETTINGS, ...data });
        return;
      }
    }
    setSettingsState({ ...DEFAULT_SETTINGS });
  };

  const clearMemory = async () => {
    if (isElectron) {
      await clearAllMemory?.();
      setSettingsState({ ...DEFAULT_SETTINGS });
    }
  };

  const openHistoryItem = (payload) => {
    if (!payload) return;
    if (isElectron) {
      const contextId = payload.contextId || createId();
      openWindow("context", {
        ...payload,
        contextId,
        contextKey: contextId
      });
      return;
    }
    setMockData(payload);
    setViewMode("context");
  };

  const combinedTranscription = micTranscription || systemTranscription;
  const combinedProcessing = micProcessing || systemProcessing;
  const combinedChunks = micChunks + systemChunks;
  const combinedError = micError || systemError;
  const listeningActive = micActive || systemActive;

  return {
    inputValue,
    isProcessing,
    interactionCount,
    inputRef,
    micStatus: listeningActive,
    screenStatus,
    liveVoiceContext,
    viewMode,
    mockData,
    transcription: combinedTranscription,
    isTranscribing: combinedProcessing,
    voiceError: combinedError,
    permissionDenied,
    chunksProcessed: combinedChunks,
    settings: {
      ...settingsState,
      activePlugins,
      cpuLoad: 34
    },

    handleInputChange,
    handleKeyDown,
    handleSubmit,
    copyToClipboard,
    clearInput,
    showSettings,
    showHistory,
    toggleScreenVision,
    toggleMicrophone,

    updateSettings,
    resetSettingsState,
    clearMemory,
    togglePlugin,
    historyRefreshToken,
    openHistoryItem,
    setSearchContentHeight,
    searchContentHeight
  };
};
