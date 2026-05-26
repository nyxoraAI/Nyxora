import fs from 'fs';
import path from 'path';
import { loadConfig } from '../config/parser';
import { getPath } from '../config/paths';

export interface MemoryEntry {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: any[];
}

export class Logger {
  private logFilePath: string;
  private memory: MemoryEntry[] = [];

  constructor() {
    const config = loadConfig();
    this.logFilePath = getPath(config.memory.path || 'memory.json');
    this.loadMemory();
  }

  private loadMemory() {
    if (fs.existsSync(this.logFilePath)) {
      try {
        const data = fs.readFileSync(this.logFilePath, 'utf-8');
        this.memory = JSON.parse(data);
      } catch (error) {
        console.error('Failed to read memory file. Starting fresh.');
        this.memory = [];
      }
    }
  }

  private saveMemory() {
    try {
      fs.writeFileSync(this.logFilePath, JSON.stringify(this.memory, null, 2));
    } catch (error) {
      console.error('Failed to write memory file.');
    }
  }

  public getHistory(): MemoryEntry[] {
    return [...this.memory];
  }

  public addEntry(entry: MemoryEntry) {
    this.memory.push(entry);
    this.saveMemory();
  }

  public clear() {
    this.memory = [];
    this.saveMemory();
  }
}
