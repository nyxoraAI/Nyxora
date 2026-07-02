import fs from 'fs';
import { getPath } from '../config/paths';
import { loadConfig, saveConfig } from '../config/parser';

let disabledSkillsCache: string[] | null = null;

const reverseSkillMapping: Record<string, { category: 'os' | 'web3', name: string }> = {
  // OS Skills
  'read_local_file': { category: 'os', name: 'readFile' },
  'write_local_file': { category: 'os', name: 'writeFile' },
  'edit_local_file': { category: 'os', name: 'editFile' },
  'generate_excel_file': { category: 'os', name: 'generateExcel' },
  'analyze_document': { category: 'os', name: 'analyzeDocument' },
  'run_terminal_command': { category: 'os', name: 'executeShell' },
  'browse_website': { category: 'os', name: 'browseWeb' },
  'search_web': { category: 'os', name: 'searchWeb' },
  'read_gmail_inbox': { category: 'os', name: 'readGmail' },
  'list_calendar_events': { category: 'os', name: 'listCalendar' },
  'append_row_to_sheets': { category: 'os', name: 'appendSheets' },
  'read_google_docs': { category: 'os', name: 'readDocs' },
  'read_google_form_responses': { category: 'os', name: 'readForms' },
  'execute_git_command': { category: 'os', name: 'gitManager' },
  'forget_memory': { category: 'os', name: 'forgetMemory' },
  'manage_twitter': { category: 'os', name: 'xManager' },
  'manage_notion': { category: 'os', name: 'notionWorkspace' },
  'transcribe_audio': { category: 'os', name: 'audioTranscribe' },
  'summarize_text': { category: 'os', name: 'summarizeText' },
  'update_security_policy': { category: 'os', name: 'updateSecurityPolicy' },
  'create_cognitive_skill': { category: 'os', name: 'createCognitiveSkill' },
  
  // Web3 Skills
  'transfer_token': { category: 'web3', name: 'transfer' },
  'transfer_native': { category: 'web3', name: 'transfer' },
  'swap_token': { category: 'web3', name: 'swap' },
  'bridge_token': { category: 'web3', name: 'bridge' },
  'mint_nft': { category: 'web3', name: 'mintNft' },
  'custom_tx': { category: 'web3', name: 'customTx' },
  'check_address': { category: 'web3', name: 'checkAddress' },
  'get_my_address': { category: 'web3', name: 'getMyAddress' },
  'check_token_security': { category: 'web3', name: 'checkSecurity' },
  'check_portfolio': { category: 'web3', name: 'checkPortfolio' },
  'analyze_market': { category: 'web3', name: 'marketAnalysis' },
  'get_trending_tokens': { category: 'web3', name: 'getTrendingTokens' },
  'manage_custom_tokens': { category: 'web3', name: 'manageCustomTokens' },
  'get_price_and_fiat_value': { category: 'web3', name: 'getPrice' },
  'supply_aave': { category: 'web3', name: 'aaveSupply' },
  'revoke_approval': { category: 'web3', name: 'revokeApproval' },
  'deposit_yield_vault': { category: 'web3', name: 'vaultDeposit' },
  'provide_liquidity_v3': { category: 'web3', name: 'provideLiquidity' },
  'get_tx_history': { category: 'web3', name: 'getTxHistory' },
  'check_registry_status': { category: 'web3', name: 'checkRegistryStatus' },
  'create_limit_order': { category: 'web3', name: 'createLimitOrder' },
  'confirm_pending_tx': { category: 'web3', name: 'confirmPendingTx' }
};

function getDisabledSkillsFile(): string {
  return getPath('disabled_skills.json');
}

export function getDisabledSkills(): string[] {
  if (disabledSkillsCache !== null) {
    return disabledSkillsCache;
  }
  const filepath = getDisabledSkillsFile();
  if (!fs.existsSync(filepath)) {
    disabledSkillsCache = [];
    return disabledSkillsCache;
  }
  try {
    const data = fs.readFileSync(filepath, 'utf-8');
    disabledSkillsCache = JSON.parse(data);
    if (!Array.isArray(disabledSkillsCache)) disabledSkillsCache = [];
    return disabledSkillsCache;
  } catch (e) {
    disabledSkillsCache = [];
    return [];
  }
}

export function toggleSkill(skillName: string, active: boolean): void {
  const current = new Set(getDisabledSkills());
  if (active) {
    current.delete(skillName); // Remove from disabled list to activate
  } else {
    current.add(skillName); // Add to disabled list to deactivate
  }
  disabledSkillsCache = Array.from(current);
  fs.writeFileSync(getDisabledSkillsFile(), JSON.stringify(disabledSkillsCache, null, 2));

  // Sync to config.yaml
  const mapping = reverseSkillMapping[skillName];
  if (mapping) {
    const config = loadConfig();
    if (!config.skills) config.skills = { web3: [], os: [] } as any;
    
    const categoryArray = mapping.category === 'web3' ? config.skills!.web3 : config.skills!.os;
    
    if (active && !categoryArray.includes(mapping.name)) {
      categoryArray.push(mapping.name);
    } else if (!active) {
      const index = categoryArray.indexOf(mapping.name);
      if (index !== -1) {
        categoryArray.splice(index, 1);
      }
    }
    
    saveConfig(config);
  }
}

export function isSkillActive(functionName: string): boolean {
  const disabled = getDisabledSkills();
  if (disabled.includes(functionName)) return false;

  for (const [key, mapping] of Object.entries(reverseSkillMapping)) {
    if (mapping.name === functionName) {
      if (disabled.includes(key)) {
        return false;
      }
    }
  }
  return true;
}

export function syncAllSkillsToConfig(): void {
  const config = loadConfig();
  if (!config.skills) config.skills = { web3: [], os: [] } as any;

  const activeWeb3 = new Set<string>();
  const activeOs = new Set<string>();

  for (const [skillName, mapping] of Object.entries(reverseSkillMapping)) {
    if (isSkillActive(skillName)) {
      if (mapping.category === 'web3') {
        activeWeb3.add(mapping.name);
      } else {
        activeOs.add(mapping.name);
      }
    }
  }

  // Check if arrays are different to avoid unnecessary saves
  const currentWeb3 = config.skills!.web3 || [];
  const currentOs = config.skills!.os || [];

  const web3Changed = currentWeb3.length !== activeWeb3.size || !currentWeb3.every(s => activeWeb3.has(s));
  const osChanged = currentOs.length !== activeOs.size || !currentOs.every(s => activeOs.has(s));

  if (web3Changed || osChanged) {
    config.skills!.web3 = Array.from(activeWeb3);
    config.skills!.os = Array.from(activeOs);
    saveConfig(config);
    console.log('[SkillManager] Automatically synchronized active skills to config.yaml');
  }
}
