import { EpisodicMemoryDB } from './packages/core/src/memory/episodic';
const db = new EpisodicMemoryDB();
try {
  db.upsertPersonaByCategory('behavior', 'Interactive and responsive. Follows up on failed requests ("coba lagi dong"). Corrects Nyxora when information is contextually irrelevant to them ("gue tinggal di indonesia njir"). Switches between crypto-related and general information requests. Is direct and clear in requests and corrections.');
  console.log("Success!");
} catch (e: any) {
  console.error("FAILED:");
  console.error(e);
}
