import { useState, useRef, useEffect, useCallback } from "react";
import { askAi } from "../../app/ai/askAi.js";
import { useMicTranscription } from "./useMicTranscription.js";
import { DEFAULT_SETTINGS } from "../../../shared/settings/defaults.js";
import { createId } from "../../app/context/uuid.js";
import { saveHistoryItem } from "../../app/context/contextHistory.js";
import { processQuickNoteItem } from "../../app/notes/notes.js";
import {
  openWindow,
  getSettings,
  saveSettings,
  resetSettings,
  clearAllMemory
} from "../../infra/ipc/electronBridge.js";

const QUICK_NOTE = "quick-note";
const SEARCH = "search";

const normalizeText = (value) => String(value || "").trim();

export const useAssistant = ({ windowType = "single", isElectron = false } = {}) => {
  const [inputValue, setInputValue] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [interactionCount, setInteractionCount] = useState(0);
  const [viewMode, setViewMode] = useState("collapsed");
  const [mockData, setMockData] = useState({
    query: "",
    answer: "",
    sections: [],
    citations: [],
    voiceContext: null
  });
  const [inputMode, setInputMode] = useState(QUICK_NOTE);
  const [quickNoteFeedback, setQuickNoteFeedback] = useState({ type: "idle", message: "" });
  const inputRef = useRef(null);
  const [settingsState, setSettingsState] = useState({ ...DEFAULT_SETTINGS });

  const {
    isListening: micActive,
    isProcessing: micProcessing,
    error: micError,
    permissionDenied,
    chunksProcessed: micChunks,
    startListening: startMic,
    stopListening: stopMic
  } = useMicTranscription({
    autoSaveTranscription: settingsState.memory?.autoSaveTranscription,
    audioSettings: settingsState.audio,
    enableInsights: false
  });

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

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
    if (!quickNoteFeedback?.message) return;
    const timer = setTimeout(() => {
      setQuickNoteFeedback({ type: "idle", message: "" });
    }, 2500);
    return () => clearTimeout(timer);
  }, [quickNoteFeedback]);

  const runSearch = useCallback(async (queryText, source = "text") => {
    const response = await askAi(queryText, {
      provider: settingsState.ai?.provider,
      model: settingsState.ai?.model,
      temperature: settingsState.ai?.temperature
    });

    const contextId = createId();
    const payload = {
      query: queryText,
      answer: response.answer || response,
      sections: response.sections || [],
      citations: response.citations || [],
      voiceContext: source === "audio"
        ? {
          source: "mic",
          text: queryText,
          timestamp: Date.now(),
          chunksProcessed: micChunks,
          isLive: false
        }
        : null,
      contextKey: "ask",
      contextId
    };

    setMockData(payload);

    if (isElectron) {
      openWindow("context", payload);
      saveHistoryItem?.({
        contextId,
        contextKey: "ask",
        payload
      });
      setViewMode("collapsed");
      return;
    }

    setViewMode("context");
  }, [isElectron, micChunks, settingsState.ai?.model, settingsState.ai?.provider, settingsState.ai?.temperature]);

  const runQuickNote = useCallback(async (text, source = "text") => {
    const result = await processQuickNoteItem({
      text,
      source
    });

    if (result?.ok) {
      setQuickNoteFeedback({
        type: "success",
        message: result.message
          || (result.queued
            ? "Entrada enviada para fila."
            : (result.operation === "updated" ? "Nota atualizada." : "Nota criada."))
      });
      return result;
    }

    const fallbackMessage = result?.message || "Nao foi possivel salvar a nota.";
    setQuickNoteFeedback({
      type: "error",
      message: fallbackMessage
    });
    return result;
  }, []);

  const processInput = useCallback(async (rawText, source = "text", modeOverride = null) => {
    const text = normalizeText(rawText);
    if (!text) return;

    const activeMode = modeOverride || inputMode;
    if (activeMode === SEARCH) {
      if (isSearching) return;
      setIsSearching(true);
      setInteractionCount((previous) => previous + 1);
      try {
        await runSearch(text, source);
      } catch (error) {
        console.error("Failed to process search input:", error);
      } finally {
        setIsSearching(false);
        setInputValue("");
      }
      return;
    }

    setInteractionCount((previous) => previous + 1);
    if (source === "text") {
      setInputValue("");
    }

    try {
      await runQuickNote(text, source);
    } catch (error) {
      console.error("Failed to enqueue quick note:", error);
      setQuickNoteFeedback({
        type: "error",
        message: "Falha ao enfileirar quick note."
      });
    }
  }, [inputMode, isSearching, runQuickNote, runSearch]);

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      processInput(inputValue, "text");
    }
    if (e.key === "Escape" && viewMode !== "collapsed") {
      setViewMode("collapsed");
    }
  };

  const handleSubmit = async () => {
    await processInput(inputValue, "text");
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
    setViewMode((previous) => (previous === "settings" ? "collapsed" : "settings"));
  };

  const showNotes = () => {
    if (isElectron) {
      openWindow("notes");
      setViewMode("collapsed");
      return;
    }
    setViewMode((previous) => (previous === "notes" ? "collapsed" : "notes"));
  };

  const toggleMicrophone = useCallback(async () => {
    if (micActive) {
      const transcript = normalizeText(await stopMic());
      if (!transcript) return;
      await processInput(transcript, "audio", inputMode);
      return;
    }

    if (isSearching) return;
    await startMic();
  }, [inputMode, isSearching, micActive, processInput, startMic, stopMic]);

  const toggleInputMode = () => {
    setInputMode((previous) => (previous === QUICK_NOTE ? SEARCH : QUICK_NOTE));
  };

  const selectInputMode = (mode) => {
    if (mode !== QUICK_NOTE && mode !== SEARCH) return;
    setInputMode(mode);
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
    if (!isElectron) {
      const message = "Limpeza de memoria disponivel apenas no app Electron.";
      console.warn("[Memory] clearAll skipped:", message);
      return { ok: false, message };
    }

    try {
      const result = await clearAllMemory?.();
      const ok = !!(result && (result.ok === true || result.cleared === true));

      if (ok) {
        setSettingsState({ ...DEFAULT_SETTINGS });
      }

      return {
        ok,
        cleared: ok,
        details: result?.details || null,
        message: ok
          ? "Memoria limpa com sucesso."
          : (result?.message || "A limpeza nao foi concluida por completo.")
      };
    } catch (error) {
      console.error("[Memory] clearAll failed:", error);
      return {
        ok: false,
        cleared: false,
        message: error?.message || "Erro inesperado ao limpar memoria."
      };
    }
  };

  return {
    inputValue,
    isProcessing: isSearching,
    interactionCount,
    inputRef,
    micStatus: micActive,
    isTranscribing: micProcessing,
    voiceError: micError,
    permissionDenied,
    chunksProcessed: micChunks,
    settings: settingsState,
    viewMode,
    mockData,
    inputMode,
    quickNoteFeedback,

    handleInputChange,
    handleKeyDown,
    handleSubmit,
    copyToClipboard,
    clearInput,
    showSettings,
    showNotes,
    toggleMicrophone,
    toggleInputMode,
    selectInputMode,

    updateSettings,
    resetSettingsState,
    clearMemory
  };
};
