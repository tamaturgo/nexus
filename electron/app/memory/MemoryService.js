import { app } from "electron";
import fs from "fs";
import path from "path";

export class MemoryService {
  constructor(vectorStore, settingsStore, conversationMemoryStore) {
    this.vectorStore = vectorStore;
    this.settingsStore = settingsStore;
    this.conversationMemoryStore = conversationMemoryStore;
    this.userDataPath = app.getPath("userData");
    this.historyPath = path.join(this.userDataPath, "context-history.json");
  }

  async clearAll() {
    console.log("MemoryService: clearAll started");

    const details = {
      vectorStore: false,
      contextHistory: false,
      conversationMemory: false,
      settings: false
    };
    const errors = [];

    try {
      if (this.vectorStore?.clearAll) {
        await this.vectorStore.clearAll();
        details.vectorStore = true;
      } else if (this.vectorStore?.dbPath && fs.existsSync(this.vectorStore.dbPath)) {
        fs.rmSync(this.vectorStore.dbPath, { recursive: true, force: true });
        details.vectorStore = true;
      }
    } catch (error) {
      console.error("MemoryService: failed to clear vector store:", error);
      errors.push({ step: "vectorStore", message: error?.message || String(error) });
    }

    try {
      if (fs.existsSync(this.historyPath)) {
        fs.unlinkSync(this.historyPath);
      }
      details.contextHistory = true;
    } catch (error) {
      console.error("MemoryService: failed to delete history:", error);
      errors.push({ step: "contextHistory", message: error?.message || String(error) });
    }

    try {
      if (this.conversationMemoryStore?.clearAll) {
        details.conversationMemory = !!this.conversationMemoryStore.clearAll();
      } else {
        details.conversationMemory = true;
      }
    } catch (error) {
      console.error("MemoryService: failed to delete conversation memory:", error);
      errors.push({ step: "conversationMemory", message: error?.message || String(error) });
    }

    try {
      if (this.settingsStore?.deleteSettingsFile) {
        this.settingsStore.deleteSettingsFile();
      }
      details.settings = true;
    } catch (error) {
      console.error("MemoryService: failed to clear settings:", error);
      errors.push({ step: "settings", message: error?.message || String(error) });
    }

    const cleared = Object.values(details).every(Boolean);
    const result = {
      ok: cleared,
      cleared,
      details,
      errors,
      message: cleared
        ? "Memoria limpa com sucesso."
        : "Limpeza parcial da memoria. Verifique os logs.",
      timestamp: Date.now()
    };

    console.log("MemoryService: clearAll completed", result);
    return result;
  }
}
