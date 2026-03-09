import { buildContextualPrompt, JSON_OUTPUT_INSTRUCTIONS } from "./promptTemplates.js";

const WEEKDAY_INDEX = new Map([
  ["domingo", 0],
  ["segunda", 1],
  ["segunda-feira", 1],
  ["segunda feira", 1],
  ["terca", 2],
  ["terca-feira", 2],
  ["terca feira", 2],
  ["quarta", 3],
  ["quarta-feira", 3],
  ["quarta feira", 3],
  ["quinta", 4],
  ["quinta-feira", 4],
  ["quinta feira", 4],
  ["sexta", 5],
  ["sexta-feira", 5],
  ["sexta feira", 5],
  ["sabado", 6]
]);

const stripAccents = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const normalizeText = (value) =>
  stripAccents(String(value || ""))
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const toIsoDate = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
};

const fromIsoDate = (value) => {
  const text = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const [yearText, monthText, dayText] = text.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const parsed = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (
    parsed.getFullYear() !== year
    || parsed.getMonth() !== month - 1
    || parsed.getDate() !== day
  ) {
    return null;
  }
  return parsed;
};

const resolveReferenceDate = (value) => {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) {
    const candidate = new Date(parsed);
    if (!Number.isNaN(candidate.getTime())) return candidate;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  return new Date();
};

const resolveRelativeWeekday = (
  referenceDate,
  weekdayIndex,
  { preferPast = false, strictFuture = false } = {}
) => {
  const base = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
    12,
    0,
    0,
    0
  );
  const currentWeekday = base.getDay();

  if (preferPast) {
    let delta = currentWeekday - weekdayIndex;
    if (delta < 0) delta += 7;
    if (delta === 0) delta = 7;
    const result = new Date(base);
    result.setDate(base.getDate() - delta);
    return result;
  }

  let delta = weekdayIndex - currentWeekday;
  if (delta < 0) delta += 7;
  if (strictFuture && delta === 0) delta = 7;
  const result = new Date(base);
  result.setDate(base.getDate() + delta);
  return result;
};

const getNextWeekRange = (referenceDate) => {
  const base = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
    12,
    0,
    0,
    0
  );
  const currentWeekday = base.getDay();
  const deltaToNextMonday = ((8 - currentWeekday) % 7) || 7;
  const start = new Date(base);
  start.setDate(base.getDate() + deltaToNextMonday);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
};

const getCurrentWeekRange = (referenceDate) => {
  const base = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
    12,
    0,
    0,
    0
  );
  const currentWeekday = base.getDay();
  const mondayOffset = currentWeekday === 0 ? -6 : 1 - currentWeekday;
  const monday = new Date(base);
  monday.setDate(base.getDate() + mondayOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: base,
    end: sunday
  };
};

const parseExplicitDateInQuery = (normalizedQuery, referenceDate) => {
  const isoMatch = normalizedQuery.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (isoMatch) {
    const iso = `${isoMatch[1]}-${String(Number(isoMatch[2])).padStart(2, "0")}-${String(Number(isoMatch[3])).padStart(2, "0")}`;
    const parsed = fromIsoDate(iso);
    if (parsed) return toIsoDate(parsed);
  }

  const brMatch = normalizedQuery.match(/\b([0-3]?\d)[\/\-]([0-1]?\d)(?:[\/\-](\d{2,4}))?\b/);
  if (!brMatch) return "";

  const day = Number(brMatch[1]);
  const month = Number(brMatch[2]);
  if (month < 1 || month > 12) return "";

  const yearInput = brMatch[3] ? Number(brMatch[3]) : referenceDate.getFullYear();
  const year = brMatch[3] && String(brMatch[3]).length <= 2 ? 2000 + yearInput : yearInput;
  const parsed = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (
    parsed.getFullYear() !== year
    || parsed.getMonth() !== month - 1
    || parsed.getDate() !== day
  ) {
    return "";
  }

  if (!brMatch[3]) {
    const today = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate(), 0, 0, 0, 0);
    if (parsed < today) {
      parsed.setFullYear(parsed.getFullYear() + 1);
    }
  }

  return toIsoDate(parsed);
};

const extractDueDateFromNoteText = (text) => {
  const raw = String(text || "");
  const directMatch = raw.match(/Prazo:\s*(\d{4}-\d{2}-\d{2})/i);
  if (directMatch?.[1] && fromIsoDate(directMatch[1])) return directMatch[1];
  const tagMatch = raw.match(/prazo:(\d{4}-\d{2}-\d{2})/i);
  if (tagMatch?.[1] && fromIsoDate(tagMatch[1])) return tagMatch[1];
  return "";
};

const extractCompletionFromNoteText = (text) => {
  const raw = String(text || "");
  const normalized = normalizeText(raw);
  if (/status:\s*completed/.test(normalized)) return true;
  if (/status:\s*pending/.test(normalized)) return false;

  const hasUnchecked = /-\s*\[\s\]\s+/i.test(raw);
  const hasChecked = /-\s*\[[xX]\]\s+/i.test(raw);
  if (hasChecked && !hasUnchecked) return true;
  return false;
};

const extractNoteIdFromNoteText = (text) => {
  const raw = String(text || "");
  const match = raw.match(/NoteId:\s*([A-Za-z0-9_-]+)/i);
  return match?.[1] || "";
};

export class AssistantService {
  constructor(aiClient, vectorStore, settingsStore, conversationMemoryStore) {
    this.aiClient = aiClient;
    this.vectorStore = vectorStore;
    this.settingsStore = settingsStore;
    this.conversationMemoryStore = conversationMemoryStore;
  }

  async processQuery(text, options = {}) {
    console.log(`AssistantService: Processing query: "${text}"`);

    const memorySettings = this.settingsStore?.getSettings?.().memory || {};
    const recentTurnsLimit = this.normalizePositiveInt(
      memorySettings.shortTermTurns,
      10
    );
    const semanticLimit = this.normalizePositiveInt(
      memorySettings.semanticContextItems,
      8
    );
    const referenceDate = resolveReferenceDate(options.referenceTime);
    const queryIntent = this.buildQueryIntent(text, referenceDate);

    const allRecentTurns = this.conversationMemoryStore?.listRecent?.(recentTurnsLimit) || [];
    const recentTurns = this.filterRecentTurnsByQueryIntent(allRecentTurns, queryIntent);
    const includeTypes = this.getSemanticIncludeTypes(queryIntent);

    let semanticItems = [];
    try {
      semanticItems = await this.vectorStore.search(text, semanticLimit, {
        includeTypes
      });
      semanticItems = semanticItems.filter(item => this.isEligibleSemanticMemory(item));
      semanticItems = this.filterSemanticItemsByQueryIntent(semanticItems, queryIntent);
      semanticItems = this.rankContextByRecency(semanticItems).slice(0, semanticLimit);
      console.log(`AssistantService: Retrieved ${semanticItems.length} semantic memory items.`);
    } catch (error) {
      console.error("AssistantService: Context retrieval failed", error);
    }

    if (this.hasStrictTaskWindow(queryIntent) && semanticItems.length === 0) {
      const response = this.buildNoTaskMatchResponse(queryIntent);
      await this.saveInteraction(text, response);
      return response;
    }

    const correctionHints = this.buildCorrectionHints(text, recentTurns);
    const basePrompt = buildContextualPrompt({
      userQuery: text,
      recentTurns,
      semanticItems,
      correctionHints,
      timeContext: this.buildTimeContextForPrompt(queryIntent, referenceDate)
    });
    const fullPrompt = `${basePrompt}\n${JSON_OUTPUT_INSTRUCTIONS}`;

    let response = null;
    try {
      const aiSettings = this.settingsStore?.getSettings?.().ai || {};
      const rawText = await this.aiClient.generateText(fullPrompt, {
        provider: options.provider || aiSettings.provider,
        model: options.model || aiSettings.model,
        temperature: options.temperature ?? aiSettings.temperature
      });
      response = this.normalizeResponse(rawText);
    } catch (error) {
      console.error("AssistantService: AI generation failed", error);
      response = {
        answer: "Desculpe, ocorreu um erro ao gerar a resposta. Por favor, tente novamente.",
        sections: [],
        citations: []
      };
    }

    await this.saveInteraction(text, response);

    return response;
  }

  normalizePositiveInt(value, fallback) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.floor(parsed);
  }

  getSemanticIncludeTypes(queryIntent = {}) {
    if (this.hasStrictTaskWindow(queryIntent)) {
      return ["note"];
    }
    return ["conversation_user", "conversation", "explicit_memory", "voice_transcription", "note"];
  }

  filterRecentTurnsByQueryIntent(recentTurns = [], queryIntent = {}) {
    if (!Array.isArray(recentTurns) || !recentTurns.length) return [];

    if (!this.hasStrictTaskWindow(queryIntent)) return recentTurns;

    return recentTurns.filter((turn) => {
      const role = String(turn?.role || "").toLowerCase();
      const text = String(turn?.text || "");
      const isCorrection = /(na verdade|corrig|erro|errad|o certo|o correto|atualiza|retifica)/i.test(text);
      return role === "user" && isCorrection;
    });
  }

  buildQueryIntent(queryText, referenceDate = new Date()) {
    const normalized = normalizeText(queryText);
    const todayIso = toIsoDate(referenceDate);
    const intent = {
      referenceDateIso: todayIso,
      hasTemporalIntent: false,
      rangeStartIso: "",
      rangeEndIso: "",
      preferFuture: false,
      allowPast: false,
      wantsCompleted: /\b(concluid[ao]s?|finalizad[ao]s?|feitas?|resolvid[ao]s?)\b/.test(normalized),
      wantsPending: /\b(pendente[s]?|abert[ao]s?|a fazer|por fazer|nao conclu|nao finalizad)\b/.test(normalized),
      summary: "Sem filtro temporal."
    };

    if (intent.wantsCompleted && intent.wantsPending) {
      if (/nao conclu|nao finalizad|pendente|a fazer|por fazer|abert[ao]s?/.test(normalized)) {
        intent.wantsCompleted = false;
      } else {
        intent.wantsCompleted = false;
        intent.wantsPending = false;
      }
    }

    intent.allowPast = /\b(passad[ao]s?|anterior(?:es)?|ultima[s]?|ultim[oa]s?)\b/.test(normalized);
    intent.preferFuture = !intent.allowPast;

    const explicitDate = parseExplicitDateInQuery(normalized, referenceDate);
    if (explicitDate) {
      intent.hasTemporalIntent = true;
      intent.rangeStartIso = explicitDate;
      intent.rangeEndIso = explicitDate;
      intent.summary = `Filtrar notas com prazo em ${explicitDate}.`;
      return intent;
    }

    if (/\bdepois de amanha\b/.test(normalized)) {
      const target = new Date(referenceDate);
      target.setDate(target.getDate() + 2);
      const targetIso = toIsoDate(target);
      intent.hasTemporalIntent = true;
      intent.rangeStartIso = targetIso;
      intent.rangeEndIso = targetIso;
      intent.summary = `Filtrar notas com prazo em ${targetIso} (depois de amanha).`;
      return intent;
    }

    if (/\bamanha\b/.test(normalized)) {
      const target = new Date(referenceDate);
      target.setDate(target.getDate() + 1);
      const targetIso = toIsoDate(target);
      intent.hasTemporalIntent = true;
      intent.rangeStartIso = targetIso;
      intent.rangeEndIso = targetIso;
      intent.summary = `Filtrar notas com prazo em ${targetIso} (amanha).`;
      return intent;
    }

    if (/\bhoje\b/.test(normalized)) {
      intent.hasTemporalIntent = true;
      intent.rangeStartIso = todayIso;
      intent.rangeEndIso = todayIso;
      intent.summary = `Filtrar notas com prazo em ${todayIso} (hoje).`;
      return intent;
    }

    if (/\bsemana passada\b/.test(normalized)) {
      const current = getCurrentWeekRange(referenceDate);
      const start = new Date(current.start);
      start.setDate(start.getDate() - 7);
      const end = new Date(current.end);
      end.setDate(end.getDate() - 7);
      intent.hasTemporalIntent = true;
      intent.allowPast = true;
      intent.preferFuture = false;
      intent.rangeStartIso = toIsoDate(start);
      intent.rangeEndIso = toIsoDate(end);
      intent.summary = `Filtrar notas da semana passada (${intent.rangeStartIso} a ${intent.rangeEndIso}).`;
      return intent;
    }

    if (/\b(proxima|proximo)\s+semana\b|\bsemana que vem\b/.test(normalized)) {
      const range = getNextWeekRange(referenceDate);
      intent.hasTemporalIntent = true;
      intent.preferFuture = true;
      intent.rangeStartIso = toIsoDate(range.start);
      intent.rangeEndIso = toIsoDate(range.end);
      intent.summary = `Filtrar notas da proxima semana (${intent.rangeStartIso} a ${intent.rangeEndIso}).`;
      return intent;
    }

    if (/\b(esta|essa)\s+semana\b|\bsemana atual\b/.test(normalized)) {
      const range = getCurrentWeekRange(referenceDate);
      intent.hasTemporalIntent = true;
      intent.preferFuture = true;
      intent.rangeStartIso = toIsoDate(range.start);
      intent.rangeEndIso = toIsoDate(range.end);
      intent.summary = `Filtrar notas da semana atual (${intent.rangeStartIso} a ${intent.rangeEndIso}).`;
      return intent;
    }

    const weekdayMatch = normalized.match(
      /\b(?:(proxima|proximo|passada|passado|essa|esta)\s+)?(segunda(?:-feira| feira)?|terca(?:-feira| feira)?|quarta(?:-feira| feira)?|quinta(?:-feira| feira)?|sexta(?:-feira| feira)?|sabado|domingo)\b/
    );
    if (weekdayMatch) {
      const modifier = String(weekdayMatch[1] || "").trim();
      const weekdayLabel = String(weekdayMatch[2] || "").trim();
      const weekdayIndex = WEEKDAY_INDEX.get(weekdayLabel.replace(/\s+/g, " "));
      if (typeof weekdayIndex === "number") {
        const preferPast = modifier === "passada" || modifier === "passado" || intent.allowPast;
        const strictFuture = modifier === "proxima" || modifier === "proximo";
        const targetDate = resolveRelativeWeekday(referenceDate, weekdayIndex, {
          preferPast,
          strictFuture
        });
        const targetIso = toIsoDate(targetDate);
        intent.hasTemporalIntent = true;
        intent.allowPast = preferPast;
        intent.preferFuture = !preferPast;
        intent.rangeStartIso = targetIso;
        intent.rangeEndIso = targetIso;
        intent.summary = `Filtrar notas com prazo em ${targetIso} (${weekdayLabel}).`;
      }
    }

    return intent;
  }

  filterSemanticItemsByQueryIntent(items = [], queryIntent = {}) {
    if (!Array.isArray(items) || !items.length) return [];
    const strictTaskWindow = this.hasStrictTaskWindow(queryIntent);
    const sourceItems = strictTaskWindow
      ? items.filter((item) => item && item.type === "note")
      : items;

    const latestByNoteId = new Map();
    const deduped = [];
    for (const item of sourceItems) {
      if (!item || item.type !== "note") {
        deduped.push(item);
        continue;
      }

      const noteId = extractNoteIdFromNoteText(item.text);
      if (!noteId) {
        deduped.push(item);
        continue;
      }

      const previous = latestByNoteId.get(noteId);
      if (!previous) {
        latestByNoteId.set(noteId, item);
        continue;
      }

      const previousTs = Number(previous.timestamp) || 0;
      const nextTs = Number(item.timestamp) || 0;
      if (nextTs >= previousTs) {
        latestByNoteId.set(noteId, item);
      }
    }

    for (const noteItem of latestByNoteId.values()) {
      deduped.push(noteItem);
    }

    const hasStatusFilter = queryIntent.wantsCompleted || queryIntent.wantsPending;
    if (!queryIntent.hasTemporalIntent && !hasStatusFilter) {
      return deduped;
    }

    const todayIso = queryIntent.referenceDateIso || toIsoDate(new Date());
    return deduped.filter((item) => {
      if (!item || item.type !== "note") return true;

      const text = String(item.text || "");
      const dueDateIso = extractDueDateFromNoteText(text);
      const isCompleted = extractCompletionFromNoteText(text);

      if (queryIntent.wantsCompleted && !isCompleted) return false;
      if (queryIntent.wantsPending && isCompleted) return false;

      if (queryIntent.hasTemporalIntent) {
        if (!dueDateIso) return false;
        if (queryIntent.rangeStartIso && dueDateIso < queryIntent.rangeStartIso) return false;
        if (queryIntent.rangeEndIso && dueDateIso > queryIntent.rangeEndIso) return false;
        if (queryIntent.preferFuture && !queryIntent.allowPast && dueDateIso < todayIso) return false;
      }

      return true;
    });
  }

  buildTimeContextForPrompt(queryIntent = {}, referenceDate = new Date()) {
    const referenceDateIso = queryIntent.referenceDateIso || toIsoDate(referenceDate);
    const referenceDateLabel = referenceDate.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });

    const filters = [];
    if (queryIntent.wantsCompleted) filters.push("status: concluidas");
    if (queryIntent.wantsPending) filters.push("status: pendentes");

    return {
      referenceDateIso,
      referenceDateLabel,
      summary: queryIntent.summary || "Sem filtro temporal.",
      rangeStartIso: queryIntent.rangeStartIso || "",
      rangeEndIso: queryIntent.rangeEndIso || "",
      filters
    };
  }

  hasStrictTaskWindow(queryIntent = {}) {
    return Boolean(
      queryIntent.hasTemporalIntent
      || queryIntent.wantsCompleted
      || queryIntent.wantsPending
    );
  }

  buildNoTaskMatchResponse(queryIntent = {}) {
    const filters = [];
    if (queryIntent.wantsCompleted) filters.push("concluidas");
    if (queryIntent.wantsPending) filters.push("pendentes");
    const statusSuffix = filters.length > 0 ? ` com status ${filters.join(" e ")}` : "";

    let windowLabel = "nos filtros solicitados";
    if (queryIntent.rangeStartIso && queryIntent.rangeEndIso) {
      windowLabel = queryIntent.rangeStartIso === queryIntent.rangeEndIso
        ? `em ${queryIntent.rangeStartIso}`
        : `entre ${queryIntent.rangeStartIso} e ${queryIntent.rangeEndIso}`;
    } else if (queryIntent.rangeStartIso) {
      windowLabel = `a partir de ${queryIntent.rangeStartIso}`;
    }

    return {
      answer: `Nao encontrei tarefas${statusSuffix} ${windowLabel}.`,
      sections: [],
      citations: []
    };
  }

  rankContextByRecency(items = []) {
    if (!Array.isArray(items) || !items.length) return [];

    const now = Date.now();
    return [...items].sort((a, b) => {
      const scoreA = this.computeContextScore(a, now);
      const scoreB = this.computeContextScore(b, now);
      return scoreB - scoreA;
    });
  }

  isEligibleSemanticMemory(item = {}) {
    if (!item || typeof item !== "object") return false;
    if (item.type !== "conversation") return true;

    const text = String(item.text || "").trim().toLowerCase();
    if (!text) return false;

    const looksLikeQuestion = text.includes("?")
      || /^(como|o que|qual|quais|quantas?|onde|quando|por que|porque|pq|me explica|me diga|pode|voce pode)\b/i.test(text);
    const looksLikeCorrection = /(na verdade|corrig|isso esta errado|nao e|o certo e|o correto e|eu corrigi)/i.test(text);

    return looksLikeQuestion || looksLikeCorrection;
  }

  computeContextScore(item = {}, now = Date.now()) {
    const ageMs = Math.max(0, now - (Number(item.timestamp) || now));
    const ageHours = ageMs / (1000 * 60 * 60);
    const recencyBoost = Math.exp(-ageHours / 72);

    const distance = typeof item._distance === "number" ? item._distance : 1;
    const similarityScore = 1 / (1 + Math.max(0, distance));

    const typeBoost = item.type === "explicit_memory"
      ? 0.2
      : item.type === "note"
        ? 0.18
      : item.type === "conversation_user"
        ? 0.15
        : 0;

    const noteRecencyBoost = item.type === "note" && ageHours <= 24
      ? 0.08
      : 0;

    return similarityScore * 0.65 + recencyBoost * 0.35 + typeBoost + noteRecencyBoost;
  }

  buildCorrectionHints(queryText, recentTurns = []) {
    const text = String(queryText || "").toLowerCase();
    const correctionPattern = /(na verdade|corrig|voce errou|vc errou|isso esta errado|isso ta errado|nao e|o certo e|o correto e)/i;
    if (!correctionPattern.test(text)) return [];

    const lastAssistantTurn = [...recentTurns].reverse().find(turn => turn.role === "assistant");
    if (!lastAssistantTurn) return [];

    return [
      "The user is correcting previous information. Prioritize the user's correction over past assistant claims.",
      `Last assistant statement being corrected: ${lastAssistantTurn.text}`
    ];
  }

  normalizeResponse(rawText) {
    let text = (rawText || "").trim();

    if (text.startsWith("```json")) {
      text = text.replace(/^```json\n?/, "").replace(/\n?```$/, "");
    } else if (text.startsWith("```")) {
      text = text.replace(/^```\n?/, "").replace(/\n?```$/, "");
    }

    try {
      const rawJson = JSON.parse(text);
      return {
        answer: rawJson.answer || rawJson.response || text,
        sections: Array.isArray(rawJson.sections)
          ? rawJson.sections
              .filter(section => typeof section === "object" && section.title && section.content)
              .map(section => ({
                title: String(section.title),
                content: String(section.content),
                type: ["text", "list", "code", "steps"].includes(section.type)
                  ? section.type
                  : "text"
              }))
          : [],
        citations: Array.isArray(rawJson.citations)
          ? rawJson.citations
              .filter(citation => typeof citation === "object")
              .map(citation => ({
                source: String(citation.source || ""),
                relevance: String(citation.relevance || "")
              }))
          : []
      };
    } catch (parseError) {
      console.error("AssistantService: JSON parse failed, using raw text", parseError);
      return {
        answer: text,
        sections: [],
        citations: []
      };
    }
  }

  async saveInteraction(userQuery, aiResponse) {
    try {
      const timestamp = Date.now();
      const userText = String(userQuery || "").trim();

      if (userText) {
        await this.vectorStore.addDocument(userText, {
          role: "user",
          type: "conversation_user",
          timestamp
        });
        this.conversationMemoryStore?.appendTurn({
          role: "user",
          text: userText,
          timestamp
        });
      }

      if (aiResponse) {
        const responseText = typeof aiResponse === "string"
          ? aiResponse
          : aiResponse.answer || JSON.stringify(aiResponse);

        this.conversationMemoryStore?.appendTurn({
          role: "assistant",
          text: responseText,
          timestamp: Date.now()
        });
      }

      console.log("AssistantService: Interaction saved to memory.");
    } catch (error) {
      console.error("AssistantService: Failed to save interaction", error);
    }
  }

  async saveExplicitMemory(text, metadata) {
    return await this.vectorStore.addDocument(text, {
      ...metadata,
      timestamp: Date.now(),
      type: "explicit_memory"
    });
  }

  async saveTranscription(text, metadata) {
    try {
      return await this.vectorStore.addDocument(text, {
        ...metadata,
        timestamp: metadata.timestamp || Date.now(),
        type: "voice_transcription"
      });
    } catch (error) {
      console.error("AssistantService: Failed to save transcription", error);
      throw error;
    }
  }
}
