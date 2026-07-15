import { episodicDB } from '../../memory/episodic';
import { PromotionEngine } from '../../memory/promotionEngine';

export const forgetMemoryToolDefinition = {
  type: "function",
  function: {
    name: "forget_memory",
    description: "Use this tool to permanently delete a specific memory, habit, or preference from your Episodic Database if the user explicitly asks you to forget or change something about them.",
    parameters: {
      type: "object",
      properties: {
        keyword: {
          type: "string",
          description: "A short keyword or phrase to search and delete from the database (e.g. 'Hinata', 'Base Sepolia', 'casual tone'). Be specific enough to not delete unrelated memories."
        }
      },
      required: ["keyword"]
    }
  }
};

export async function forgetMemory(keyword: string): Promise<string> {
  try {
    const memoryChanges = episodicDB.deleteMemoryByFact(keyword);
    const personaChanges = episodicDB.deletePersonaByTrait(keyword);
    const totalChanges = memoryChanges + personaChanges;

    if (totalChanges > 0) {
      await PromotionEngine.runPromotionAndDecay();
      return `[Success] Deleted ${memoryChanges} memory record(s) and ${personaChanges} persona trait(s) containing '${keyword}'. Profile synchronized.`;
    } else {
      return `[Info] No memories or persona traits found containing the keyword '${keyword}'.`;
    }
  } catch (error: any) {
    return `[Error] Failed to forget memory: ${error.message}`;
  }
}
