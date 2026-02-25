import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import {
  FiBookOpen,
  FiPlus,
  FiTrash2,
  FiSearch,
  FiRefreshCw,
  FiMinus
} from "react-icons/fi";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  loadNotes,
  createNoteItem,
  updateNoteItem,
  deleteNoteItem
} from "../../../app/notes/notes.js";

const NOTE_TYPES = [
  { value: "all", label: "Todos os tipos" },
  { value: "note", label: "Nota" },
  { value: "task", label: "Tarefa" },
  { value: "idea", label: "Ideia" },
  { value: "reference", label: "Referencia" }
];

const PRIORITIES = [
  { value: "all", label: "Qualquer prioridade" },
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Media" },
  { value: "high", label: "Alta" }
];

const COMPLETION_FILTERS = [
  { value: "all", label: "Todas" },
  { value: "pending", label: "Pendentes" },
  { value: "completed", label: "Concluidas" }
];

const normalizeTagsCsv = (value) =>
  String(value || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

const toInputDate = (timestamp) => {
  const parsed = Number(timestamp);
  if (!Number.isFinite(parsed) || parsed <= 0) return "";
  const date = new Date(parsed);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
};

const toDueAt = (inputValue) => {
  const text = String(inputValue || "").trim();
  if (!text) return null;
  const parsed = new Date(`${text}T23:59:59`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.getTime();
};

const formatDueDate = (timestamp) => {
  const parsed = Number(timestamp);
  if (!Number.isFinite(parsed) || parsed <= 0) return "";
  return new Date(parsed).toLocaleDateString("pt-BR");
};

const toDraft = (note) => ({
  id: note.id,
  title: note.title || "",
  body: note.body || "",
  type: note.type || "note",
  priority: note.priority || "medium",
  tagsCsv: Array.isArray(note.tags) ? note.tags.join(", ") : "",
  dueDate: toInputDate(note.dueAt),
  isCompleted: !!note.isCompleted,
  completedAt: Number(note.completedAt) || null
});

const toPayload = (draft) => ({
  title: draft.title?.trim() || "Sem titulo",
  body: draft.body || "",
  type: draft.type || "note",
  priority: draft.priority || "medium",
  tags: normalizeTagsCsv(draft.tagsCsv),
  dueAt: toDueAt(draft.dueDate),
  isCompleted: !!draft.isCompleted,
  completedAt: draft.isCompleted
    ? (Number(draft.completedAt) || Date.now())
    : null
});

const payloadSignature = (payload) => JSON.stringify(payload);

const MermaidBlock = ({ chart }) => {
  const [svg, setSvg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    const renderChart = async () => {
      try {
        setError("");
        setSvg("");
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "loose",
          theme: "dark"
        });
        const id = `mermaid-${Math.random().toString(36).slice(2, 10)}`;
        const rendered = await mermaid.render(id, chart);
        if (mounted) {
          setSvg(rendered.svg || "");
        }
      } catch (renderError) {
        if (mounted) {
          setError(renderError?.message || "Falha ao renderizar Mermaid.");
        }
      }
    };

    renderChart();

    return () => {
      mounted = false;
    };
  }, [chart]);

  if (error) {
    return (
      <pre className="text-xs text-red-200 bg-red-500/10 border border-red-400/20 rounded-md p-3 overflow-x-auto">
        {error}
      </pre>
    );
  }

  if (!svg) {
    return (
      <div className="text-xs text-gray-400 bg-black/30 border border-white/10 rounded-md p-3">
        Renderizando grafico Mermaid...
      </div>
    );
  }

  return (
    <div
      className="bg-black/20 border border-white/10 rounded-md p-3 overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};

MermaidBlock.propTypes = {
  chart: PropTypes.string.isRequired
};

const MarkdownPreview = ({ content }) => {
  return (
    <div className="h-full overflow-y-auto bg-black/30 border border-white/10 rounded-md p-4">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="text-xl font-semibold text-gray-100 mb-3">{children}</h1>,
          h2: ({ children }) => <h2 className="text-lg font-semibold text-gray-100 mt-5 mb-2">{children}</h2>,
          h3: ({ children }) => <h3 className="text-base font-semibold text-gray-200 mt-4 mb-2">{children}</h3>,
          p: ({ children }) => <p className="text-sm text-gray-200 leading-relaxed mb-3">{children}</p>,
          ul: ({ children }) => <ul className="list-disc ml-5 text-sm text-gray-200 space-y-1 mb-3">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal ml-5 text-sm text-gray-200 space-y-1 mb-3">{children}</ol>,
          li: ({ children }) => <li>{children}</li>,
          code: ({ className, children }) => {
            const language = String(className || "");
            const value = String(children || "").trim();

            if (language.includes("language-mermaid")) {
              return <MermaidBlock chart={value} />;
            }

            return (
              <code className="bg-black/50 border border-white/10 px-1.5 py-0.5 rounded text-xs text-blue-200">
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="bg-black/50 border border-white/10 rounded-md p-3 text-xs text-gray-200 overflow-x-auto mb-3">
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-blue-400/60 pl-3 text-sm text-gray-300 italic mb-3">
              {children}
            </blockquote>
          )
        }}
      >
        {content || ""}
      </ReactMarkdown>
    </div>
  );
};

MarkdownPreview.propTypes = {
  content: PropTypes.string
};

const NotesHub = ({ onMinimize }) => {
  const [notes, setNotes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [completionFilter, setCompletionFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [saveState, setSaveState] = useState("idle");
  const [isDraftDirty, setIsDraftDirty] = useState(false);
  const [isEditorFocused, setIsEditorFocused] = useState(false);
  const [previewBody, setPreviewBody] = useState("");

  const lastSavedRef = useRef("");
  const didLoadOnceRef = useRef(false);
  const selectedIdRef = useRef(null);
  const draftDirtyRef = useRef(false);
  const editorFocusedRef = useRef(false);
  const refreshRequestRef = useRef(0);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    draftDirtyRef.current = isDraftDirty;
  }, [isDraftDirty]);

  useEffect(() => {
    editorFocusedRef.current = isEditorFocused;
  }, [isEditorFocused]);

  const selectNoteState = useCallback((note) => {
    const nextId = note?.id || null;
    const nextDraft = note ? toDraft(note) : null;
    selectedIdRef.current = nextId;
    setSelectedId(nextId);
    setDraft(nextDraft);
    lastSavedRef.current = nextDraft ? payloadSignature(toPayload(nextDraft)) : "";
  }, []);

  const refreshNotes = useCallback(async (preserveSelection = true) => {
    const requestId = refreshRequestRef.current + 1;
    refreshRequestRef.current = requestId;
    const data = await loadNotes?.();
    if (refreshRequestRef.current !== requestId) {
      return;
    }
    const list = Array.isArray(data) ? data : [];
    setNotes(list);

    const currentSelectedId = selectedIdRef.current;
    if (!preserveSelection || !currentSelectedId) {
      const first = list[0] || null;
      selectNoteState(first);
      return;
    }

    const selected = list.find((item) => item.id === currentSelectedId);
    if (!selected) {
      const first = list[0] || null;
      selectNoteState(first);
      setIsDraftDirty(false);
      return;
    }

    const selectedSignature = payloadSignature(toPayload(toDraft(selected)));
    const canHydrateSelectedDraft = !draftDirtyRef.current && !editorFocusedRef.current;
    if (canHydrateSelectedDraft && selectedSignature === lastSavedRef.current) {
      setDraft(toDraft(selected));
    }
  }, [selectNoteState]);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      setIsLoading(true);
      try {
        await refreshNotes(false);
        if (mounted) {
          didLoadOnceRef.current = true;
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, [refreshNotes]);

  useEffect(() => {
    const interval = setInterval(() => {
      refreshNotes(true);
    }, 3000);
    return () => clearInterval(interval);
  }, [refreshNotes]);

  const filteredNotes = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const normalizedTag = tagFilter.trim().toLowerCase();

    return notes.filter((note) => {
      if (typeFilter !== "all" && note.type !== typeFilter) return false;
      if (priorityFilter !== "all" && note.priority !== priorityFilter) return false;
      if (completionFilter === "completed" && !note.isCompleted) return false;
      if (completionFilter === "pending" && note.isCompleted) return false;

      if (normalizedTag) {
        const tags = Array.isArray(note.tags) ? note.tags.map((tag) => String(tag).toLowerCase()) : [];
        if (!tags.some((tag) => tag.includes(normalizedTag))) return false;
      }

      if (!normalizedSearch) return true;
      const haystack = `${note.title || ""}\n${note.body || ""}\n${(note.tags || []).join(" ")}`.toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [completionFilter, notes, priorityFilter, searchTerm, tagFilter, typeFilter]);

  useEffect(() => {
    if (!draft?.id) return;
    if (!didLoadOnceRef.current) return;

    const payload = toPayload(draft);
    const signature = payloadSignature(payload);
    if (signature === lastSavedRef.current) return;

    setSaveState("saving");
    const timer = setTimeout(async () => {
      try {
        const updated = await updateNoteItem?.(draft.id, payload);
        if (!updated) {
          setSaveState("error");
          return;
        }
        lastSavedRef.current = signature;
        setNotes((previous) => previous.map((item) => (item.id === updated.id ? updated : item)));
        setSaveState("saved");
        setIsDraftDirty(false);
      } catch (error) {
        console.error("NotesHub: failed to autosave note", error);
        setSaveState("error");
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [draft]);

  useEffect(() => {
    if (saveState !== "saved" && saveState !== "error") return undefined;
    const timer = setTimeout(() => setSaveState("idle"), 1500);
    return () => clearTimeout(timer);
  }, [saveState]);

  useEffect(() => {
    const body = draft?.body || "";
    const timer = setTimeout(() => {
      setPreviewBody(body);
    }, 220);
    return () => clearTimeout(timer);
  }, [draft?.body]);

  const updateDraft = (updater) => {
    setDraft((previous) => {
      if (!previous) return previous;
      const next = typeof updater === "function" ? updater(previous) : { ...previous, ...updater };
      return next;
    });
    setIsDraftDirty(true);
  };

  const handleSelectNote = (note) => {
    selectNoteState(note);
    setSaveState("idle");
    setIsDraftDirty(false);
  };

  const handleCreate = async () => {
    const created = await createNoteItem?.({
      title: "Nova nota",
      body: "## Nova nota\n\n- [ ] Escreva aqui",
      type: "note",
      priority: "medium",
      tags: [],
      isCompleted: false,
      completedAt: null,
      source: "text"
    });

    if (!created) return;
    setNotes((previous) => [created, ...previous]);
    handleSelectNote(created);
    setIsDraftDirty(false);
  };

  const handleDelete = async () => {
    if (!draft?.id) return;
    const removed = await deleteNoteItem?.(draft.id);
    if (!removed) return;

    const remaining = notes.filter((item) => item.id !== draft.id);
    setNotes(remaining);
    const fallback = remaining[0] || null;
    selectNoteState(fallback);
    setIsDraftDirty(false);
  };

  const saveLabel = (() => {
    if (saveState === "saving") return "Salvando...";
    if (saveState === "saved") return "Salvo";
    if (saveState === "error") return "Erro ao salvar";
    return "Autosave";
  })();

  return (
    <div className="h-full flex flex-col">
      <div className="h-12 px-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-200">
          <FiBookOpen className="text-purple-300" />
          Notes Hub
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{saveLabel}</span>
          <button
            onClick={() => refreshNotes(true)}
            className="w-8 h-8 rounded-md inline-flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10"
            title="Atualizar"
          >
            <FiRefreshCw className="w-4 h-4" />
          </button>
          {onMinimize && (
            <button
              onClick={onMinimize}
              className="w-8 h-8 rounded-md inline-flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10"
              title="Minimizar"
            >
              <FiMinus className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 flex">
        <aside className="w-[340px] border-r border-white/10 bg-black/20 p-3 flex flex-col gap-3">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-3 h-3" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar notas..."
              className="w-full pl-8 pr-3 py-2 rounded-md bg-black/40 border border-white/10 text-sm text-gray-200 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-2">
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              className="bg-black/40 border border-white/10 rounded-md px-2 py-2 text-sm text-gray-200 focus:outline-none"
            >
              {NOTE_TYPES.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <select
              value={priorityFilter}
              onChange={(event) => setPriorityFilter(event.target.value)}
              className="bg-black/40 border border-white/10 rounded-md px-2 py-2 text-sm text-gray-200 focus:outline-none"
            >
              {PRIORITIES.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <select
              value={completionFilter}
              onChange={(event) => setCompletionFilter(event.target.value)}
              className="bg-black/40 border border-white/10 rounded-md px-2 py-2 text-sm text-gray-200 focus:outline-none"
            >
              {COMPLETION_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <input
              value={tagFilter}
              onChange={(event) => setTagFilter(event.target.value)}
              placeholder="Filtro por tag"
              className="bg-black/40 border border-white/10 rounded-md px-2 py-2 text-sm text-gray-200 focus:outline-none"
            />
          </div>

          <button
            onClick={handleCreate}
            className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-blue-500/20 text-blue-200 border border-blue-400/30 hover:bg-blue-500/30 text-sm"
          >
            <FiPlus className="w-3 h-3" />
            Nova nota
          </button>

          <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
            {isLoading && (
              <div className="text-xs text-gray-500 px-2 py-3">Carregando notas...</div>
            )}
            {!isLoading && filteredNotes.length === 0 && (
              <div className="text-xs text-gray-500 px-2 py-3">Nenhuma nota encontrada.</div>
            )}

            {filteredNotes.map((note) => (
              <button
                key={note.id}
                onClick={() => handleSelectNote(note)}
                className={`w-full text-left rounded-md border px-3 py-2 transition-colors ${
                  note.id === selectedId
                    ? "border-blue-400/50 bg-blue-500/10"
                    : "border-white/10 bg-black/30 hover:bg-white/5"
                }`}
              >
                <div className="text-sm text-gray-200 truncate">{note.title || "Sem titulo"}</div>
                <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                  {(note.body || "").replace(/[#*_`>-]/g, "").slice(0, 120) || "Sem conteudo"}
                </div>
                <div className="mt-2 flex items-center gap-2 text-[10px] text-gray-500">
                  <span>{note.type}</span>
                  <span>|</span>
                  <span>{note.priority}</span>
                  <span>|</span>
                  <span>{note.isCompleted ? "concluida" : "pendente"}</span>
                  {note.dueAt ? (
                    <>
                      <span>|</span>
                      <span>prazo {formatDueDate(note.dueAt)}</span>
                    </>
                  ) : null}
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className="flex-1 min-w-0 p-4 flex flex-col gap-3">
          {!draft && (
            <div className="h-full flex items-center justify-center text-sm text-gray-500">
              Selecione ou crie uma nota para editar.
            </div>
          )}

          {draft && (
            <>
              <div className="flex items-center gap-2">
                <input
                  value={draft.title}
                  onFocus={() => setIsEditorFocused(true)}
                  onBlur={() => setIsEditorFocused(false)}
                  onChange={(event) => updateDraft((previous) => ({ ...previous, title: event.target.value }))}
                  placeholder="Titulo da nota"
                  className="flex-1 bg-black/40 border border-white/10 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none"
                />
                <select
                  value={draft.type}
                  onFocus={() => setIsEditorFocused(true)}
                  onBlur={() => setIsEditorFocused(false)}
                  onChange={(event) => updateDraft((previous) => ({ ...previous, type: event.target.value }))}
                  className="bg-black/40 border border-white/10 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none"
                >
                  {NOTE_TYPES.filter((option) => option.value !== "all").map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <select
                  value={draft.priority}
                  onFocus={() => setIsEditorFocused(true)}
                  onBlur={() => setIsEditorFocused(false)}
                  onChange={(event) => updateDraft((previous) => ({ ...previous, priority: event.target.value }))}
                  className="bg-black/40 border border-white/10 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none"
                >
                  {PRIORITIES.filter((option) => option.value !== "all").map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <input
                  type="date"
                  value={draft.dueDate || ""}
                  onFocus={() => setIsEditorFocused(true)}
                  onBlur={() => setIsEditorFocused(false)}
                  onChange={(event) => updateDraft((previous) => ({ ...previous, dueDate: event.target.value }))}
                  className="bg-black/40 border border-white/10 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none"
                  title="Prazo"
                />
                <label className="inline-flex items-center gap-2 px-2 py-1 rounded-md border border-white/10 bg-black/30 text-xs text-gray-200">
                  <input
                    type="checkbox"
                    checked={!!draft.isCompleted}
                    onFocus={() => setIsEditorFocused(true)}
                    onBlur={() => setIsEditorFocused(false)}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      updateDraft((previous) => ({
                        ...previous,
                        isCompleted: checked,
                        completedAt: checked ? (previous.completedAt || Date.now()) : null
                      }));
                    }}
                    className="accent-emerald-400"
                  />
                  Concluida
                </label>
                <button
                  onClick={handleDelete}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-red-400/30 text-red-200 hover:bg-red-500/10 text-sm"
                  title="Excluir nota"
                >
                  <FiTrash2 className="w-3 h-3" />
                  Excluir
                </button>
              </div>

              <input
                value={draft.tagsCsv}
                onFocus={() => setIsEditorFocused(true)}
                onBlur={() => setIsEditorFocused(false)}
                onChange={(event) => updateDraft((previous) => ({ ...previous, tagsCsv: event.target.value }))}
                placeholder="Tags separadas por virgula"
                className="bg-black/40 border border-white/10 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none"
              />

              <div className="text-xs text-gray-500">
                Editor Markdown (esquerda) com preview e Mermaid (direita).
              </div>

              <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-2 gap-3">
                <textarea
                  value={draft.body}
                  onFocus={() => setIsEditorFocused(true)}
                  onBlur={() => setIsEditorFocused(false)}
                  onChange={(event) => updateDraft((previous) => ({ ...previous, body: event.target.value }))}
                  placeholder="Escreva em Markdown..."
                  className="h-full min-h-0 resize-none bg-black/40 border border-white/10 rounded-md px-3 py-3 text-sm text-gray-100 focus:outline-none font-mono"
                />

                <MarkdownPreview content={previewBody} />
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
};

NotesHub.propTypes = {
  onMinimize: PropTypes.func
};

export default NotesHub;
