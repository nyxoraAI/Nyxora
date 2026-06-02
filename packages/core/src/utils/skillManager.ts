import fs from 'fs';
import { getPath } from '../config/paths';

let disabledSkillsCache: string[] | null = null;

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
}

export function isSkillActive(skillName: string): boolean {
  const disabled = getDisabledSkills();
  return !disabled.includes(skillName);
}
