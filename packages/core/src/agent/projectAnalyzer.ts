/**
 * Project Analyzer — workspace detection for the Nyxora Coding Posture.
 *
 * Scans the active project directory once at session start and produces
 * a structured "ProjectFacts" snapshot that is baked into the system prompt
 * (context tier). The model can then answer questions about the project
 * (build commands, package manager, git state) without guessing.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// ---------------------------------------------------------------------------
// Project root markers — presence of ANY of these signals a coding workspace.
// ---------------------------------------------------------------------------
const PROJECT_MARKERS: string[] = [
  // Python
  'pyproject.toml', 'setup.py', 'setup.cfg', 'requirements.txt',
  // Node / Deno
  'package.json', 'tsconfig.json', 'deno.json', 'deno.jsonc',
  // Rust
  'Cargo.toml',
  // Go
  'go.mod',
  // Java / JVM
  'pom.xml', 'build.gradle', 'build.gradle.kts',
  // C / C++
  'CMakeLists.txt',
  // Ruby
  'Gemfile',
  // PHP
  'composer.json',
  // Elixir
  'mix.exs',
  // Dart / Flutter
  'pubspec.yaml',
  // General build / CI
  'Makefile', 'Dockerfile', 'docker-compose.yml',
  // Common agent context files
  'AGENTS.md', 'CLAUDE.md', '.cursorrules', 'Nyxora.md',
];

// Context files surfaced separately — their content may be injected verbatim.
const CONTEXT_FILES: string[] = ['AGENTS.md', 'CLAUDE.md', '.cursorrules', 'Nyxora.md'];

// Lockfile → package manager, checked in priority order.
const LOCKFILE_MAP: Array<[string, string]> = [
  ['uv.lock',           'uv'],
  ['poetry.lock',       'poetry'],
  ['Pipfile.lock',      'pipenv'],
  ['pnpm-lock.yaml',    'pnpm'],
  ['bun.lockb',         'bun'],
  ['bun.lock',          'bun'],
  ['yarn.lock',         'yarn'],
  ['package-lock.json', 'npm'],
  ['Cargo.lock',        'cargo'],
  ['go.sum',            'go'],
  ['Gemfile.lock',      'bundler'],
];

// npm/yarn/pnpm script names worth surfacing as verify commands.
const VERIFY_SCRIPT_NAMES: string[] = [
  'test', 'tests', 'lint', 'typecheck', 'check',
  'build', 'fmt', 'format', 'validate',
];

const MAX_VERIFY_COMMANDS = 8;
const GIT_TIMEOUT_MS = 2500;

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface ProjectFacts {
  projectRoot: string;
  manifests: string[];
  packageManagers: string[];
  verifyCommands: string[];
  contextFiles: string[];
  gitBranch?: string;
  gitUpstream?: string;
  gitAhead?: number;
  gitBehind?: number;
  gitStaged?: number;
  gitModified?: number;
  gitUntracked?: number;
  isGitRepo: boolean;
  isWorktree?: boolean;
}

// ---------------------------------------------------------------------------
// Git helpers
// ---------------------------------------------------------------------------

function _git(cwd: string, ...args: string[]): string {
  try {
    return execSync(`git ${args.join(' ')}`, {
      cwd,
      timeout: GIT_TIMEOUT_MS,
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
    }).trim();
  } catch {
    return '';
  }
}

function _parseGitStatus(porcelain: string): {
  branch: string; upstream: string;
  ahead: number; behind: number;
  staged: number; modified: number; untracked: number;
} {
  const result = { branch: '', upstream: '', ahead: 0, behind: 0, staged: 0, modified: 0, untracked: 0 };
  for (const line of porcelain.split('\n')) {
    if (line.startsWith('# branch.head'))     result.branch   = line.split(/\s+/)[2] ?? '';
    else if (line.startsWith('# branch.upstream')) result.upstream = line.split(/\s+/)[2] ?? '';
    else if (line.startsWith('# branch.ab')) {
      const parts = line.split(/\s+/);
      result.ahead  = parseInt(parts[2]?.replace('+', '') ?? '0', 10);
      result.behind = parseInt(parts[3]?.replace('-', '') ?? '0', 10);
    } else if (line.startsWith('1 ') || line.startsWith('2 ')) {
      const xy = line.split(/\s+/)[1] ?? '..';
      if (xy[0] !== '.') result.staged++;
      if (xy[1] !== '.') result.modified++;
    } else if (line.startsWith('? ')) {
      result.untracked++;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Verify command extraction
// ---------------------------------------------------------------------------

function _getVerifyCommands(root: string): string[] {
  const commands: string[] = [];
  const seen = new Set<string>();
  const add = (cmd: string) => { if (!seen.has(cmd)) { seen.add(cmd); commands.push(cmd); } };

  // scripts/run_tests.sh
  if (fs.existsSync(path.join(root, 'scripts', 'run_tests.sh'))) {
    add('scripts/run_tests.sh');
  }

  // package.json scripts
  const pkgPath = path.join(root, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const scripts: Record<string, string> = pkg.scripts ?? {};
      const pm = LOCKFILE_MAP.find(([lock]) => fs.existsSync(path.join(root, lock)))?.[1] ?? 'npm';
      for (const name of VERIFY_SCRIPT_NAMES) {
        if (scripts[name]) add(`${pm} run ${name}`);
      }
    } catch { /* ignore */ }
  }

  // Makefile targets
  const mkPath = path.join(root, 'Makefile');
  if (fs.existsSync(mkPath)) {
    try {
      const mk = fs.readFileSync(mkPath, 'utf8');
      for (const name of VERIFY_SCRIPT_NAMES) {
        if (new RegExp(`^${name}\\s*:`, 'm').test(mk)) add(`make ${name}`);
      }
    } catch { /* ignore */ }
  }

  // pyproject.toml — pytest
  const ppPath = path.join(root, 'pyproject.toml');
  if (fs.existsSync(ppPath)) {
    try {
      const pp = fs.readFileSync(ppPath, 'utf8');
      if (pp.includes('[tool.pytest') || pp.includes('[tool.ruff')) add('pytest');
    } catch { /* ignore */ }
  }

  // pytest.ini standalone
  if (fs.existsSync(path.join(root, 'pytest.ini'))) add('pytest');

  return commands.slice(0, MAX_VERIFY_COMMANDS);
}

// ---------------------------------------------------------------------------
// Core: detectProjectFacts()
// ---------------------------------------------------------------------------

export function detectProjectFacts(directory: string): ProjectFacts | null {
  try {
    const root = path.resolve(directory);
    if (!fs.existsSync(root)) return null;

    // Manifests
    const manifests = PROJECT_MARKERS.filter(m =>
      !CONTEXT_FILES.includes(m) && fs.existsSync(path.join(root, m))
    );
    if (manifests.length === 0) {
      // Not a recognized project root — no block injected
      return null;
    }

    // Package managers (deduplicated, priority order)
    const packageManagers = Array.from(new Set(
      LOCKFILE_MAP
        .filter(([lock]) => fs.existsSync(path.join(root, lock)))
        .map(([, pm]) => pm)
    ));

    // Context files
    const contextFiles = CONTEXT_FILES.filter(f => fs.existsSync(path.join(root, f)));

    // Verify commands
    const verifyCommands = _getVerifyCommands(root);

    // Git status
    let isGitRepo = false;
    let isWorktree = false;
    let gitBranch: string | undefined;
    let gitUpstream: string | undefined;
    let gitAhead: number | undefined;
    let gitBehind: number | undefined;
    let gitStaged: number | undefined;
    let gitModified: number | undefined;
    let gitUntracked: number | undefined;

    const revParse = _git(root, 'rev-parse', '--git-dir');
    if (revParse) {
      isGitRepo = true;
      isWorktree = revParse !== '.git' && !revParse.endsWith('/.git');

      const porcelain = _git(root, 'status', '--porcelain=2', '--branch');
      const parsed = _parseGitStatus(porcelain);
      gitBranch   = parsed.branch   || undefined;
      gitUpstream = parsed.upstream || undefined;
      gitAhead    = parsed.ahead;
      gitBehind   = parsed.behind;
      gitStaged   = parsed.staged;
      gitModified = parsed.modified;
      gitUntracked = parsed.untracked;
    }

    return {
      projectRoot: root,
      manifests,
      packageManagers,
      verifyCommands,
      contextFiles,
      isGitRepo,
      isWorktree,
      gitBranch,
      gitUpstream,
      gitAhead,
      gitBehind,
      gitStaged,
      gitModified,
      gitUntracked,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// buildWorkspaceBlock()
// Formats ProjectFacts into the system-prompt string injected at context tier.
// ---------------------------------------------------------------------------

export function buildWorkspaceBlock(facts: ProjectFacts): string {
  const lines: string[] = [];
  lines.push(`--- WORKSPACE (snapshot at session start — re-check with \`git\` before acting) ---`);
  lines.push(`Root: ${facts.projectRoot}`);

  if (facts.isGitRepo) {
    let branchLine = `Branch: ${facts.gitBranch ?? '(detached HEAD)'}`;
    if (facts.gitUpstream) {
      branchLine += ` → ${facts.gitUpstream}`;
      const aheadBehind: string[] = [];
      if ((facts.gitAhead ?? 0) > 0) aheadBehind.push(`ahead ${facts.gitAhead}`);
      if ((facts.gitBehind ?? 0) > 0) aheadBehind.push(`behind ${facts.gitBehind}`);
      if (aheadBehind.length) branchLine += ` (${aheadBehind.join(', ')})`;
    }
    lines.push(branchLine);

    if (facts.isWorktree) lines.push(`Worktree: linked (git state shared with primary tree)`);

    const statusParts: string[] = [];
    if ((facts.gitStaged ?? 0) > 0)    statusParts.push(`${facts.gitStaged} staged`);
    if ((facts.gitModified ?? 0) > 0)  statusParts.push(`${facts.gitModified} modified`);
    if ((facts.gitUntracked ?? 0) > 0) statusParts.push(`${facts.gitUntracked} untracked`);
    if (statusParts.length) lines.push(`Status: ${statusParts.join(', ')}`);
    else lines.push(`Status: clean`);
  }

  if (facts.manifests.length > 0) {
    lines.push(`Project: ${facts.manifests.join(', ')}`);
  }
  if (facts.packageManagers.length > 0) {
    lines.push(`Package Manager: ${facts.packageManagers.join(', ')}`);
  }
  if (facts.verifyCommands.length > 0) {
    lines.push(`Verify: ${facts.verifyCommands.join('; ')}`);
  }
  if (facts.contextFiles.length > 0) {
    lines.push(`Context files: ${facts.contextFiles.join(', ')}`);
  }

  return lines.join('\n');
}
