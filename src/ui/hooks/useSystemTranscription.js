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
  transcribeAudio
} from "../../infra/ipc/electronBridge.js";

export const useSystemTranscription = ({ audioSettings } = {}) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [transcription, setTranscription] = useState("");
  const [fullTranscription, setFullTranscription] = useState("");
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
        const cleanedText = sanitizeTranscriptionText(payload?.text || "");
        if (!cleanedText) return;
        setTranscription(cleanedText);
        setFullTranscription(prev => (prev ? `${prev} ${cleanedText}` : cleanedText));
        setChunksProcessed(prev => {
          const next = prev + 1;
          chunksProcessedRef.current = next;
          return next;
        });
        setLastEvent({
          ...payload,
          text: cleanedText,
          source: "system"
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
  }, [audioSettings, clearFallbackTimer]);

  const startCapture = useCallback(async (options = {}) => {
    if (!isElectron() || isCapturingRef.current) return;

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
  }, []);

  useEffect(() => {
    if (!isElectron()) return;

    const offTranscription = onSystemTranscription((payload) => {
      const cleanedText = sanitizeTranscriptionText(payload?.text || "");
      if (!cleanedText) return;
      clearFallbackTimer();
      setTranscription(cleanedText);
      setFullTranscription(prev => (prev ? `${prev} ${cleanedText}` : cleanedText));
      setChunksProcessed(prev => {
        const next = prev + 1;
        chunksProcessedRef.current = next;
        return next;
      });
      setLastEvent({ ...payload, text: cleanedText });
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
    };
  }, [clearFallbackTimer, startDesktopFallback]);

  return {
    isCapturing,
    isProcessing,
    error,
    transcription,
    fullTranscription,
    chunksProcessed,
    lastEvent,
    startCapture,
    stopCapture
  };
};
