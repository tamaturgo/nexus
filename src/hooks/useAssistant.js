import { useState, useRef, useEffect } from 'react';
import { aiService } from '../services/aiService';

export const useAssistant = ({ windowType = 'single', isElectron = false } = {}) => {
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [interactionCount, setInteractionCount] = useState(0);
  const [micStatus, setMicStatus] = useState(false); 
  const [screenStatus, setScreenStatus] = useState(false);
  const [viewMode, setViewMode] = useState('collapsed');
  const [mockData, setMockData] = useState({ query: '', answer: '', sections: [], citations: [] });
  const inputRef = useRef(null);

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

  useEffect(() => {
    const interval = setInterval(() => {
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

    try {
      const response = await aiService.ask(inputValue);
      
      // A resposta agora é um objeto estruturado { answer, sections, citations }
      setMockData({
        query: inputValue,
        answer: response.answer || response,
        sections: response.sections || [],
        citations: response.citations || []
      });

      if (isElectron && window.electronAPI?.openWindow) {
        window.electronAPI.openWindow('context', {
          query: inputValue,
          answer: response.answer || response,
          sections: response.sections || [],
          citations: response.citations || []
        });
        setViewMode('collapsed');
      } else {
        setViewMode('context'); 
      }
    } catch (error) {
      console.error("Failed to get AI response:", error);
      // Optional: set error state to show in UI
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
    viewMode,
    mockData,
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
    
    setSelectedProvider,
    togglePlugin
  };
};