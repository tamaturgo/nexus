import { useState, useEffect, useRef } from "react";
import { Header, Footer, SearchBar, MainContainer } from "./ui/components";
import ContextOverlay from "./ui/components/layout/ContextOverlay";
import NeuralCenter from "./ui/components/layout/NeuralCenter";
import ContextHistory from "./ui/components/layout/ContextHistory";
import ErrorToast from "./ui/components/common/ErrorToast";
import { useAssistant } from "./ui/hooks/useAssistant";
import {
  isElectron as bridgeIsElectron,
  getWindowType,
  getContextData,
  onContextData,
  resizeWindow,
  closeCurrentWindow,
  minimizeCurrentWindow
} from "./infra/ipc/electronBridge.js";

function App() {
  const hasWindowParam = new URLSearchParams(window.location.search).has("window");
  const isElectron = bridgeIsElectron() || hasWindowParam;
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
      closeCurrentWindow();
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
    showSettings,
    showHistory,
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
    historyRefreshToken,
    updateSettings,
    resetSettingsState,
    clearMemory,
    openHistoryItem,
    setSearchContentHeight,
    searchContentHeight
  } = useAssistant({ windowType, isElectron });

  const [isFocused, setIsFocused] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const searchContentRef = useRef(null);

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

  useEffect(() => {
    if (!isElectron) return;
    const WIDTH = 600;
    if (windowType === "search") {
      const height = viewMode === "history" ? 700 : 220;
      resizeWindow(WIDTH, height);
    }
    if (windowType === "context") {
      resizeWindow(WIDTH, 720);
    }
    if (windowType === "settings") {
      resizeWindow(WIDTH, 820);
    }
    if (windowType === "history") {
      resizeWindow(WIDTH, 720);
    }
  }, [isElectron, windowType, viewMode, searchContentHeight]);

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
            onMinimize={handleMinimizeWindow}
          />
      </MainContainer>
    );
  }

  if (windowType === "settings") {
    return (
      <MainContainer isFocused={isFocused}>
        <NeuralCenter
          settings={settings}
          onUpdateSettings={updateSettings}
          onResetSettings={resetSettingsState}
          onClearMemory={clearMemory}
          onMinimize={handleMinimizeWindow}
        />
      </MainContainer>
    );
  }

  if (windowType === "history") {
    return (
      <MainContainer isFocused={isFocused}>
        <ContextHistory
          refreshToken={historyRefreshToken}
          onOpenContext={openHistoryItem}
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

      <div ref={searchContentRef} className="relative">
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
        onShowSettings={showSettings}
        onShowHistory={showHistory}
          micStatus={micStatus}
          screenStatus={screenStatus}
          onToggleScreenVision={toggleScreenVision}
          onToggleMicrophone={toggleMicrophone}
          isTranscribing={isTranscribing}
          permissionDenied={permissionDenied}
          chunksProcessed={chunksProcessed}
          onHeightChange={setSearchContentHeight}
        />

        {windowType === "single" && viewMode === "context" && (
          <ContextOverlay
            query={liveVoiceContext?.isLive ? "Contexto de Voz Ao Vivo" : (mockData?.query || "Query")}
            answer={liveVoiceContext?.isLive ? (liveVoiceContext.text || "") : (mockData?.answer || "No response")}
            sections={liveVoiceContext?.isLive ? [] : (mockData?.sections || [])}
            citations={liveVoiceContext?.isLive ? [] : (mockData?.citations || [])}
            voiceContext={liveVoiceContext}
            isLiveVoice={liveVoiceContext?.isLive || false}
          />
        )}

        {windowType === "single" && viewMode === "settings" && (
          <NeuralCenter
            settings={settings}
            onUpdateSettings={updateSettings}
            onResetSettings={resetSettingsState}
            onClearMemory={clearMemory}
          />
        )}

        {viewMode === "history" && windowType === "single" && (
          <ContextHistory
            refreshToken={historyRefreshToken}
            onOpenContext={openHistoryItem}
          />
        )}

        {viewMode === "collapsed" && <Footer />}
      </div>
    </MainContainer>
  );
}

export default App;
