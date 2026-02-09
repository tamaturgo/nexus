import { useState, useEffect } from "react";
import { Header, Footer, SearchBar, MainContainer } from "./ui/components";
import ContextOverlay from "./ui/components/layout/ContextOverlay";
import NeuralCenter from "./ui/components/layout/NeuralCenter";
import ErrorToast from "./ui/components/common/ErrorToast";
import { useAssistant } from "./ui/hooks/useAssistant";
import {
  isElectron as bridgeIsElectron,
  getWindowType,
  getContextData,
  onContextData,
  closeCurrentWindow,
  minimizeCurrentWindow
} from "./infra/ipc/electronBridge.js";

function App() {
  const isElectron = bridgeIsElectron();
  const windowType = isElectron
    ? (getWindowType()
        || new URLSearchParams(window.location.search).get("window")
        || "search")
    : "single";

  const handleCloseWindow = () => {
    if (isElectron) {
      closeCurrentWindow();
    }
  };

  const handleMinimizeWindow = () => {
    if (isElectron) {
      minimizeCurrentWindow();
    }
  };

  const [contextData, setContextData] = useState({
    query: "",
    answer: "",
    sections: [],
    citations: [],
    voiceContext: null
  });

  useEffect(() => {
    if (windowType !== "context" || !isElectron) return;
    let isMounted = true;

    getContextData()?.then((data) => {
      if (!isMounted || !data) return;
      setContextData(data);
    });

    const unsubscribe = onContextData?.((data) => {
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

  useEffect(() => {
    if (voiceError) {
      setErrorMessage(voiceError);
      setTimeout(() => setErrorMessage(null), 5000);
    }
  }, [voiceError]);

  useEffect(() => {
    const handleFocus = () => setIsFocused(true);
    const handleBlur = () => setIsFocused(false);

    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  if (windowType === "context") {
    const finalAnswer = typeof contextData.answer === "string"
      ? contextData.answer
      : (contextData.answer?.answer || JSON.stringify(contextData.answer || ""));

    const isLive = contextData.voiceContext?.isLive || false;

    return (
      <MainContainer isFocused={isFocused}>
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

  if (windowType === "settings") {
    return (
      <MainContainer isFocused={isFocused}>
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
      <ErrorToast
        message={errorMessage}
        onDismiss={() => setErrorMessage(null)}
      />

      {viewMode === "collapsed" && (
        <Header
          isProcessing={isProcessing}
          interactionCount={interactionCount}
        />
      )}

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

      {windowType === "single" && (
        <div className="relative">
          {viewMode === "context" && (
            <ContextOverlay
              query={liveVoiceContext?.isLive ? "Contexto de Voz Ao Vivo" : (mockData?.query || "Query")}
              answer={liveVoiceContext?.isLive ? (liveVoiceContext.text || "") : (mockData?.answer || "No response")}
              sections={liveVoiceContext?.isLive ? [] : (mockData?.sections || [])}
              citations={liveVoiceContext?.isLive ? [] : (mockData?.citations || [])}
              voiceContext={liveVoiceContext}
              isLiveVoice={liveVoiceContext?.isLive || false}
            />
          )}

          {viewMode === "settings" && (
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

      {viewMode === "collapsed" && <Footer />}
    </MainContainer>
  );
}

export default App;
