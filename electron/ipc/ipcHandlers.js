import { ipcMain, desktopCapturer } from 'electron';

export function registerHandlers(windowManager, assistantManager, whisperService) {
  
  // Window Management
  ipcMain.handle('start-window-drag', (event) => {
     // No-op or specific platform logic if needed
     // Usually handled by CSS app-region: drag
  });

  ipcMain.handle('resize-window', (event, { width, height }) => {
    windowManager.resizeWindow(width, height);
  });

  ipcMain.handle('open-window', (event, { type, payload }) => {
    if (type === 'context') {
      windowManager.openContextWindow(payload);
    } 
    // Add other types if needed
  });

  ipcMain.handle('update-context-window', (event, payload) => {
    windowManager.updateContextWindow(payload);
  });

  ipcMain.handle('close-current-window', (event) => {
    windowManager.closeCurrentWindow(event.sender);
  });

  ipcMain.handle('minimize-current-window', (event) => {
    windowManager.minimizeCurrentWindow(event.sender);
  });

  // Data / State
  ipcMain.handle('get-context-data', () => {
    return windowManager.latestContextData;
  });

  // AI Services
  ipcMain.handle('ask-ai', async (event, prompt) => {
    return await assistantManager.processQuery(prompt);
  });

  ipcMain.handle('save-memory', async (event, { text, metadata }) => {
    return await assistantManager.saveExplicitMemory(text, metadata);
  });

  // Voice Transcription
  ipcMain.handle('save-transcription', async (event, { text, metadata }) => {
    return await assistantManager.saveTranscription(text, metadata);
  });

  // Whisper transcription
  ipcMain.handle('transcribe-audio', async (event, { audioBuffer, options }) => {
    try {
      const buffer = Buffer.from(audioBuffer);
      const result = await whisperService.transcribe(buffer, options);
      return result;
    } catch (error) {
      console.error('Transcription error:', error);
      throw error;
    }
  });

  // Desktop Capturer for system audio
  ipcMain.handle('get-desktop-sources', async (event, options) => {
    const sources = await desktopCapturer.getSources(options);
    return sources;
  });

}
