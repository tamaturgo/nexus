import { GoogleGenAI } from "@google/genai";
import dotenv from 'dotenv';
import fetch from 'node-fetch';

if (!global.fetch) {
  global.fetch = fetch;
}

dotenv.config();

export class AIService {
  constructor() {
    this.client = new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY});
  }
  
  async generateResponse(prompt) {
    try {
        // Adiciona instruções de JSON ao prompt
        const enhancedPrompt = `${prompt}

IMPORTANTE: Responda APENAS com um objeto JSON válido seguindo esta estrutura exata:
{
  "answer": "Sua resposta principal aqui de forma clara e direta",
  "sections": [
    {
      "title": "Título da seção",
      "content": "Conteúdo detalhado aqui",
      "type": "text"
    }
  ]
}

Tipos válidos para "type": "text", "list", "code", "steps"
Use sections[] para organizar informações complexas (como listas, tutoriais, múltiplas partes).
Retorne APENAS o JSON, sem texto adicional antes ou depois.`;

        const response = await this.client.models.generateContent({
            model: "gemini-2.5-flash",
            contents: enhancedPrompt,
            config: {
                temperature: 0.7,
                maxOutputTokens: 2000
            }
        });
        
        let text = response.text.trim();
        
        // Remove markdown code blocks se presentes
        if (text.startsWith('```json')) {
            text = text.replace(/^```json\n?/, '').replace(/\n?```$/, '');
        } else if (text.startsWith('```')) {
            text = text.replace(/^```\n?/, '').replace(/\n?```$/, '');
        }
        
        console.log("AIService: Cleaned response (first 500 chars):", text.substring(0, 500));
        
        let rawJson;
        try {
            rawJson = JSON.parse(text);
        } catch (parseError) {
            console.error("AIService: JSON parse failed, using text as answer");
            return {
                answer: text,
                sections: [],
                citations: []
            };
        }
        
        // Normaliza a resposta
        const normalized = {
            answer: rawJson.answer || rawJson.response || text,
            sections: Array.isArray(rawJson.sections) 
                ? rawJson.sections
                    .filter(section => typeof section === 'object' && section.title && section.content)
                    .map(section => ({
                        title: String(section.title),
                        content: String(section.content),
                        type: ['text', 'list', 'code', 'steps'].includes(section.type) ? section.type : 'text'
                    }))
                : [],
            citations: Array.isArray(rawJson.citations)
                ? rawJson.citations
                    .filter(citation => typeof citation === 'object')
                    .map(citation => ({
                        source: String(citation.source || ""),
                        relevance: String(citation.relevance || "")
                    }))
                : []
        };
        
        console.log("AIService: Normalized with", normalized.sections.length, "sections");
        return normalized;
    } catch (error) {
        console.error("Error generating AI response:", error);
        return {
            answer: "Desculpe, ocorreu um erro ao gerar a resposta. Por favor, tente novamente.",
            sections: [],
            citations: []
        };
    }
  }
}
