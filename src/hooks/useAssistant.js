import { useState, useRef, useEffect } from 'react';
import { aiService } from '../services/aiService';
import { useVoiceCapture } from './useVoiceCapture';

export const useAssistant = ({ windowType = 'single', isElectron = false } = {}) => {
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [interactionCount, setInteractionCount] = useState(0);
  const [screenStatus, setScreenStatus] = useState(false);
  const [viewMode, setViewMode] = useState('collapsed');
  const [mockData, setMockData] = useState({ query: '', answer: '', sections: [], citations: [], voiceContext: null });
  const [lastVoiceCapture, setLastVoiceCapture] = useState(null);
  const [liveVoiceContext, setLiveVoiceContext] = useState(null);
  const inputRef = useRef(null);

  // Integrar voice capture
  const {
    isListening: micStatus,
    transcription,
    fullTranscription,
    isProcessing: isTranscribing,
    error: voiceError,
    permissionDenied,
    chunksProcessed,
    toggleListening
  } = useVoiceCapture();

  const [selectedProvider, setSelectedProvider] = useState('gemini');
  const [activePlugins, setActivePlugins] = useState([
    { id: 'gcal', name: 'Google Calendar', active: true },
    { id: 'slack', name: 'Slack Connect', active: false },
    { id: 'notion', name: 'Notion', active: true },
  ]);

  useEffect(() => {
    if (!isElectron || windowType !== 'search') return;

    const COLLAPSED_HEIGHT = 180; 
    const EXPANDED_HEIGHT = 600;  

    if (window.electronAPI && window.electronAPI.resizeWindow) {
      if (viewMode === 'collapsed') {
        window.electronAPI.resizeWindow(600, COLLAPSED_HEIGHT);
      } else {
        window.electronAPI.resizeWindow(600, EXPANDED_HEIGHT);
      }
    }
  }, [viewMode, windowType, isElectron]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Abrir/atualizar janela de transcrição ao vivo quando transcrição é atualizada
  useEffect(() => {
    if (!fullTranscription) return;

    const voiceCtx = {
      timestamp: Date.now(),
      text: fullTranscription,
      chunksProcessed,
      isLive: true
    };

    setLiveVoiceContext(voiceCtx);

    // ABRIR NOVA JANELA na primeira vez, depois só atualizar
    if (isElectron && window.electronAPI?.openWindow) {
      const payload = {
        query: 'Captura de Voz em Tempo Real',
        answer: fullTranscription,
        sections: [],
        citations: [],
        voiceContext: voiceCtx
      };
      
      // openContextWindow já verifica se existe e só atualiza
      window.electronAPI.openWindow('context', payload);
    } else {
      // Single window mode - usar viewMode
      setViewMode('context');
    }
  }, [fullTranscription, chunksProcessed, isElectron]);

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      if (viewMode !== 'collapsed') {
         setViewMode('collapsed');
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
      const response = await aiService.ask(queryText);
      
      setMockData({
        query: queryText,
        answer: response.answer || response,
        sections: response.sections || [],
        citations: response.citations || [],
        voiceContext: voiceCtx
      });

      if (isElectron && window.electronAPI?.openWindow) {
        window.electronAPI.openWindow('context', {
          query: queryText,
          answer: response.answer || response,
          sections: response.sections || [],
          citations: response.citations || [],
          voiceContext: voiceCtx
        });
        setViewMode('collapsed');
      } else {
        setViewMode('context'); 
      }
      
      setLastVoiceCapture(null);
    } catch (error) {
      console.error("Failed to get AI response:", error);
    } finally {
      setIsProcessing(false);
      setInputValue('');
    }
  };

  const copyToClipboard = async () => {
    if (inputValue) {
      await navigator.clipboard.writeText(inputValue);
    }
  };

  const clearInput = () => {
    setInputValue('');
    inputRef.current?.focus();
    setViewMode('collapsed');
  };

  const searchWeb = () => {
    console.log('Searching web for:', inputValue);
  };

  const showSettings = () => {
    if (isElectron && window.electronAPI?.openWindow) {
      window.electronAPI.openWindow('settings');
      setViewMode('collapsed');
      return;
    }

    setViewMode(prev => prev === 'settings' ? 'collapsed' : 'settings');
  };

  const quickAction = () => {
    console.log('Quick action');
  };

  const toggleScreenVision = () => {
    setScreenStatus(prev => !prev);
  }

  const togglePlugin = (id) => {
    setActivePlugins(prev => prev.map(p => p.id === id ? { ...p, active: !p.active } : p));
  }

  return {
    inputValue,
    isProcessing,
    interactionCount,
    inputRef,
    micStatus,
    screenStatus,
    liveVoiceContext,
    viewMode,
    mockData,
    transcription,
    isTranscribing,
    voiceError,
    permissionDenied,
    chunksProcessed,
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
    toggleMicrophone: toggleListening,
    
    setSelectedProvider,
    togglePlugin
  };
};
