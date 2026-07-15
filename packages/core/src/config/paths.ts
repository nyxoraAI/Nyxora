import fs from 'fs';
import path from 'path';
import os from 'os';

export function getAppDir(): string {
  const globalDir = path.join(os.homedir(), '.nyxora');
  if (!fs.existsSync(globalDir)) {
    fs.mkdirSync(globalDir, { recursive: true });
  }
  return globalDir;
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function getPath(filename: string): string {
  const baseDir = getAppDir();
  
  // Determine subdirectory based on filename
  let subDir = '';
  const lowerFile = filename.toLowerCase();
  
  if (filename === 'skills' || lowerFile.startsWith('skills/')) {
    subDir = 'skills';
  } else if (lowerFile.endsWith('.db') || lowerFile.endsWith('.db-wal') || lowerFile.endsWith('.db-shm') || (lowerFile.endsWith('.json') && lowerFile.includes('memory')) || lowerFile.endsWith('.md') || lowerFile.includes('orders')) {
    subDir = 'data';
  } else if (lowerFile.endsWith('.yaml') || lowerFile.includes('config') || lowerFile.includes('whitelist') || lowerFile.includes('tokens')) {
    subDir = 'config';
  } else if (lowerFile.endsWith('.token') || lowerFile.includes('vault') || lowerFile.includes('credentials')) {
    subDir = 'auth';
  } else if (lowerFile.endsWith('.log') || lowerFile.includes('pid') || lowerFile.includes('tracker')) {
    subDir = 'run';
  }

  const targetDir = path.join(baseDir, subDir);
  ensureDir(targetDir);
  
  let fullPath = path.join(targetDir, filename);

  // Prevent duplicating the subdirectory name if the filename already includes it
  if (filename === subDir) {
    fullPath = targetDir;
  } else if (filename.startsWith(subDir + '/') || filename.startsWith(subDir + '\\')) {
    fullPath = path.join(baseDir, filename);
  }

  // AUTO-MIGRATION: If file exists in root but not in subdir, move it
  const oldRootPath = path.join(baseDir, filename);
  if (subDir !== '' && fullPath !== oldRootPath) {
    if (fs.existsSync(oldRootPath) && !fs.existsSync(fullPath)) {
      try {
        fs.renameSync(oldRootPath, fullPath);
        console.log(`[Migration] Moved ${filename} to ${subDir}/ directory.`);
      } catch (err) {
        console.warn(`[Migration] Failed to move ${filename} to ${subDir}/`, err);
        return oldRootPath; // fallback to root if migration fails
      }
    }
  }

  return fullPath;
}
