import { ipcMain } from "electron";
import { CHANNELS } from "../../../shared/ipc/channels.js";

export const registerContextHandlers = (windowService) => {
  ipcMain.handle(CHANNELS.WINDOW.UPDATE_CONTEXT, (_event, payload) => {
    windowService.updateContextWindow(payload);
  });

  ipcMain.handle(CHANNELS.WINDOW.GET_CONTEXT_DATA, (event) => {
    return windowService.getContextData(event.sender);
  });
};
