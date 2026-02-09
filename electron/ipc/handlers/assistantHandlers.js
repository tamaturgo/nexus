import { ipcMain } from "electron";
import { CHANNELS } from "../../../shared/ipc/channels.js";

export const registerAssistantHandlers = (assistantService) => {
  ipcMain.handle(CHANNELS.ASSISTANT.ASK_AI, async (_event, prompt) => {
    return await assistantService.processQuery(prompt);
  });

  ipcMain.handle(CHANNELS.ASSISTANT.SAVE_MEMORY, async (_event, { text, metadata }) => {
    return await assistantService.saveExplicitMemory(text, metadata);
  });

  ipcMain.handle(CHANNELS.ASSISTANT.SAVE_TRANSCRIPTION, async (_event, { text, metadata }) => {
    return await assistantService.saveTranscription(text, metadata);
  });
};