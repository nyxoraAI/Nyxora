/**
 * search_files — grep-style content search across project files.
 *
 * Prefers `ripgrep (rg)` when available (fast, respects .gitignore),
 * falls back to `grep -r`. Results are capped at maxResults (default 50)
 * to prevent context-window bloat.
 */

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

// Directories to always exclude from search
const SKIP_DIRS: string[] = [
  'node_modules', '.git', 'dist', 'build', '.next', '.turbo',
  'vendor', '__pycache__', '.venv', 'venv', 'target', 'coverage',
  '.nyc_output', 'out',
];

const DEFAULT_MAX_RESULTS = 50;
const EXEC_TIMEOUT_MS = 15_000;

interface SearchArgs {
  query: string;
  directory: string;
  filePattern?: string;
  maxResults?: number;
  caseSensitive?: boolean;
  useRegex?: boolean;
}

// ---------------------------------------------------------------------------
// Check ripgrep availability (cached)
// ---------------------------------------------------------------------------
let _rgAvailable: boolean | null = null;
function hasRipgrep(): boolean {
  if (_rgAvailable !== null) return _rgAvailable;
  try {
    execSync('rg --version', { stdio: 'ignore', timeout: 2000 });
    _rgAvailable = true;
  } catch {
    _rgAvailable = false;
  }
  return _rgAvailable;
}

// ---------------------------------------------------------------------------
// searchFiles()
// ---------------------------------------------------------------------------

export function searchFiles(args: SearchArgs): string {
  const {
    query,
    directory,
    filePattern,
    maxResults = DEFAULT_MAX_RESULTS,
    caseSensitive = false,
    useRegex = false,
  } = args;

  if (!query || query.trim() === '') {
    return 'Error: `query` parameter is required and cannot be empty.';
  }

  const absDir = path.resolve(directory);
  if (!fs.existsSync(absDir)) {
    return `Error: Directory not found: ${absDir}`;
  }

  try {
    let output: string;

    if (hasRipgrep()) {
      // Build rg command
      const rgArgs: string[] = ['rg'];
      if (!caseSensitive) rgArgs.push('--ignore-case');
      if (!useRegex)      rgArgs.push('--fixed-strings');
      rgArgs.push('--line-number', '--with-filename', '--no-heading');
      rgArgs.push(`--max-count=${maxResults}`);
      for (const skip of SKIP_DIRS) rgArgs.push(`--glob=!${skip}`);
      if (filePattern) rgArgs.push(`--glob=${filePattern}`);
      rgArgs.push('--', query, absDir);

      output = execSync(rgArgs.join(' '), {
        timeout: EXEC_TIMEOUT_MS,
        encoding: 'utf8',
        maxBuffer: 2 * 1024 * 1024,
      });
    } else {
      // Fallback to grep
      const grepArgs: string[] = ['grep', '-r', '--line-number', '--with-filename'];
      if (!caseSensitive) grepArgs.push('--ignore-case');
      if (!useRegex)      grepArgs.push('--fixed-strings');

      for (const skip of SKIP_DIRS) {
        grepArgs.push(`--exclude-dir=${skip}`);
      }
      if (filePattern) grepArgs.push(`--include=${filePattern}`);
      grepArgs.push('--', query, absDir);

      output = execSync(grepArgs.join(' '), {
        timeout: EXEC_TIMEOUT_MS,
        encoding: 'utf8',
        maxBuffer: 2 * 1024 * 1024,
      });
    }

    const lines = output.trim().split('\n').filter(Boolean);
    if (lines.length === 0) {
      return `No matches found for "${query}" in ${absDir}`;
    }

    // Trim paths relative to search directory for readability
    const formatted = lines.slice(0, maxResults).map(line => {
      try {
        // rg / grep format: /abs/path/to/file.ts:42:content
        const colonIdx = line.indexOf(':', absDir.length);
        if (colonIdx > -1) {
          const filePart = path.relative(absDir, line.slice(0, colonIdx));
          return filePart + line.slice(colonIdx);
        }
      } catch { /* ignore */ }
      return line;
    });

    const truncated = lines.length > maxResults;
    let result = formatted.join('\n');
    if (truncated) {
      result += `\n\n... (results capped at ${maxResults}. Use filePattern or a more specific query to narrow down.)`;
    }
    return result;
  } catch (err: any) {
    // grep exits with code 1 when no matches — not an error
    if (err.status === 1 && !err.stdout && !err.stderr?.trim()) {
      return `No matches found for "${query}" in ${absDir}`;
    }
    // Return whatever partial output exists
    const partial = err.stdout?.trim() ?? '';
    if (partial) return partial;
    return `Search error: ${err.message ?? String(err)}`;
  }
}

// ---------------------------------------------------------------------------
// Tool definition (OpenAI function-calling schema)
// ---------------------------------------------------------------------------

export const searchFilesToolDefinition = {
  type: 'function',
  function: {
    name: 'search_files',
    description: [
      'Search for text or regex patterns across files in a directory.',
      'Use this BEFORE editing code to locate where a symbol/function is defined or used.',
      'Faster than reading files one-by-one. Respects .gitignore when ripgrep is available.',
      'Always use an absolute path for `directory`.',
    ].join(' '),
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Text or regex pattern to search for.',
        },
        directory: {
          type: 'string',
          description: 'Absolute path to the root directory to search in.',
        },
        filePattern: {
          type: 'string',
          description: 'Optional glob filter, e.g. "*.ts", "*.py", "src/**". Narrows search to matching files only.',
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of matching lines to return (default: 50).',
        },
        caseSensitive: {
          type: 'boolean',
          description: 'Whether the search is case-sensitive (default: false).',
        },
        useRegex: {
          type: 'boolean',
          description: 'Treat `query` as a regex pattern instead of a literal string (default: false).',
        },
      },
      required: ['query', 'directory'],
    },
  },
};
