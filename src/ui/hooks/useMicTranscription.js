import { useCallback, useEffect, useRef, useState } from "react";
import { WebAudioRecorder } from "../../infra/audio/webAudioRecorder.js";
import { createMicTranscriptionPipeline } from "../../app/audio/micTranscriptionPipeline.js";
import { DEFAULT_LANGUAGE } from "../../../shared/audio/constants.js";
import { sanitizeTranscriptionText } from "../../../shared/audio/transcription.js";
import { isElectron, saveTranscription, transcribeAudio } from "../../infra/ipc/electronBridge.js";

export const useMicTranscription = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcription, setTranscription] = useState("");
  const [fullTranscription, setFullTranscription] = useState("");
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

    setFullTranscription(prev => (prev ? `${prev} ${cleanedText}` : cleanedText));
    setTranscription(cleanedText);
    setChunksProcessed(prev => prev + 1);

    if (isElectron()) {
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
  }, []);

  const startListening = useCallback(async () => {
    if (isListeningRef.current) return;

    try {
      setError(null);
      setPermissionDenied(false);

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

      await recorder.start();
      const sampleRate = recorder.getSampleRate();

      pipelineRef.current = createMicTranscriptionPipeline({
        sampleRate,
        language: DEFAULT_LANGUAGE,
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
    return () => {
      isListeningRef.current = false;
      pipelineRef.current?.flush({ reason: "cleanup" });
      recorderRef.current?.stop();
    };
  }, []);

  return {
    isListening,
    transcription,
    fullTranscription,
    isProcessing,
    error,
    permissionDenied,
    chunksProcessed,
    startListening,
    stopListening,
    toggleListening
  };
};
