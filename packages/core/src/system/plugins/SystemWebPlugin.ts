import { Plugin } from '../../plugin/types';
import { browseWebsiteToolDefinition, browseWebsite } from '../skills/browseWeb';
import { searchWebToolDefinition, searchWeb } from '../skills/searchWeb';
import { summarizeTextToolDefinition, summarizeText } from '../skills/summarizeText';
import { audioTranscribeToolDefinition, transcribeAudio } from '../skills/audioTranscribe';

export class SystemWebPlugin implements Plugin {
  public name = 'SystemWebPlugin';
  public description = 'Web browsing, searching, and media analysis operations.';
  public version = '1.0.1';

  public tools = [
    browseWebsiteToolDefinition,
    searchWebToolDefinition,
    summarizeTextToolDefinition,
    audioTranscribeToolDefinition
  ];

  public handlers = {
    ['browse_website']: async (args: any) => {
      return await browseWebsite(args.url);
    },
    ['search_web']: async (args: any) => {
      return await searchWeb(args.query, args.depth);
    },
    ['summarize_text']: async (args: any) => {
      return await summarizeText(args.text, args.format);
    },
    ['transcribe_audio']: async (args: any) => {
      return await transcribeAudio(args.filePath);
    }
  };
}
