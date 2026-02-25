import fs from "fs";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

const NOTE_TYPES = new Set(["note", "task", "idea", "reference"]);
const PRIORITY_LEVELS = ["low", "medium", "high"];
const PRIORITY_INDEX = new Map(PRIORITY_LEVELS.map((value, index) => [value, index]));
const NOTE_SOURCES = new Set(["text", "audio"]);

const normalizeString = (value, fallback = "") => {
  if (typeof value !== "string") return fallback;
  return value.trim();
};

const normalizeArray = (value) => {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const normalized = [];
  for (const entry of value) {
    const text = normalizeString(entry);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(text);
  }
  return normalized;
};

const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

const normalizeType = (value) => {
  const lower = normalizeString(value, "note").toLowerCase();
  return NOTE_TYPES.has(lower) ? lower : "note";
};

const normalizePriority = (value) => {
  const lower = normalizeString(value, "medium").toLowerCase();
  return PRIORITY_INDEX.has(lower) ? lower : "medium";
};

const normalizeSource = (value) => {
  const lower = normalizeString(value, "text").toLowerCase();
  return NOTE_SOURCES.has(lower) ? lower : "text";
};

const normalizeTimestamp = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
};

const normalizeOptionalTimestamp = (value, fallback = null) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
};

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);

const stripAccents = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const tokenize = (value) =>
  stripAccents(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter(Boolean);

const jaccard = (left, right) => {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  if (leftSet.size === 0 || rightSet.size === 0) return 0;

  let intersection = 0;
  for (const token of leftSet) {
    if (rightSet.has(token)) intersection += 1;
  }
  const union = new Set([...leftSet, ...rightSet]).size;
  if (!union) return 0;
  return intersection / union;
};

const overlapCoefficient = (left, right) => {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  if (leftSet.size === 0 || rightSet.size === 0) return 0;

  let intersection = 0;
  for (const token of leftSet) {
    if (rightSet.has(token)) intersection += 1;
  }

  const denominator = Math.min(leftSet.size, rightSet.size);
  if (!denominator) return 0;
  return intersection / denominator;
};

const scoreSimilarity = (queryTokens, noteTokens, noteTitleTokens) => {
  const bodyJaccard = jaccard(queryTokens, noteTokens);
  const titleOverlap = overlapCoefficient(queryTokens, noteTitleTokens);
  const blended = titleOverlap * 0.75 + bodyJaccard * 0.25;
  return Math.max(bodyJaccard, blended);
};

export class NoteStore {
  constructor({ filePath } = {}) {
    this.filePath = filePath || path.join(this.resolveUserDataPath(), "notes.json");
  }

  list() {
    const data = this.loadAll();
    return data.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  get(noteId) {
    const id = normalizeString(noteId);
    if (!id) return null;
    const data = this.loadAll();
    return data.find((item) => item.id === id) || null;
  }

  create(payload = {}) {
    const now = Date.now();
    const note = this.normalizeNote({
      id: createId(),
      title: payload.title || "",
      body: payload.body || "",
      type: payload.type || "note",
      priority: payload.priority || "medium",
      tags: payload.tags || [],
      source: payload.source || "text",
      dueAt: payload.dueAt ?? null,
      isCompleted: payload.isCompleted ?? false,
      completedAt: payload.completedAt ?? null,
      createdAt: now,
      updatedAt: now
    });

    const data = this.loadAll();
    data.push(note);
    this.writeAll(data);
    return note;
  }

  update(noteId, patch = {}) {
    const id = normalizeString(noteId);
    if (!id) return null;

    const data = this.loadAll();
    const index = data.findIndex((item) => item.id === id);
    if (index < 0) return null;

    const previous = data[index];
    const merged = {
      ...previous,
      ...patch,
      id: previous.id,
      createdAt: previous.createdAt,
      updatedAt: Date.now()
    };

    data[index] = this.normalizeNote(merged);
    this.writeAll(data);
    return data[index];
  }

  remove(noteId) {
    const id = normalizeString(noteId);
    if (!id) return false;
    const data = this.loadAll();
    const next = data.filter((item) => item.id !== id);
    if (next.length === data.length) return false;
    this.writeAll(next);
    return true;
  }

  findCandidatesBySimilarity(text, { limit = 6 } = {}) {
    const queryTokens = tokenize(text);
    if (!queryTokens.length) return [];

    const notes = this.list();
    const scored = notes
      .map((note) => {
        const noteTokens = tokenize(`${note.title}\n${note.body}`);
        const titleTokens = tokenize(note.title);
        const similarity = scoreSimilarity(queryTokens, noteTokens, titleTokens);
        return { note, similarity };
      })
      .filter((entry) => entry.similarity > 0)
      .sort((a, b) => b.similarity - a.similarity);

    return scored.slice(0, Math.max(1, Number(limit) || 6));
  }

  mergePriority(firstPriority, secondPriority) {
    const first = normalizePriority(firstPriority);
    const second = normalizePriority(secondPriority);
    const firstRank = PRIORITY_INDEX.get(first) ?? 1;
    const secondRank = PRIORITY_INDEX.get(second) ?? 1;
    return firstRank >= secondRank ? first : second;
  }

  normalizeNote(value = {}) {
    const now = Date.now();
    const hasIsCompleted = hasOwn(value, "isCompleted");
    const normalizedCompletedAt = normalizeOptionalTimestamp(value.completedAt, null);

    let isCompleted = false;
    if (hasIsCompleted) {
      isCompleted = Boolean(value.isCompleted);
    } else {
      isCompleted = normalizedCompletedAt !== null;
    }

    const completedAt = isCompleted
      ? (normalizedCompletedAt || now)
      : null;

    return {
      id: normalizeString(value.id, createId()),
      title: normalizeString(value.title, "Sem titulo"),
      body: normalizeString(value.body),
      type: normalizeType(value.type),
      priority: normalizePriority(value.priority),
      tags: normalizeArray(value.tags),
      source: normalizeSource(value.source),
      dueAt: normalizeOptionalTimestamp(value.dueAt, null),
      isCompleted,
      completedAt,
      createdAt: normalizeTimestamp(value.createdAt, now),
      updatedAt: normalizeTimestamp(value.updatedAt, now)
    };
  }

  loadAll() {
    try {
      if (!fs.existsSync(this.filePath)) return [];
      const raw = fs.readFileSync(this.filePath, "utf8").trim();
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((entry) => entry && typeof entry === "object")
        .map((entry) => this.normalizeNote(entry));
    } catch (error) {
      console.error("NoteStore: read failed:", error);
      return [];
    }
  }

  writeAll(data) {
    try {
      const normalized = Array.isArray(data) ? data.map((entry) => this.normalizeNote(entry)) : [];
      fs.writeFileSync(this.filePath, JSON.stringify(normalized, null, 2));
    } catch (error) {
      console.error("NoteStore: write failed:", error);
    }
  }

  resolveUserDataPath() {
    try {
      const electron = require("electron");
      if (electron?.app?.getPath) {
        return electron.app.getPath("userData");
      }
    } catch (_error) {
    }
    return process.cwd();
  }
}
