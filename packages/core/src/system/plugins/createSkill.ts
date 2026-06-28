import { Plugin } from '../../plugin/types';
import { skillExtractor } from '../skillExtractor';
import { logger } from '../../agent/reasoning';

export class CreateSkillPlugin implements Plugin {
  public name = 'CreateSkill';
  public version = '1.0.0';
  public description = 'Autonomously extracts and creates skills for Nyxora.';

  public tools = [
    {
      type: 'function',
      function: {
        name: 'extract_and_create_skill',
        description: 'Autonomously extracts a skill from the user intent and chat history, generating a new persistent skill for the agent.',
        parameters: {
          type: 'object',
          properties: {
            skillName: { type: 'string', description: 'A short, underscore_separated name for the skill (e.g. fetch_weather, audit_contract).' },
            description: { type: 'string', description: 'A brief description of what the skill does.' },
            userIntent: { type: 'string', description: 'Detailed step-by-step logic and requirements for the skill.' }
          },
          required: ['skillName', 'description', 'userIntent']
        }
      }
    }
  ];

  public handlers = {
    'extract_and_create_skill': async (args: any, context?: any) => {
      const history = logger.getHistory(context?.sessionId, 20).map((m: any) => `[${m.role}] ${m.content}`);
      const success = await skillExtractor.generateSkill(args.skillName, args.description, args.userIntent, history);
      
      if (success) {
        return `Successfully synthesized and deployed the skill '${args.skillName}'. It is now available for use in future requests.`;
      } else {
        return `Failed to create the skill '${args.skillName}'. It may already exist or the generation failed.`;
      }
    }
  };
}
