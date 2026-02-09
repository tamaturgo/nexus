export class WindowService {
  constructor(windowManager) {
    this.windowManager = windowManager;
  }

  resizeWindow(width, height) {
    this.windowManager.resizeWindow(width, height);
  }

  openWindow(type, payload) {
    if (type === "context") {
      this.windowManager.openContextWindow(payload);
      return;
    }

    this.windowManager.createWindow(type);
  }

  updateContextWindow(payload) {
    this.windowManager.updateContextWindow(payload);
  }

  broadcast(channel, payload) {
    this.windowManager.broadcast(channel, payload);
  }

  closeCurrentWindow(webContents) {
    this.windowManager.closeCurrentWindow(webContents);
  }

  minimizeCurrentWindow(webContents) {
    this.windowManager.minimizeCurrentWindow(webContents);
  }

  getContextData(webContents) {
    return this.windowManager.getContextDataForWebContents(webContents);
  }
}
