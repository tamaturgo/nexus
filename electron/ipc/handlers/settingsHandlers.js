import { ipcMain } from "electron";
import { CHANNELS } from "../../../shared/ipc/channels.js";

export const registerSettingsHandlers = (settingsStore) => {
  if (!settingsStore) return;

  ipcMain.handle(CHANNELS.SETTINGS.GET, async () => {
    return settingsStore.getSettings();
  });

  ipcMain.handle(CHANNELS.SETTINGS.SAVE, async (_event, partial) => {
    return settingsStore.saveSettings(partial);
  });

  ipcMain.handle(CHANNELS.SETTINGS.RESET, async () => {
    return settingsStore.resetSettings();
  });
};
