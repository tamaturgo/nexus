import { useCallback, useEffect, useRef, useState } from "react";
import { WebAudioRecorder } from "../../infra/audio/webAudioRecorder.js";
import { createMicTranscriptionPipeline } from "../../app/audio/micTranscriptionPipeline.js";
import { DEFAULT_LANGUAGE } from "../../../shared/audio/constants.js";
import { sanitizeTranscriptionText } from "../../../shared/audio/transcription.js";
import {
  isElectron,
  saveTranscription,
  transcribeAudio,
  processTranscriptionInsight,
  resetTranscriptionInsightSession,
  onTranscriptionInsight
} from "../../infra/ipc/electronBridge.js";

const normalizeComment = (value) => String(value || "").replace(/\s+/g, " ").trim();
const mergeComments = (previous = [], incoming = [], limit = 14) => {
  const seen = new Set();
  const merged = [];
  for (const entry of [...previous, ...incoming]) {
    const value = normalizeComment(entry);
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(value);
  }
  return merged.slice(-limit);
};

export const useMicTranscription = ({
  autoSaveTranscription = true,
  audioSettings,
  enableInsights = false
} = {}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcription, setTranscription] = useState("");
  const [fullTranscription, setFullTranscription] = useState("");
  const [latestInsight, setLatestInsight] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [chunksProcessed, setChunksProcessed] = useState(0);

  const recorderRef = useRef(null);
  const pipelineRef = useRef(null);
  const isListeningRef = useRef(false);
  const fullTranscriptionRef = useRef("");

  const appendTranscription = useCallback((chunkText) => {
    if (!chunkText) return;
    setTranscription(chunkText);
    setFullTranscription((previous) => {
      const next = previous ? `${previous}\n${chunkText}` : chunkText;
      fullTranscriptionRef.current = next;
      return next;
    });
  }, []);

  const handleTranscription = useCallback(async (payload) => {
    const cleanedText = sanitizeTranscriptionText(payload?.text || "");
    if (!cleanedText) return;

    setChunksProcessed((previous) => previous + 1);
    appendTranscription(cleanedText);

    if (enableInsights && isElectron() && processTranscriptionInsight) {
      try {
        await processTranscriptionInsight({
          source: "mic",
          text: cleanedText,
          chunkIndex: payload.chunkIndex,
          timestamp: payload.timestamp,
          durationMs: payload.durationMs || payload.duration || 5
        });
      } catch (insightError) {
        console.error("Erro ao processar insight de microfone:", insightError);
      }
    }

    if (isElectron() && autoSaveTranscription) {
      await saveTranscription({
        text: cleanedText,
        metadata: {
          type: "voice_transcription",
          source: "mic",
          chunkIndex: payload.chunkIndex,
          timestamp: payload.timestamp,
          duration: payload.duration || 5,
          confidence: payload.confidence || 0.9
        }
      });
    }
  }, [appendTranscription, autoSaveTranscription, enableInsights]);

  const startListening = useCallback(async () => {
    if (isListeningRef.current) return;

    try {
      setError(null);
      setPermissionDenied(false);
      setTranscription("");
      setFullTranscription("");
      setLatestInsight(null);
      setChunksProcessed(0);
      fullTranscriptionRef.current = "";

      if (!isElectron()) {
        setError("Transcricao disponivel apenas no app Electron.");
        return;
      }

      const recorder = new WebAudioRecorder({
        sampleRate: 16000,
        onPcm: (chunk) => {
          pipelineRef.current?.handlePcmChunk(chunk);
        }
      });
      recorderRef.current = recorder;

      if (enableInsights) {
        await resetTranscriptionInsightSession?.("mic");
      }

      await recorder.start();
      const sampleRate = recorder.getSampleRate();

      pipelineRef.current = createMicTranscriptionPipeline({
        sampleRate,
        language: DEFAULT_LANGUAGE,
        silenceThreshold: audioSettings?.silenceThreshold,
        silenceMs: audioSettings?.silenceMs,
        transcribe: async (audioBuffer, options) => {
          return await transcribeAudio({ audioBuffer, options });
        },
        onTranscription: handleTranscription,
        onError: (err) => setError(err?.message || "Erro ao processar audio."),
        onProcessingChange: setIsProcessing
      });

      isListeningRef.current = true;
      setIsListening(true);
    } catch (err) {
      console.error("Erro ao iniciar captura do microfone:", err);
      if (err?.name === "NotAllowedError") {
        setPermissionDenied(true);
        setError("Permissao de microfone negada.");
      } else {
        setError(err?.message ? `Erro ao acessar microfone: ${err.message}` : "Erro ao acessar microfone.");
      }
      isListeningRef.current = false;
      setIsListening(false);
    }
  }, [audioSettings, enableInsights, handleTranscription]);

  const stopListening = useCallback(async () => {
    if (!isListeningRef.current) {
      return fullTranscriptionRef.current.trim();
    }

    try {
      isListeningRef.current = false;
      setIsListening(false);

      pipelineRef.current?.flush({ reason: "stop" });

      if (recorderRef.current) {
        await recorderRef.current.stop();
      }

      await pipelineRef.current?.waitForIdle?.(3000);

      if (enableInsights) {
        await resetTranscriptionInsightSession?.("mic");
      }
    } catch (err) {
      console.error("Erro ao parar captura:", err);
    }

    return fullTranscriptionRef.current.trim();
  }, [enableInsights]);

  const toggleListening = useCallback(() => {
    if (isListeningRef.current) {
      return stopListening();
    }
    return startListening();
  }, [startListening, stopListening]);

  useEffect(() => {
    if (!enableInsights || !isElectron()) return undefined;

    const offInsight = onTranscriptionInsight?.((payload) => {
      if (!payload || payload.source !== "mic") return;
      const displayText = payload.displayText || payload.contextSnapshot || "";
      const summary = payload.rollingSummary || payload.summary || "";
      const incomingComments = Array.isArray(payload.modelComments) ? payload.modelComments : [];
      if (!displayText && !summary && incomingComments.length === 0) return;

      const visibleText = displayText || summary;
      fullTranscriptionRef.current = visibleText;
      setFullTranscription(visibleText);
      setTranscription(visibleText);
      setLatestInsight((previous) => {
        const previousComments = Array.isArray(previous?.comments) ? previous.comments : [];
        return {
          source: "mic",
          summary,
          comments: mergeComments(previousComments, incomingComments),
          rawRecentChunk: "",
          snapshot: payload.contextSnapshot || previous?.snapshot || "",
          displayText: payload.displayText || previous?.displayText || "",
          insightType: payload.insightType || previous?.insightType || "",
          relevanceScore: payload.relevanceScore || previous?.relevanceScore || 0,
          timestamp: payload.timestamp || Date.now()
        };
      });
    });

    return () => offInsight?.();
  }, [enableInsights]);

  useEffect(() => {
    return () => {
      isListeningRef.current = false;
      pipelineRef.current?.flush({ reason: "cleanup" });
      recorderRef.current?.stop();
      if (enableInsights) {
        resetTranscriptionInsightSession?.("mic");
      }
    };
  }, [enableInsights]);

  return {
    isListening,
    transcription,
    fullTranscription,
    latestInsight,
    isProcessing,
    error,
    permissionDenied,
    chunksProcessed,
    startListening,
    stopListening,
    toggleListening
  };
};
