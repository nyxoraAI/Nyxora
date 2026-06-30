import { Plugin } from '../../plugin/types';
import { xManagerToolDefinition, manageTwitter } from '../skills/xManager';
import { notionWorkspaceToolDefinition, manageNotion } from '../skills/notionWorkspace';

export class SystemSocialPlugin implements Plugin {
  public name = 'SystemSocialPlugin';
  public description = 'Social media and external workspace operations (Twitter, Notion).';
  public version = '1.0.1';

  public tools = [
    xManagerToolDefinition,
    notionWorkspaceToolDefinition
  ];

  public handlers = {
    ['manage_twitter']: async (args: any) => {
      return await manageTwitter(args.action, args.content, args.username);
    },
    ['manage_notion']: async (args: any) => {
      return await manageNotion(args.action, args.pageId, args.text);
    }
  };
}
