import fs from 'fs';
import path from 'path';
import { getPath } from '../config/paths';
import { episodicDB, EpisodicMemory } from './episodic';

export class PromotionEngine {
  // Score required to promote an observation to Permanent Preference
  private static readonly PROMOTION_THRESHOLD = 3.0;

  public static async runPromotionAndDecay(): Promise<void> {
    try {
      // 1. Run Garbage Collection (thresholds tightened in episodic.ts: 30d / conf<0.5 / occ<=1)
      episodicDB.decayMemories();

      // 2. Fetch all current episodic memories
      const memories = episodicDB.getMemories();

      // 3. Bucket facts by category, sorted by score DESC (confidence × occurrences)
      //    Cap: MAX_PER_CATEGORY facts per category to keep user.md lean and fully readable.
      //    Permanent rule-type entries are always included regardless of cap.
      const MAX_PER_CATEGORY = 8;
      const categoryBuckets = new Map<string, EpisodicMemory[]>();

      for (const mem of memories) {
        const cat = mem.category || 'general';
        if (!categoryBuckets.has(cat)) categoryBuckets.set(cat, []);
        categoryBuckets.get(cat)!.push(mem);
      }

      const permanentPreferences: string[] = [];
      const recentObservations: string[]   = [];

      for (const [cat, items] of categoryBuckets.entries()) {
        // Sort by score desc
        items.sort((a, b) => (b.occurrences * b.confidence) - (a.occurrences * a.confidence));

        let included = 0;
        for (const mem of items) {
          const score = mem.occurrences * mem.confidence;
          const isPermanent = mem.rule_type === 'permanent' || score >= PromotionEngine.PROMOTION_THRESHOLD;

          if (isPermanent) {
            permanentPreferences.push(`- [${cat.toUpperCase()}] ${mem.fact}`);
          } else if (mem.rule_type === 'temporary') {
            recentObservations.push(`- [TEMPORARY] ${mem.fact}`);
          } else if (included < MAX_PER_CATEGORY) {
            // Only include top N observations per category
            recentObservations.push(`- ${mem.fact}`);
            included++;
          }
          // else: fact stays in DB (accessible via RAG), just not written to user.md
        }
      }

      // Deduplicate arrays
      const uniquePermanent = [...new Set(permanentPreferences)];
      const uniqueRecent    = [...new Set(recentObservations)];

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
