import PropTypes from 'prop-types';
import { useState, useEffect, useRef } from 'react';
import { FiClipboard, FiX, FiSend, FiSettings, FiEye, FiEyeOff, FiMic, FiClock } from 'react-icons/fi';
import ActionButton from '../common/ActionButton';
import InputField from '../common/InputField';

const Waveform = ({ isActive }) => (
  <div className={`flex items-center gap-[2px] h-4 ${isActive ? 'opacity-100' : 'opacity-40'}`}>
     <div className={`w-[2px] bg-purple-500 rounded-full transition-all duration-300 ${isActive ? 'h-3 animate-pulse' : 'h-1'}`} />
     <div className={`w-[2px] bg-purple-500 rounded-full transition-all duration-300 delay-75 ${isActive ? 'h-4 animate-pulse' : 'h-1.5'}`} />
     <div className={`w-[2px] bg-purple-500 rounded-full transition-all duration-300 delay-150 ${isActive ? 'h-2 animate-pulse' : 'h-1'}`} />
     <div className={`w-[2px] bg-purple-500 rounded-full transition-all duration-300 delay-100 ${isActive ? 'h-3 animate-pulse' : 'h-1'}`} />
  </div>
);

Waveform.propTypes = {
  isActive: PropTypes.bool
};

const SearchBar = ({
  inputValue,
  onInputChange,
  onSubmit,
  onKeyDown,
  isProcessing,
  inputRef,
  onCopyToClipboard,
  onClearInput,
  onShowSettings,
  onShowHistory,
  micStatus,
  screenStatus,
  onToggleScreenVision,
  onToggleMicrophone,
  isTranscribing,
  permissionDenied,
  chunksProcessed,
  onHeightChange
}) => {
  const [placeholder, setPlaceholder] = useState("Ask me anything...");
  const containerRef = useRef(null);
  
  useEffect(() => {
    const placeholders = [
      "Ask me anything...",
      "Summarize this meeting...",
      "What was decided?",
      "Analyze this screen..."
    ];
    let index = 0;
    const interval = setInterval(() => {
      if (!micStatus && !isTranscribing) {
        index = (index + 1) % placeholders.length;
        setPlaceholder(placeholders[index]);
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [micStatus, isTranscribing]);

  useEffect(() => {
    if (!containerRef.current || !onHeightChange) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      onHeightChange(Math.ceil(entry.contentRect.height));
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [onHeightChange]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputValue.trim() || isProcessing) return;
    onSubmit(e);
  };

  const hasInput = inputValue.length > 0;

  return (
    <div className="relative" style={{ WebkitAppRegion: 'drag' }}>
      {/* Área de input */}
      <div ref={containerRef} className="p-3">
        <form onSubmit={handleSubmit} className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <InputField
              value={inputValue}
              onChange={onInputChange}
              onKeyDown={onKeyDown}
              inputRef={inputRef}
              placeholder={placeholder}
              icon={() => <Waveform isActive={micStatus} />}
              maxHeight={160}
            />
          </div>

          {/* Controles à direita */}
          <div 
            className="flex items-center gap-1 pt-1 ml-auto justify-end min-w-[200px]"
            style={{ WebkitAppRegion: 'no-drag' }}
          >
            <ActionButton
              onClick={onToggleScreenVision}
              title={screenStatus ? "Vision On" : "Vision Off"}
              className={screenStatus ? "text-green-400" : "text-gray-400"}
            >
              {screenStatus ? <FiEye className="w-4 h-4" /> : <FiEyeOff className="w-4 h-4" />}
            </ActionButton>
            
            {/* Microphone Toggle */}
            <ActionButton
              onClick={onToggleMicrophone}
              title={
                permissionDenied 
                  ? "Clique para permitir microfone" 
                  : micStatus 
                    ? "Parar captura de voz" 
                    : "Iniciar captura de voz"
              }
              className={
                permissionDenied 
                  ? "text-yellow-400" 
                  : micStatus 
                    ? "text-red-400 animate-pulse" 
                    : "text-gray-400"
              }
            >
              <FiMic className="w-4 h-4" />
            </ActionButton>
            
            <div className="w-px h-4 bg-white bg-opacity-10 mx-1" />

            {hasInput ? (
              <>
                <ActionButton
                  onClick={onCopyToClipboard}
                  title="Copiar"
                >
                  <FiClipboard className="w-4 h-4" />
                </ActionButton>

                <ActionButton
                  onClick={onClearInput}
                  title="Limpar"
                >
                  <FiX className="w-4 h-4" />
                </ActionButton>
              </>
            ) : (
              <>
                <ActionButton
                  onClick={onShowSettings}
                  disabled={isProcessing}
                  title="Configurações"
                >
                  <FiSettings className="w-4 h-4" />
                </ActionButton>

                <ActionButton
                  onClick={onShowHistory}
                  disabled={isProcessing}
                  title="Histórico"
                >
                  <FiClock className="w-4 h-4" />
                </ActionButton>
              </>
            )}

            <div className="w-px h-6 bg-white bg-opacity-10 mx-2" />

            <ActionButton
              onClick={handleSubmit}
              disabled={!inputValue.trim() || isProcessing || isTranscribing}
              variant="primary"
              title="Executar"
            >
              {isProcessing ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <FiSend className="w-4 h-4" />
              )}
            </ActionButton>
          </div>
        </form>
      </div>
    </div>
  );
};

SearchBar.propTypes = {
  inputValue: PropTypes.string.isRequired,
  onInputChange: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  onKeyDown: PropTypes.func,
  isProcessing: PropTypes.bool,
  inputRef: PropTypes.object,
  onCopyToClipboard: PropTypes.func.isRequired,
  onClearInput: PropTypes.func.isRequired,
  onShowSettings: PropTypes.func.isRequired,
  onShowHistory: PropTypes.func.isRequired,
  micStatus: PropTypes.bool,
  screenStatus: PropTypes.bool,
  onToggleScreenVision: PropTypes.func,
  onToggleMicrophone: PropTypes.func.isRequired,
  isTranscribing: PropTypes.bool,
  permissionDenied: PropTypes.bool,
  chunksProcessed: PropTypes.number,
  onHeightChange: PropTypes.func
};

export default SearchBar;
