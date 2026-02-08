import { useState, useEffect } from 'react';
import { Header, Footer, SearchBar, MainContainer } from './components';
import ContextOverlay from './components/layout/ContextOverlay';
import NeuralCenter from './components/layout/NeuralCenter';
import ErrorToast from './components/common/ErrorToast';
import { useAssistant } from './hooks/useAssistant';

function App() {
  const isElectron = typeof window !== 'undefined' && !!window.electronAPI;
  const windowType = isElectron
    ? (window.electronAPI?.getWindowType?.()
        || new URLSearchParams(window.location.search).get('window')
        || 'search')
    : 'single';

  const handleCloseWindow = () => {
    if (isElectron && window.electronAPI?.closeCurrentWindow) {
      window.electronAPI.closeCurrentWindow();
    }
  };

  const handleMinimizeWindow = () => {
    if (isElectron && window.electronAPI?.minimizeCurrentWindow) {
      window.electronAPI.minimizeCurrentWindow();
    }
  };

  const [contextData, setContextData] = useState({
    query: '',
    answer: '',
    sections: [],
    citations: [],
    voiceContext: null
  });

  useEffect(() => {
    if (windowType !== 'context' || !isElectron) return;
    let isMounted = true;

    window.electronAPI?.getContextData?.().then((data) => {
      if (!isMounted || !data) return;
      setContextData(data);
    });

    const unsubscribe = window.electronAPI?.onContextData?.((data) => {
      if (!data) return;
      setContextData(data);
    });

    return () => {
      isMounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [windowType, isElectron]);

  const {
    inputValue,
    isProcessing,
    interactionCount,
    inputRef,
    handleInputChange,
    handleKeyDown,
    handleSubmit,
    copyToClipboard,
    clearInput,
    searchWeb,
    showSettings,
    quickAction,
    micStatus,
    screenStatus,
    toggleScreenVision,
    toggleMicrophone,
    transcription,
    isTranscribing,
    voiceError,
    permissionDenied,
    chunksProcessed,
    viewMode,
    mockData,
    liveVoiceContext,
    settings,
    setSelectedProvider,
    togglePlugin
  } = useAssistant({ windowType, isElectron });

  const [isFocused, setIsFocused] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Monitorar erros de voz
  useEffect(() => {
    if (voiceError) {
      setErrorMessage(voiceError);
      setTimeout(() => setErrorMessage(null), 5000); // Auto-dismiss após 5s
    }
  }, [voiceError]);

  useEffect(() => {
    const handleFocus = () => setIsFocused(true);
    const handleBlur = () => setIsFocused(false);

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  if (windowType === 'context') {
    // Ensure answer is a string before passing to ContextOverlay
    const finalAnswer = typeof contextData.answer === 'string' 
      ? contextData.answer 
      : (contextData.answer?.answer || JSON.stringify(contextData.answer || ""));

    // Detectar se é contexto de voz ao vivo
    const isLive = contextData.voiceContext?.isLive || false;

    return (
      <MainContainer isFocused={true}>
        <ContextOverlay
          query={contextData.query}
          answer={finalAnswer}
          sections={contextData.sections || []}
          citations={contextData.citations || []}
          voiceContext={contextData.voiceContext}
          isLiveVoice={isLive}
          onClose={handleCloseWindow}
          onMinimize={handleMinimizeWindow}
        />
      </MainContainer>
    );
  }

  if (windowType === 'settings') {
    return (
      <MainContainer isFocused={true}>
        <NeuralCenter
          selectedProvider={settings.selectedProvider}
          onSelectProvider={setSelectedProvider}
          cpuLoad={settings.cpuLoad}
          activePlugins={settings.activePlugins}
          onTogglePlugin={togglePlugin}
          onClose={handleCloseWindow}
          onMinimize={handleMinimizeWindow}
        />
      </MainContainer>
    );
  }

  return (
    <MainContainer isFocused={isFocused}>
      {/* Error Toast */}
      <ErrorToast 
        message={errorMessage} 
        onDismiss={() => setErrorMessage(null)} 
      />

      {/* Header */}
      {viewMode === 'collapsed' && (
        <Header
          isProcessing={isProcessing}
          interactionCount={interactionCount}
        />
      )}

      {/* Search Bar (Always Visible) */}
      <SearchBar
        inputValue={inputValue}
        onInputChange={handleInputChange}
        onSubmit={handleSubmit}
        onKeyDown={handleKeyDown}
        isProcessing={isProcessing}
        inputRef={inputRef}
        onCopyToClipboard={copyToClipboard}
        onClearInput={clearInput}
        onSearchWeb={searchWeb}
        onShowSettings={showSettings}
        onQuickAction={quickAction}
        micStatus={micStatus}
        screenStatus={screenStatus}
        onToggleScreenVision={toggleScreenVision}
        onToggleMicrophone={toggleMicrophone}
        isTranscribing={isTranscribing}
        permissionDenied={permissionDenied}
        chunksProcessed={chunksProcessed}
      />

      {/* Dynamic Content Views (Single Window Mode) */}
      {windowType === 'single' && (
        <div className="relative">
          {/* Context Overlay View */}
          {viewMode === 'context' && (
            <ContextOverlay
              query={liveVoiceContext?.isLive ? "Contexto de Voz Ao Vivo" : (mockData?.query || "Query")}
              answer={liveVoiceContext?.isLive ? (liveVoiceContext.text || "") : (mockData?.answer || "No response")}
              sections={liveVoiceContext?.isLive ? [] : (mockData?.sections || [])}
              citations={liveVoiceContext?.isLive ? [] : (mockData?.citations || [])}
              voiceContext={liveVoiceContext}
              isLiveVoice={liveVoiceContext?.isLive || false}
            />
          )}

          {/* Neural Center (Settings) View */}
          {viewMode === 'settings' && (
            <NeuralCenter
              selectedProvider={settings.selectedProvider}
              onSelectProvider={setSelectedProvider}
              cpuLoad={settings.cpuLoad}
              activePlugins={settings.activePlugins}
              onTogglePlugin={togglePlugin}
            />
          )}
        </div>
      )}

      {/* Footer (Only in collapsed mode) */}
      {viewMode === 'collapsed' && <Footer />}
    </MainContainer>
  );
}

export default App;
