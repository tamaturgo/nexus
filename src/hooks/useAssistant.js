import { useState, useRef, useEffect } from 'react';

export const useAssistant = () => {
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [interactionCount, setInteractionCount] = useState(0);
  const [micStatus, setMicStatus] = useState(false); // New: Microphone status
  const [screenStatus, setScreenStatus] = useState(false);
  const [viewMode, setViewMode] = useState('collapsed'); // 'collapsed' | 'context' | 'settings'
  const [mockData, setMockData] = useState({ query: '', answer: '', citations: [] });
  const inputRef = useRef(null);

  // Settings State
  const [selectedProvider, setSelectedProvider] = useState('gemini');
  const [activePlugins, setActivePlugins] = useState([
    { id: 'gcal', name: 'Google Calendar', active: true },
    { id: 'slack', name: 'Slack Connect', active: false },
    { id: 'notion', name: 'Notion', active: true },
  ]);

  // Handle Window Resizing based on ViewMode
  useEffect(() => {
    // Definir tamanhos para cada modo
    // Base width: 600px (definido no main.js padrão)
    const COLLAPSED_HEIGHT = 120; // Apenas barra
    const EXPANDED_HEIGHT = 600;  // Com overlay/settings

    // Se estiver rodando no Electron
    if (window.electronAPI && window.electronAPI.resizeWindow) {
      if (viewMode === 'collapsed') {
         window.electronAPI.resizeWindow(600, COLLAPSED_HEIGHT);
      } else {
         window.electronAPI.resizeWindow(600, EXPANDED_HEIGHT);
      }
    }
  }, [viewMode]);

  useEffect(() => {
    // Focar no input quando o hook é inicializado
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Simular detecção de atividade do microfone
  useEffect(() => {
    const interval = setInterval(() => {
      // Randomly toggle mic activity for demo
      if (Math.random() > 0.8) setMicStatus(prev => !prev);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    // Escape to close/collapse
    if (e.key === 'Escape') {
      if (viewMode !== 'collapsed') {
         setViewMode('collapsed');
      }
    }
  };

  const handleSubmit = async () => {
    if (!inputValue.trim() || isProcessing) return;

    setIsProcessing(true);
    setInteractionCount(prev => prev + 1);

    // Simular processamento da IA
    setTimeout(() => {
      setIsProcessing(false);
      setMockData({
        query: inputValue,
        answer: "Com base na reunião das 10h, o cronograma foi ajustado para incluir a fase de testes na próxima terça-feira. \n\nO time concordou que a integração do backend deve ser priorizada antes da UI final.",
        citations: [
            { id: 1, timestamp: "10:32:15", snippet: "Discussão sobre cronograma", img: null },
            { id: 2, timestamp: "10:45:00", snippet: "Acordo sobre Backend", img: null },
        ]
      });
      setViewMode('context'); // Expand to show results
      setInputValue('');
    }, 2000);
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
    // State
    inputValue,
    isProcessing,
    interactionCount,
    inputRef,
    micStatus,
    screenStatus,
    viewMode,
    mockData,
    settings: {
        selectedProvider,
        activePlugins,
        cpuLoad: 34
    },

    // Handlers
    handleInputChange,
    handleKeyDown,
    handleSubmit,
    copyToClipboard,
    clearInput,
    searchWeb,
    showSettings,
    quickAction,
    toggleScreenVision,
    
    // Settings Handlers
    setSelectedProvider,
    togglePlugin
  };
};