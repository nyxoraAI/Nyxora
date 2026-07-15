export const MAX_SCAN_CHARS = 65536;

const FILLER = `(?:\\w+\\s+){0,8}`;

const PATTERNS: Array<{ regex: string; pid: string; scope: 'all' | 'context' | 'strict' }> = [
  // Classic prompt injection
  { regex: `ignore\\s+${FILLER}(previous|all|above|prior)\\s+${FILLER}instructions`, pid: 'prompt_injection', scope: 'all' },
  { regex: `system\\s+prompt\\s+override`, pid: 'sys_prompt_override', scope: 'all' },
  { regex: `disregard\\s+${FILLER}(your|all|any)\\s+${FILLER}(instructions|rules|guidelines)`, pid: 'disregard_rules', scope: 'all' },
  { regex: `act\\s+as\\s+(if|though)\\s+${FILLER}you\\s+${FILLER}(have\\s+no|don't\\s+have)\\s+${FILLER}(restrictions|limits|rules)`, pid: 'bypass_restrictions', scope: 'all' },
  { regex: `<!--[^>]{0,512}(?:ignore|override|system|secret|hidden)[^>]{0,512}-->`, pid: 'html_comment_injection', scope: 'all' },
  { regex: `<\\s*div\\s+style\\s*=\\s*["'][^>]{0,2048}display\\s*:\\s*none`, pid: 'hidden_div', scope: 'all' },
  { regex: `translate\\s+[^\\n]{0,512}\\s+into\\s+[^\\n]{0,512}\\s+and\\s+(execute|run|eval)`, pid: 'translate_execute', scope: 'all' },
  { regex: `do\\s+not\\s+${FILLER}tell\\s+${FILLER}the\\s+user`, pid: 'deception_hide', scope: 'all' },

  // Role-play hijack
  { regex: `you\\s+are\\s+${FILLER}now\\s+(?:a|an|the)\\s+`, pid: 'role_hijack', scope: 'context' },
  { regex: `pretend\\s+${FILLER}(you\\s+are|to\\s+be)\\s+`, pid: 'role_pretend', scope: 'context' },
  { regex: `output\\s+${FILLER}(system|initial)\\s+prompt`, pid: 'leak_system_prompt', scope: 'context' },
  { regex: `(respond|answer|reply)\\s+without\\s+${FILLER}(restrictions|limitations|filters|safety)`, pid: 'remove_filters', scope: 'context' },
  { regex: `you\\s+have\\s+been\\s+${FILLER}(updated|upgraded|patched)\\s+to`, pid: 'fake_update', scope: 'context' },
  { regex: `\\bname\\s+yourself\\s+\\w+`, pid: 'identity_override', scope: 'context' },

  // C2 promptware
  { regex: `register\\s+(as\\s+)?a?\\s*node`, pid: 'c2_node_registration', scope: 'context' },
  { regex: `(heartbeat|beacon|check[\\s\\-]?in)\\s+(to|with)\\s+`, pid: 'c2_heartbeat', scope: 'context' },
  { regex: `pull\\s+(down\\s+)?(?:new\\s+)?task(?:ing|s)?\\b`, pid: 'c2_task_pull', scope: 'context' },
  { regex: `connect\\s+to\\s+the\\s+network\\b`, pid: 'c2_network_connect', scope: 'context' },
  { regex: `you\\s+must\\s+(?:\\w+\\s+){0,3}(register|connect|report|beacon)\\b`, pid: 'forced_action', scope: 'context' },
  { regex: `only\\s+use\\s+one[\\s\\-]?liners?\\b`, pid: 'anti_forensic_oneliner', scope: 'context' },
  { regex: `never\\s+${FILLER}(?:create|write)\\s+${FILLER}(?:script|file)\\s+${FILLER}disk`, pid: 'anti_forensic_disk', scope: 'context' },
  { regex: `unset\\s+\\w*(?:CLAUDE|CODEX|HERMES|AGENT|OPENAI|ANTHROPIC|NYXORA)\\w*`, pid: 'env_var_unset_agent', scope: 'context' },

  // Exfil via curl
  { regex: `curl\\s+[^\\n]{0,2048}\\$\\{?\\w*(KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|API)`, pid: 'exfil_curl', scope: 'all' },
  { regex: `wget\\s+[^\\n]{0,2048}\\$\\{?\\w*(KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|API)`, pid: 'exfil_wget', scope: 'all' },
  { regex: `cat\\s+[^\\n]{0,2048}(\\.env|credentials|\\.netrc|\\.pgpass|\\.npmrc|\\.pypirc)`, pid: 'read_secrets', scope: 'all' },
  { regex: `(send|post|upload|transmit)\\s+[^\\n]{0,2048}\\s+(to|at)\\s+https?://`, pid: 'send_to_url', scope: 'strict' },
  
  // SSH Backdoor
  { regex: `authorized_keys`, pid: 'ssh_backdoor', scope: 'strict' },
  { regex: `\\$HOME/\\.ssh|\\~/\\.ssh`, pid: 'ssh_access', scope: 'strict' },
];

const INVISIBLE_CHARS = new Set([
  '\\u200b', '\\u200c', '\\u200d', '\\u2060', '\\u2062', '\\u2063', '\\u2064',
  '\\ufeff', '\\u202a', '\\u202b', '\\u202c', '\\u202d', '\\u202e', '\\u2066',
  '\\u2067', '\\u2068', '\\u2069'
]);

let _compiled: Record<string, Array<{ regex: RegExp; pid: string }>> | null = null;

function compilePatterns() {
  if (_compiled) return;
  const allPatterns = [];
  const contextPatterns = [];
  const strictPatterns = [];

  for (const { regex, pid, scope } of PATTERNS) {
    const r = new RegExp(regex, 'i');
    const entry = { regex: r, pid };
    if (scope === 'all') {
      allPatterns.push(entry);
      contextPatterns.push(entry);
      strictPatterns.push(entry);
    } else if (scope === 'context') {
      contextPatterns.push(entry);
      strictPatterns.push(entry);
    } else if (scope === 'strict') {
      strictPatterns.push(entry);
    }
  }

  _compiled = {
    all: allPatterns,
    context: contextPatterns,
    strict: strictPatterns
  };
}

export function scanForThreats(content: string, scope: 'all' | 'context' | 'strict' = 'context'): string[] {
  if (!content) return [];
  compilePatterns();

  const findings: string[] = [];
  const truncated = content.substring(0, MAX_SCAN_CHARS);

  for (const char of truncated) {
    if (INVISIBLE_CHARS.has(char)) {
      const hex = char.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0');
      findings.push(`invisible_unicode_U+${hex}`);
    }
  }

  // Normalize Unicode (NFKC)
  const normalized = truncated.normalize('NFKC');

  const patterns = _compiled![scope];
  for (const { regex, pid } of patterns) {
    if (regex.test(normalized)) {
      findings.push(pid);
    }
  }

  return findings;
}

export function scanContextContent(content: string, filename: string): string {
  const findings = scanForThreats(content, 'context');
  if (findings.length > 0) {
    console.warn(`Context file ${filename} blocked: ${findings.join(', ')}`);
    return `[BLOCKED: ${filename} contained potential prompt injection (${findings.join(', ')}). Content not loaded.]`;
  }
  return content;
}
