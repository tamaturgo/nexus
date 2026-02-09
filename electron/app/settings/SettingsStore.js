import { app } from "electron";
import fs from "fs";
import path from "path";
import { DEFAULT_SETTINGS } from "../../../shared/settings/defaults.js";

export class SettingsStore {
  constructor() {
    this.filePath = path.join(app.getPath("userData"), "settings.json");
  }

  getSettings() {
    try {
      if (!fs.existsSync(this.filePath)) {
        return { ...DEFAULT_SETTINGS };
      }
      const raw = fs.readFileSync(this.filePath, "utf8").trim();
      if (!raw) return { ...DEFAULT_SETTINGS };
      const parsed = JSON.parse(raw);
      return this.mergeSettings(parsed);
    } catch (error) {
      console.error("SettingsStore: failed to read settings:", error);
      return { ...DEFAULT_SETTINGS };
    }
  }

  saveSettings(partial = {}) {
    const current = this.getSettings();
    const next = this.mergeSettings({
      audio: { ...current.audio, ...(partial?.audio || {}) },
      ai: { ...current.ai, ...(partial?.ai || {}) },
      memory: { ...current.memory, ...(partial?.memory || {}) }
    });
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(next, null, 2));
    } catch (error) {
      console.error("SettingsStore: failed to save settings:", error);
    }
    return next;
  }

  resetSettings() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(DEFAULT_SETTINGS, null, 2));
    } catch (error) {
      console.error("SettingsStore: failed to reset settings:", error);
    }
    return { ...DEFAULT_SETTINGS };
  }

  deleteSettingsFile() {
    try {
      if (fs.existsSync(this.filePath)) {
        fs.unlinkSync(this.filePath);
      }
    } catch (error) {
      console.error("SettingsStore: failed to delete settings file:", error);
    }
  }

  mergeSettings(settings) {
    return {
      audio: {
        ...DEFAULT_SETTINGS.audio,
        ...(settings?.audio || {})
      },
      ai: {
        ...DEFAULT_SETTINGS.ai,
        ...(settings?.ai || {})
      },
      memory: {
        ...DEFAULT_SETTINGS.memory,
        ...(settings?.memory || {})
      }
    };
  }
}
