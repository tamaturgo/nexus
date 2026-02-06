import PropTypes from 'prop-types';
import { FiPlay, FiCpu, FiCheck, FiX, FiLayers } from 'react-icons/fi';
import ActionButton from '../common/ActionButton';

const ContextOverlay = ({ query, answer, citations }) => {
  return (
    <div className="pt-2 pb-6 px-4 animate-in fade-in slide-in-from-top-4 duration-300">
      {/* 1. User Query (Recap) */}
      <div className="mb-4 text-xs font-mono text-gray-500 uppercase tracking-wider flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
        Contexto: {query}
      </div>

      {/* 2. AI Response Block */}
      <div className="mb-6 text-gray-200 text-sm leading-relaxed font-light whitespace-pre-line">
        {answer}
      </div>

      {/* 3. Evidence Carousel */}
      {citations && citations.length > 0 && (
        <div className="mb-6">
          <h3 className="text-[10px] font-bold text-gray-600 uppercase mb-2 ml-1">Evidence Sources</h3>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x">
            {citations.map((cite) => (
              <div 
                key={cite.id}
                className="snap-start shrink-0 w-[140px] group cursor-pointer relative rounded-lg border border-white/10 bg-black/40 overflow-hidden hover:border-purple-500/50 transition-all duration-300"
              >
                {/* Thumbnail */}
                <div className="h-[80px] bg-gray-900 overflow-hidden relative opacity-60 group-hover:opacity-100 transition-opacity">
                   {cite.img ? (
                     <img src={cite.img} alt="Evidence" className="w-full h-full object-cover" />
                   ) : (
                     <div className="w-full h-full flex items-center justify-center text-gray-700">
                        <FiLayers className="w-6 h-6" />
                     </div>
                   )}
                   {/* Play Overlay */}
                   <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                     <FiPlay className="w-6 h-6 text-white drop-shadow-lg" />
                   </div>
                </div>
                
                {/* Timestamp Badge */}
                <div className="absolute top-1 right-1 bg-black/80 text-[9px] text-green-400 px-1.5 py-0.5 rounded font-mono border border-green-900/30">
                  {cite.timestamp}
                </div>

                {/* Caption */}
                <div className="p-2 border-t border-white/5">
                  <div className="text-[10px] text-gray-400 truncate font-mono">
                    {cite.snippet}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Quick Actions Footer */}
      <div className="flex gap-2 border-t border-white/10 pt-4">
        <QuickActionButton label="Gerar Resumo" />
        <QuickActionButton label="Enviar por Email" />
        <QuickActionButton label="Copiar Código" />
      </div>
    </div>
  );
};

const QuickActionButton = ({ label }) => (
  <button className="px-3 py-1.5 rounded-md bg-white/5 hover:bg-white/10 text-xs text-gray-300 transition-colors border border-white/5 hover:border-white/20">
    {label}
  </button>
);

ContextOverlay.propTypes = {
  query: PropTypes.string,
  answer: PropTypes.string,
  citations: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.number,
    timestamp: PropTypes.string,
    img: PropTypes.string,
    snippet: PropTypes.string
  }))
};

export default ContextOverlay;
