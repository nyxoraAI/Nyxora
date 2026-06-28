import { Plugin } from '../../plugin/types';
import { createAgentSkillToolDefinition, createAgentSkill } from '../skills/createAgentSkill';

export class SystemExternalPlugin implements Plugin {
  public name = 'SystemExternalPlugin';
  public description = 'Provides tools for creating and managing third-party external agent skills.';
  public version = '1.0.0';

  public tools = [
    createAgentSkillToolDefinition
  ];

  public handlers = {
    ['create_agent_skill']: async (args: any) => {
      return await createAgentSkill(args.name, args.description, args.parameters, args.required, args.scriptContent);
    }
  };
}
