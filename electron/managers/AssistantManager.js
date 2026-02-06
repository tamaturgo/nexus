import { buildContextualPrompt } from '../utils/promptTemplates.js';

export class AssistantManager {
  constructor(aiService, vectorStoreService) {
    this.aiService = aiService;
    this.vectorStoreService = vectorStoreService;
  }

  async processQuery(text) {
    console.log(`AssistantManager: Processing query: "${text}"`);

    // 1. Retrieve Context
    let contextItems = [];
    try {
      contextItems = await this.vectorStoreService.search(text, 5);
      console.log(`AssistantManager: Retrieved ${contextItems.length} context items.`);
    } catch (error) {
      console.error("AssistantManager: Context retrieval failed", error);
    }

    // 2. Augment Prompt
    const fullPrompt = buildContextualPrompt(text, contextItems);

    // 3. Generate Response (agora retorna objeto estruturado)
    let response = null;
    try {
      response = await this.aiService.generateResponse(fullPrompt);
    } catch (error) {
      console.error("AssistantManager: AI generation failed", error);
      throw error;
    }

    // 4. Persist Interaction (Fire and Forget)
    this.saveInteraction(text, response);

    return response;
  }

  async saveInteraction(userQuery, aiResponse) {
    try {
      const timestamp = Date.now();
      
      await this.vectorStoreService.addDocument(userQuery, {
        role: 'user',
        type: 'conversation',
        timestamp
      });

      if (aiResponse) {
        // Se a resposta é um objeto estruturado, salva o texto da resposta
        const responseText = typeof aiResponse === 'string' 
          ? aiResponse 
          : aiResponse.answer || JSON.stringify(aiResponse);
          
        await this.vectorStoreService.addDocument(responseText, {
            role: 'assistant',
            type: 'conversation',
            timestamp
        });
      }
      
      console.log("AssistantManager: Interaction saved to memory.");
    } catch (error) {
      console.error("AssistantManager: Failed to save interaction", error);
    }
  }

  async saveExplicitMemory(text, metadata) {
      return await this.vectorStoreService.addDocument(text, {
          ...metadata,
          timestamp: Date.now(), 
          type: 'explicit_memory'
      });
  }
}
