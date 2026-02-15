import { useCallback, useEffect, useRef, useState } from "react";
import { WebAudioRecorder } from "../../infra/audio/webAudioRecorder.js";
import { createMicTranscriptionPipeline } from "../../app/audio/micTranscriptionPipeline.js";
import { DEFAULT_LANGUAGE } from "../../../shared/audio/constants.js";
import { sanitizeTranscriptionText } from "../../../shared/audio/transcription.js";
import {
  isElectron,
  getDesktopSources,
  startSystemCapture,
  stopSystemCapture,
  onSystemTranscription,
  onSystemTranscriptionStatus,
  onSystemCaptureStatus,
  onSystemCaptureError,
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

export const useSystemTranscription = ({ audioSettings } = {}) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [transcription, setTranscription] = useState("");
  const [fullTranscription, setFullTranscription] = useState("");
  const [latestInsight, setLatestInsight] = useState(null);
  const [chunksProcessed, setChunksProcessed] = useState(0);
  const [lastEvent, setLastEvent] = useState(null);

  const isCapturingRef = useRef(false);
  const usingFallbackRef = useRef(false);
  const fallbackAttemptedRef = useRef(false);
  const fallbackRecorderRef = useRef(null);
  const fallbackPipelineRef = useRef(null);
  const fallbackTimerRef = useRef(null);
  const chunksProcessedRef = useRef(0);
  const isProcessingRef = useRef(false);

  const clearFallbackTimer = useCallback(() => {
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }, []);

  const processInsightFromChunk = useCallback(async (payload, source = "system") => {
    const cleanedText = sanitizeTranscriptionText(payload?.text || "");
    if (!cleanedText) return;
    console.log("[SystemTranscription] chunk recebido:", {
      source,
      chunkIndex: payload?.chunkIndex,
      timestamp: payload?.timestamp,
      text: cleanedText
    });

    clearFallbackTimer();

    setChunksProcessed(prev => {
      const next = prev + 1;
      chunksProcessedRef.current = next;
      return next;
    });

    const timestamp = payload?.timestamp || Date.now();
    const chunkIndex = payload?.chunkIndex;

    try {
      const insight = await processTranscriptionInsight?.({
        source,
        text: cleanedText,
        timestamp,
        chunkIndex,
        durationMs: payload?.durationMs || payload?.duration || 5
      });

      if (!insight?.relevant || !insight?.displayText) {
        console.log("[SystemTranscription] insight filtrado:", {
          source,
          reason: insight?.reason,
          relevanceScore: insight?.relevanceScore
        });
        setLastEvent({
          ...payload,
          source,
          timestamp,
          chunkIndex,
          ignored: true
        });
        return;
      }
    } catch (error) {
      console.error("Erro ao processar insight do sistema:", error);
      setError(error?.message || "Erro ao processar insights em tempo real.");
    }
  }, [clearFallbackTimer]);

  const startDesktopFallback = useCallback(async () => {
    clearFallbackTimer();
    if (!getDesktopSources) {
      throw new Error("Captura de desktop indisponivel.");
    }
    if (!transcribeAudio) {
      throw new Error("Transcricao indisponivel.");
    }

    const recorder = new WebAudioRecorder({
      sampleRate: 16000,
      getStream: async () => {
        const sources = await getDesktopSources({
          types: ["screen"],
          fetchWindowIcons: false
        });

        const source = sources?.[0];
        if (!source?.id) {
          throw new Error("Nenhuma tela encontrada para captura de audio do sistema.");
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            mandatory: {
              chromeMediaSource: "desktop",
              chromeMediaSourceId: source.id
            }
          },
          video: {
            mandatory: {
              chromeMediaSource: "desktop",
              chromeMediaSourceId: source.id,
              maxWidth: 1,
              maxHeight: 1,
              maxFrameRate: 1
            }
          }
        });

        stream.getVideoTracks().forEach(track => track.stop());
        return stream;
      },
      onPcm: (chunk) => {
        fallbackPipelineRef.current?.handlePcmChunk(chunk);
      }
    });

    fallbackRecorderRef.current = recorder;
    await recorder.start();
    const sampleRate = recorder.getSampleRate();

    fallbackPipelineRef.current = createMicTranscriptionPipeline({
      sampleRate,
      language: DEFAULT_LANGUAGE,
      silenceThreshold: audioSettings?.silenceThreshold,
      silenceMs: audioSettings?.silenceMs,
      transcribe: async (audioBuffer, options) => {
        return await transcribeAudio({ audioBuffer, options });
      },
      onTranscription: (payload) => {
        processInsightFromChunk(payload, "system").catch((error) => {
          console.error("Falha no insight do fallback de sistema:", error);
        });
      },
      onError: (err) => setError(err?.message || "Erro ao processar audio do sistema."),
      onProcessingChange: setIsProcessing
    });

    usingFallbackRef.current = true;
    fallbackAttemptedRef.current = true;
    isCapturingRef.current = true;
    setIsCapturing(true);
    setError(null);
  }, [audioSettings, clearFallbackTimer, processInsightFromChunk]);

  const startCapture = useCallback(async (options = {}) => {
    if (!isElectron() || isCapturingRef.current) return;

    setTranscription("");
    setFullTranscription("");
    setLatestInsight(null);
    setChunksProcessed(0);
    await resetTranscriptionInsightSession?.("system");
    const response = await startSystemCapture({
      ...options,
      silenceThreshold: audioSettings?.silenceThreshold,
      silenceMs: audioSettings?.silenceMs
    });
    if (response?.started) {
      isCapturingRef.current = true;
      setIsCapturing(true);
      setError(null);
      clearFallbackTimer();
      fallbackAttemptedRef.current = false;

      fallbackTimerRef.current = setTimeout(async () => {
        if (!isCapturingRef.current) return;
        if (usingFallbackRef.current || fallbackAttemptedRef.current) return;
        if (chunksProcessedRef.current > 0 || isProcessingRef.current) return;
        try {
          await stopSystemCapture();
          await startDesktopFallback();
        } catch (error) {
          setError(error?.message || "Erro ao iniciar captura de desktop.");
        }
      }, 4500);
      return;
    }

    if (response?.reason === "no_loopback_device") {
      try {
        await startDesktopFallback();
        return;
      } catch (error) {
        setError(error?.message || response?.message || "Erro ao iniciar captura do sistema.");
        return;
      }
    }

    if (response?.message) {
      setError(response.message);
    }
  }, [audioSettings, startDesktopFallback]);

  const stopCapture = useCallback(async () => {
    if (!isElectron() || !isCapturingRef.current) return;
    clearFallbackTimer();
    if (usingFallbackRef.current) {
      fallbackPipelineRef.current?.flush({ reason: "stop" });
      await fallbackRecorderRef.current?.stop();
      fallbackRecorderRef.current = null;
      fallbackPipelineRef.current = null;
      usingFallbackRef.current = false;
    } else {
      await stopSystemCapture();
    }
    fallbackAttemptedRef.current = false;
    isCapturingRef.current = false;
    chunksProcessedRef.current = 0;
    isProcessingRef.current = false;
    setIsCapturing(false);
    setIsProcessing(false);
    await resetTranscriptionInsightSession?.("system");
  }, []);

  useEffect(() => {
    if (!isElectron()) return undefined;

    const offInsight = onTranscriptionInsight?.((payload) => {
      if (!payload || payload.source !== "system") return;
      const displayText = payload.displayText || payload.contextSnapshot || "";
      const summary = payload?.rollingSummary || payload?.summary || "";
      const incomingComments = Array.isArray(payload?.modelComments) ? payload.modelComments : [];
      if (!displayText && !summary && incomingComments.length === 0) return;

      const visibleText = displayText || summary;
      setTranscription(visibleText);
      setFullTranscription(visibleText);
      setLatestInsight((previous) => {
        const previousComments = Array.isArray(previous?.comments) ? previous.comments : [];
        return {
          source: payload?.source || "system",
          summary,
          comments: mergeComments(previousComments, incomingComments),
          rawRecentChunk: "",
          snapshot: payload?.contextSnapshot || previous?.snapshot || "",
          displayText: payload?.displayText || previous?.displayText || "",
          insightType: payload?.insightType || previous?.insightType || "",
          relevanceScore: payload?.relevanceScore || previous?.relevanceScore || 0,
          timestamp: payload?.timestamp || Date.now()
        };
      });
      console.log("[SystemTranscription] insight relevante exibido:", {
        source: payload?.source,
        relevanceScore: payload?.relevanceScore,
        insightType: payload?.insightType,
        text: visibleText
      });
      setLastEvent({
        source: payload?.source || "system",
        text: visibleText,
        timestamp: payload?.timestamp || Date.now(),
        insight: payload,
        isInsight: true
      });
    });

    return () => offInsight?.();
  }, []);

  useEffect(() => {
    if (!isElectron()) return;

    const offTranscription = onSystemTranscription((payload) => {
      processInsightFromChunk(payload, "system").catch((error) => {
        console.error("Falha no insight de transcricao do sistema:", error);
      });
    });

    const offProcessing = onSystemTranscriptionStatus((payload) => {
      if (payload?.isProcessing) {
        clearFallbackTimer();
      }
      const active = Boolean(payload?.isProcessing);
      isProcessingRef.current = active;
      setIsProcessing(active);
    });

    const offStatus = onSystemCaptureStatus((payload) => {
      if (usingFallbackRef.current) return;
      const active = Boolean(payload?.isCapturing);
      isCapturingRef.current = active;
      setIsCapturing(active);
    });

    const offError = onSystemCaptureError(async (payload) => {
      if (usingFallbackRef.current) return;
      setError(payload?.message || "Erro ao capturar audio do sistema.");
      if (!fallbackAttemptedRef.current) {
        try {
          await stopSystemCapture();
          await startDesktopFallback();
        } catch (error) {
          setError(error?.message || "Erro ao iniciar captura de desktop.");
        }
      }
    });

    return () => {
      clearFallbackTimer();
      offTranscription?.();
      offProcessing?.();
      offStatus?.();
      offError?.();
      resetTranscriptionInsightSession?.("system");
    };
  }, [clearFallbackTimer, processInsightFromChunk, startDesktopFallback]);

  return {
    isCapturing,
    isProcessing,
    error,
    transcription,
    fullTranscription,
    latestInsight,
    chunksProcessed,
    lastEvent,
    startCapture,
    stopCapture
  };
};
