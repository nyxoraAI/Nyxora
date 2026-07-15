import fs from 'fs';
import path from 'path';
import { getPath } from '../config/paths';
import { episodicDB, EpisodicMemory } from './episodic';

export class PromotionEngine {
  // Score required to promote an observation to Permanent Preference
  private static readonly PROMOTION_THRESHOLD = 3.0;

  public static async runPromotionAndDecay(): Promise<void> {
    try {
      // 1. Run Garbage Collection
      episodicDB.decayMemories(60, 0.3); // Remove if older than 60 days and confidence < 0.3

      // 2. Fetch all current episodic memories
      const memories = episodicDB.getMemories();

      const permanentPreferences: string[] = [];
      const recentObservations: string[] = [];

      // 3. Evaluate each memory
      for (const mem of memories) {
        // Calculate dynamic weight (simple model: occurrences * confidence)
        // If it's a permanent rule fast-track, it might have high confidence (e.g., 2.0)
        let score = mem.occurrences * mem.confidence;

        if (mem.rule_type === 'permanent' || score >= this.PROMOTION_THRESHOLD) {
          permanentPreferences.push(`- [${mem.category.toUpperCase()}] ${mem.fact}`);
        } else if (mem.rule_type === 'temporary') {
          // Temporary rules stay as observations and naturally decay
          recentObservations.push(`- [TEMPORARY] ${mem.fact}`);
        } else {
          // Normal observations
          recentObservations.push(`- ${mem.fact}`);
        }
      }

      // Deduplicate arrays
      const uniquePermanent = [...new Set(permanentPreferences)];
      const uniqueRecent = [...new Set(recentObservations)];

      // 4. Fetch Persona Traits
      const personas = episodicDB.getStrongPersonas(0.4);
      const personaStrings: string[] = [];
      for (const p of personas) {
        personaStrings.push(`- [${p.category.toUpperCase()}] ${p.trait}`);
      }

      // 5. Rewrite user.md (The Golden Profile)
      this.rewriteUserProfile(uniquePermanent, uniqueRecent, personaStrings);

    } catch (error) {
      console.error('[PromotionEngine] Error running promotion engine:', error);
    }
  }

  private static rewriteUserProfile(permanent: string[], recent: string[], personas: string[] = []): void {
    const userMdPath = getPath('user.md');

    let newContent = `Write custom instructions, special rules, user profiles, or the persona you want for Nyxora AI in this file.\n\n`;
    newContent += `<!-- AUTOMANAGED BY PROMOTION ENGINE. MANUAL EDITS MAY BE OVERWRITTEN -->\n\n`;

    newContent += `# User Persona & Identity\n`;
    if (personas.length === 0) {
      newContent += `*(No specific persona traits identified yet)*\n`;
    } else {
      newContent += personas.join('\n') + '\n';
    }

    newContent += `\n# Permanent Preferences\n`;
    if (permanent.length === 0) {
      newContent += `*(No permanent preferences recorded yet)*\n`;
    } else {
      newContent += permanent.join('\n') + '\n';
    }

    newContent += `\n# Recent Observations\n`;
    if (recent.length === 0) {
      newContent += `*(No recent observations)*\n`;
    } else {
      newContent += recent.join('\n') + '\n';
    }

    fs.writeFileSync(userMdPath, newContent, 'utf-8');
    console.log(`[PromotionEngine] user.md successfully synchronized with Layer 2 Episodic Memory and Personas.`);
  }
}
