import { ipcMain } from "electron";
import { CHANNELS } from "../../../shared/ipc/channels.js";

export const registerAssistantHandlers = (assistantService) => {
  ipcMain.handle(CHANNELS.ASSISTANT.ASK_AI, async (_event, payload) => {
    if (typeof payload === "string") {
      return await assistantService.processQuery(payload);
    }
    const prompt = payload?.prompt || "";
    const options = payload?.options || {};
    return await assistantService.processQuery(prompt, options);
  });

  ipcMain.handle(CHANNELS.ASSISTANT.SAVE_MEMORY, async (_event, { text, metadata }) => {
    return await assistantService.saveExplicitMemory(text, metadata);
  });

  ipcMain.handle(CHANNELS.ASSISTANT.SAVE_TRANSCRIPTION, async (_event, { text, metadata }) => {
    return await assistantService.saveTranscription(text, metadata);
  });
};
