import fs from 'fs';
import path from 'path';
import os from 'os';
import { loadConfig } from '../config/parser';

const getPlaybooksDir = () => path.join(os.homedir(), '.nyxora', 'playbooks');

export class SkillCurator {
  private static instance: SkillCurator;

  private constructor() {}

  public static getInstance(): SkillCurator {
    if (!SkillCurator.instance) {
      SkillCurator.instance = new SkillCurator();
    }
    return SkillCurator.instance;
  }

  public async runMaintenance(): Promise<void> {
    try {
      const config = loadConfig();
      const curatorConfig = config.curator || { enabled: true, archive_after_days: 14 };

      if (!curatorConfig.enabled) {
        return;
      }

      const userDir = getPlaybooksDir();
      const usageFile = path.join(userDir, '.usage.json');
      const archiveDir = path.join(userDir, '.archive');

      if (!fs.existsSync(usageFile)) return;

      const usage: Record<string, { last_accessed: number, use_count: number }> = JSON.parse(
        fs.readFileSync(usageFile, 'utf-8')
      );

      const now = Date.now();
      const maxAgeMs = curatorConfig.archive_after_days * 24 * 60 * 60 * 1000;
      
      let archivedCount = 0;

      for (const [filename, metrics] of Object.entries(usage)) {
        // DO NOT archive web3 skills as per user strict policy
        if (filename.toLowerCase().includes('web3')) {
          continue;
        }

        const ageMs = now - metrics.last_accessed;
        if (ageMs > maxAgeMs) {
          const sourcePath = path.join(userDir, filename);
          const destPath = path.join(archiveDir, filename);

          if (fs.existsSync(sourcePath)) {
            // Ensure archive subdirectories exist
            fs.mkdirSync(path.dirname(destPath), { recursive: true });
            
            // Move file
            fs.renameSync(sourcePath, destPath);
            archivedCount++;
            
            // Remove from usage file so we don't try again
            delete usage[filename];
          }
        }
      }

      if (archivedCount > 0) {
        fs.writeFileSync(usageFile, JSON.stringify(usage, null, 2));
        console.log(`[Curator] Archived ${archivedCount} idle skill(s) older than ${curatorConfig.archive_after_days} days.`);
      }

    } catch (err: any) {
      console.warn('[Curator] Maintenance task failed:', err.message);
    }
  }
}

export const skillCurator = SkillCurator.getInstance();
