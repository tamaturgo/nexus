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

  async initialize() {
    try {
      if (!fs.existsSync(this.dbPath)) {
        fs.mkdirSync(this.dbPath, { recursive: true });
      }
      this.db = await lancedb.connect(this.dbPath);

      this.embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      console.log('LanceDbVectorStore: Model loaded.');

      const existingTables = await this.db.tableNames();
      
      if (!existingTables.includes(this.tableName)) {
      } else {
        this.table = await this.db.openTable(this.tableName);
      }
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
      const vector = await this.getEmbedding(text);
      
      // Only use basic fields that match the schema
      const data = [{
        vector,
        text,
        type: metadata.type || 'general',
        timestamp: metadata.timestamp || Date.now()
      }];

      if (!this.table) {
        const existingTables = await this.db.tableNames();
        if (existingTables.includes(this.tableName)) {
           this.table = await this.db.openTable(this.tableName);
           await this.table.add(data);
        } else {
           this.table = await this.db.createTable(this.tableName, data);
        }
      } else {
        await this.table.add(data);
      }
      
      console.log(`LanceDbVectorStore: Added document: "${text.substring(0, 20)}..."`);
      return true;
    } catch (error) {
      console.error('LanceDbVectorStore: Add document error:', error);
      return false;
    }
  }

  async search(queryText, limit = 5) {
    try {
      if (!this.table) return [];
      
      const queryVector = await this.getEmbedding(queryText);
      
      const results = await this.table.vectorSearch(queryVector)
        .limit(limit)
        .toArray();
        
      return results;
    } catch (error) {
      console.error('LanceDbVectorStore: Search error:', error);
      return [];
    }
  }
}
