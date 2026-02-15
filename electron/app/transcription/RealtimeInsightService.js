import { EventEmitter } from "events";

const DEFAULTS = {
  minWordsForApiCall: 7,
  maxWaitMs: 4500,
  relevanceThreshold: 55,
  recentChunkWindow: 8,
  maxRecentChars: 1000,
  maxSummaryChars: 1000,
  maxOutputTokens: 280,
  model: "arcee-ai/trinity-large-preview:free",
  maxKnowledgeItems: 12,
  maxCommentItems: 18,
  maxSummaryParagraphs: 24,
  summaryBacklogMaxChars: 1800,
  insightMinIntervalMs: 700,
  summaryMinIntervalMs: 12000
};

const compactWhitespace = (value) => String(value || "").replace(/\s+/g, " ").trim();
const normalizeSignature = (value) => compactWhitespace(value).toLowerCase().replace(/[^a-z0-9\s]/gi, "");
const normalizeForSignals = (value) =>
  compactWhitespace(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const truncateText = (value, maxChars) => {
  const text = compactWhitespace(value);
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 3))}...`;
};

const uniqueBySignature = (items = []) => {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const value = compactWhitespace(item);
    if (!value) continue;
    const signature = normalizeSignature(value);
    if (!signature || seen.has(signature)) continue;
    seen.add(signature);
    result.push(value);
  }
  return result;
};

const stripCodeFence = (value) => {
  let text = String(value || "").trim();
  if (text.startsWith("```json")) {
    text = text.replace(/^```json\s*/i, "").replace(/\s*```$/, "");
  } else if (text.startsWith("```")) {
    text = text.replace(/^```\s*/i, "").replace(/\s*```$/, "");
  }
  return text.trim();
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export class RealtimeInsightService extends EventEmitter {
  constructor(aiClient, settingsStore, assistantService) {
    super();
    this.aiClient = aiClient;
    this.settingsStore = settingsStore;
    this.assistantService = assistantService;
    this.sessions = new Map();
  }

  getSession(source = "mic") {
    const key = source === "system" ? "system" : "mic";
    if (!this.sessions.has(key)) {
      this.sessions.set(key, {
        source: key,
        rollingSummary: "",
        recentChunks: [],
        pendingText: "",
        processing: false,
        lastProcessedAt: 0,
        lastInsightSignature: "",
        lastInsightAt: 0,
        keyTakeaways: [],
        actionQueue: [],
        riskSignals: [],
        contextSnapshot: "",
        modelComments: [],
        summaryParagraphs: [],
        summaryBacklog: "",
        lastInsightModelCallAt: 0,
        lastSummaryModelCallAt: 0,
        summaryRefreshInFlight: false
      });
    }
    return this.sessions.get(key);
  }

  resetSession(source = "mic") {
    const key = source === "system" ? "system" : "mic";
    this.sessions.delete(key);
    return { ok: true, source: key };
  }

  async processChunk(payload = {}) {
    const source = payload.source === "system" ? "system" : "mic";
    const text = compactWhitespace(payload.text);
    if (!text) {
      return {
        ok: true,
        source,
        relevant: false,
        reason: "empty_text"
      };
    }

    const session = this.getSession(source);
    const timestamp = Number(payload.timestamp) || Date.now();
    console.log(
      `RealtimeInsightService: received transcript chunk (source=${source}, chunkIndex=${Number(payload.chunkIndex) || 0}, text="${truncateText(text, 300)}")`
    );

    session.recentChunks.push({
      text,
      timestamp,
      chunkIndex: Number(payload.chunkIndex) || 0
    });
    if (session.recentChunks.length > DEFAULTS.recentChunkWindow) {
      session.recentChunks = session.recentChunks.slice(-DEFAULTS.recentChunkWindow);
    }

    session.pendingText = compactWhitespace(`${session.pendingText} ${text}`);

    if (session.processing) {
      console.log(`RealtimeInsightService: chunk queued because processor is busy (source=${source})`);
      return {
        ok: true,
        source,
        relevant: false,
        queued: true,
        reason: "processing_in_progress"
      };
    }

    if (!this.shouldProcess(session)) {
      const words = session.pendingText.split(/\s+/).filter(Boolean).length;
      console.log(`RealtimeInsightService: accumulating context (source=${source}, pendingWords=${words})`);
      return {
        ok: true,
        source,
        relevant: false,
        queued: true,
        reason: "accumulating_context"
      };
    }

    return await this.consumePending(session, payload);
  }

  shouldProcess(session) {
    const words = session.pendingText.split(/\s+/).filter(Boolean).length;
    if (words >= DEFAULTS.minWordsForApiCall) return true;

    const normalized = normalizeForSignals(session.pendingText);
    const highSignal = /\?|decisao|decidimos|requisit|escopo|prazo|deadline|risco|problema|bloque|impediment|acao|tarefa|urgente|importante|proximo passo|sugest|dependenc|responsavel|owner|entrega|cliente|stakeholder|aprovac|prioridade|alinhamento|pendenc/i.test(
      normalized
    );
    if (highSignal && words >= 6) return true;

    const hasEnoughHistory = session.recentChunks.length >= 2;
    const waitedEnough = Date.now() - session.lastProcessedAt >= DEFAULTS.maxWaitMs;
    return hasEnoughHistory && waitedEnough && words >= 8;
  }

  buildInsightPrompt({ source, rollingSummary, recentWindow, pendingText }) {
    return `
You are a real-time insight engine for live business conversations in Brazilian Portuguese.
Your job is NOT transcription. Your job is extracting only meaningful insights.
Primary scenarios: corporate meetings, requirement elicitation, project updates, stakeholder syncs, interviews, and planning discussions.
Stay domain-adaptable: do not assume gaming context or any single industry.

Return ONLY valid JSON with this exact schema:
{
  "relevant": true,
  "relevanceScore": 0,
  "insightType": "none",
  "headline": "",
  "summary": "",
  "suggestions": [],
  "actionItems": [],
  "mindmap": [],
  "displayText": "",
  "reason": ""
}

Rules:
- If there is no meaningful new information, return:
  relevant=false, relevanceScore <= 40, insightType="none", displayText="".
- Mark relevant=true only for one of: decisions, requirements, blockers, risks, concrete actions, important ideas, explicit questions, clear context shifts.
- Treat process improvements, tactical explanations, strategic tradeoffs, and cause/effect insights as relevant.
- Prioritize extraction of: owners, deadlines, dependencies, scope changes, approvals, constraints, success criteria, and next steps.
- If person/product names are unclear, keep them as heard and do not invent facts.
- Avoid repeating old insights.
- Keep suggestions practical and short.
- When relevant=true, provide at least one concise summary sentence and, when possible, 1-3 concrete actionItems or suggestions.
- Keep summary concise (max ~320 chars) and displayText short (max ~220 chars).
- Build displayText in Portuguese (pt-BR), concise, readable, and useful.
- Prefer paraphrasing; avoid copying transcript verbatim.
- Never output raw transcript chunks unless necessary.

Context:
- Source: ${source}
- Running summary: ${rollingSummary || "(empty)"}
- Recent context window: ${recentWindow || "(empty)"}
- New chunk to analyze: ${pendingText}
`;
  }

  buildSummaryPrompt({ source, currentSummary, recentWindow, backlog, keyTakeaways, actionQueue, riskSignals }) {
    return `
You are a context summarizer for live business conversations in pt-BR.
Goal: maintain an evolving summary that preserves early context while integrating recent updates.

Return ONLY valid JSON:
{
  "updatedSummary": "",
  "carryForwardPoints": []
}

Rules:
- updatedSummary must preserve timeline continuity from beginning to now.
- Never drop previously confirmed decisions/requirements unless explicitly superseded.
- If topic changes, keep prior context and append the new context (do not overwrite old context).
- Keep names/entities/events even when recognition is noisy.
- Compress repetition and keep signal (decisions, requirements, risks, blockers, owners, deadlines, dependencies).
- updatedSummary should be concise and easy to scan (target <= 900 chars).
- Use 2-4 concise paragraphs maximum.
- Prefer paraphrasing over verbatim transcript.
- carryForwardPoints should contain 3-8 short bullets that must stay in memory.

Context:
- Source: ${source}
- Current summary: ${currentSummary || "(empty)"}
- Recent context window: ${recentWindow || "(empty)"}
- New backlog to merge: ${backlog || "(empty)"}
- Key takeaways: ${(keyTakeaways || []).join(" | ") || "(empty)"}
- Action queue: ${(actionQueue || []).join(" | ") || "(empty)"}
- Risk signals: ${(riskSignals || []).join(" | ") || "(empty)"}
`;
  }

  compactSummaryText(value, maxChars = DEFAULTS.maxSummaryChars) {
    const raw = String(value || "");
    if (!raw.trim()) return "";

    const normalized = raw
      .replace(/\r/g, "")
      .replace(/\n{3,}/g, "\n\n");

    const paragraphChunks = normalized
      .split(/\n{2,}/)
      .map(item => compactWhitespace(item))
      .filter(Boolean);

    const uniqueParagraphs = uniqueBySignature(paragraphChunks);
    const paragraphs = uniqueParagraphs.length > 4
      ? [...uniqueParagraphs.slice(0, 2), ...uniqueParagraphs.slice(-2)]
      : uniqueParagraphs;

    if (paragraphs.length > 0) {
      return truncateText(paragraphs.join("\n\n"), maxChars);
    }

    const sentenceChunks = normalized
      .split(/(?<=[.!?])\s+/)
      .map(item => compactWhitespace(item))
      .filter(Boolean);
    const uniqueSentences = uniqueBySignature(sentenceChunks);
    return truncateText(uniqueSentences.join(" "), maxChars);
  }

  compactModelComments(list = [], limit = DEFAULTS.maxCommentItems) {
    const normalized = list
      .map(item => truncateText(compactWhitespace(item), 220))
      .filter(Boolean);
    return uniqueBySignature(normalized).slice(-limit);
  }

  parseInsight(rawText) {
    const clean = stripCodeFence(rawText);
    try {
      const parsed = JSON.parse(clean);
      return {
        relevant: Boolean(parsed?.relevant),
        relevanceScore: Number(parsed?.relevanceScore) || 0,
        insightType: compactWhitespace(parsed?.insightType || "none"),
        headline: compactWhitespace(parsed?.headline || ""),
        summary: this.compactSummaryText(parsed?.summary || "", 380),
        suggestions: Array.isArray(parsed?.suggestions)
          ? parsed.suggestions.map(item => truncateText(compactWhitespace(item), 180)).filter(Boolean).slice(0, 5)
          : [],
        actionItems: Array.isArray(parsed?.actionItems)
          ? parsed.actionItems
              .map(item => truncateText(compactWhitespace(typeof item === "string" ? item : item?.task || ""), 180))
              .filter(Boolean)
              .slice(0, 5)
          : [],
        mindmap: Array.isArray(parsed?.mindmap)
          ? parsed.mindmap
              .map(item => truncateText(compactWhitespace(typeof item === "string" ? item : item?.node || ""), 180))
              .filter(Boolean)
              .slice(0, 8)
          : [],
        displayText: truncateText(compactWhitespace(parsed?.displayText || ""), 220),
        reason: compactWhitespace(parsed?.reason || "")
      };
    } catch (_error) {
      return null;
    }
  }

  parseSummaryUpdate(rawText) {
    const clean = stripCodeFence(rawText);
    try {
      const parsed = JSON.parse(clean);
      return {
        updatedSummary: this.compactSummaryText(parsed?.updatedSummary || "", DEFAULTS.maxSummaryChars),
        carryForwardPoints: Array.isArray(parsed?.carryForwardPoints)
          ? parsed.carryForwardPoints.map(item => compactWhitespace(item)).filter(Boolean).slice(0, 8)
          : []
      };
    } catch (_error) {
      return null;
    }
  }

  composeDisplayText(insight) {
    if (!insight) return "";
    if (insight.displayText) return truncateText(insight.displayText, 220);

    const lines = [];
    if (insight.headline) lines.push(`Insight: ${insight.headline}`);
    if (insight.summary) lines.push(truncateText(insight.summary, 220));
    if (insight.actionItems.length) lines.push(`Acoes: ${insight.actionItems.join("; ")}`);
    if (insight.suggestions.length) lines.push(`Sugestoes: ${insight.suggestions.join("; ")}`);
    if (insight.mindmap.length) lines.push(`Mindmap: ${insight.mindmap.join(" | ")}`);
    return truncateText(lines.join("\n"), 420);
  }

  isDuplicate(session, displayText) {
    const signature = normalizeSignature(displayText);
    if (!signature) return false;
    const now = Date.now();
    const duplicate = signature === session.lastInsightSignature && now - session.lastInsightAt < 45000;
    if (!duplicate) {
      session.lastInsightSignature = signature;
      session.lastInsightAt = now;
    }
    return duplicate;
  }

  buildSummaryParagraph(insight = {}, pendingText = "") {
    const bestCandidate = compactWhitespace(
      insight.summary || insight.displayText || insight.headline || pendingText
    );
    return this.compactSummaryText(bestCandidate, 260);
  }

  appendSummaryParagraph(session, paragraph) {
    const value = compactWhitespace(paragraph);
    if (!value) return;

    const alreadyExists = session.summaryParagraphs.some(
      item => normalizeSignature(item) === normalizeSignature(value)
    );
    if (!alreadyExists) {
      session.summaryParagraphs.push(value);
    }

    if (session.summaryParagraphs.length > DEFAULTS.maxSummaryParagraphs) {
      const head = session.summaryParagraphs.slice(0, 12);
      const tail = session.summaryParagraphs.slice(-16);
      session.summaryParagraphs = [...head, ...tail];
    }
  }

  mergeUnique(list = [], items = [], limit = DEFAULTS.maxKnowledgeItems) {
    const merged = [...list];
    for (const item of items) {
      const value = compactWhitespace(item);
      if (!value) continue;
      const alreadyExists = merged.some(existing => normalizeSignature(existing) === normalizeSignature(value));
      if (!alreadyExists) {
        merged.push(value);
      }
    }
    if (merged.length <= limit) return merged;
    return merged.slice(merged.length - limit);
  }

  buildRiskSignals(insight = {}, pendingText = "") {
    const sourceText = normalizeForSignals(`${insight.headline || ""} ${insight.summary || ""} ${pendingText}`);
    const signals = [];

    if (/risco|atraso|bloque|impediment|erro|falha|impacto|dependenc|retrabalho|escalon|custo|instavel/.test(sourceText)) {
      signals.push(insight.summary || insight.headline || "Risco relevante identificado no contexto.");
    }
    if (/escopo|requisito novo|mudanca de requisito|sem aprovacao|decisao pendente|sem responsavel|sem dono|conflito/.test(sourceText)) {
      signals.push("Ha sinais de risco por escopo/decisao em aberto; confirmar dono e prazo.");
    }

    return signals.map(signal => compactWhitespace(signal)).filter(Boolean);
  }

  mergeSessionKnowledge(session, insight, pendingText) {
    session.keyTakeaways = this.mergeUnique(
      session.keyTakeaways,
      [insight.headline, insight.summary, ...insight.mindmap]
    );
    session.actionQueue = this.mergeUnique(
      session.actionQueue,
      [...insight.actionItems, ...insight.suggestions]
    );
    session.riskSignals = this.mergeUnique(
      session.riskSignals,
      this.buildRiskSignals(insight, pendingText),
      6
    );
  }

  mergeSessionComments(session, insight) {
    const candidates = [
      insight?.displayText,
      insight?.summary,
      insight?.headline,
      ...(Array.isArray(insight?.actionItems) ? insight.actionItems : []),
      ...(Array.isArray(insight?.suggestions) ? insight.suggestions : [])
    ];
    session.modelComments = this.compactModelComments(
      this.mergeUnique(session.modelComments, candidates, DEFAULTS.maxCommentItems),
      DEFAULTS.maxCommentItems
    );
  }

  composeEvolvingSummary(session) {
    const rolling = compactWhitespace(session.rollingSummary);
    if (rolling) {
      return this.compactSummaryText(rolling, DEFAULTS.maxSummaryChars);
    }

    const parts = [];
    const head = session.summaryParagraphs.slice(0, 6);
    const recent = session.summaryParagraphs.slice(-8);

    parts.push(...head);
    for (const paragraph of recent) {
      const duplicated = parts.some(item => normalizeSignature(item) === normalizeSignature(paragraph));
      if (!duplicated) {
        parts.push(paragraph);
      }
    }

    return this.compactSummaryText(parts.join("\n\n"), DEFAULTS.maxSummaryChars);
  }

  buildContextSnapshot(session) {
    const lines = [];
    const evolvingSummary = truncateText(this.composeEvolvingSummary(session), 700);
    if (evolvingSummary) {
      lines.push("Resumo vivo:");
      lines.push(evolvingSummary);
    }

    if (session.keyTakeaways.length > 0) {
      lines.push("");
      lines.push("Pontos-chave:");
      for (const item of session.keyTakeaways.slice(-6)) {
        lines.push(`- ${item}`);
      }
    }

    if (session.actionQueue.length > 0) {
      lines.push("");
      lines.push("Acoes sugeridas:");
      for (const item of session.actionQueue.slice(-5)) {
        lines.push(`- ${item}`);
      }
    }

    if (session.riskSignals.length > 0) {
      lines.push("");
      lines.push("Riscos/alertas:");
      for (const item of session.riskSignals.slice(-4)) {
        lines.push(`- ${item}`);
      }
    }

    if (session.modelComments.length > 0) {
      lines.push("");
      lines.push("Comentarios acumulados:");
      for (const item of session.modelComments.slice(-8)) {
        lines.push(`- ${item}`);
      }
    }

    return truncateText(lines.join("\n"), 1200);
  }

  resolveInsightModel() {
    const aiSettings = this.settingsStore?.getSettings?.().ai || {};
    if (aiSettings.provider === "openrouter" && aiSettings.model) {
      return aiSettings.model;
    }
    return DEFAULTS.model;
  }

  registerSummaryBacklog(session, pendingText, insight) {
    const pendingDigest = this.compactSummaryText(pendingText, 220);
    const blocks = [
      pendingDigest,
      insight?.summary || "",
      ...(Array.isArray(insight?.mindmap) ? insight.mindmap.slice(0, 2) : []),
      ...(Array.isArray(insight?.actionItems) ? insight.actionItems.slice(0, 2) : [])
    ]
      .map(item => compactWhitespace(item))
      .filter(Boolean)
      .join(" ");

    if (!blocks) return;
    session.summaryBacklog = truncateText(
      `${session.summaryBacklog}\n${blocks}`,
      DEFAULTS.summaryBacklogMaxChars
    );
  }

  async enforceCallInterval(session, fieldName, minIntervalMs, label) {
    const elapsed = Date.now() - (session[fieldName] || 0);
    if (elapsed < minIntervalMs) {
      const waitMs = minIntervalMs - elapsed;
      console.log(`RealtimeInsightService: waiting ${waitMs}ms before ${label} call`);
      await sleep(waitMs);
    }
    session[fieldName] = Date.now();
  }

  async maybeRefreshRollingSummary(session, source, recentWindow) {
    if (!compactWhitespace(session.summaryBacklog)) {
      session.rollingSummary = this.composeEvolvingSummary(session);
      return;
    }

    const elapsed = Date.now() - (session.lastSummaryModelCallAt || 0);
    if (elapsed < DEFAULTS.summaryMinIntervalMs) {
      session.rollingSummary = this.composeEvolvingSummary(session);
      return;
    }

    await this.enforceCallInterval(
      session,
      "lastSummaryModelCallAt",
      DEFAULTS.summaryMinIntervalMs,
      "summary"
    );

    try {
      const startedAt = Date.now();
      const prompt = this.buildSummaryPrompt({
        source,
        currentSummary: this.composeEvolvingSummary(session),
        recentWindow,
        backlog: session.summaryBacklog,
        keyTakeaways: session.keyTakeaways,
        actionQueue: session.actionQueue,
        riskSignals: session.riskSignals
      });
      console.log(`RealtimeInsightService: summary prompt start (source=${source})\n${prompt}\nRealtimeInsightService: summary prompt end (source=${source})`);

      const raw = await this.aiClient.generateText(prompt, {
        model: this.resolveInsightModel(),
        temperature: 0.1,
        maxOutputTokens: 260
      });
      console.log(`RealtimeInsightService: summary raw output (source=${source})="${truncateText(raw, 1000)}"`);

      const parsed = this.parseSummaryUpdate(raw);
      if (parsed?.updatedSummary) {
        session.rollingSummary = this.compactSummaryText(parsed.updatedSummary, DEFAULTS.maxSummaryChars);
        this.appendSummaryParagraph(session, parsed.updatedSummary);
      }
      if (parsed?.carryForwardPoints?.length) {
        session.keyTakeaways = this.mergeUnique(session.keyTakeaways, parsed.carryForwardPoints, 10);
        session.modelComments = this.compactModelComments(
          this.mergeUnique(session.modelComments, parsed.carryForwardPoints, DEFAULTS.maxCommentItems),
          DEFAULTS.maxCommentItems
        );
      }

      session.summaryBacklog = "";
      session.rollingSummary = this.composeEvolvingSummary(session);
      console.log(
        `RealtimeInsightService: summary refreshed (source=${source}, durationMs=${Date.now() - startedAt}, summaryChars=${session.rollingSummary.length})`
      );
    } catch (error) {
      console.warn("RealtimeInsightService: summary refresh failed", error?.message || error);
      session.rollingSummary = this.composeEvolvingSummary(session);
    }
  }

  scheduleSummaryRefresh(session, source, recentWindow) {
    if (session.summaryRefreshInFlight) return;
    session.summaryRefreshInFlight = true;
    this.maybeRefreshRollingSummary(session, source, recentWindow)
      .catch((error) => {
        console.warn("RealtimeInsightService: summary refresh scheduling failed", error?.message || error);
      })
      .finally(() => {
        session.summaryRefreshInFlight = false;
      });
  }

  async consumePending(session, payload) {
    session.processing = true;
    const source = session.source;
    const pendingText = session.pendingText;
    session.pendingText = "";
    session.lastProcessedAt = Date.now();

    const recentWindowRaw = session.recentChunks
      .map((chunk) => chunk.text)
      .join(" ");
    const recentWindow = truncateText(recentWindowRaw, DEFAULTS.maxRecentChars);
    const rollingSummary = truncateText(this.composeEvolvingSummary(session), DEFAULTS.maxSummaryChars);
    let insight = null;
    const startedAt = Date.now();

    console.log(`RealtimeInsightService: processing chunk (source=${source}, chars=${pendingText.length}, model=${this.resolveInsightModel()})`);

    try {
      const insightPrompt = this.buildInsightPrompt({
        source,
        rollingSummary,
        recentWindow,
        pendingText
      });
      console.log(`RealtimeInsightService: insight prompt start (source=${source})\n${insightPrompt}\nRealtimeInsightService: insight prompt end (source=${source})`);

      await this.enforceCallInterval(
        session,
        "lastInsightModelCallAt",
        DEFAULTS.insightMinIntervalMs,
        "insight"
      );

      const raw = await this.aiClient.generateText(insightPrompt, {
        model: this.resolveInsightModel(),
        temperature: 0.1,
        maxOutputTokens: DEFAULTS.maxOutputTokens
      });
      console.log(`RealtimeInsightService: raw model output (source=${source})="${truncateText(raw, 1200)}"`);

      insight = this.parseInsight(raw);
      if (!insight) {
        console.warn(`RealtimeInsightService: invalid JSON output from model (source=${source})`);
        const fallbackParagraph = this.buildSummaryParagraph({}, pendingText);
        this.appendSummaryParagraph(session, fallbackParagraph);
        this.registerSummaryBacklog(session, pendingText, null);
        this.scheduleSummaryRefresh(session, source, recentWindow);
        return {
          ok: true,
          source,
          relevant: false,
          reason: "invalid_json_output"
        };
      }

      const displayText = this.composeDisplayText(insight);
      const signalText = normalizeForSignals(`${pendingText} ${insight.summary} ${insight.headline}`);
      const businessSignal = /(decisao|requisit|escopo|dependenc|risco|bloque|impediment|acao|tarefa|plano|prioridade|alinhamento|aprovac|cliente|stakeholder|metrica|objetivo|entrega|prazo|deadline|roadmap|next step|proximo passo|tradeoff|aprendizado|causa e efeito)/i.test(
        signalText
      );
      const hasUsefulText = Boolean(displayText || insight.summary || insight.headline);
      const relevantByModel = insight.relevant && insight.relevanceScore >= DEFAULTS.relevanceThreshold;
      const relevantBySignal = insight.relevanceScore >= 50 && businessSignal && hasUsefulText;
      const relevant = (relevantByModel || relevantBySignal) && hasUsefulText;

      const paragraph = this.buildSummaryParagraph(insight, pendingText);
      this.appendSummaryParagraph(session, paragraph);
      this.registerSummaryBacklog(session, pendingText, insight);

      if (hasUsefulText) {
        this.mergeSessionKnowledge(session, insight, pendingText);
        this.mergeSessionComments(session, insight);
      }

      this.scheduleSummaryRefresh(session, source, recentWindow);

      if (!relevant) {
        console.log("RealtimeInsightService: insight filtered", {
          source,
          reason: insight.reason || "filtered_low_relevance",
          relevanceScore: insight.relevanceScore,
          modelRelevant: insight.relevant,
          hasDisplayText: Boolean(displayText),
          threshold: DEFAULTS.relevanceThreshold,
          durationMs: Date.now() - startedAt
        });
        return {
          ok: true,
          source,
          relevant: false,
          reason: insight.reason || "filtered_low_relevance",
          relevanceScore: insight.relevanceScore
        };
      }

      if (this.isDuplicate(session, displayText)) {
        console.log(`RealtimeInsightService: duplicate insight dropped (source=${source})`);
        return {
          ok: true,
          source,
          relevant: false,
          reason: "duplicate_insight",
          relevanceScore: insight.relevanceScore
        };
      }

      const normalizedDisplay = truncateText(displayText, 1200);
      const contextSnapshot = this.buildContextSnapshot(session);
      session.contextSnapshot = contextSnapshot;
      const modelComments = this.compactModelComments(session.modelComments, 12);

      const result = {
        ok: true,
        source,
        relevant: true,
        relevanceScore: insight.relevanceScore,
        insightType: insight.insightType || "summary",
        headline: insight.headline,
        summary: this.composeEvolvingSummary(session),
        suggestions: insight.suggestions,
        actionItems: insight.actionItems,
        mindmap: insight.mindmap,
        displayText: normalizedDisplay,
        contextSnapshot,
        rollingSummary: this.composeEvolvingSummary(session),
        modelComments,
        timestamp: Number(payload?.timestamp) || Date.now()
      };

      this.assistantService?.saveExplicitMemory?.(normalizedDisplay, {
        source: `live_insight_${source}`,
        insightType: result.insightType,
        relevanceScore: result.relevanceScore
      }).catch((error) => {
        console.error("RealtimeInsightService: failed to save insight memory", error);
      });

      this.emit("insight", result);
      console.log(
        `RealtimeInsightService: relevant insight generated (source=${source}, score=${result.relevanceScore}, durationMs=${Date.now() - startedAt}, summaryParagraphs=${session.summaryParagraphs.length}, comments=${session.modelComments.length})`
      );
      return result;
    } catch (error) {
      console.error("RealtimeInsightService: processing failed", error);
      const fallbackParagraph = this.buildSummaryParagraph(insight || {}, pendingText);
      this.appendSummaryParagraph(session, fallbackParagraph);
      this.registerSummaryBacklog(session, pendingText, insight);
      return {
        ok: false,
        source,
        relevant: false,
        reason: "processing_error",
        message: error?.message || "Falha no processamento de insight em tempo real."
      };
    } finally {
      session.processing = false;
      if (this.shouldProcess(session)) {
        this.consumePending(session, payload).catch((error) => {
          console.error("RealtimeInsightService: background drain failed", error);
        });
      }
    }
  }
}
