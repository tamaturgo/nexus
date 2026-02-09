import { app } from "electron";
import fs from "fs";
import path from "path";

export class ContextHistoryStore {
  constructor() {
    this.filePath = path.join(app.getPath("userData"), "context-history.json");
  }

  list() {
    const data = this.loadAll();
    return data.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  get(contextId) {
    const data = this.loadAll();
    return data.find(item => item.contextId === contextId) || null;
  }

  save(payload) {
    if (!payload?.contextId) {
      throw new Error("contextId is required");
    }
    const data = this.loadAll();
    const now = Date.now();
    const index = data.findIndex(item => item.contextId === payload.contextId);
    if (index >= 0) {
      data[index] = {
        ...data[index],
        ...payload,
        updatedAt: now
      };
    } else {
      data.push({
        favorite: false,
        createdAt: now,
        updatedAt: now,
        ...payload
      });
    }
    this.writeAll(data);
    return payload.contextId;
  }

  toggleFavorite(contextId) {
    const data = this.loadAll();
    const index = data.findIndex(item => item.contextId === contextId);
    if (index < 0) return null;
    data[index].favorite = !data[index].favorite;
    data[index].updatedAt = Date.now();
    this.writeAll(data);
    return data[index];
  }

  remove(contextId) {
    const data = this.loadAll();
    const next = data.filter(item => item.contextId !== contextId);
    this.writeAll(next);
    return true;
  }

  loadAll() {
    try {
      if (!fs.existsSync(this.filePath)) return [];
      const raw = fs.readFileSync(this.filePath, "utf8").trim();
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error("ContextHistoryStore: read failed:", error);
      return [];
    }
  }

  writeAll(data) {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error("ContextHistoryStore: write failed:", error);
    }
  }
}
