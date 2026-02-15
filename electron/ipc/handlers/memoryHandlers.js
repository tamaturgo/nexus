import { ipcMain } from "electron";
import { CHANNELS } from "../../../shared/ipc/channels.js";

export const registerMemoryHandlers = (memoryService) => {
  if (!memoryService) return;

  ipcMain.handle(CHANNELS.MEMORY.CLEAR_ALL, async () => {
    console.log("Memory IPC: clear-all requested");
    try {
      const result = await memoryService.clearAll();
      console.log("Memory IPC: clear-all result", result);
      return result;
    } catch (error) {
      console.error("Memory IPC: clear-all failed", error);
      return {
        ok: false,
        cleared: false,
        message: error?.message || "Falha ao limpar memoria."
      };
    }
  });
};
