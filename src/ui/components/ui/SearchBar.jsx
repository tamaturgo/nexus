import PropTypes from "prop-types";
import { useState, useEffect } from "react";
import {
  FiClipboard,
  FiX,
  FiSend,
  FiSettings,
  FiMic,
  FiBookOpen,
  FiSearch,
  FiEdit3
} from "react-icons/fi";
import ActionButton from "../common/ActionButton";
import InputField from "../common/InputField";

const QUICK_NOTE = "quick-note";
const SEARCH = "search";

const Waveform = ({ isActive }) => (
  <div className={`flex items-center gap-[2px] h-4 ${isActive ? "opacity-100" : "opacity-40"}`}>
    <div className={`w-[2px] bg-purple-500 rounded-full transition-all duration-300 ${isActive ? "h-3 animate-pulse" : "h-1"}`} />
    <div className={`w-[2px] bg-purple-500 rounded-full transition-all duration-300 delay-75 ${isActive ? "h-4 animate-pulse" : "h-1.5"}`} />
    <div className={`w-[2px] bg-purple-500 rounded-full transition-all duration-300 delay-150 ${isActive ? "h-2 animate-pulse" : "h-1"}`} />
    <div className={`w-[2px] bg-purple-500 rounded-full transition-all duration-300 delay-100 ${isActive ? "h-3 animate-pulse" : "h-1"}`} />
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
  onShowNotes,
  micStatus,
  onToggleMicrophone,
  isTranscribing,
  permissionDenied,
  chunksProcessed,
  inputMode,
  onSelectInputMode,
  quickNoteFeedback
}) => {
  const [placeholder, setPlaceholder] = useState("Capture uma nota rapida...");

  useEffect(() => {
    const searchPlaceholders = [
      "Pergunte usando suas notas e memoria...",
      "O que foi decidido sobre o projeto?",
      "Resuma os ultimos pontos importantes..."
    ];
    const notePlaceholders = [
      "Capture uma nota rapida...",
      "Ex.: Ligar para cliente amanha as 10h",
      "Ex.: Ideia para feature de onboarding"
    ];

    const options = inputMode === SEARCH ? searchPlaceholders : notePlaceholders;
    setPlaceholder(options[0]);

    let index = 0;
    const interval = setInterval(() => {
      if (!micStatus && !isTranscribing) {
        index = (index + 1) % options.length;
        setPlaceholder(options[index]);
      }
    }, 3800);

    return () => clearInterval(interval);
  }, [inputMode, micStatus, isTranscribing]);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!inputValue.trim() || (isProcessing && !isQuickNote)) return;
    onSubmit(event);
  };

  const hasInput = inputValue.length > 0;
  const isQuickNote = inputMode === QUICK_NOTE;

  return (
    <div className="relative" data-tauri-drag-region style={{ WebkitAppRegion: 'drag' }}>
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

          <div
            className="flex items-center gap-1 pt-1 ml-auto justify-end min-w-[220px]"
            style={{ WebkitAppRegion: "no-drag" }}
          >
            <ActionButton
              onClick={onToggleMicrophone}
              title={
                permissionDenied
                  ? "Clique para permitir microfone"
                  : micStatus
                    ? "Parar gravacao"
                    : "Iniciar gravacao"
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
                  title="Configuracoes"
                >
                  <FiSettings className="w-4 h-4" />
                </ActionButton>

                <ActionButton
                  onClick={onShowNotes}
                  disabled={isProcessing}
                  title="Notas"
                >
                  <FiBookOpen className="w-4 h-4" />
                </ActionButton>
              </>
            )}

            <div className="w-px h-6 bg-white bg-opacity-10 mx-2" />

            <ActionButton
              onClick={handleSubmit}
              disabled={!inputValue.trim() || (isProcessing && !isQuickNote) || isTranscribing}
              variant="primary"
              title={isQuickNote ? "Salvar quick note" : "Pesquisar"}
            >
              {isProcessing ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <FiSend className="w-4 h-4" />
              )}
            </ActionButton>
          </div>
        </form>

        {quickNoteFeedback?.message && (
          <div
            className={`mt-2 text-xs px-3 py-2 rounded-md border ${
              quickNoteFeedback.type === "success"
                ? "text-emerald-200 border-emerald-400/30 bg-emerald-500/10"
                : quickNoteFeedback.type === "error"
                  ? "text-red-200 border-red-400/30 bg-red-500/10"
                  : "text-gray-300 border-white/10 bg-black/20"
            }`}
            style={{ WebkitAppRegion: "no-drag" }}
          >
            {quickNoteFeedback.message}
          </div>
        )}
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
  onShowNotes: PropTypes.func.isRequired,
  micStatus: PropTypes.bool,
  onToggleMicrophone: PropTypes.func.isRequired,
  isTranscribing: PropTypes.bool,
  permissionDenied: PropTypes.bool,
  chunksProcessed: PropTypes.number,
  inputMode: PropTypes.oneOf([QUICK_NOTE, SEARCH]).isRequired,
  onSelectInputMode: PropTypes.func.isRequired,
  quickNoteFeedback: PropTypes.shape({
    type: PropTypes.string,
    message: PropTypes.string
  })
};

export default SearchBar;
