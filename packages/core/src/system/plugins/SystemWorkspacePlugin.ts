import { Plugin } from '../../plugin/types';
import { readLocalFileToolDefinition, readLocalFile } from '../skills/readFile';
import { writeLocalFileToolDefinition, writeLocalFile } from '../skills/writeFile';
import { editLocalFileToolDefinition, editLocalFile } from '../skills/editFile';
import { generateExcelToolDefinition, generateExcelFile } from '../skills/generateExcel';
import { runTerminalCommandToolDefinition, runTerminalCommand } from '../skills/executeShell';
import { gitManagerToolDefinition, executeGitCommand } from '../skills/gitManager';

export class SystemWorkspacePlugin implements Plugin {
  public name = 'SystemWorkspacePlugin';
  public description = 'Local system operations including file management, terminal execution, and Git.';
  public version = '1.0.0';

  public tools = [
    readLocalFileToolDefinition,
    writeLocalFileToolDefinition,
    editLocalFileToolDefinition,
    generateExcelToolDefinition,
    runTerminalCommandToolDefinition,
    gitManagerToolDefinition
  ];

  public handlers = {
    ['read_local_file']: async (args: any) => {
      return await readLocalFile(args.filePath);
    },
    ['write_local_file']: async (args: any) => {
      return await writeLocalFile(args.filePath, args.content);
    },
    ['edit_local_file']: async (args: any) => {
      return await editLocalFile(args.filePath, args.searchString, args.replacementString);
    },
    ['generate_excel_report']: async (args: any) => {
      return await generateExcelFile(args.data, args.filename);
    },
    ['run_terminal_command']: async (args: any) => {
      return await runTerminalCommand(args.command);
    },
    ['git_manager']: async (args: any) => {
      return await executeGitCommand(args.command, args.args);
    }
  };
}
