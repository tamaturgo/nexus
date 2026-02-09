import { ipcMain } from "electron";
import { CHANNELS } from "../../../shared/ipc/channels.js";

export const registerSystemCaptureHandlers = (systemCaptureController, windowService) => {
  if (!systemCaptureController) return;

  systemCaptureController.on("transcription", (payload) => {
    windowService.broadcast(CHANNELS.SYSTEM_CAPTURE.TRANSCRIPTION_EVENT, payload);
  });

  systemCaptureController.on("processing", (payload) => {
    windowService.broadcast(CHANNELS.SYSTEM_CAPTURE.PROCESSING_EVENT, payload);
  });

  systemCaptureController.on("status", (payload) => {
    windowService.broadcast(CHANNELS.SYSTEM_CAPTURE.STATUS_EVENT, payload);
  });

  systemCaptureController.on("error", (error) => {
    windowService.broadcast(CHANNELS.SYSTEM_CAPTURE.ERROR_EVENT, {
      message: error?.message || "Erro ao capturar audio do sistema."
    });
  });

  ipcMain.handle(CHANNELS.SYSTEM_CAPTURE.START, async (_event, options) => {
    try {
      return systemCaptureController.startCapture(options);
    } catch (error) {
      return {
        started: false,
        reason: "error",
        message: error?.message || "Erro ao iniciar captura do sistema.",
        devices: systemCaptureController.listDevices()
      };
    }
  });

  ipcMain.handle(CHANNELS.SYSTEM_CAPTURE.STOP, async () => {
    return systemCaptureController.stopCapture();
  });

  ipcMain.handle(CHANNELS.SYSTEM_CAPTURE.DEVICES, async () => {
    return systemCaptureController.listDevices();
  });
};