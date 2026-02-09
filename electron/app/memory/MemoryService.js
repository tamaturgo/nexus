import { app } from "electron";
import fs from "fs";
import path from "path";

export class MemoryService {
  constructor(vectorStore, settingsStore) {
    this.vectorStore = vectorStore;
    this.settingsStore = settingsStore;
    this.userDataPath = app.getPath("userData");
    this.historyPath = path.join(this.userDataPath, "context-history.json");
  }

  async clearAll() {
    try {
      if (this.vectorStore?.clearAll) {
        await this.vectorStore.clearAll();
      } else if (this.vectorStore?.dbPath && fs.existsSync(this.vectorStore.dbPath)) {
        fs.rmSync(this.vectorStore.dbPath, { recursive: true, force: true });
      }
    } catch (error) {
      console.error("MemoryService: failed to clear vector store:", error);
    }

    try {
      if (fs.existsSync(this.historyPath)) {
        fs.unlinkSync(this.historyPath);
      }
    } catch (error) {
      console.error("MemoryService: failed to delete history:", error);
    }

    try {
      if (this.settingsStore?.deleteSettingsFile) {
        this.settingsStore.deleteSettingsFile();
      }
    } catch (error) {
      console.error("MemoryService: failed to clear settings:", error);
    }

    return { cleared: true };
  }
}
