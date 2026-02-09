import { ipcMain, desktopCapturer } from "electron";
import { CHANNELS } from "../../../shared/ipc/channels.js";

export const registerDesktopCaptureHandlers = () => {
  ipcMain.handle(CHANNELS.DESKTOP_CAPTURE.GET_SOURCES, async (_event, options) => {
    return await desktopCapturer.getSources(options);
  });
};