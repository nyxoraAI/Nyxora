import fs from 'fs';
import yaml from 'yaml';
import { getPath } from '../../config/paths';

export function updateSecurityPolicy(rule: string, action: 'add' | 'remove' | 'clear'): string {
  try {
    const policyPath = getPath('policy.yaml');
    let policyRules: any = { max_usd_per_tx: 999999999, whitelist_only: false, require_approval: true, custom_llm_rules: [] };
    
    if (fs.existsSync(policyPath)) {
      const file = fs.readFileSync(policyPath, 'utf8');
      policyRules = { ...policyRules, ...yaml.parse(file) };
    }

    if (!Array.isArray(policyRules.custom_llm_rules)) {
      policyRules.custom_llm_rules = [];
    }
    
    if (action === 'clear') {
      policyRules.custom_llm_rules = [];
      fs.writeFileSync(policyPath, yaml.stringify(policyRules), 'utf8');
      return "Security policy cleared.";
    } else if (action === 'add') {
      if (!policyRules.custom_llm_rules.includes(rule)) {
        policyRules.custom_llm_rules.push(rule);
      }
      fs.writeFileSync(policyPath, yaml.stringify(policyRules), 'utf8');
      return `Rule added to security policy: ${rule}`;
    } else if (action === 'remove') {
      policyRules.custom_llm_rules = policyRules.custom_llm_rules.filter((r: string) => !r.includes(rule));
      fs.writeFileSync(policyPath, yaml.stringify(policyRules), 'utf8');
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
    description: "Updates the custom_llm_rules array in policy.yaml to restrict your own autonomous behavior. Use this when the user explicitly forbids you from doing something.",
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
