import { Plugin } from '../../plugin/types';
import { updateProfileToolDefinition, updateProfile } from '../../agent/updateProfile';
import { updateIdentityToolDefinition, updateIdentity } from '../../agent/updateIdentity';
import { updateSecurityPolicyToolDefinition, updateSecurityPolicy } from '../skills/updateSecurityPolicy';
import { scheduleTaskDefinition, executeScheduleTask } from '../skills/scheduleTask';
import { cancelTaskDefinition, executeCancelTask } from '../skills/cancelTask';
import { forgetMemoryToolDefinition, forgetMemory } from '../skills/forgetMemory';

export class SystemCorePlugin implements Plugin {
  public name = 'SystemCorePlugin';
  public description = 'Core system identity, profile, and task scheduling operations.';
  public version = '1.0.0';

  public tools = [
    updateProfileToolDefinition,
    updateIdentityToolDefinition,
    updateSecurityPolicyToolDefinition,
    scheduleTaskDefinition,
    cancelTaskDefinition,
    forgetMemoryToolDefinition
  ];

  public handlers = {
    ['update_profile']: async (args: any) => {
      return await updateProfile(args.content, args.mode);
    },
    ['update_identity']: async (args: any) => {
      return await updateIdentity(args.content, args.mode);
    },
    ['update_security_policy']: async (args: any) => {
      return await updateSecurityPolicy(args.policy, args.action || 'add');
    },
    ['schedule_task']: async (args: any) => {
      return await executeScheduleTask(args);
    },
    ['cancel_task']: async (args: any) => {
      return await executeCancelTask(args);
    },
    ['forget_memory']: async (args: any) => {
      return await forgetMemory(args.keyword);
    }
  };
}
