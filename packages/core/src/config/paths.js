"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAppDir = getAppDir;
exports.getPath = getPath;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
function getAppDir() {
    const globalDir = path_1.default.join(os_1.default.homedir(), '.nyxora');
    if (!fs_1.default.existsSync(globalDir)) {
        fs_1.default.mkdirSync(globalDir, { recursive: true });
    }
    return globalDir;
}
function ensureDir(dir) {
    if (!fs_1.default.existsSync(dir)) {
        fs_1.default.mkdirSync(dir, { recursive: true });
    }
}
function getPath(filename) {
    const baseDir = getAppDir();
    // Determine subdirectory based on filename
    let subDir = '';
    const lowerFile = filename.toLowerCase();
    if (filename === 'skills' || lowerFile.startsWith('skills/')) {
        subDir = 'skills';
    }
    else if (lowerFile.endsWith('.db') || lowerFile.endsWith('.db-wal') || lowerFile.endsWith('.db-shm') || (lowerFile.endsWith('.json') && lowerFile.includes('memory')) || lowerFile.endsWith('.md') || lowerFile.includes('orders')) {
        subDir = 'data';
    }
    else if (lowerFile.endsWith('.yaml') || lowerFile.includes('config') || lowerFile.includes('whitelist') || lowerFile.includes('tokens')) {
        subDir = 'config';
    }
    else if (lowerFile.endsWith('.token') || lowerFile.includes('vault') || lowerFile.includes('credentials')) {
        subDir = 'auth';
    }
    else if (lowerFile.endsWith('.log') || lowerFile.includes('pid') || lowerFile.includes('tracker')) {
        subDir = 'run';
    }
    const targetDir = path_1.default.join(baseDir, subDir);
    ensureDir(targetDir);
    let fullPath = path_1.default.join(targetDir, filename);
    // Prevent duplicating the subdirectory name if the filename already includes it
    if (filename === subDir) {
        fullPath = targetDir;
    }
    else if (filename.startsWith(subDir + '/') || filename.startsWith(subDir + '\\')) {
        fullPath = path_1.default.join(baseDir, filename);
    }
    // AUTO-MIGRATION: If file exists in root but not in subdir, move it
    const oldRootPath = path_1.default.join(baseDir, filename);
    if (subDir !== '' && fullPath !== oldRootPath) {
        if (fs_1.default.existsSync(oldRootPath) && !fs_1.default.existsSync(fullPath)) {
            try {
                fs_1.default.renameSync(oldRootPath, fullPath);
                console.log(`[Migration] Moved ${filename} to ${subDir}/ directory.`);
            }
            catch (err) {
                console.warn(`[Migration] Failed to move ${filename} to ${subDir}/`, err);
                return oldRootPath; // fallback to root if migration fails
            }
        }
    }
    return fullPath;
}
