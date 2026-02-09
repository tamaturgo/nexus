import { ipcMain } from "electron";
import { CHANNELS } from "../../../shared/ipc/channels.js";

export const registerWindowHandlers = (windowService) => {
  ipcMain.handle(CHANNELS.WINDOW.START_DRAG, () => {
    return undefined;
  });

  ipcMain.handle(CHANNELS.WINDOW.RESIZE, (_event, { width, height }) => {
    windowService.resizeWindow(width, height);
  });

  ipcMain.handle(CHANNELS.WINDOW.OPEN, (_event, { type, payload }) => {
    windowService.openWindow(type, payload);
  });

  ipcMain.handle(CHANNELS.WINDOW.CLOSE_CURRENT, (event) => {
    windowService.closeCurrentWindow(event.sender);
  });

  ipcMain.handle(CHANNELS.WINDOW.MINIMIZE_CURRENT, (event) => {
    windowService.minimizeCurrentWindow(event.sender);
  });
};