import { ipcMain } from 'electron';

export function registerHandlers(windowManager, assistantManager) {
  
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

}
