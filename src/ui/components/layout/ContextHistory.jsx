import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { FiClock, FiStar, FiTrash2, FiSearch, FiMinus } from "react-icons/fi";
import {
  loadHistory,
  toggleFavorite,
  deleteHistoryItem
} from "../../../app/context/contextHistory.js";

const ContextHistory = ({ onOpenContext, refreshToken = 0, onMinimize }) => {
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState("");
  const [onlyFavorites, setOnlyFavorites] = useState(false);

  useEffect(() => {
    let mounted = true;
    loadHistory?.().then((data) => {
      if (!mounted || !Array.isArray(data)) return;
      setItems(data);
    });
    return () => {
      mounted = false;
    };
  }, [refreshToken]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (onlyFavorites && !item.favorite) return false;
      if (!q) return true;
      const text = JSON.stringify(item.payload || {}).toLowerCase();
      return text.includes(q);
    });
  }, [items, query, onlyFavorites]);

  const handleToggleFavorite = async (contextId) => {
    const updated = await toggleFavorite?.(contextId);
    if (!updated) return;
    setItems((prev) =>
      prev.map((item) => item.contextId === updated.contextId ? updated : item)
    );
  };

  const handleDelete = async (contextId) => {
    await deleteHistoryItem?.(contextId);
    setItems((prev) => prev.filter((item) => item.contextId !== contextId));
  };

  return (
    <div className="pt-2 pb-6 px-4 animate-in fade-in slide-in-from-top-4 duration-300" style={{ WebkitAppRegion: "no-drag" }}>
      <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-2" style={{ WebkitAppRegion: "drag" }}>
        <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
          <FiClock className="text-purple-400" />
          Historico de Contextos
        </h2>
        <div className="flex items-center gap-2" style={{ WebkitAppRegion: "no-drag" }}>
          <button
            onClick={() => setOnlyFavorites(prev => !prev)}
            className={`text-xs px-3 py-1 rounded-md border transition-colors ${
              onlyFavorites ? "border-purple-400 text-purple-300 bg-purple-500/10" : "border-white/10 text-gray-400"
            }`}
          >
            <FiStar className="w-3 h-3 inline-block mr-1" />
            Favoritos
          </button>
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

      <div className="mb-3 flex items-center gap-2 bg-black/40 border border-white/10 rounded-md px-3 py-2">
        <FiSearch className="text-gray-500 w-3 h-3" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar no historico..."
          className="w-full bg-transparent text-sm text-gray-200 focus:outline-none"
          style={{ WebkitAppRegion: "no-drag" }}
        />
      </div>

      <div className="space-y-2 max-h-[420px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
        {filtered.length === 0 && (
          <div className="text-xs text-gray-500 p-4 border border-white/5 rounded-md bg-black/30">
            Nenhum contexto encontrado.
          </div>
        )}

        {filtered.map((item) => {
          const payload = item.payload || {};
          const title = payload.query || payload.answer || "Contexto";
          const created = item.createdAt ? new Date(item.createdAt).toLocaleString("pt-BR") : "";

          return (
            <div
              key={item.contextId}
              className="border border-white/10 rounded-md bg-black/30 p-3 flex items-start justify-between gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="text-xs text-gray-400 mb-1">
                  {item.contextKey || "contexto"} • {created}
                </div>
                <div className="text-sm text-gray-200 truncate">
                  {String(title).slice(0, 120)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleFavorite(item.contextId)}
                  className={`w-7 h-7 rounded-md inline-flex items-center justify-center ${
                    item.favorite ? "text-yellow-400" : "text-gray-500 hover:text-gray-200"
                  }`}
                >
                  <FiStar className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onOpenContext?.(payload)}
                  className="text-xs px-3 py-1 rounded-md border border-white/10 text-gray-300 hover:bg-white/10"
                >
                  Abrir
                </button>
                <button
                  onClick={() => handleDelete(item.contextId)}
                  className="w-7 h-7 rounded-md inline-flex items-center justify-center text-gray-500 hover:text-red-400"
                >
                  <FiTrash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

ContextHistory.propTypes = {
  onOpenContext: PropTypes.func,
  refreshToken: PropTypes.number,
  onMinimize: PropTypes.func
};

export default ContextHistory;
