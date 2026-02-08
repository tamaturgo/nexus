import { useState, useRef, useEffect, useCallback } from 'react';

const TARGET_SAMPLE_RATE = 16000;
const SILENCE_THRESHOLD = 0.02; 
const SILENCE_DURATION = 1500;  
const MAX_CHUNK_DURATION = 30000; 
const MIN_SAMPLES_TO_PROCESS = 16000 * 1.2;

const downsampleBuffer = (buffer, inputRate, targetRate) => {
  if (inputRate === targetRate) return buffer;

  const ratio = inputRate / targetRate;
  const newLength = Math.round(buffer.length / ratio);
  const result = new Float32Array(newLength);

  let offsetResult = 0;
  let offsetBuffer = 0;

  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
    let accum = 0;
    let count = 0;

    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i += 1) {
      accum += buffer[i];
      count += 1;
    }

    result[offsetResult] = count ? accum / count : 0;
    offsetResult += 1;
    offsetBuffer = nextOffsetBuffer;
  }

  return result;
};

const encodeWavFromFloats = (float32Data, sampleRate) => {
  const numChannels = 1;
  const channelData = float32Data;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + channelData.length * bytesPerSample);
  const view = new DataView(buffer);

  const writeString = (offset, value) => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + channelData.length * bytesPerSample, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeString(36, 'data');
  view.setUint32(40, channelData.length * bytesPerSample, true);

  let offset = 44;
  for (let i = 0; i < channelData.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, channelData[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }

  return new Uint8Array(buffer);
};

export const useVoiceCapture = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [fullTranscription, setFullTranscription] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [chunksProcessed, setChunksProcessed] = useState(0);
  
  const audioContextRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const processorRef = useRef(null);
  const pcmChunksRef = useRef([]);
  const streamRef = useRef(null);

  const systemAudioContextRef = useRef(null);
  const systemSourceNodeRef = useRef(null);
  const systemProcessorRef = useRef(null);
  const systemPcmChunksRef = useRef([]);
  const systemStreamRef = useRef(null);

  const isListeningRef = useRef(false);
  const micActiveRef = useRef(false);
  const systemActiveRef = useRef(false);
  const micChunkIndexRef = useRef(0);
  const systemChunkIndexRef = useRef(0);
  const processingCountRef = useRef(0);

  const silenceTimerRef = useRef(null);
  const safetyTimerRef = useRef(null);
  const hasDetectedSpeechRef = useRef(false);

  const systemSilenceTimerRef = useRef(null);
  const systemSafetyTimerRef = useRef(null);
  const systemHasDetectedSpeechRef = useRef(false);

  const canSystemCapture = typeof window !== 'undefined' && !!window.electronAPI?.getDesktopSources;

  const updateListeningState = useCallback(() => {
    const active = micActiveRef.current || systemActiveRef.current;
    setIsListening(active);
    isListeningRef.current = active;
  }, []);

  const beginProcessing = useCallback(() => {
    processingCountRef.current += 1;
    setIsProcessing(true);
  }, []);

  const endProcessing = useCallback(() => {
    processingCountRef.current = Math.max(0, processingCountRef.current - 1);
    setIsProcessing(processingCountRef.current > 0);
  }, []);

  const captureMicAudio = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000
        }
      });
      return stream;
    } catch (err) {
      console.error('Falha ao capturar mic:', err);
      if (err.name === 'NotAllowedError') {
        setPermissionDenied(true);
        setError('Permissão de microfone negada.');
      } else {
        setError('Erro ao acessar microfone: ' + err.message);
      }
      throw err;
    }
  }, []);

  const captureSystemAudio = useCallback(async () => {
    if (!canSystemCapture) throw new Error('Captura de áudio do sistema indisponível.');

    const sources = await window.electronAPI.getDesktopSources({
      types: ['screen'],
      fetchWindowIcons: false
    });

    const source = sources?.[0];
    if (!source?.id) {
      throw new Error('Nenhuma tela encontrada para captura de áudio do sistema.');
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: source.id
        }
      },
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: source.id,
          maxWidth: 1,
          maxHeight: 1,
          maxFrameRate: 1
        }
      }
    });

    const videoTracks = stream.getVideoTracks();
    videoTracks.forEach(track => track.stop());

    return stream;
  }, [canSystemCapture]);

  const processChunk = useCallback(async (pcmChunk, inputSampleRate, sourceType, chunkIndexRef) => {
    beginProcessing();
    const chunkIndex = chunkIndexRef ? (chunkIndexRef.current += 1) : chunksProcessed + 1;

    try {
      const downsampled = downsampleBuffer(pcmChunk, inputSampleRate, TARGET_SAMPLE_RATE);
      const uint8Array = encodeWavFromFloats(downsampled, TARGET_SAMPLE_RATE);

      if (window.electronAPI?.transcribeAudio) {
        const result = await window.electronAPI.transcribeAudio({
          audioBuffer: uint8Array,
          options: { language: 'pt', useVad: true }
        });

        if (result.text && result.text.trim().length > 0) {
          setFullTranscription(prev => (prev ? prev + ' ' : '') + result.text.trim());
          setTranscription(result.text.trim());

          if (window.electronAPI?.saveTranscription) {
            await window.electronAPI.saveTranscription({
              text: result.text,
              metadata: {
                type: sourceType || 'voice_transcription',
                chunkIndex,
                timestamp: Date.now(),
                duration: result.duration || 5,
                confidence: result.confidence || 0.9
              }
            });
          }
        }
        setChunksProcessed(prev => prev + 1);
      }
    } catch (err) {
      console.error('Erro no processamento do chunk:', err);
    } finally {
      endProcessing();
    }
  }, [beginProcessing, endProcessing, chunksProcessed]);

  const flushChunk = useCallback(async () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    const totalSamples = pcmChunksRef.current.reduce((sum, chunk) => sum + chunk.length, 0);

    if (!hasDetectedSpeechRef.current || totalSamples < MIN_SAMPLES_TO_PROCESS) {
      pcmChunksRef.current = [];
      hasDetectedSpeechRef.current = false;
      return;
    }

    const merged = new Float32Array(totalSamples);
    let offset = 0;
    pcmChunksRef.current.forEach((chunk) => {
      merged.set(chunk, offset);
      offset += chunk.length;
    });

    pcmChunksRef.current = [];
    hasDetectedSpeechRef.current = false;

    if (audioContextRef.current) {
      await processChunk(merged, audioContextRef.current.sampleRate, 'voice_transcription', micChunkIndexRef);
    }
  }, [processChunk]);

  const flushSystemChunk = useCallback(async () => {
    if (systemSilenceTimerRef.current) {
      clearTimeout(systemSilenceTimerRef.current);
      systemSilenceTimerRef.current = null;
    }

    const totalSamples = systemPcmChunksRef.current.reduce((sum, chunk) => sum + chunk.length, 0);

    if (!systemHasDetectedSpeechRef.current || totalSamples < MIN_SAMPLES_TO_PROCESS) {
      systemPcmChunksRef.current = [];
      systemHasDetectedSpeechRef.current = false;
      return;
    }

    const merged = new Float32Array(totalSamples);
    let offset = 0;
    systemPcmChunksRef.current.forEach((chunk) => {
      merged.set(chunk, offset);
      offset += chunk.length;
    });

    systemPcmChunksRef.current = [];
    systemHasDetectedSpeechRef.current = false;

    if (systemAudioContextRef.current) {
      await processChunk(merged, systemAudioContextRef.current.sampleRate, 'system_transcription', systemChunkIndexRef);
    }
  }, [processChunk]);

  const startListening = useCallback(async () => {
    if (isListeningRef.current) return;

    try {
      setError(null);
      setPermissionDenied(false);
      let micStarted = false;
      let systemStarted = false;

      try {
        const stream = await captureMicAudio();
        streamRef.current = stream;

        const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        audioContextRef.current = audioContext;

        await audioContext.audioWorklet.addModule(
          new URL('./pcmWorklet.js', import.meta.url)
        );

        const sourceNode = audioContext.createMediaStreamSource(stream);
        const processor = new AudioWorkletNode(audioContext, 'pcm-processor');

        sourceNodeRef.current = sourceNode;
        processorRef.current = processor;

        processor.port.onmessage = (event) => {
          if (!micActiveRef.current) return;
          
          const pcmData = event.data;
          pcmChunksRef.current.push(pcmData);

          let sum = 0;
          for (let i = 0; i < pcmData.length; i++) {
            sum += pcmData[i] * pcmData[i];
          }
          const rms = Math.sqrt(sum / pcmData.length);

          if (rms > SILENCE_THRESHOLD) {
            hasDetectedSpeechRef.current = true;
            if (silenceTimerRef.current) {
              clearTimeout(silenceTimerRef.current);
              silenceTimerRef.current = null;
            }
          } else if (hasDetectedSpeechRef.current) {
            if (!silenceTimerRef.current) {
              silenceTimerRef.current = setTimeout(() => {
                flushChunk();
              }, SILENCE_DURATION);
            }
          }
        };

        sourceNode.connect(processor);
        processor.connect(audioContext.destination);

        micActiveRef.current = true;
        micStarted = true;

        safetyTimerRef.current = setInterval(() => {
          if (hasDetectedSpeechRef.current) flushChunk();
        }, MAX_CHUNK_DURATION);
      } catch (err) {
        console.error('Erro ao iniciar captura do microfone:', err);
      }

      if (canSystemCapture) {
        try {
          const systemStream = await captureSystemAudio();
          systemStreamRef.current = systemStream;

          const systemAudioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
          systemAudioContextRef.current = systemAudioContext;

          await systemAudioContext.audioWorklet.addModule(
            new URL('./pcmWorklet.js', import.meta.url)
          );

          const systemSourceNode = systemAudioContext.createMediaStreamSource(systemStream);
          const systemProcessor = new AudioWorkletNode(systemAudioContext, 'pcm-processor');

          systemSourceNodeRef.current = systemSourceNode;
          systemProcessorRef.current = systemProcessor;

          systemProcessor.port.onmessage = (event) => {
            if (!systemActiveRef.current) return;

            const pcmData = event.data;
            systemPcmChunksRef.current.push(pcmData);

            let sum = 0;
            for (let i = 0; i < pcmData.length; i++) {
              sum += pcmData[i] * pcmData[i];
            }
            const rms = Math.sqrt(sum / pcmData.length);

            if (rms > SILENCE_THRESHOLD) {
              systemHasDetectedSpeechRef.current = true;
              if (systemSilenceTimerRef.current) {
                clearTimeout(systemSilenceTimerRef.current);
                systemSilenceTimerRef.current = null;
              }
            } else if (systemHasDetectedSpeechRef.current) {
              if (!systemSilenceTimerRef.current) {
                systemSilenceTimerRef.current = setTimeout(() => {
                  flushSystemChunk();
                }, SILENCE_DURATION);
              }
            }
          };

          systemSourceNode.connect(systemProcessor);
          systemProcessor.connect(systemAudioContext.destination);

          systemActiveRef.current = true;
          systemStarted = true;

          systemSafetyTimerRef.current = setInterval(() => {
            if (systemHasDetectedSpeechRef.current) flushSystemChunk();
          }, MAX_CHUNK_DURATION);
        } catch (err) {
          console.error('Erro ao iniciar captura do sistema:', err);
          setError(err?.message ? `Erro ao iniciar captura do sistema: ${err.message}` : 'Erro ao iniciar captura do sistema.');
        }
      }

      if (!micStarted && !systemStarted) {
        setError('Não foi possível iniciar microfone nem áudio do sistema.');
      }

      updateListeningState();
    } catch (err) {
      console.error('Erro ao iniciar captura:', err);
      setError(err?.message ? `Erro ao iniciar captura: ${err.message}` : 'Erro ao iniciar captura.');
      micActiveRef.current = false;
      systemActiveRef.current = false;
      updateListeningState();
    }
  }, [captureMicAudio, captureSystemAudio, flushChunk, flushSystemChunk, updateListeningState, canSystemCapture]);

  const stopListening = useCallback(async () => {
    if (!isListeningRef.current) return;

    try {
      micActiveRef.current = false;
      systemActiveRef.current = false;
      updateListeningState();

      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (safetyTimerRef.current) clearInterval(safetyTimerRef.current);
      if (systemSilenceTimerRef.current) clearTimeout(systemSilenceTimerRef.current);
      if (systemSafetyTimerRef.current) clearInterval(systemSafetyTimerRef.current);

      await flushChunk();
      await flushSystemChunk();

      if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current = null;
      }
      if (sourceNodeRef.current) {
        sourceNodeRef.current.disconnect();
        sourceNodeRef.current = null;
      }
      if (audioContextRef.current) {
        await audioContextRef.current.close();
        audioContextRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      if (systemProcessorRef.current) {
        systemProcessorRef.current.disconnect();
        systemProcessorRef.current = null;
      }
      if (systemSourceNodeRef.current) {
        systemSourceNodeRef.current.disconnect();
        systemSourceNodeRef.current = null;
      }
      if (systemAudioContextRef.current) {
        await systemAudioContextRef.current.close();
        systemAudioContextRef.current = null;
      }
      if (systemStreamRef.current) {
        systemStreamRef.current.getTracks().forEach(track => track.stop());
        systemStreamRef.current = null;
      }
    } catch (err) {
      console.error('Erro ao parar captura:', err);
    }
  }, [flushChunk, flushSystemChunk, updateListeningState]);

  const toggleListening = useCallback(() => {
    if (isListening) stopListening();
    else startListening();
  }, [isListening, startListening, stopListening]);

  useEffect(() => {
    return () => {
      isListeningRef.current = false;
      micActiveRef.current = false;
      systemActiveRef.current = false;
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (safetyTimerRef.current) clearInterval(safetyTimerRef.current);
      if (systemSilenceTimerRef.current) clearTimeout(systemSilenceTimerRef.current);
      if (systemSafetyTimerRef.current) clearInterval(systemSafetyTimerRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (systemAudioContextRef.current) systemAudioContextRef.current.close();
      if (systemStreamRef.current) {
        systemStreamRef.current.getTracks().forEach(track => track.stop());
      }
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
