import { ipcMain } from "electron";
import { CHANNELS } from "../../../shared/ipc/channels.js";

export const registerTranscriptionHandlers = (transcriber) => {
  ipcMain.handle(CHANNELS.TRANSCRIPTION.TRANSCRIBE_AUDIO, async (_event, { audioBuffer, options }) => {
    try {
      const buffer = Buffer.from(audioBuffer);
      const result = await transcriber.transcribe(buffer, options);
      return result;
    } catch (error) {
      console.error("Transcription error:", error);
      throw error;
    }
  });
};