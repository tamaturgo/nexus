import { useState, useRef, useEffect, useCallback } from "react";
import { askAi } from "../../app/ai/askAi.js";
import { useMicTranscription } from "./useMicTranscription.js";
import { useSystemTranscription } from "./useSystemTranscription.js";
import { openWindow, resizeWindow } from "../../infra/ipc/electronBridge.js";

export const useAssistant = ({ windowType = "single", isElectron = false } = {}) => {
  const [inputValue, setInputValue] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [interactionCount, setInteractionCount] = useState(0);
  const [screenStatus, setScreenStatus] = useState(false);
  const [viewMode, setViewMode] = useState("collapsed");
  const [mockData, setMockData] = useState({ query: "", answer: "", sections: [], citations: [], voiceContext: null });
  const [lastVoiceCapture, setLastVoiceCapture] = useState(null);
  const [liveVoiceContext, setLiveVoiceContext] = useState(null);
  const inputRef = useRef(null);

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
  } = useMicTranscription();

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
  } = useSystemTranscription();

  const [selectedProvider, setSelectedProvider] = useState("gemini");
  const [activePlugins, setActivePlugins] = useState([
    { id: "gcal", name: "Google Calendar", active: true },
    { id: "slack", name: "Slack Connect", active: false },
    { id: "notion", name: "Notion", active: true }
  ]);

  const updateLiveVoiceContext = useCallback((source, text, chunks, timestamp) => {
    const voiceCtx = {
      timestamp: timestamp || Date.now(),
      text,
      chunksProcessed: chunks,
      source,
      isLive: true
    };

    if (isElectron) {
      const payload = {
        query: source === "system" ? "Captura do Sistema" : "Captura do Microfone",
        answer: text,
        sections: [],
        citations: [],
        voiceContext: voiceCtx,
        contextKey: `transcription-${source}`
      };

      openWindow("context", payload);
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
      const response = await askAi(queryText);

      setMockData({
        query: queryText,
        answer: response.answer || response,
        sections: response.sections || [],
        citations: response.citations || [],
        voiceContext: voiceCtx
      });

      if (isElectron) {
        openWindow("context", {
          query: queryText,
          answer: response.answer || response,
          sections: response.sections || [],
          citations: response.citations || [],
          voiceContext: voiceCtx,
          contextKey: "ask"
        });
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

  const searchWeb = () => {
    console.log("Searching web for:", inputValue);
  };

  const showSettings = () => {
    if (isElectron) {
      openWindow("settings");
      setViewMode("collapsed");
      return;
    }

    setViewMode(prev => prev === "settings" ? "collapsed" : "settings");
  };

  const quickAction = () => {
    console.log("Quick action");
  };

  const toggleScreenVision = () => {
    setScreenStatus(prev => !prev);
  };

  const toggleMicrophone = async () => {
    if (micActive || systemActive) {
      await stopSystemCapture();
      await stopMic();
      return;
    }

    await startSystemCapture();
    await startMic();
  };

  const togglePlugin = (id) => {
    setActivePlugins(prev => prev.map(p => p.id === id ? { ...p, active: !p.active } : p));
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
      selectedProvider,
      activePlugins,
      cpuLoad: 34
    },

    handleInputChange,
    handleKeyDown,
    handleSubmit,
    copyToClipboard,
    clearInput,
    searchWeb,
    showSettings,
    quickAction,
    toggleScreenVision,
    toggleMicrophone,

    setSelectedProvider,
    togglePlugin
  };
};
