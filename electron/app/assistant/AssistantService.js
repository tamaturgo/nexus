import { buildContextualPrompt, JSON_OUTPUT_INSTRUCTIONS } from "./promptTemplates.js";

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

    const recentTurns = this.conversationMemoryStore?.listRecent?.(recentTurnsLimit) || [];

    let semanticItems = [];
    try {
      semanticItems = await this.vectorStore.search(text, semanticLimit, {
        includeTypes: ["conversation_user", "conversation", "explicit_memory", "voice_transcription"]
      });
      semanticItems = semanticItems.filter(item => this.isEligibleSemanticMemory(item));
      semanticItems = this.rankContextByRecency(semanticItems).slice(0, semanticLimit);
      console.log(`AssistantService: Retrieved ${semanticItems.length} semantic memory items.`);
    } catch (error) {
      console.error("AssistantService: Context retrieval failed", error);
    }

    const correctionHints = this.buildCorrectionHints(text, recentTurns);
    const basePrompt = buildContextualPrompt({
      userQuery: text,
      recentTurns,
      semanticItems,
      correctionHints
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
      : item.type === "conversation_user"
        ? 0.15
        : 0;

    return similarityScore * 0.7 + recencyBoost * 0.3 + typeBoost;
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
