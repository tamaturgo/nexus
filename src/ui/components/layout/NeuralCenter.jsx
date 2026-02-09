import PropTypes from "prop-types";
import { useState } from "react";
import {
  FiCpu,
  FiMic,
  FiSliders,
  FiDatabase,
  FiRefreshCcw,
  FiTrash2,
  FiMinus
} from "react-icons/fi";

const modelOptions = [
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro" }
];

const inputOptions = [
  { value: "both", label: "Microfone + Sistema" },
  { value: "mic", label: "Somente microfone" },
  { value: "system", label: "Somente sistema" }
];

const NeuralCenter = ({
  settings,
  onUpdateSettings,
  onResetSettings,
  onClearMemory,
  onMinimize
}) => {
  const [confirmClear, setConfirmClear] = useState(false);

  const handleClearMemory = async () => {
    if (!confirmClear) {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 4000);
      return;
    }
    setConfirmClear(false);
    await onClearMemory?.();
  };

  const updateAudio = (patch) => onUpdateSettings?.({ audio: patch });
  const updateAi = (patch) => onUpdateSettings?.({ ai: patch });
  const updateMemory = (patch) => onUpdateSettings?.({ memory: patch });

  return (
    <div className="pt-2 pb-6 px-4 animate-in fade-in slide-in-from-top-4 duration-300 max-h-[620px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent" style={{ WebkitAppRegion: "no-drag" }}>
      <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-2" style={{ WebkitAppRegion: "drag" }}>
        <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
          <FiSliders className="text-purple-400" />
          Settings
        </h2>
        <div className="flex items-center gap-2" style={{ WebkitAppRegion: "no-drag" }}>
          <span className="text-[10px] text-gray-500 font-mono">SYS.CONFIG</span>
          {onMinimize && (
            <button
              onClick={onMinimize}
              className="w-7 h-7 inline-flex items-center justify-center rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Minimizar"
              title="Minimizar"
            >
              <FiMinus className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <section className="bg-white/5 rounded-xl p-4 border border-white/10">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-300 uppercase mb-3">
            <FiMic className="w-3 h-3" /> Audio
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-gray-400 col-span-2">Fonte de entrada</label>
            <select
              value={settings.audio?.inputDevice || "both"}
              onChange={(e) => updateAudio({ inputDevice: e.target.value })}
              className="col-span-2 bg-black/40 text-gray-200 text-sm rounded-md px-3 py-2 border border-white/10 focus:outline-none"
            >
              {inputOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            <label className="text-xs text-gray-400 col-span-2">Sensibilidade de silencio</label>
            <input
              type="range"
              min="0.001"
              max="0.05"
              step="0.001"
              value={settings.audio?.silenceThreshold ?? 0.01}
              onChange={(e) => updateAudio({ silenceThreshold: Number(e.target.value) })}
              className="col-span-2"
            />
            <div className="text-[10px] text-gray-500 col-span-2">
              Threshold atual: {Number(settings.audio?.silenceThreshold ?? 0.01).toFixed(3)}
            </div>

            <label className="text-xs text-gray-400 col-span-2">Silencio minimo (ms)</label>
            <input
              type="range"
              min="200"
              max="2500"
              step="50"
              value={settings.audio?.silenceMs ?? 700}
              onChange={(e) => updateAudio({ silenceMs: Number(e.target.value) })}
              className="col-span-2"
            />
            <div className="text-[10px] text-gray-500 col-span-2">
              {settings.audio?.silenceMs ?? 700} ms
            </div>
          </div>
        </section>

        <section className="bg-white/5 rounded-xl p-4 border border-white/10">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-300 uppercase mb-3">
            <FiCpu className="w-3 h-3" /> IA
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-gray-400 col-span-2">Provider</label>
            <select
              value={settings.ai?.provider || "gemini"}
              onChange={(e) => updateAi({ provider: e.target.value })}
              className="col-span-2 bg-black/40 text-gray-200 text-sm rounded-md px-3 py-2 border border-white/10 focus:outline-none"
            >
              <option value="gemini">Gemini</option>
            </select>

            <label className="text-xs text-gray-400 col-span-2">Modelo</label>
            <select
              value={settings.ai?.model || "gemini-2.5-flash"}
              onChange={(e) => updateAi({ model: e.target.value })}
              className="col-span-2 bg-black/40 text-gray-200 text-sm rounded-md px-3 py-2 border border-white/10 focus:outline-none"
            >
              {modelOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            <label className="text-xs text-gray-400 col-span-2">Temperatura</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settings.ai?.temperature ?? 0.7}
              onChange={(e) => updateAi({ temperature: Number(e.target.value) })}
              className="col-span-2"
            />
            <div className="text-[10px] text-gray-500 col-span-2">
              {Number(settings.ai?.temperature ?? 0.7).toFixed(2)}
            </div>
          </div>
        </section>

        <section className="bg-white/5 rounded-xl p-4 border border-white/10">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-300 uppercase mb-3">
            <FiDatabase className="w-3 h-3" /> Memoria
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-gray-400 col-span-2">Auto salvar transcricao</label>
            <button
              onClick={() => updateMemory({ autoSaveTranscription: !settings.memory?.autoSaveTranscription })}
              className="col-span-2 text-left bg-black/40 text-gray-200 text-sm rounded-md px-3 py-2 border border-white/10 focus:outline-none"
            >
              {settings.memory?.autoSaveTranscription ? "Ativo" : "Desativado"}
            </button>

            <label className="text-xs text-gray-400 col-span-2">Retencao (dias)</label>
            <input
              type="number"
              min="1"
              max="365"
              value={settings.memory?.retentionDays ?? 30}
              onChange={(e) => updateMemory({ retentionDays: Number(e.target.value) })}
              className="col-span-2 bg-black/40 text-gray-200 text-sm rounded-md px-3 py-2 border border-white/10 focus:outline-none"
            />

            <label className="text-xs text-gray-400 col-span-2">Maximo de itens</label>
            <input
              type="number"
              min="50"
              max="5000"
              value={settings.memory?.maxItems ?? 500}
              onChange={(e) => updateMemory({ maxItems: Number(e.target.value) })}
              className="col-span-2 bg-black/40 text-gray-200 text-sm rounded-md px-3 py-2 border border-white/10 focus:outline-none"
            />
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={handleClearMemory}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-xs border transition-colors ${
                confirmClear
                  ? "border-red-400 text-red-300 bg-red-500/10"
                  : "border-white/10 text-gray-300 bg-black/40 hover:bg-white/10"
              }`}
            >
              <FiTrash2 className="w-3 h-3" />
              {confirmClear ? "Confirmar limpeza total" : "Limpar memoria (total)"}
            </button>

            <button
              onClick={onResetSettings}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-xs border border-white/10 text-gray-300 bg-black/40 hover:bg-white/10"
            >
              <FiRefreshCcw className="w-3 h-3" />
              Reset settings
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

NeuralCenter.propTypes = {
  settings: PropTypes.object.isRequired,
  onUpdateSettings: PropTypes.func,
  onResetSettings: PropTypes.func,
  onClearMemory: PropTypes.func,
  onMinimize: PropTypes.func
};

export default NeuralCenter;
