import fs from 'fs';
import path from 'path';

export function findGitRoot(startPath: string): string | null {
  let current = path.resolve(startPath);
  while (true) {
    if (fs.existsSync(path.join(current, '.git'))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }
  return null;
}

const NYXORA_MD_NAMES = ['.nyxora.md', 'NYXORA.md', '.cursorrules'];

export function findNyxoraMd(cwd: string): string | null {
  const stopAt = findGitRoot(cwd);
  let current = path.resolve(cwd);

  while (true) {
    for (const name of NYXORA_MD_NAMES) {
      const candidate = path.join(current, name);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return candidate;
      }
    }
    if (stopAt && current === stopAt) {
      break;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      break; // Reached root without finding git root (should only happen if stopAt is null)
    }
    current = parent;
  }
  return null;
}

export function stripYamlFrontmatter(content: string): string {
  if (content.startsWith('---')) {
    const end = content.indexOf('\n---', 3);
    if (end !== -1) {
      const body = content.substring(end + 4).replace(/^\n/, '');
      return body ? body : content;
    }
  }
  return content;
}
