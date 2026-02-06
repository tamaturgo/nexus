import PropTypes from 'prop-types';
import { FiCpu, FiDatabase, FiLock, FiToggleLeft, FiToggleRight, FiZap } from 'react-icons/fi';

const NeuralCenter = ({ 
  selectedProvider, 
  onSelectProvider,
  cpuLoad,
  activePlugins,
  onTogglePlugin
}) => {
  return (
    <div className="pt-2 pb-6 px-4 animate-in fade-in slide-in-from-top-4 duration-300">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-6 border-b border-white/10 pb-2">
        <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
          <FiZap className="text-purple-500" />
          Neural Center
        </h2>
        <span className="text-[10px] text-gray-500 font-mono">SYS.READY</span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        
        {/* 1. Model Selector Card */}
        <div className="col-span-2 bg-white/5 rounded-xl p-4 border border-white/10">
          <label className="text-[10px] font-bold text-gray-500 uppercase block mb-3">Active Model</label>
          <div className="grid grid-cols-3 gap-2">
            <ModelCard 
              name="Gemini Pro" 
              provider="Google"
              isActive={selectedProvider === 'gemini'} 
              onClick={() => onSelectProvider('gemini')}
            />
            <ModelCard 
              name="GPT-4o" 
              provider="OpenAI"
              isActive={selectedProvider === 'openai'} 
              onClick={() => onSelectProvider('openai')}
            />
            <ModelCard 
              name="Llama 3" 
              provider="Local"
              isActive={selectedProvider === 'local'} 
              onClick={() => onSelectProvider('local')}
              isLocal
            />
          </div>
        </div>

        {/* 2. Hardware Stats */}
        <div className="col-span-1 bg-white/5 rounded-xl p-4 border border-white/10">
          <label className="text-[10px] font-bold text-gray-500 uppercase block mb-3 flex items-center gap-2">
            <FiCpu className="w-3 h-3" /> System Load
          </label>
          
          <div className="space-y-3">
             {/* Simulação de barra de CPU */}
             <div>
               <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                 <span>CPU ({cpuLoad}%)</span>
                 <span>Normal</span>
               </div>
               <div className="h-1.5 w-full bg-black/50 rounded-full overflow-hidden">
                 <div 
                    className={`h-full rounded-full transition-all duration-500 ${cpuLoad > 80 ? 'bg-red-500' : 'bg-green-500'}`} 
                    style={{ width: `${cpuLoad}%` }}
                 />
               </div>
             </div>
             <div>
               <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                 <span>VRAM (4.2GB)</span>
                 <span>Using Shared</span>
               </div>
               <div className="h-1.5 w-full bg-black/50 rounded-full overflow-hidden">
                 <div className="h-full bg-purple-500/50 w-[40%] rounded-full" />
               </div>
             </div>
          </div>
        </div>

        {/* 3. MCP Integrations */}
        <div className="col-span-1 bg-white/5 rounded-xl p-4 border border-white/10">
           <label className="text-[10px] font-bold text-gray-500 uppercase block mb-3 flex items-center gap-2">
            <FiDatabase className="w-3 h-3" /> MCP Plugins
          </label>
          <div className="space-y-2">
            {activePlugins.map(plugin => (
              <div key={plugin.id} className="flex items-center justify-between group">
                <span className="text-xs text-gray-300">{plugin.name}</span>
                <button onClick={() => onTogglePlugin(plugin.id)} className="text-gray-400 hover:text-white transition-colors">
                  {plugin.active 
                    ? <FiToggleRight className="w-5 h-5 text-green-400" /> 
                    : <FiToggleLeft className="w-5 h-5" />}
                </button>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

const ModelCard = ({ name, provider, isActive, onClick, isLocal }) => (
  <div 
    onClick={onClick}
    className={`
      cursor-pointer p-3 rounded-lg border transition-all duration-200 relative overflow-hidden
      ${isActive ? 'bg-purple-500/10 border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.2)]' : 'bg-black/20 border-white/5 hover:border-white/20'}
    `}
  >
    <div className={`text-xs font-bold ${isActive ? 'text-white' : 'text-gray-400'}`}>{name}</div>
    <div className="text-[9px] text-gray-500 mt-1 uppercase tracking-wider">{provider}</div>
    {isLocal && (
       <div className="absolute top-1 right-1">
         <FiLock className="w-3 h-3 text-gray-600" />
       </div>
    )}
  </div>
);

NeuralCenter.propTypes = {
  selectedProvider: PropTypes.string,
  onSelectProvider: PropTypes.func,
  cpuLoad: PropTypes.number,
  activePlugins: PropTypes.array,
  onTogglePlugin: PropTypes.func
};

export default NeuralCenter;
