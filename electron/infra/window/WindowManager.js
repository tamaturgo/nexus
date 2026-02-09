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
      history: null
    };
    this.contextWindows = new Map();
    this.contextDataByWebContentsId = new Map();
    this.isSearchWindowVisible = false;
    this.latestContextData = null;

    this.userDataPath = app.getPath("userData");
    this.configPaths = {
      search: path.join(this.userDataPath, "window-config-search.json"),
      context: path.join(this.userDataPath, "window-config-context.json"),
      settings: path.join(this.userDataPath, "window-config-settings.json"),
      history: path.join(this.userDataPath, "window-config-history.json")
    };
    this.popupWindowTypes = new Set(["context", "settings", "history"]);
  }

  saveWindowPosition(windowType, windowRef = null) {
    const targetWindow = windowRef || this.windows[windowType];
    try {
      if (!targetWindow || targetWindow.isDestroyed()) return;
      const bounds = targetWindow.getBounds();
      const config = { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
      try {
        fs.writeFileSync(this.configPaths[windowType], JSON.stringify(config, null, 2));
      } catch (error) {
        console.error(`Error saving config for ${windowType}:`, error);
      }
    } catch (error) {
      console.warn(`WindowManager: skip save for destroyed ${windowType}:`, error?.message || error);
    }
  }

  loadWindowPosition(windowType, defaultSize) {
    try {
      if (fs.existsSync(this.configPaths[windowType])) {
        const fileContent = fs.readFileSync(this.configPaths[windowType], "utf8").trim();

        if (!fileContent) {
          console.log(`Config file for ${windowType} is empty, using defaults`);
        } else {
          const config = JSON.parse(fileContent);
          if (config.x !== undefined && config.y !== undefined &&
              config.width !== undefined && config.height !== undefined) {
            return config;
          }
        }
      }
    } catch (error) {
      console.error(`Error loading config for ${windowType}:`, error);
      try {
        if (fs.existsSync(this.configPaths[windowType])) {
          fs.unlinkSync(this.configPaths[windowType]);
          console.log(`Deleted corrupted config file for ${windowType}`);
        }
      } catch (deleteError) {
        console.error(`Error deleting corrupted config:`, deleteError);
      }
    }

    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
    return {
      x: Math.round((screenWidth - defaultSize.width) / 2),
      y: Math.round((screenHeight - defaultSize.height) / 2),
      width: defaultSize.width,
      height: defaultSize.height
    };
  }

  createWindow(windowType, options = {}) {
    if (!this.popupWindowTypes.has(windowType) && this.windows[windowType] && !this.windows[windowType].isDestroyed()) {
      this.windows[windowType].show();
      this.windows[windowType].focus();
      return this.windows[windowType];
    }

    const defaultSize = windowType === "search"
      ? { width: 600, height: 180 }
      : windowType === "history"
        ? { width: 600, height: 720 }
        : windowType === "settings"
          ? { width: 600, height: 820 }
          : { width: 600, height: 600 };

    const windowConfig = this.loadWindowPosition(windowType, defaultSize);

    const win = new BrowserWindow({
      x: windowConfig.x,
      y: windowConfig.y,
      width: windowConfig.width,
      height: windowConfig.height,
      frame: false,
      transparent: true,
      hasShadow: true,
      alwaysOnTop: windowType === "search" || windowType === "context",
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

    if (isDev) {
      win.loadURL(`${DEV_URL}?window=${windowType}`);
    } else {
      win.loadFile(path.join(this.rootPath, "../dist/index.html"), {
        query: { window: windowType }
      });
    }

    win.once("ready-to-show", () => {
      if (windowType === "search") {
        win.show();
        this.isSearchWindowVisible = true;
      } else {
        win.show();
      }
    });

    const webContentsId = win.webContents.id;

    win.on("close", () => {
      this.saveWindowPosition(windowType, win);
    });

    win.on("closed", () => {
      if (!this.popupWindowTypes.has(windowType)) {
        this.windows[windowType] = null;
        if (windowType === "search") this.isSearchWindowVisible = false;
      } else if (windowType === "context" && options.contextKey) {
        this.contextWindows.delete(options.contextKey);
        if (this.windows.context === win) {
          this.windows.context = null;
        }
      } else {
        this.windows[windowType] = null;
      }
      this.contextDataByWebContentsId.delete(webContentsId);
    });

    if (windowType !== "context") {
      this.windows[windowType] = win;
    } else {
      this.windows.context = win;
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
    } else {
      if (!this.windows.search || this.windows.search.isDestroyed()) {
        this.createWindow("search");
      } else {
        this.windows.search.show();
        this.windows.search.focus();
      }
      this.isSearchWindowVisible = true;
    }
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
    this.contextWindows.set(contextKey, targetWindow);

    const sendData = () => {
      if (targetWindow && !targetWindow.isDestroyed()) {
        this.setContextDataForWindow(targetWindow, payload);
        targetWindow.webContents.send(CHANNELS.CONTEXT.DATA_EVENT, payload);
      }
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
    if (target && !target.isDestroyed()) {
      target.setSize(width, height);
    }
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
    if (win && win !== this.windows.search) {
      win.close();
    }
  }

  minimizeCurrentWindow(webContents) {
    const win = BrowserWindow.fromWebContents(webContents);
    if (win && win !== this.windows.search) {
      win.minimize();
    }
  }

  getWindowFromWebContents(webContents) {
    if (!webContents) return null;
    return BrowserWindow.fromWebContents(webContents);
  }

  startDrag(webContents) {
    const win = BrowserWindow.fromWebContents(webContents);
    if (!win) return;
  }

  setContextDataForWindow(win, payload) {
    this.latestContextData = payload;
    this.contextDataByWebContentsId.set(win.webContents.id, payload);
  }

  getContextDataForWebContents(webContents) {
    if (!webContents) return this.latestContextData;
    return this.contextDataByWebContentsId.get(webContents.id) || this.latestContextData;
  }
}
