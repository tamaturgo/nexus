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

export const useMicTranscription = ({ autoSaveTranscription = true, audioSettings } = {}) => {
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

  const handleTranscription = useCallback(async (payload) => {
    const cleanedText = sanitizeTranscriptionText(payload?.text || "");
    if (!cleanedText) return;
    console.log("[MicTranscription] chunk recebido:", {
      chunkIndex: payload?.chunkIndex,
      timestamp: payload?.timestamp,
      text: cleanedText
    });

    setChunksProcessed(prev => prev + 1);

    let insightResult = null;
    if (isElectron() && processTranscriptionInsight) {
      try {
        insightResult = await processTranscriptionInsight({
          source: "mic",
          text: cleanedText,
          chunkIndex: payload.chunkIndex,
          timestamp: payload.timestamp,
          durationMs: payload.durationMs || payload.duration || 5
        });
      } catch (error) {
        console.error("Erro ao processar insight de microfone:", error);
      }
    }

    if (insightResult && (!insightResult?.relevant || !insightResult?.displayText)) {
      console.log("[MicTranscription] insight filtrado:", {
        reason: insightResult?.reason,
        relevanceScore: insightResult?.relevanceScore
      });
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
  }, [autoSaveTranscription]);

  const startListening = useCallback(async () => {
    if (isListeningRef.current) return;

    try {
      setError(null);
      setPermissionDenied(false);
      setTranscription("");
      setFullTranscription("");
      setLatestInsight(null);
      setChunksProcessed(0);

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

      await resetTranscriptionInsightSession?.("mic");
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
  }, [handleTranscription]);

  const stopListening = useCallback(async () => {
    if (!isListeningRef.current) return;

    try {
      isListeningRef.current = false;
      setIsListening(false);

      pipelineRef.current?.flush({ reason: "stop" });

      if (recorderRef.current) {
        await recorderRef.current.stop();
      }
      await resetTranscriptionInsightSession?.("mic");
    } catch (err) {
      console.error("Erro ao parar captura:", err);
    }
  }, []);

  const toggleListening = useCallback(() => {
    if (isListeningRef.current) {
      stopListening();
    } else {
      startListening();
    }
  }, [startListening, stopListening]);

  useEffect(() => {
    if (!isElectron()) return undefined;

    const offInsight = onTranscriptionInsight?.((payload) => {
      if (!payload || payload.source !== "mic") return;
      const displayText = payload.displayText || payload.contextSnapshot || "";
      const summary = payload.rollingSummary || payload.summary || "";
      const incomingComments = Array.isArray(payload.modelComments) ? payload.modelComments : [];
      if (!displayText && !summary && incomingComments.length === 0) return;

      const visibleText = displayText || summary;
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
      console.log("[MicTranscription] insight relevante exibido:", {
        relevanceScore: payload?.relevanceScore,
        insightType: payload?.insightType,
        text: visibleText
      });
    });

    return () => offInsight?.();
  }, []);

  useEffect(() => {
    return () => {
      isListeningRef.current = false;
      pipelineRef.current?.flush({ reason: "cleanup" });
      recorderRef.current?.stop();
      resetTranscriptionInsightSession?.("mic");
    };
  }, []);

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
