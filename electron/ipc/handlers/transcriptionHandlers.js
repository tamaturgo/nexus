import { ipcMain } from "electron";
import { CHANNELS } from "../../../shared/ipc/channels.js";

const compactWhitespace = (value) => String(value || "").replace(/\s+/g, " ").trim();
const truncateText = (value, maxChars = 220) => {
  const text = compactWhitespace(value);
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 3))}...`;
};

export const registerTranscriptionHandlers = (transcriber, realtimeInsightService, windowService) => {
  if (realtimeInsightService && windowService) {
    realtimeInsightService.on("insight", (payload) => {
      windowService.broadcast(CHANNELS.TRANSCRIPTION.INSIGHT_EVENT, payload);
    });
  }

  ipcMain.handle(CHANNELS.TRANSCRIPTION.TRANSCRIBE_AUDIO, async (_event, { audioBuffer, options }) => {
    try {
      const buffer = Buffer.from(audioBuffer);
      console.log(`Transcription IPC: transcribe-audio requested (bytes=${buffer.length}, language=${options?.language || "pt"})`);
      const result = await transcriber.transcribe(buffer, options);
      console.log(`Transcription IPC: whisper output="${truncateText(result?.text || "", 300)}"`);
      return result;
    } catch (error) {
      console.error("Transcription error:", error);
      throw error;
    }
  });

  ipcMain.handle(CHANNELS.TRANSCRIPTION.PROCESS_INSIGHT, async (_event, payload) => {
    if (!realtimeInsightService) {
      return {
        ok: false,
        relevant: false,
        reason: "insight_service_unavailable"
      };
    }

    const source = payload?.source || "mic";
    const textPreview = truncateText(payload?.text || "", 220);
    console.log(`Transcription IPC: process-insight requested (source=${source}, text="${textPreview}")`);
    const result = await realtimeInsightService.processChunk(payload || {});
    console.log("Transcription IPC: process-insight result", {
      source,
      ok: result?.ok,
      relevant: result?.relevant,
      reason: result?.reason,
      relevanceScore: result?.relevanceScore,
      insightType: result?.insightType,
      displayText: truncateText(result?.displayText || "", 220),
      contextSnapshot: truncateText(result?.contextSnapshot || "", 320)
    });
    return result;
  });

  ipcMain.handle(CHANNELS.TRANSCRIPTION.RESET_INSIGHT_SESSION, async (_event, payload) => {
    if (!realtimeInsightService) {
      return { ok: false, reason: "insight_service_unavailable" };
    }
    return realtimeInsightService.resetSession(payload?.source || "mic");
  });
};
