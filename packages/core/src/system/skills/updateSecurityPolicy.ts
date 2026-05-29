import fs from 'fs';
import { getPath } from '../../config/paths';

export function updateSecurityPolicy(rule: string, action: 'add' | 'remove' | 'clear'): string {
  try {
    const policyPath = getPath('security_policy.md');
    let existingContent = "";
    
    if (fs.existsSync(policyPath)) {
      existingContent = fs.readFileSync(policyPath, 'utf8');
    }
    
    if (action === 'clear') {
      fs.writeFileSync(policyPath, '', 'utf8');
      return "Security policy cleared.";
    } else if (action === 'add') {
      const newContent = existingContent + (existingContent.endsWith('\n') || existingContent === '' ? '' : '\n') + `* ${rule}`;
      fs.writeFileSync(policyPath, newContent, 'utf8');
      return `Rule added to security policy: ${rule}`;
    } else if (action === 'remove') {
      // Very basic line removal
      const lines = existingContent.split('\n');
      const filtered = lines.filter(l => !l.includes(rule));
      fs.writeFileSync(policyPath, filtered.join('\n'), 'utf8');
      return `Rule removed (if it existed).`;
    }
    
    return "Invalid action.";
  } catch (error: any) {
    return `Failed to update security policy: ${error.message}`;
  }
}

export const updateSecurityPolicyToolDefinition = {
  type: "function",
  function: {
    name: "update_security_policy",
    description: "Updates the security_policy.md file to restrict your own autonomous behavior. Use this when the user explicitly forbids you from doing something (e.g. 'do not touch drive E').",
    parameters: {
      type: "object",
      properties: {
        rule: {
          type: "string",
          description: "The rule to add or remove.",
        },
        action: {
          type: "string",
          enum: ["add", "remove", "clear"],
          description: "The action to perform on the policy.",
        }
      },
      required: ["rule", "action"],
    },
  },
};
