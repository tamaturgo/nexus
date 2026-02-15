import { app } from "electron";
import fs from "fs";
import path from "path";

const DEFAULT_RETENTION_DAYS = 30;
const DEFAULT_MAX_ITEMS = 500;

const normalizeLimit = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
};

const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export class ConversationMemoryStore {
  constructor(settingsStore) {
    this.settingsStore = settingsStore;
    this.filePath = path.join(app.getPath("userData"), "conversation-memory.json");
  }

  appendTurn(turn = {}) {
    const role = turn.role === "assistant" ? "assistant" : "user";
    const text = String(turn.text || "").trim();
    if (!text) return null;

    const now = Date.now();
    const item = {
      id: createId(),
      role,
      text,
      timestamp: Number(turn.timestamp) || now,
      createdAt: now,
      metadata: turn.metadata && typeof turn.metadata === "object" ? turn.metadata : {}
    };

    const data = this.loadAll();
    data.push(item);
    this.writeAll(this.applyRetention(data));
    return item;
  }

  listRecent(limit = 8) {
    const normalizedLimit = normalizeLimit(limit, 8);
    const data = this.loadAll()
      .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    if (!data.length) return [];
    return data.slice(-normalizedLimit);
  }

  getLastAssistantTurn() {
    const data = this.loadAll()
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    return data.find(item => item.role === "assistant") || null;
  }

  clearAll() {
    try {
      if (fs.existsSync(this.filePath)) {
        fs.unlinkSync(this.filePath);
      }
      return true;
    } catch (error) {
      console.error("ConversationMemoryStore: clear failed:", error);
      return false;
    }
  }

  getMemoryLimits() {
    const settings = this.settingsStore?.getSettings?.() || {};
    const memorySettings = settings.memory || {};

    return {
      retentionDays: normalizeLimit(memorySettings.retentionDays, DEFAULT_RETENTION_DAYS),
      maxItems: normalizeLimit(memorySettings.maxItems, DEFAULT_MAX_ITEMS)
    };
  }

  applyRetention(data) {
    if (!Array.isArray(data) || data.length === 0) return [];

    const { retentionDays, maxItems } = this.getMemoryLimits();
    const minTimestamp = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    const recent = data
      .filter(item => !item.timestamp || item.timestamp >= minTimestamp)
      .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    if (recent.length <= maxItems) return recent;
    return recent.slice(recent.length - maxItems);
  }

  loadAll() {
    try {
      if (!fs.existsSync(this.filePath)) return [];
      const raw = fs.readFileSync(this.filePath, "utf8").trim();
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error("ConversationMemoryStore: read failed:", error);
      return [];
    }
  }

  writeAll(data) {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error("ConversationMemoryStore: write failed:", error);
    }
  }
}
