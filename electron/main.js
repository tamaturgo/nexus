import { app, BrowserWindow, globalShortcut, screen, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Desenvolvimento vs Produção
const isDev = process.env.NODE_ENV !== 'production';
const DEV_URL = 'http://localhost:5173';

let mainWindow = null;
let isWindowVisible = false;

// Caminho para armazenar configurações da janela
const WINDOW_CONFIG_PATH = path.join(app.getPath('userData'), 'window-config.json');

// Funções para salvar/carregar posição da janela
function saveWindowPosition() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const bounds = mainWindow.getBounds();
    const config = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height
    };
    
    try {
      fs.writeFileSync(WINDOW_CONFIG_PATH, JSON.stringify(config, null, 2));
    } catch (error) {
      console.error('Erro ao salvar configuração da janela:', error);
    }
  }
}

function loadWindowPosition() {
  try {
    if (fs.existsSync(WINDOW_CONFIG_PATH)) {
      const config = JSON.parse(fs.readFileSync(WINDOW_CONFIG_PATH, 'utf8'));
      return config;
    }
  } catch (error) {
    console.error('Erro ao carregar configuração da janela:', error);
  }
  
  // Posição padrão caso não haja configuração salva
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  return {
    x: Math.round((screenWidth - 600) / 2),
    y: Math.round((screenHeight - 180) / 2),
    width: 600,
    height: 180
  };
}

function showWindow() {
  if (mainWindow && !isWindowVisible) {
    mainWindow.show();
    mainWindow.focus();
  }
}

function hideWindow() {
  if (mainWindow && isWindowVisible) {
    mainWindow.hide();
  }
}

function toggleWindow() {
  if (isWindowVisible) {
    hideWindow();
  } else {
    showWindow();
  }
}

function createWindow() {
  const windowConfig = loadWindowPosition();
  
  mainWindow = new BrowserWindow({
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
    closable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    backgroundColor: '#00000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Salvar posição da janela quando movida ou redimensionada
  mainWindow.on('moved', () => {
    saveWindowPosition();
  });

  mainWindow.on('resized', () => {
    saveWindowPosition();
  });

  // IPC handlers
  ipcMain.handle('start-window-drag', () => {
    // Handler mantido para compatibilidade futura
  });

  ipcMain.handle('resize-window', (event, { width, height }) => {
    if (mainWindow) {
      const bounds = mainWindow.getBounds();
      // Manter a posição centralizada ou x constante, ajustar y se necessário para não sair da tela
      // Por enquanto, apenas redimensiona mantendo (x,y) ou centralizando no eixo Y se preferir
      // Vamos manter a posição superior (y) fixa ou ajustada?
      // Geralmente "expandir para baixo" significa manter y e aumentar height.
      mainWindow.setSize(width, height, true); // true for animate on Mac
    }
  });

  // Prevenir fechamento
  mainWindow.on('close', (e) => {
    e.preventDefault();
  });

  // Prevenir minimização
  mainWindow.on('minimize', (e) => {
    e.preventDefault();
  });

  // Controlar visibilidade
  mainWindow.on('show', () => {
    isWindowVisible = true;
  });

  mainWindow.on('hide', () => {
    isWindowVisible = false;
  });

  // esconde o conteúdo do compartimento da janela até que esteja totalmente carregado
  mainWindow.setContentProtection(true);

  mainWindow.webContents.once('did-finish-load', () => {
    if (!isWindowVisible) {
      showWindow();
    }
  });

  if (isDev) {
    mainWindow.loadURL(DEV_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  globalShortcut.register('CommandOrControl+Alt+Space', () => {
    toggleWindow();
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
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
