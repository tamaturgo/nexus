import { app, BrowserWindow, globalShortcut, screen, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Desenvolvimento vs Produção
const isDev = process.env.NODE_ENV !== 'production';
const DEV_URL = 'http://localhost:5173';

const windows = {
  search: null,
  context: null,
  settings: null
};
let isSearchWindowVisible = false;

// Caminho para armazenar configurações da janela
const WINDOW_CONFIG_PATHS = {
  search: path.join(app.getPath('userData'), 'window-config-search.json'),
  context: path.join(app.getPath('userData'), 'window-config-context.json'),
  settings: path.join(app.getPath('userData'), 'window-config-settings.json')
};

let latestContextData = null;

// Funções para salvar/carregar posição da janela
function saveWindowPosition(windowType) {
  const targetWindow = windows[windowType];
  if (targetWindow && !targetWindow.isDestroyed()) {
    const bounds = targetWindow.getBounds();
    const config = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height
    };
    
    try {
      fs.writeFileSync(WINDOW_CONFIG_PATHS[windowType], JSON.stringify(config, null, 2));
    } catch (error) {
      console.error('Erro ao salvar configuração da janela:', error);
    }
  }
}

function loadWindowPosition(windowType, defaultSize) {
  try {
    const configPath = WINDOW_CONFIG_PATHS[windowType];
    if (configPath && fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return config;
    }
  } catch (error) {
    console.error('Erro ao carregar configuração da janela:', error);
  }
  
  // Posição padrão caso não haja configuração salva
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  return {
    x: Math.round((screenWidth - defaultSize.width) / 2),
    y: Math.round((screenHeight - defaultSize.height) / 2),
    width: defaultSize.width,
    height: defaultSize.height
  };
}

function showSearchWindow() {
  if (windows.search && !isSearchWindowVisible) {
    windows.search.show();
    windows.search.focus();
  }
}

function hideSearchWindow() {
  if (windows.search && isSearchWindowVisible) {
    windows.search.hide();
  }
}

function toggleWindow() {
  if (isSearchWindowVisible) {
    hideSearchWindow();
  } else {
    showSearchWindow();
  }
}

function createWindow(windowType) {
  const defaultSize = windowType === 'search'
    ? { width: 600, height: 180 }
    : { width: 600, height: 600 };
  const windowConfig = loadWindowPosition(windowType, defaultSize);

  const windowOptions = {
    x: windowConfig.x,
    y: windowConfig.y,
    width: windowConfig.width,
    height: windowConfig.height,
    show: false,
    resizable: true,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    closable: windowType !== 'search',
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    backgroundColor: '#00000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
      additionalArguments: [`--window-type=${windowType}`]
    }
  };

  const newWindow = new BrowserWindow(windowOptions);
  windows[windowType] = newWindow;

  newWindow.on('moved', () => saveWindowPosition(windowType));
  newWindow.on('resized', () => saveWindowPosition(windowType));

  if (windowType === 'search') {
    // Prevenir fechamento
    newWindow.on('close', (e) => {
      e.preventDefault();
    });

    // Prevenir minimização
    newWindow.on('minimize', (e) => {
      e.preventDefault();
    });

    newWindow.on('show', () => {
      isSearchWindowVisible = true;
    });

    newWindow.on('hide', () => {
      isSearchWindowVisible = false;
    });
  } else {
    newWindow.on('closed', () => {
      if (windows[windowType] === newWindow) {
        windows[windowType] = null;
      }
    });
  }

  // esconde o conteúdo do compartimento da janela até que esteja totalmente carregado
  newWindow.setContentProtection(true);

  newWindow.webContents.once('did-finish-load', () => {
    if (windowType === 'search') {
      if (!isSearchWindowVisible) {
        showSearchWindow();
      }
    } else {
      newWindow.show();
      newWindow.focus();
      if (windowType === 'context' && latestContextData) {
        newWindow.webContents.send('context-data', latestContextData);
      }
    }
  });

  if (isDev) {
    newWindow.loadURL(`${DEV_URL}/?window=${windowType}`);
  } else {
    newWindow.loadFile(path.join(__dirname, '../dist/index.html'), {
      query: { window: windowType }
    });
  }
}

ipcMain.handle('start-window-drag', () => {
  // Handler mantido para compatibilidade futura
});

ipcMain.handle('resize-window', (event, { width, height }) => {
  const targetWindow = BrowserWindow.fromWebContents(event.sender);
  if (targetWindow) {
    targetWindow.setSize(width, height, true);
  }
});

ipcMain.handle('open-window', (event, { type, payload }) => {
  const windowType = type || 'search';
  if (!windows[windowType] || windows[windowType].isDestroyed()) {
    createWindow(windowType);
  } else {
    windows[windowType].show();
    windows[windowType].focus();
  }

  if (windowType === 'context' && payload) {
    latestContextData = payload;
    windows[windowType]?.webContents.send('context-data', latestContextData);
  }
});

ipcMain.handle('close-current-window', (event) => {
  const targetWindow = BrowserWindow.fromWebContents(event.sender);
  if (targetWindow && targetWindow !== windows.search) {
    targetWindow.close();
  }
});

ipcMain.handle('minimize-current-window', (event) => {
  const targetWindow = BrowserWindow.fromWebContents(event.sender);
  if (targetWindow && targetWindow !== windows.search) {
    targetWindow.minimize();
  }
});

ipcMain.handle('get-context-data', () => latestContextData);

app.whenReady().then(() => {
  globalShortcut.register('CommandOrControl+Alt+Space', () => {
    toggleWindow();
  });

  createWindow('search');

  app.on('activate', () => {
    if (!windows.search || windows.search.isDestroyed()) {
      createWindow('search');
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
