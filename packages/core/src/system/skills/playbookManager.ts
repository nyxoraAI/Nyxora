import fs from 'fs';
import path from 'path';
import os from 'os';

const getPlaybooksDir = () => path.join(os.homedir(), '.nyxora', 'playbooks');

const getDefaultPlaybooksDir = () => {
  const isDist = __dirname.includes(path.normalize('/dist/'));
  return isDist 
    ? path.join(__dirname, '../../../../../../packages/core/playbooks')
    : path.join(__dirname, '../../../playbooks'); 
};

import crypto from 'crypto';

function computeMD5(filePath: string): string {
  if (!fs.existsSync(filePath)) return '';
  const content = fs.readFileSync(filePath);
  return crypto.createHash('md5').update(content).digest('hex');
}

export function ensurePlaybookDir() {
  const userDir = getPlaybooksDir();
  
  const defaultDir = getDefaultPlaybooksDir();

  const manifestPath = path.join(userDir, '.bundled_manifest.json');

  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
  }

  if (!fs.existsSync(defaultDir)) return;

  // Load manifest
  let manifest: Record<string, string> = {};
  if (fs.existsSync(manifestPath)) {
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    } catch (e) {
      console.warn('[PlaybookManager] Failed to parse manifest, starting fresh.');
    }
  }

  const getAllFiles = (dir: string, relativePrefix = '', fileMap = new Map<string, string>()) => {
    if (!fs.existsSync(dir)) return fileMap;
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const relPath = path.join(relativePrefix, file);
      if (fs.statSync(filePath).isDirectory()) {
        getAllFiles(filePath, relPath, fileMap);
      } else {
        fileMap.set(relPath, filePath);
      }
    }
    return fileMap;
  };

  const defaultFiles = getAllFiles(defaultDir);
  const userFiles = getAllFiles(userDir);
  
  // Track which files are in the bundle to clean up the manifest later
  const bundledKeys = new Set(defaultFiles.keys());

  let updatedCount = 0;
  let copiedCount = 0;

  for (const [relPath, srcPath] of defaultFiles.entries()) {
    const destPath = path.join(userDir, relPath);
    const bundledHash = computeMD5(srcPath);
    
    // 1. NEW: Not in manifest
    if (!manifest[relPath]) {
      if (userFiles.has(relPath)) {
        // User already has this file (perhaps from an old dumb copy).
        // Baseline the hash so we can track future changes.
        manifest[relPath] = computeMD5(destPath);
      } else {
        // Copy new file
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        fs.copyFileSync(srcPath, destPath);
        manifest[relPath] = bundledHash;
        copiedCount++;
      }
    } else {
      // 2. EXISTING: In manifest
      const originHash = manifest[relPath];
      
      // If the file no longer exists in userDir, they deleted it on purpose. Skip.
      if (!userFiles.has(relPath)) continue;
      
      const userHash = computeMD5(destPath);
      
      // Check if user modified it
      if (userHash !== originHash) {
        // User modified it, skip update
        continue;
      }
      
      // User didn't modify it. Has the bundled version changed?
      if (bundledHash !== originHash) {
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        fs.copyFileSync(srcPath, destPath);
        manifest[relPath] = bundledHash;
        updatedCount++;
      }
    }
  }

  // 3. CLEAN stale manifest entries
  for (const key of Object.keys(manifest)) {
    if (!bundledKeys.has(key)) {
      delete manifest[key];
    }
  }

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  
  if (copiedCount > 0 || updatedCount > 0) {
    console.log(`[PlaybookManager] Smart Sync complete: Copied ${copiedCount}, Updated ${updatedCount} files to ${userDir}`);
  }
}

function getAllMdFiles(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllMdFiles(filePath, fileList);
    } else if (filePath.endsWith('.md')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

export async function search_playbook(query: string): Promise<string> {
  try {
    const userDir = getPlaybooksDir();
    const defaultDir = getDefaultPlaybooksDir();
    
    // We want to combine files from both directories.
    // If a user file has the same relative path as a default file, it overrides it.
    const fileMap = new Map<string, string>();
    
    const getAllFiles = (dir: string, relativePrefix = '') => {
      if (!fs.existsSync(dir)) return;
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        const relPath = path.join(relativePrefix, file);
        if (fs.statSync(filePath).isDirectory()) {
          getAllFiles(filePath, relPath);
        } else if (file.endsWith('.md')) {
          fileMap.set(relPath, filePath);
        }
      }
    };
    
    getAllFiles(defaultDir);
    getAllFiles(userDir);
    
    if (fileMap.size === 0) return "No playbooks available.";

    const lowerQuery = query.toLowerCase();
    const results = [];
    
    for (const [relPath, filePath] of fileMap.entries()) {
      const content = fs.readFileSync(filePath, 'utf-8');
      if (relPath.toLowerCase().includes(lowerQuery) || content.toLowerCase().includes(lowerQuery)) {
        const firstLine = content.split('\n').find(l => l.trim().length > 0) || relPath;
        results.push(`- ${relPath}: ${firstLine.substring(0, 100)}`);
      }
    }
    
    if (results.length === 0) return `No playbooks found matching '${query}'.`;
    return `Found ${results.length} playbooks matching '${query}':\n` + results.join('\n');
  } catch (err: any) {
    return `Error searching playbooks: ${err.message}`;
  }
}

export function list_playbooks(): string[] {
  try {
    const userDir = getPlaybooksDir();
    const defaultDir = getDefaultPlaybooksDir();
    const fileMap = new Map<string, string>();
    
    const getAllFiles = (dir: string, relativePrefix = '') => {
      if (!fs.existsSync(dir)) return;
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        const relPath = path.join(relativePrefix, file);
        if (fs.statSync(filePath).isDirectory()) {
          getAllFiles(filePath, relPath);
        } else if (file.endsWith('.md')) {
          fileMap.set(relPath, filePath);
        }
      }
    };
    
    getAllFiles(defaultDir);
    getAllFiles(userDir);
    
    return Array.from(fileMap.keys());
  } catch {
    return [];
  }
}

export async function read_playbook(filename: string): Promise<string> {
  try {
    const userDir = getPlaybooksDir();
    const defaultDir = getDefaultPlaybooksDir();
    
    // Resolve in user directory first (overrides)
    const userPath = path.resolve(userDir, filename);
    const defaultPath = path.resolve(defaultDir, filename);
    
    // Prevent directory traversal
    if (!userPath.startsWith(path.resolve(userDir)) && !defaultPath.startsWith(path.resolve(defaultDir))) {
      return `Error: Invalid playbook path. Access denied.`;
    }

    let targetPath = "";
    if (fs.existsSync(userPath) && userPath.startsWith(path.resolve(userDir))) {
      targetPath = userPath;
    } else if (fs.existsSync(defaultPath) && defaultPath.startsWith(path.resolve(defaultDir))) {
      targetPath = defaultPath;
    }

    if (targetPath) {
      const content = fs.readFileSync(targetPath, 'utf-8');
      const userDirName = path.dirname(path.resolve(userDir, filename));
      const defaultDirName = path.dirname(path.resolve(defaultDir, filename));
      
      const systemNote = `> [SYSTEM NOTE TO AI]: \n> Playbook Name: \`${filename}\`\n> 1. Your Working Directory: \`${userDirName}\` (User Overrides)\n> 2. System Assets Directory: \`${defaultDirName}\` (Original Scripts/Templates)\n> \n> If you need to run local scripts (e.g. .py, .sh, Makefile) or read template files (.tex, .json) mentioned in this playbook, check the Working Directory first. If the files don't exist there, they are guaranteed to be in the System Assets Directory. Use absolute paths when executing them.\n\n`;
      
      return systemNote + content;
    }
    
    return `Playbook '${filename}' not found.`;
  } catch (err: any) {
    return `Error reading playbook: ${err.message}`;
  }
}

export const searchPlaybookToolDefinition = {
  type: "function",
  function: {
    name: "search_playbook",
    description: "Searches for Markdown SOP/Playbook files that teach you how to perform specific tasks or workflows using external tools/CLIs. Always call this if you don't know how to perform a complex integration task.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Topic to search for (e.g., 'github PR', 'deploy vercel', 'smart home').",
        }
      },
      required: ["query"],
    },
  },
};

export const readPlaybookToolDefinition = {
  type: "function",
  function: {
    name: "read_playbook",
    description: "Reads the full content of a Markdown Playbook file. Use the filename returned from search_playbook.",
    parameters: {
      type: "object",
      properties: {
        filename: {
          type: "string",
          description: "The relative path to the .md file (e.g., 'github/github-pr-workflow/SKILL.md').",
        }
      },
      required: ["filename"],
    },
  },
};
