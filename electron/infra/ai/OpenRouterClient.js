import { OpenRouter } from "@openrouter/sdk";
import dotenv from "dotenv";
import fetch from "node-fetch";

if (!global.fetch) {
  global.fetch = fetch;
}

dotenv.config();

const DEFAULT_MODEL = "arcee-ai/trinity-large-preview:free";

const extractMessageText = (content) => {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (!part) return "";
        if (typeof part === "string") return part;
        if (typeof part.text === "string") return part.text;
        if (typeof part.content === "string") return part.content;
        return "";
      })
      .join("")
      .trim();
  }

  if (content && typeof content === "object") {
    if (typeof content.text === "string") return content.text;
    if (typeof content.content === "string") return content.content;
  }

  return "";
};

export class OpenRouterClient {
  constructor() {
    this.client = new OpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });
  }

  async generateText(prompt, options = {}) {
    const {
      model = DEFAULT_MODEL,
      temperature = 0.7,
      maxOutputTokens = 2000
    } = options;

    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error("OPENROUTER_API_KEY is not configured.");
    }

    const response = await this.client.chat.send({
      chatGenerationParams: {
        model,
        messages: [{ role: "user", content: prompt }],
        temperature,
        maxTokens: maxOutputTokens
      }
    });

    const content =
      response?.choices?.[0]?.message?.content ??
      response?.choices?.[0]?.text ??
      response?.output_text ??
      "";

    const text = extractMessageText(content).trim();
    if (!text) {
      throw new Error("OpenRouter returned an empty response.");
    }

    return text;
  }
}
