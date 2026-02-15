import PropTypes from 'prop-types';
import { FiPlay, FiCpu, FiCheck, FiX, FiLayers, FiMinus, FiList, FiCode, FiFileText, FiMic } from 'react-icons/fi';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Componente customizado para renderizar markdown com estilos do tema
const MarkdownRenderer = ({ content }) => {
  // Validação de conteúdo
  if (!content || typeof content !== 'string') {
    return <p className="text-sm text-gray-400 italic">No content available</p>;
  }

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // Headers
        h1: ({ children }) => (
          <h1 className="text-lg font-bold text-gray-200 mb-3 mt-4 first:mt-0">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-base font-semibold text-gray-200 mb-2 mt-3">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-sm font-semibold text-gray-200 mb-2 mt-3">{children}</h3>
        ),
        h4: ({ children }) => (
          <h4 className="text-sm font-medium text-gray-300 mb-1 mt-2">{children}</h4>
        ),

        // Parágrafos
        p: ({ children }) => (
          <p className="text-sm text-gray-300 leading-relaxed mb-3 last:mb-0">{children}</p>
        ),

        // Listas
        ul: ({ children }) => (
          <ul className="text-sm text-gray-300 leading-relaxed mb-3 space-y-1">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="text-sm text-gray-300 leading-relaxed mb-3 space-y-1">{children}</ol>
        ),
        li: ({ children }) => (
          <li className="flex items-start gap-2">
            <span className="text-purple-400 mt-1.5 text-xs">•</span>
            <span className="flex-1">{children}</span>
          </li>
        ),

        // Código inline
        code: ({ inline, children }) => {
          if (inline) {
            return (
              <code className="bg-gray-800 text-purple-300 px-1.5 py-0.5 rounded text-xs font-mono">
                {children}
              </code>
            );
          }
          return (
            <code className="block bg-gray-800 text-gray-200 p-3 rounded-md text-xs font-mono overflow-x-auto">
              {children}
            </code>
          );
        },

        // Blocos de código
        pre: ({ children }) => (
          <pre className="bg-gray-800 text-gray-200 p-3 rounded-md text-xs font-mono overflow-x-auto mb-3">
            {children}
          </pre>
        ),

        // Links
        a: ({ href, children }) => (
          <a
            href={href}
            className="text-purple-400 hover:text-purple-300 underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            {children}
          </a>
        ),

        // Ênfase
        strong: ({ children }) => (
          <strong className="font-semibold text-gray-200">{children}</strong>
        ),
        em: ({ children }) => (
          <em className="italic text-gray-300">{children}</em>
        ),

        // Citações
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-purple-500/50 pl-4 py-2 my-3 bg-purple-500/5 rounded-r-md">
            <div className="text-sm text-gray-400 italic">{children}</div>
          </blockquote>
        ),

        // Tabelas
        table: ({ children }) => (
          <div className="overflow-x-auto mb-3">
            <table className="min-w-full text-sm text-gray-300 border-collapse border border-gray-700">
              {children}
            </table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-gray-800">{children}</thead>
        ),
        tbody: ({ children }) => (
          <tbody className="divide-y divide-gray-700">{children}</tbody>
        ),
        tr: ({ children }) => (
          <tr className="hover:bg-gray-800/50">{children}</tr>
        ),
        th: ({ children }) => (
          <th className="px-3 py-2 text-left font-semibold text-gray-200 border border-gray-700">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="px-3 py-2 border border-gray-700">{children}</td>
        ),

        // Linha horizontal
        hr: () => (
          <hr className="border-gray-700 my-4" />
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
};

const ContextOverlay = ({ query, answer, sections = [], citations = [], voiceContext, isLiveVoice, onMinimize }) => {
  
  // Debug logs
  console.log('ContextOverlay render:', { isLiveVoice, hasVoiceContext: !!voiceContext, voiceText: voiceContext?.text });

  const renderSection = (section, index) => {
    const { title, content, type } = section;

    // Ícone baseado no tipo
    const getIcon = () => {
      switch(type) {
        case 'list': return <FiList className="w-4 h-4" />;
        case 'code': return <FiCode className="w-4 h-4" />;
        case 'steps': return <FiList className="w-4 h-4" />;
        default: return <FiFileText className="w-4 h-4" />;
      }
    };

    return (
      <div key={index} className="mb-4 border-l-2 border-purple-500/30 pl-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-purple-400">{getIcon()}</span>
          <h4 className="text-sm font-semibold text-gray-300">{title}</h4>
        </div>
        <div className="text-sm text-gray-400 leading-relaxed">
          <MarkdownRenderer content={content} />
        </div>
      </div>
    );
  };

  return (
    <div
      className="pt-2 pb-6 px-4 animate-in fade-in slide-in-from-top-4 duration-300 max-h-[620px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent"
      style={{ WebkitAppRegion: 'no-drag' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between mb-3"
        style={{ WebkitAppRegion: 'drag' }}
      >
        <div className="text-xs font-mono text-gray-500 uppercase tracking-wider flex items-center gap-2">
            AI Response
        </div>
        <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' }}>
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

      {/* 1. User Query (Recap) */}
      <div className="mb-4 text-xs font-mono text-gray-500 uppercase tracking-wider flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
        {isLiveVoice ? (
          <span className="flex items-center gap-2">
            <FiMic className="w-3 h-3 animate-pulse text-red-400" />
            Live Capture
          </span>
        ) : (
          `Your Question: ${query}`
        )}
      </div>

      {/* Voice Context - Live Mode */}
      {isLiveVoice && voiceContext && (
        <div className="mb-4">
          <div className="p-4 bg-gradient-to-br from-purple-500/20 to-purple-900/20 border border-purple-500/40 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <FiMic className="text-purple-400 w-5 h-5 animate-pulse" />
              <span className="text-sm font-semibold text-purple-300">
                Insights Ao Vivo
              </span>

              {voiceContext?.source && (
                <span className="ml-auto text-[10px] uppercase tracking-wider text-gray-400">
                  Fonte: {voiceContext.source === "system" ? "Sistema" : "Microfone"}
                </span>
              )}
            </div>

            {voiceContext?.insight ? (
              <div className="max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-purple-500 scrollbar-track-transparent space-y-3">
                <div className="rounded-md border border-white/10 bg-black/20 p-3">
                  <div className="text-[11px] uppercase tracking-wider text-purple-300 mb-1">
                    Comentarios do Modelo
                  </div>
                  {Array.isArray(voiceContext.insight.comments) && voiceContext.insight.comments.length > 0 ? (
                    <ul className="space-y-1">
                      {voiceContext.insight.comments.slice(-10).reverse().map((comment, index) => (
                        <li key={`${comment}-${index}`} className="text-sm text-gray-200 leading-relaxed">
                          - {comment}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-400 italic">Sem comentarios adicionais no momento.</p>
                  )}
                </div>

                <div className="rounded-md border border-white/10 bg-black/20 p-3">
                  <div className="text-[11px] uppercase tracking-wider text-purple-300 mb-1">
                    Resumo Evolutivo
                  </div>
                  <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap max-h-36 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
                    {voiceContext.insight.summary
                      ? (voiceContext.insight.summary.length > 700
                          ? `${voiceContext.insight.summary.slice(0, 700)}...`
                          : voiceContext.insight.summary)
                      : "Aguardando resumo relevante..."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-purple-500 scrollbar-track-transparent">
                {voiceContext.text ? (
                  <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">
                    {voiceContext.text}
                  </p>
                ) : (
                  <p className="text-sm text-gray-400 italic">
                    Aguardando audio... Fale no microfone.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Voice Context - Histórico */}
      {!isLiveVoice && voiceContext && (
        <div className="mb-4 p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <FiMic className="text-purple-400 w-4 h-4" />
            <span className="text-xs font-semibold text-purple-300">
              Captura de Voz
            </span>
            <span className="text-xs text-gray-500 ml-auto">
              {voiceContext.chunksProcessed || 0} chunks processados
            </span>
          </div>
          <p className="text-sm text-gray-300 italic">
            "{voiceContext.text?.substring(0, 200)}{voiceContext.text?.length > 200 ? '...' : ''}"
          </p>
          <div className="mt-2 text-xs text-gray-500">
            Capturado em: {new Date(voiceContext.timestamp).toLocaleTimeString('pt-BR')}
          </div>
        </div>
      )}

      {/* 2. AI Response Block - Só mostrar se não for live */}
      {!isLiveVoice && (
        <div className="mb-4 text-gray-200 text-sm leading-relaxed font-light">
          <MarkdownRenderer content={answer} />
        </div>
      )}

      {/* 3. Sections (if available) */}
      {!isLiveVoice && sections && sections.length > 0 && (
        <div className="mb-6 space-y-2">
          {sections.map((section, index) => renderSection(section, index))}
        </div>
      )}

      {/* 4. Citations (if available) */}
      {!isLiveVoice && citations && citations.length > 0 && (
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

      {/* 5. Quick Actions Footer */}
      {!isLiveVoice && (
        <div className="flex gap-2 border-t border-white/10 pt-4">
          <QuickActionButton label="Gerar Resumo" />
          <QuickActionButton label="Enviar por Email" />
          <QuickActionButton label="Copiar Código" />
        </div>
      )}
    </div>
  );
};

const QuickActionButton = ({ label }) => (
  <button className="px-3 py-1.5 rounded-md bg-white/5 hover:bg-white/10 text-xs text-gray-300 transition-colors border border-white/5 hover:border-white/20">
    {label}
  </button>
);

MarkdownRenderer.propTypes = {
  content: PropTypes.string
};

QuickActionButton.propTypes = {
  label: PropTypes.string.isRequired
};

ContextOverlay.propTypes = {
  query: PropTypes.string,
  answer: PropTypes.string,
  sections: PropTypes.arrayOf(PropTypes.shape({
    title: PropTypes.string,
    content: PropTypes.string,
    type: PropTypes.oneOf(['text', 'list', 'code', 'steps'])
  })),
  citations: PropTypes.arrayOf(PropTypes.shape({
    source: PropTypes.string,
    relevance: PropTypes.string
  })),
  voiceContext: PropTypes.shape({
    timestamp: PropTypes.number,
    text: PropTypes.string,
    chunksProcessed: PropTypes.number,
    isLive: PropTypes.bool,
    source: PropTypes.oneOf(['mic', 'system']),
    insight: PropTypes.shape({
      summary: PropTypes.string,
      comments: PropTypes.arrayOf(PropTypes.string),
      rawRecentChunk: PropTypes.string,
      snapshot: PropTypes.string,
      displayText: PropTypes.string,
      insightType: PropTypes.string,
      relevanceScore: PropTypes.number,
      timestamp: PropTypes.number
    })
  }),
  isLiveVoice: PropTypes.bool,
  onMinimize: PropTypes.func
};

export default ContextOverlay;




