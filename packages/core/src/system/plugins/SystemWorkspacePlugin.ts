import { Plugin } from '../../plugin/types';
import { readLocalFileToolDefinition, readLocalFile } from '../skills/readFile';
import { writeLocalFileToolDefinition, writeLocalFile } from '../skills/writeFile';
import { editLocalFileToolDefinition, editLocalFile } from '../skills/editFile';
import { generateExcelToolDefinition, generateExcelFile } from '../skills/generateExcel';
import { runTerminalCommandToolDefinition, runTerminalCommand } from '../skills/executeShell';
import { runTerminalCommandPTYToolDefinition, runTerminalCommandPTY } from '../skills/executeShellPTY';
import { createCognitiveSkillToolDefinition, createCognitiveSkill } from '../skills/createCognitiveSkill';
import { searchPlaybookToolDefinition, readPlaybookToolDefinition, restorePlaybookToolDefinition, search_playbook, read_playbook, restore_playbook } from '../skills/playbookManager';
import { generateDownloadLinkToolDefinition, generateDownloadLink } from '../skills/fileDownloader';
import { analyzeLocalImageToolDefinition, analyzeLocalImage } from '../skills/analyzeImage';
import { generateImageToolDefinition, generateImage } from '../skills/generateImage';
import { sendTelegramFileToolDefinition, sendTelegramFile } from '../skills/telegramUpload';
import { searchFilesToolDefinition, searchFiles } from '../skills/searchFiles';
import { todoWriteToolDefinition, todoReadToolDefinition, todoWrite, todoRead } from '../skills/todoTool';
import { computerUseToolDefinition, computerUse } from '../skills/computerUse';
import { delegateSubagentToolDefinition, delegateSubagent } from '../skills/delegateSubagent';
import { searchMemoryToolDefinition, executeSearchMemory } from '../skills/searchMemory';
import { runTestsAndFixToolDefinition, runTestsAndFix } from '../skills/runTestsAndFix';
import { planMigrationToolDefinition, planMigration } from '../skills/planMigration';
import { analyzePdfToolDefinition, analyzePdf } from '../skills/analyzePdf';
import { analyzeChartToolDefinition, analyzeChart } from '../skills/analyzeChart';
import { verifyVisualToolDefinition, verifyVisual } from '../skills/verifyVisual';

// ---------------------------------------------------------------------------
// CWD resolution — multi-source, with sentinel rejection.
//
// Priority order (highest to lowest):
//  1. Explicit `args.cwd` (if non-empty and non-sentinel)
//  2. `context.cwd` from session/project registration
//  3. Per-session last-known CWD (persisted across calls in the same session)
//  4. undefined → tool uses its own default (process.cwd())
// ---------------------------------------------------------------------------

const SENTINEL_CWDS = new Set(['', '.', './', 'auto', 'cwd']);
const _lastKnownCwd = new Map<string, string>(); // sessionId → cwd

function resolveCwd(context?: any, args?: any): string | undefined {
  const candidates = [
    args?.cwd,
    context?.cwd,
    context?.sessionId ? _lastKnownCwd.get(context.sessionId) : undefined,
  ];
  for (const c of candidates) {
    if (c && typeof c === 'string' && !SENTINEL_CWDS.has(c)) return c;
  }
  return undefined;
}

function updateLastKnownCwd(context?: any, cwd?: string): void {
  if (context?.sessionId && cwd && !SENTINEL_CWDS.has(cwd)) {
    _lastKnownCwd.set(context.sessionId, cwd);
  }
}

// ---------------------------------------------------------------------------

export class SystemWorkspacePlugin implements Plugin {
  public name = 'SystemWorkspacePlugin';
  public description = 'Local system operations including file management, terminal execution, and project-aware search.';
  public version = '1.1.0';

  public tools = [
    readLocalFileToolDefinition,
    writeLocalFileToolDefinition,
    editLocalFileToolDefinition,
    generateExcelToolDefinition,
    runTerminalCommandToolDefinition,
    runTerminalCommandPTYToolDefinition,
    createCognitiveSkillToolDefinition,
    searchPlaybookToolDefinition,
    readPlaybookToolDefinition,
    restorePlaybookToolDefinition,
    generateDownloadLinkToolDefinition,
    analyzeLocalImageToolDefinition,
    generateImageToolDefinition,
    sendTelegramFileToolDefinition,
    // ── New tools ───────────────────────────────────────────────
    searchFilesToolDefinition,
    todoWriteToolDefinition,
    todoReadToolDefinition,
    computerUseToolDefinition,
    delegateSubagentToolDefinition,
    searchMemoryToolDefinition,
    runTestsAndFixToolDefinition,
    planMigrationToolDefinition,
    analyzePdfToolDefinition,
    analyzeChartToolDefinition,
    verifyVisualToolDefinition
  ];

  public handlers = {
    ['read_local_file']: async (args: any) => {
      return await readLocalFile(args.filePath, args.startLine, args.endLine);
    },
    ['write_local_file']: async (args: any) => {
      return await writeLocalFile(args.filePath, args.content);
    },
    ['edit_local_file']: async (args: any) => {
      return await editLocalFile(args.filePath, args.searchString, args.replacementString);
    },
    ['generate_excel_file']: async (args: any) => {
      return await generateExcelFile(args.data, args.filePath);
    },
    ['run_terminal_command']: async (args: any, context?: any) => {
      const cwd = resolveCwd(context, args);
      if (cwd) updateLastKnownCwd(context, cwd);
      return await runTerminalCommand(args.command, cwd, args.envType, args.dockerImage);
    },
    ['run_terminal_command_pty']: async (args: any, context?: any) => {
      const cwd = resolveCwd(context, args);
      if (cwd) updateLastKnownCwd(context, cwd);
      return await runTerminalCommandPTY(args.command, undefined, cwd);
    },
    ['create_cognitive_skill']: async (args: any) => {
      return await createCognitiveSkill(args.category, args.skillName, args.content);
    },
    ['search_playbook']: async (args: any) => {
      return await search_playbook(args.query);
    },
    ['read_playbook']: async (args: any) => {
      return await read_playbook(args.filename);
    },
    ['restore_playbook']: async (args: any) => {
      return await restore_playbook(args.filename);
    },
    ['generate_download_link']: async (args: any) => {
      return await generateDownloadLink(args.absolutePath);
    },
    ['analyze_local_image']: async (args: any) => {
      return await analyzeLocalImage(args.imagePath, args.prompt);
    },
    ['generate_image']: async (args: any) => {
      return await generateImage(args.prompt);
    },
    ['computer']: async (args: any) => {
      return await computerUse(args);
    },
    ['send_telegram_file']: async (args: any) => {
      return await sendTelegramFile(args.absolutePath);
    },
    // ── New handlers ─────────────────────────────────────────────────────
    ['search_files']: async (args: any, context?: any) => {
      const dir = args.directory || resolveCwd(context, args);
      return searchFiles({ ...args, directory: dir ?? args.directory });
    },
    ['todo_write']: async (args: any, context?: any) => {
      return todoWrite(args.todos, context?.sessionId);
    },
    ['todo_read']: async (_args: any, context?: any) => {
      return todoRead(context?.sessionId);
    },
    ['delegate_subagent']: async (args: any) => {
      return await delegateSubagent(args.task, args.roleName);
    },
    ['search_memory']: async (args: any) => {
      return executeSearchMemory(args.query, args.limit);
    },
    ['run_tests_and_fix']: async (args: any, context?: any) => {
      const cwd = resolveCwd(context, args);
      return await runTestsAndFix({ ...args, workDir: cwd ?? args.workDir });
    },
    ['plan_migration']: async (args: any, context?: any) => {
      const cwd = resolveCwd(context, args);
      return await planMigration({ ...args, workDir: cwd ?? args.workDir });
    },
    ['analyze_pdf']: async (args: any) => {
      return await analyzePdf(args);
    },
    ['analyze_chart']: async (args: any) => {
      return await analyzeChart(args);
    },
    ['verify_visual_output']: async (args: any) => {
      return await verifyVisual(args);
    },
  };
}
