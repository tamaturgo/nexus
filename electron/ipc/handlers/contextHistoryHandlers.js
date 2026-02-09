import { ipcMain } from "electron";
import { CHANNELS } from "../../../shared/ipc/channels.js";

export const registerContextHistoryHandlers = (historyStore) => {
  if (!historyStore) return;

  ipcMain.handle(CHANNELS.CONTEXT_HISTORY.LIST, async () => {
    return historyStore.list();
  });

  ipcMain.handle(CHANNELS.CONTEXT_HISTORY.GET, async (_event, { contextId }) => {
    return historyStore.get(contextId);
  });

  ipcMain.handle(CHANNELS.CONTEXT_HISTORY.SAVE, async (_event, payload) => {
    return historyStore.save(payload);
  });

  ipcMain.handle(CHANNELS.CONTEXT_HISTORY.FAVORITE, async (_event, { contextId }) => {
    return historyStore.toggleFavorite(contextId);
  });

  ipcMain.handle(CHANNELS.CONTEXT_HISTORY.DELETE, async (_event, { contextId }) => {
    return historyStore.remove(contextId);
  });
};
