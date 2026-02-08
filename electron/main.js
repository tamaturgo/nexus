import { app, globalShortcut } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { WindowManager } from './managers/WindowManager.js';
import { AIService } from './services/AIService.js';
import { VectorStoreService } from './services/VectorStoreService.js';
import { WhisperService } from './services/WhisperService.js';
import { SystemAudioCaptureService } from './services/SystemAudioCaptureService.js';
import { AssistantManager } from './managers/AssistantManager.js';
import { registerHandlers } from './ipc/ipcHandlers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Services
// We pass __dirname so WindowManager knows where preload.cjs is relative to main.js
const windowManager = new WindowManager(__dirname);
const aiService = new AIService();
const vectorStoreService = new VectorStoreService();
const whisperService = new WhisperService();
const systemAudioService = new SystemAudioCaptureService(whisperService);
const assistantManager = new AssistantManager(aiService, vectorStoreService); 

// App Lifecycle
app.whenReady().then(async () => {
  // Init Async Services
  await vectorStoreService.initialize();
  await whisperService.initialize();

  // Register IPC Handlers
  registerHandlers(windowManager, assistantManager, whisperService, systemAudioService);

  // Global Shortcuts
  globalShortcut.register('CommandOrControl+Alt+Space', () => {
    windowManager.toggleSearchWindow();
  });

  // Init Main Window
  windowManager.createWindow('search');

  app.on('activate', () => {
    if (!windowManager.getSearchWindow()) {
      windowManager.createWindow('search');
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
