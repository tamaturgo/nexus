import { app, globalShortcut, Menu, Tray, nativeImage } from "electron";
import path from "path";
import fs from "fs";
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
import { NoteStore } from "./app/notes/NoteStore.js";
import { NoteService } from "./app/notes/NoteService.js";
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
const noteStore = new NoteStore();
const noteService = new NoteService({
  noteStore,
  aiClient,
  settingsStore,
  vectorStore
});
const memoryService = new MemoryService(vectorStore, settingsStore, conversationMemoryStore, noteStore);
const assistantService = new AssistantService(aiClient, vectorStore, settingsStore, conversationMemoryStore);
const realtimeInsightService = new RealtimeInsightService(aiClient, settingsStore, assistantService);
const contextHistoryStore = new ContextHistoryStore();

let tray = null;
let isQuitting = false;

const FALLBACK_TRAY_ICON_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9pR0fWkAAAAASUVORK5CYII=";

const resolveTrayIcon = () => {
  const preferredPath = path.join(__dirname, "../resources/icons/tray.png");

  if (fs.existsSync(preferredPath)) {
    const preferred = nativeImage.createFromPath(preferredPath);
    if (!preferred.isEmpty()) {
      return preferred;
    }
    console.warn("Main: tray icon exists but failed to load. Falling back to executable icon.");
  } else {
    console.warn("Main: tray icon not found at resources/icons/tray.png. Falling back.");
  }

  const executableIcon = nativeImage.createFromPath(process.execPath);
  if (!executableIcon.isEmpty()) {
    return executableIcon;
  }

  return nativeImage.createFromDataURL(FALLBACK_TRAY_ICON_DATA_URL);
};

const buildTrayMenu = () => Menu.buildFromTemplate([
  {
    label: "Mostrar/Ocultar Quick Note",
    click: () => {
      windowManager.toggleSearchWindow();
    }
  },
  {
    label: "Abrir Notes",
    click: () => {
      windowManager.createWindow("notes");
    }
  },
  {
    label: "Abrir Settings",
    click: () => {
      windowManager.createWindow("settings");
    }
  },
  { type: "separator" },
  {
    label: "Sair",
    click: () => {
      isQuitting = true;
      windowManager.setAppQuitting(true);
      app.quit();
    }
  }
]);

const initializeTray = () => {
  if (tray) return;
  tray = new Tray(resolveTrayIcon());
  tray.setToolTip("Recally");
  tray.setContextMenu(buildTrayMenu());
  tray.on("double-click", () => windowManager.toggleSearchWindow());
};

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
    contextHistoryStore,
    noteStore,
    noteService
  });

  globalShortcut.register("CommandOrControl+Alt+Space", () => {
    windowManager.toggleSearchWindow();
  });

  initializeTray();
  windowManager.createWindow("search");

  app.on("activate", () => {
    const searchWindow = windowManager.getSearchWindow();
    if (!searchWindow) {
      windowManager.createWindow("search");
      return;
    }
    if (!searchWindow.isDestroyed()) {
      searchWindow.show();
      searchWindow.focus();
    }
  });
});

app.on("before-quit", () => {
  isQuitting = true;
  windowManager.setAppQuitting(true);
});

app.on("window-all-closed", () => {
  if (!isQuitting) return;
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
