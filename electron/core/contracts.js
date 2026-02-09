/**
 * @typedef {Object} Transcriber
 * @property {boolean} isInitialized
 * @property {(audioBuffer: Buffer, options?: { language?: string }) => Promise<{ text: string, language?: string, duration?: number, confidence?: number }>} transcribe
 */

/**
 * @typedef {Object} VectorStore
 * @property {() => Promise<void>} initialize
 * @property {(text: string, metadata?: object) => Promise<boolean>} addDocument
 * @property {(queryText: string, limit?: number) => Promise<Array<object>>} search
 */

/**
 * @typedef {Object} WindowGateway
 * @property {(width: number, height: number) => void} resizeWindow
 * @property {(type: string, payload?: any) => void} openWindow
 * @property {(payload?: any) => void} updateContextWindow
 * @property {(webContents: Electron.WebContents) => void} closeCurrentWindow
 * @property {(webContents: Electron.WebContents) => void} minimizeCurrentWindow
 * @property {() => any} getContextData
 */

/**
 * @typedef {Object} Logger
 * @property {(message: string, ...rest: any[]) => void} info
 * @property {(message: string, ...rest: any[]) => void} warn
 * @property {(message: string, ...rest: any[]) => void} error
 */

export {}; 