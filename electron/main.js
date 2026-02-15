import { app, globalShortcut } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import { WindowManager } from "./infra/window/WindowManager.js";
import { WindowService } from "./app/window/WindowService.js";
import { OpenRouterClient } from "./infra/ai/OpenRouterClient.js";
import { LanceDbVectorStore } from "./infra/vectorstore/LanceDbVectorStore.js";
import { WhisperCliTranscriber } from "./infra/transcription/WhisperCliTranscriber.js";
import { SystemCaptureController } from "./app/audio/SystemCaptureController.js";
import { AssistantService } from "./app/assistant/AssistantService.js";
import { RealtimeInsightService } from "./app/transcription/RealtimeInsightService.js";
import { SettingsStore } from "./app/settings/SettingsStore.js";
import { MemoryService } from "./app/memory/MemoryService.js";
import { ConversationMemoryStore } from "./app/memory/ConversationMemoryStore.js";
import { ContextHistoryStore } from "./app/context/ContextHistoryStore.js";
import { registerHandlers } from "./ipc/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const windowManager = new WindowManager(__dirname);
const windowService = new WindowService(windowManager);
const aiClient = new OpenRouterClient();
const vectorStore = new LanceDbVectorStore();
const transcriber = new WhisperCliTranscriber();
const systemCaptureController = new SystemCaptureController(transcriber);
const settingsStore = new SettingsStore();
const conversationMemoryStore = new ConversationMemoryStore(settingsStore);
const memoryService = new MemoryService(vectorStore, settingsStore, conversationMemoryStore);
const assistantService = new AssistantService(aiClient, vectorStore, settingsStore, conversationMemoryStore);
const realtimeInsightService = new RealtimeInsightService(aiClient, settingsStore, assistantService);
const contextHistoryStore = new ContextHistoryStore();

app.whenReady().then(async () => {
  await vectorStore.initialize();
  await transcriber.initialize();

  registerHandlers({
    windowService,
    assistantService,
    transcriber,
    realtimeInsightService,
    systemCaptureController,
    settingsStore,
    memoryService,
    contextHistoryStore
  });

  globalShortcut.register("CommandOrControl+Alt+Space", () => {
    windowManager.toggleSearchWindow();
  });

  windowManager.createWindow("search");

  app.on("activate", () => {
    if (!windowManager.getSearchWindow()) {
      windowManager.createWindow("search");
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
