import { Plugin } from '../../plugin/types';

export class SystemSocialPlugin implements Plugin {
  public name = 'SystemSocialPlugin';
  public description = 'Social media and external workspace operations (Twitter, Notion).';
  public version = '1.0.1';

  public tools = [];

  public handlers = {};
}
