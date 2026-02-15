import lancedb from '@lancedb/lancedb';
import { pipeline } from '@xenova/transformers';
import path from 'path';
import { app } from 'electron';
import fs from 'fs';

export class LanceDbVectorStore {
  constructor() {
    this.db = null;
    this.table = null;
    this.embedder = null;
    this.tableName = 'context_memory';
    this.dbPath = path.join(app.getPath('userData'), 'nexus-memory');
  }

  async tryOpenExistingTable() {
    const existingTables = await this.db.tableNames();
    if (!existingTables.includes(this.tableName)) {
      this.table = null;
      return false;
    }

    try {
      this.table = await this.db.openTable(this.tableName);
      return true;
    } catch (error) {
      console.warn('LanceDbVectorStore: Failed to open existing table. Will recreate on write.', error);
      this.table = null;
      return false;
    }
  }

  async ensureWritableTable(initialData) {
    if (this.table) return false;

    const opened = await this.tryOpenExistingTable();
    if (opened) return false;

    const existingTables = await this.db.tableNames();
    if (existingTables.includes(this.tableName)) {
      try {
        this.table = await this.db.createTable(this.tableName, initialData, { mode: 'overwrite' });
      } catch (overwriteError) {
        console.warn('LanceDbVectorStore: Overwrite failed. Trying hard reset of table metadata.', overwriteError);
        try {
          await this.db.dropTable(this.tableName);
        } catch (_dropError) {
        }
        try {
          const tablePath = path.join(this.dbPath, `${this.tableName}.lance`);
          if (fs.existsSync(tablePath)) {
            fs.rmSync(tablePath, { recursive: true, force: true });
          }
        } catch (_fsError) {
        }
        this.table = await this.db.createTable(this.tableName, initialData, { mode: 'create' });
      }
      return true;
    }

    this.table = await this.db.createTable(this.tableName, initialData, { mode: 'create' });
    return true;
  }

  async initialize() {
    try {
      if (!fs.existsSync(this.dbPath)) {
        fs.mkdirSync(this.dbPath, { recursive: true });
      }
      this.db = await lancedb.connect(this.dbPath);

      this.embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      console.log('LanceDbVectorStore: Model loaded.');

      await this.tryOpenExistingTable();
      console.log(`LanceDbVectorStore: Service initialized at ${this.dbPath}`);
    } catch (error) {
      console.error('LanceDbVectorStore: Initialization failed:', error);
    }
  }

  async getEmbedding(text) {
    if (!this.embedder) throw new Error("Embedder not initialized");
    
    // Generate embedding
    const output = await this.embedder(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  }

  async addDocument(text, metadata = {}) {
    try {
      if (!this.db || !this.embedder) {
        await this.initialize();
      }
      if (!this.db || !this.embedder) {
        throw new Error('LanceDbVectorStore is not initialized');
      }

      const vector = await this.getEmbedding(text);
      
      // Only use basic fields that match the schema
      const data = [{
        vector,
        text,
        type: metadata.type || 'general',
        timestamp: metadata.timestamp || Date.now()
      }];

      const createdWithInitialData = await this.ensureWritableTable(data);
      if (!createdWithInitialData) {
        await this.table.add(data);
      }
      
      console.log(`LanceDbVectorStore: Added document: "${text.substring(0, 20)}..."`);
      return true;
    } catch (error) {
      console.error('LanceDbVectorStore: Add document error:', error);
      return false;
    }
  }

  async search(queryText, limit = 5, options = {}) {
    try {
      if (!this.db || !this.embedder) {
        await this.initialize();
      }
      if (!this.db || !this.embedder) {
        return [];
      }

      if (!this.table) {
        await this.tryOpenExistingTable();
      }
      if (!this.table) return [];
      
      const queryVector = await this.getEmbedding(queryText);
      const candidateLimit = Math.max(limit * 4, limit);
      const includeTypes = Array.isArray(options.includeTypes) ? options.includeTypes : null;
      const excludeTypes = Array.isArray(options.excludeTypes) ? options.excludeTypes : null;

      const results = await this.table.vectorSearch(queryVector)
        .limit(candidateLimit)
        .toArray();

      const filtered = results.filter(item => {
        if (!item || typeof item !== 'object') return false;
        if (includeTypes && includeTypes.length > 0 && !includeTypes.includes(item.type)) {
          return false;
        }
        if (excludeTypes && excludeTypes.length > 0 && excludeTypes.includes(item.type)) {
          return false;
        }
        return true;
      });

      return filtered.slice(0, limit);
    } catch (error) {
      console.error('LanceDbVectorStore: Search error:', error);
      return [];
    }
  }

  async clearAll() {
    try {
      if (this.dbPath && fs.existsSync(this.dbPath)) {
        fs.rmSync(this.dbPath, { recursive: true, force: true });
      }
      this.db = null;
      this.table = null;
      this.embedder = null;
      return true;
    } catch (error) {
      console.error("LanceDbVectorStore: Clear all failed:", error);
      return false;
    }
  }
}
