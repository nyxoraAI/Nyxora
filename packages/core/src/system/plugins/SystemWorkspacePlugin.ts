import { Plugin } from '../../plugin/types';
import { readLocalFileToolDefinition, readLocalFile } from '../skills/readFile';
import { writeLocalFileToolDefinition, writeLocalFile } from '../skills/writeFile';
import { editLocalFileToolDefinition, editLocalFile } from '../skills/editFile';
import { generateExcelToolDefinition, generateExcelFile } from '../skills/generateExcel';
import { runTerminalCommandToolDefinition, runTerminalCommand } from '../skills/executeShell';
import { createCognitiveSkillToolDefinition, createCognitiveSkill } from '../skills/createCognitiveSkill';
import { searchPlaybookToolDefinition, readPlaybookToolDefinition, search_playbook, read_playbook } from '../skills/playbookManager';
import { generateDownloadLinkToolDefinition, generateDownloadLink } from '../skills/fileDownloader';
import { analyzeLocalImageToolDefinition, analyzeLocalImage } from '../skills/analyzeImage';
import { generateImageToolDefinition, generateImage } from '../skills/generateImage';
import { sendTelegramFileToolDefinition, sendTelegramFile } from '../skills/telegramUpload';

export class SystemWorkspacePlugin implements Plugin {
  public name = 'SystemWorkspacePlugin';
  public description = 'Local system operations including file management, terminal execution, and Git.';
  public version = '1.0.1';

  public tools = [
    readLocalFileToolDefinition,
    writeLocalFileToolDefinition,
    editLocalFileToolDefinition,
    generateExcelToolDefinition,
    runTerminalCommandToolDefinition,
    createCognitiveSkillToolDefinition,
    searchPlaybookToolDefinition,
    readPlaybookToolDefinition,
    generateDownloadLinkToolDefinition,
    analyzeLocalImageToolDefinition,
    generateImageToolDefinition,
    sendTelegramFileToolDefinition
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
    ['generate_excel_file']: async (args: any) => {
      return await generateExcelFile(args.data, args.filePath);
    },
    ['run_terminal_command']: async (args: any) => {
      return await runTerminalCommand(args.command);
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
    ['generate_download_link']: async (args: any) => {
      return await generateDownloadLink(args.absolutePath);
    },
    ['analyze_local_image']: async (args: any) => {
      return await analyzeLocalImage(args.imagePath, args.prompt);
    },
    ['generate_image']: async (args: any) => {
      return await generateImage(args.prompt);
    },
    ['send_telegram_file']: async (args: any) => {
      return await sendTelegramFile(args.absolutePath);
    }
  };
}
