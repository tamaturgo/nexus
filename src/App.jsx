import { useState, useEffect } from "react";
import { Header, Footer, SearchBar, MainContainer } from "./ui/components";
import ContextOverlay from "./ui/components/layout/ContextOverlay";
import NeuralCenter from "./ui/components/layout/NeuralCenter";
import NotesHub from "./ui/components/layout/NotesHub";
import ErrorToast from "./ui/components/common/ErrorToast";
import { useAssistant } from "./ui/hooks/useAssistant";
import {
  isElectron as bridgeIsElectron,
  getWindowType,
  getContextData,
  onContextData,
  resizeWindow,
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
    showSettings,
    showNotes,
    micStatus,
    toggleMicrophone,
    isTranscribing,
    voiceError,
    permissionDenied,
    chunksProcessed,
    viewMode,
    mockData,
    settings,
    updateSettings,
    resetSettingsState,
    clearMemory,
    inputMode,
    quickNoteFeedback,
    selectInputMode
  } = useAssistant({ windowType, isElectron });

  const [isFocused, setIsFocused] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    if (voiceError) {
      setErrorMessage(voiceError);
      const timer = setTimeout(() => setErrorMessage(null), 5000);
      return () => clearTimeout(timer);
    }
    return undefined;
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
      resizeWindow(WIDTH, 220);
    }
    if (windowType === "context") {
      resizeWindow(WIDTH, 720);
    }
  }, [isElectron, windowType]);

  if (windowType === "context") {
    const finalAnswer = typeof contextData.answer === "string"
      ? contextData.answer
      : (contextData.answer?.answer || JSON.stringify(contextData.answer || ""));

    return (
      <MainContainer isFocused={isFocused}>
        <ContextOverlay
          query={contextData.query}
          answer={finalAnswer}
          sections={contextData.sections || []}
          citations={contextData.citations || []}
          voiceContext={contextData.voiceContext}
          isLiveVoice={false}
          onMinimize={handleMinimizeWindow}
        />
      </MainContainer>
    );
  }

  if (windowType === "settings") {
    return (
      <MainContainer isFocused={isFocused} variant="window">
        <NeuralCenter
          settings={settings}
          onUpdateSettings={updateSettings}
          onResetSettings={resetSettingsState}
          onClearMemory={clearMemory}
          onMinimize={handleMinimizeWindow}
          fullScreen
        />
      </MainContainer>
    );
  }

  if (windowType === "notes") {
    return (
      <MainContainer isFocused={isFocused} variant="window">
        <NotesHub onMinimize={handleMinimizeWindow} />
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
        onShowSettings={showSettings}
        onShowNotes={showNotes}
        micStatus={micStatus}
        onToggleMicrophone={toggleMicrophone}
        isTranscribing={isTranscribing}
        permissionDenied={permissionDenied}
        chunksProcessed={chunksProcessed}
        inputMode={inputMode}
        onSelectInputMode={selectInputMode}
        quickNoteFeedback={quickNoteFeedback}
      />

      {windowType === "single" && viewMode === "context" && (
        <ContextOverlay
          query={mockData?.query || "Query"}
          answer={mockData?.answer || "No response"}
          sections={mockData?.sections || []}
          citations={mockData?.citations || []}
          voiceContext={mockData?.voiceContext || null}
          isLiveVoice={false}
        />
      )}

      {windowType === "single" && viewMode === "settings" && (
        <NeuralCenter
          settings={settings}
          onUpdateSettings={updateSettings}
          onResetSettings={resetSettingsState}
          onClearMemory={clearMemory}
          fullScreen
        />
      )}

      {windowType === "single" && viewMode === "notes" && (
        <NotesHub />
      )}

      {viewMode === "collapsed" && <Footer />}
    </MainContainer>
  );
}

export default App;
