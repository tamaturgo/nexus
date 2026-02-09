import { buildContextualPrompt, JSON_OUTPUT_INSTRUCTIONS } from "./promptTemplates.js";

export class AssistantService {
  constructor(aiClient, vectorStore, settingsStore) {
    this.aiClient = aiClient;
    this.vectorStore = vectorStore;
    this.settingsStore = settingsStore;
  }

  async processQuery(text, options = {}) {
    console.log(`AssistantService: Processing query: "${text}"`);

    let contextItems = [];
    try {
      contextItems = await this.vectorStore.search(text, 5);
      console.log(`AssistantService: Retrieved ${contextItems.length} context items.`);
    } catch (error) {
      console.error("AssistantService: Context retrieval failed", error);
    }

    const basePrompt = buildContextualPrompt(text, contextItems);
    const fullPrompt = `${basePrompt}\n${JSON_OUTPUT_INSTRUCTIONS}`;

    let response = null;
    try {
      const aiSettings = this.settingsStore?.getSettings?.().ai || {};
      const rawText = await this.aiClient.generateText(fullPrompt, {
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

    this.saveInteraction(text, response);

    return response;
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

      await this.vectorStore.addDocument(userQuery, {
        role: "user",
        type: "conversation",
        timestamp
      });

      if (aiResponse) {
        const responseText = typeof aiResponse === "string"
          ? aiResponse
          : aiResponse.answer || JSON.stringify(aiResponse);

        await this.vectorStore.addDocument(responseText, {
          role: "assistant",
          type: "conversation",
          timestamp
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
