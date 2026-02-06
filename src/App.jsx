import { useState, useEffect } from 'react';
import { Header, Footer, SearchBar, MainContainer } from './components';
import ContextOverlay from './components/layout/ContextOverlay';
import NeuralCenter from './components/layout/NeuralCenter';
import { useAssistant } from './hooks/useAssistant';

function App() {
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
    viewMode,
    mockData,
    settings,
    setSelectedProvider,
    togglePlugin
  } = useAssistant();

  const [isFocused, setIsFocused] = useState(false);

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

  return (
    <MainContainer isFocused={isFocused}>
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
      />

      {/* Dynamic Content Views */}
      <div className="relative">
         {/* Context Overlay View */}
         {viewMode === 'context' && (
           <ContextOverlay 
             query={mockData.query}
             answer={mockData.answer}
             citations={mockData.citations}
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

      {/* Footer (Only in collapsed mode) */}
      {viewMode === 'collapsed' && <Footer />}
    </MainContainer>
  );
}

export default App;
