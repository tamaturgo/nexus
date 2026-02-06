import { useState, useRef, useEffect, useCallback } from 'react';

export const useVoiceCapture = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [fullTranscription, setFullTranscription] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [chunksProcessed, setChunksProcessed] = useState(0);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const chunkTimerRef = useRef(null);
  const streamRef = useRef(null);
  const isListeningRef = useRef(false); // Usar ref para ter sempre o valor atual

  // Capturar áudio do microfone
  const captureMicAudio = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000 // Whisper usa 16kHz
        }
      });
      console.log('Microphone audio captured');
      return stream;
    } catch (err) {
      console.error('Failed to capture microphone audio:', err);
      if (err.name === 'NotAllowedError') {
        setPermissionDenied(true);
        setError('Permissão de microfone negada. Clique novamente para permitir.');
      } else {
        setError('Erro ao acessar microfone: ' + err.message);
      }
      throw err;
    }
  }, []);

  // Processar chunk de áudio
  const processChunk = useCallback(async (audioBlob) => {
    setIsProcessing(true);
    const chunkIndex = chunksProcessed;

    try {
      console.log(`Processing audio chunk ${chunkIndex} (${audioBlob.size} bytes)`);

      // Converter blob para array buffer
      const arrayBuffer = await audioBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // Enviar para Whisper via IPC
      if (window.electronAPI?.transcribeAudio) {
        const result = await window.electronAPI.transcribeAudio({
          audioBuffer: uint8Array,
          options: {
            language: 'pt',
            maxDuration: 30
          }
        });

        console.log(`Transcription result:`, result.text);

        // Atualizar transcrição
        setFullTranscription(prev => (prev ? prev + ' ' : '') + result.text);
        setTranscription(result.text);

        // Salvar no vector store
        if (window.electronAPI?.saveTranscription) {
          await window.electronAPI.saveTranscription({
            text: result.text,
            metadata: {
              type: 'voice_transcription',
              chunkIndex,
              timestamp: Date.now(),
              duration: result.duration || 10,
              confidence: result.confidence || 0.9
            }
          });
        }

        setChunksProcessed(prev => prev + 1);
      } else {
        console.warn('Whisper transcription not available, using fallback');
        // Fallback: mock transcription
        const mockText = `[Chunk ${chunkIndex}] Áudio capturado aguardando transcrição`;
        setFullTranscription(prev => (prev ? prev + ' ' : '') + mockText);
        setTranscription(mockText);
        setChunksProcessed(prev => prev + 1);
      }
    } catch (err) {
      console.error('Failed to process audio chunk:', err);
      setError('Erro ao processar áudio: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  }, [chunksProcessed]);

  // Iniciar chunks de 10 segundos
  const startChunking = useCallback(() => {
    if (chunkTimerRef.current) return;

    chunkTimerRef.current = setInterval(() => {
      // Parar gravação atual
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    }, 10000); // 10 segundos
  }, []);

  // Parar chunking
  const stopChunking = useCallback(() => {
    if (chunkTimerRef.current) {
      clearInterval(chunkTimerRef.current);
      chunkTimerRef.current = null;
    }
    
    // Processar último chunk
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  // Iniciar listening
  const startListening = useCallback(async () => {
    if (isListening) return;

    try {
      setError(null);
      setPermissionDenied(false);

      // Capturar áudio do microfone
      const stream = await captureMicAudio();
      streamRef.current = stream;

      // Criar MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          audioChunksRef.current = [];
          
          // Processar chunk de forma NÃO-BLOQUEANTE
          processChunk(audioBlob).catch(err => {
            console.error('Error processing chunk:', err);
          });

          // Reiniciar gravação IMEDIATAMENTE se ainda está listening
          console.log('MediaRecorder stopped. isListeningRef:', isListeningRef.current);
          if (isListeningRef.current && mediaRecorderRef.current) {
            console.log('Restarting MediaRecorder for next chunk...');
            try {
              mediaRecorderRef.current.start();
            } catch (err) {
              console.error('Failed to restart MediaRecorder:', err);
            }
          }
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event.error);
        setError('Erro na gravação: ' + event.error);
      };

      // Iniciar gravação
      mediaRecorder.start();
      setIsListening(true);
      isListeningRef.current = true;
      
      // Iniciar chunking
      startChunking();

      console.log('Voice capture started (microphone with Whisper)');
    } catch (err) {
      console.error('Failed to start listening:', err);
      setIsListening(false);
      
      // Limpar stream se existir
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    }
  }, [isListening, captureMicAudio, startChunking, processChunk]);

  // Parar listening
  const stopListening = useCallback(async () => {
    if (!isListening) return;

    try {
      setIsListening(false);
      isListeningRef.current = false;
      
      stopChunking();

      // Parar MediaRecorder
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }

      // Parar stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      console.log('Voice capture stopped');
    } catch (err) {
      console.error('Failed to stop listening:', err);
    }
  }, [isListening, stopChunking]);

  // Toggle listening
  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (chunkTimerRef.current) {
        clearInterval(chunkTimerRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
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
