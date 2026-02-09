import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import fetch from "node-fetch";

if (!global.fetch) {
  global.fetch = fetch;
}

dotenv.config();

export class GeminiClient {
  constructor() {
    this.client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }

  async generateText(prompt, options = {}) {
    const {
      model = "gemini-2.5-flash",
      temperature = 0.7,
      maxOutputTokens = 2000
    } = options;

    const response = await this.client.models.generateContent({
      model,
      contents: prompt,
      config: {
        temperature,
        maxOutputTokens
      }
    });

    return response.text.trim();
  }
}
