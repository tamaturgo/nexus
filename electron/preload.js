import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Função para iniciar o drag da janela
  startDrag: () => {
    ipcRenderer.invoke('start-window-drag');
  },
  resizeWindow: (width, height) => {
    ipcRenderer.invoke('resize-window', { width, height });
  }
});
