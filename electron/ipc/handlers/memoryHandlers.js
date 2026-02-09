import { ipcMain } from "electron";
import { CHANNELS } from "../../../shared/ipc/channels.js";

export const registerMemoryHandlers = (memoryService) => {
  if (!memoryService) return;

  ipcMain.handle(CHANNELS.MEMORY.CLEAR_ALL, async () => {
    return memoryService.clearAll();
  });
};
