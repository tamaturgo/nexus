import { BrowserWindow, screen, app } from "electron";
import path from "path";
import fs from "fs";
import { CHANNELS } from "../../../shared/ipc/channels.js";

const isDev = process.env.NODE_ENV !== "production";
const DEV_URL = "http://localhost:5173";

export class WindowManager {
  constructor(rootPath) {
    this.rootPath = rootPath;
    this.windows = {
      search: null,
      context: null,
      settings: null,
      history: null,
      notes: null
    };
    this.contextWindows = new Map();
    this.contextDataByWebContentsId = new Map();
    this.isSearchWindowVisible = false;
    this.latestContextData = null;
    this.isAppQuitting = false;

    this.userDataPath = app.getPath("userData");
    this.configPaths = {
      search: path.join(this.userDataPath, "window-config-search.json"),
      context: path.join(this.userDataPath, "window-config-context.json"),
      settings: path.join(this.userDataPath, "window-config-settings.json"),
      history: path.join(this.userDataPath, "window-config-history.json"),
      notes: path.join(this.userDataPath, "window-config-notes.json")
    };
  }

  setAppQuitting(isAppQuitting) {
    this.isAppQuitting = Boolean(isAppQuitting);
  }

  isFullScreenWindowType(windowType) {
    return windowType === "settings" || windowType === "notes";
  }

  shouldUseSavedBounds(windowType) {
    return !this.isFullScreenWindowType(windowType);
  }

  getDefaultBounds(windowType) {
    if (this.isFullScreenWindowType(windowType)) {
      const primaryDisplay = screen.getPrimaryDisplay();
      const { x, y, width, height } = primaryDisplay.workArea;
      return { x, y, width, height };
    }

    if (windowType === "search") {
      return this.centerBounds({ width: 600, height: 180 });
    }
    if (windowType === "history") {
      return this.centerBounds({ width: 600, height: 720 });
    }
    return this.centerBounds({ width: 600, height: 600 });
  }

  centerBounds({ width, height }) {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
    return {
      x: Math.round((screenWidth - width) / 2),
      y: Math.round((screenHeight - height) / 2),
      width,
      height
    };
  }

  saveWindowPosition(windowType, windowRef = null) {
    if (!this.shouldUseSavedBounds(windowType)) return;
    const targetWindow = windowRef || this.windows[windowType];
    try {
      if (!targetWindow || targetWindow.isDestroyed()) return;
      const bounds = targetWindow.getBounds();
      const config = { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
      fs.writeFileSync(this.configPaths[windowType], JSON.stringify(config, null, 2));
    } catch (error) {
      console.warn(`WindowManager: failed to save bounds for ${windowType}`, error);
    }
  }

  loadWindowPosition(windowType, defaultBounds) {
    if (!this.shouldUseSavedBounds(windowType)) {
      return defaultBounds;
    }

    try {
      if (fs.existsSync(this.configPaths[windowType])) {
        const fileContent = fs.readFileSync(this.configPaths[windowType], "utf8").trim();
        if (fileContent) {
          const config = JSON.parse(fileContent);
          if (
            Number.isFinite(config?.x)
            && Number.isFinite(config?.y)
            && Number.isFinite(config?.width)
            && Number.isFinite(config?.height)
          ) {
            return config;
          }
        }
      }
    } catch (error) {
      console.warn(`WindowManager: failed to load bounds for ${windowType}`, error);
      try {
        if (fs.existsSync(this.configPaths[windowType])) {
          fs.unlinkSync(this.configPaths[windowType]);
        }
      } catch (cleanupError) {
        console.warn(`WindowManager: failed to cleanup bounds for ${windowType}`, cleanupError);
      }
    }

    return defaultBounds;
  }

  createWindow(windowType, options = {}) {
    if (windowType !== "context" && this.windows[windowType] && !this.windows[windowType].isDestroyed()) {
      this.windows[windowType].show();
      this.windows[windowType].focus();
      if (windowType === "search") {
        this.isSearchWindowVisible = true;
      }
      return this.windows[windowType];
    }

    const defaultBounds = this.getDefaultBounds(windowType);
    const windowConfig = this.loadWindowPosition(windowType, defaultBounds);
    const isFullScreenWindow = this.isFullScreenWindowType(windowType);

    const win = new BrowserWindow({
      x: windowConfig.x,
      y: windowConfig.y,
      width: windowConfig.width,
      height: windowConfig.height,
      frame: isFullScreenWindow,
      transparent: !isFullScreenWindow,
      hasShadow: !isFullScreenWindow,
      backgroundColor: isFullScreenWindow ? "#0b0c10" : "#00000000",
      alwaysOnTop: windowType === "search" || windowType === "context",
      autoHideMenuBar: isFullScreenWindow,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(this.rootPath, "preload.cjs"),
        additionalArguments: [
          `--window-type=${windowType}`,
          ...(options.contextKey ? [`--context-key=${options.contextKey}`] : [])
        ]
      },
      show: false
    });

    if (isFullScreenWindow) {
      win.setMenuBarVisibility(false);
    }

    if (isDev) {
      win.loadURL(`${DEV_URL}?window=${windowType}`);
    } else {
      win.loadFile(path.join(this.rootPath, "../dist/index.html"), {
        query: { window: windowType }
      });
    }

    win.once("ready-to-show", () => {
      win.show();
      if (windowType === "search") {
        this.isSearchWindowVisible = true;
      }
    });

    const webContentsId = win.webContents.id;

    win.on("close", (event) => {
      if (windowType === "search" && !this.isAppQuitting) {
        event.preventDefault();
        win.hide();
        this.isSearchWindowVisible = false;
        return;
      }
      this.saveWindowPosition(windowType, win);
    });

    win.on("closed", () => {
      if (windowType === "context" && options.contextKey) {
        this.contextWindows.delete(options.contextKey);
        if (this.windows.context === win) {
          this.windows.context = null;
        }
      } else {
        this.windows[windowType] = null;
      }
      if (windowType === "search") {
        this.isSearchWindowVisible = false;
      }
      this.contextDataByWebContentsId.delete(webContentsId);
    });

    if (windowType === "context") {
      this.windows.context = win;
      if (options.contextKey) {
        this.contextWindows.set(options.contextKey, win);
      }
    } else {
      this.windows[windowType] = win;
    }

    return win;
  }

  getSearchWindow() {
    return this.windows.search;
  }

  toggleSearchWindow() {
    if (this.windows.search && !this.windows.search.isDestroyed() && this.windows.search.isVisible()) {
      this.windows.search.hide();
      this.isSearchWindowVisible = false;
      return;
    }

    if (!this.windows.search || this.windows.search.isDestroyed()) {
      this.createWindow("search");
    } else {
      this.windows.search.show();
      this.windows.search.focus();
    }
    this.isSearchWindowVisible = true;
  }

  openContextWindow(payload) {
    if (!payload) return;
    const contextKey = payload.contextKey || "default";

    let targetWindow = this.contextWindows.get(contextKey);
    if (targetWindow && !targetWindow.isDestroyed()) {
      this.updateContextWindow(payload);
      targetWindow.focus();
      return;
    }

    targetWindow = this.createWindow("context", { contextKey });

    const sendData = () => {
      if (!targetWindow || targetWindow.isDestroyed()) return;
      this.setContextDataForWindow(targetWindow, payload);
      targetWindow.webContents.send(CHANNELS.CONTEXT.DATA_EVENT, payload);
    };

    if (targetWindow.webContents.isLoading()) {
      targetWindow.webContents.once("did-finish-load", sendData);
    } else {
      sendData();
    }
  }

  updateContextWindow(payload) {
    if (!payload) return;
    const contextKey = payload.contextKey || "default";
    const targetWindow = this.contextWindows.get(contextKey) || this.windows.context;
    if (!targetWindow || targetWindow.isDestroyed()) return;

    this.setContextDataForWindow(targetWindow, payload);
    targetWindow.webContents.send(CHANNELS.CONTEXT.DATA_EVENT, payload);
  }

  resizeWindow(width, height, windowRef = null) {
    const target = windowRef || this.windows.search;
    if (!target || target.isDestroyed()) return;
    target.setSize(width, height);
  }

  broadcast(channel, payload) {
    const uniqueWindows = new Set(Object.values(this.windows));
    this.contextWindows.forEach((win) => uniqueWindows.add(win));
    uniqueWindows.forEach((win) => {
      if (win && !win.isDestroyed()) {
        win.webContents.send(channel, payload);
      }
    });
  }

  closeCurrentWindow(webContents) {
    const win = BrowserWindow.fromWebContents(webContents);
    if (!win) return;

    if (win === this.windows.search && !this.isAppQuitting) {
      win.hide();
      this.isSearchWindowVisible = false;
      return;
    }

    win.close();
  }

  minimizeCurrentWindow(webContents) {
    const win = BrowserWindow.fromWebContents(webContents);
    if (!win) return;

    if (win === this.windows.search) {
      win.hide();
      this.isSearchWindowVisible = false;
      return;
    }

    win.minimize();
  }

  getWindowFromWebContents(webContents) {
    if (!webContents) return null;
    return BrowserWindow.fromWebContents(webContents);
  }

  startDrag() {}

  setContextDataForWindow(win, payload) {
    this.latestContextData = payload;
    this.contextDataByWebContentsId.set(win.webContents.id, payload);
  }

  getContextDataForWebContents(webContents) {
    if (!webContents) return this.latestContextData;
    return this.contextDataByWebContentsId.get(webContents.id) || this.latestContextData;
  }
}
