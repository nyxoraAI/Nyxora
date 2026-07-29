/**
 * One-time semantic duplicate cleanup for episodic_memories.
 * Merges near-duplicate facts (word overlap >= 60%) within the same category.
 * Keeps the highest-scoring entry (confidence * occurrences), deletes the rest.
 */
const os = require('os');
const path = require('path');
const DatabaseSync = require('node:sqlite').DatabaseSync;

const db = new DatabaseSync(path.join(os.homedir(), '.nyxora', 'data', 'episodic.db'));
db.exec('PRAGMA journal_mode = WAL;');

function wordOverlapSimilarity(a, b) {
  const tokenise = s =>
    new Set(s.toLowerCase().split(/[\W_]+/).filter(w => w.length > 3));
  const wa = tokenise(a);
  const wb = tokenise(b);
  if (wa.size === 0 || wb.size === 0) return 0;
  let intersection = 0;
  wa.forEach(w => { if (wb.has(w)) intersection++; });
  return intersection / Math.max(wa.size, wb.size);
}

const THRESHOLD = 0.60;
const rows = db.prepare(
  'SELECT id, fact, category, confidence, occurrences FROM episodic_memories ORDER BY category, (confidence * occurrences) DESC'
).all();

const toDelete = new Set();
const categoryGroups = {};

for (const row of rows) {
  if (!categoryGroups[row.category]) categoryGroups[row.category] = [];
  categoryGroups[row.category].push(row);
}

let mergedCount = 0;

for (const [cat, items] of Object.entries(categoryGroups)) {
  for (let i = 0; i < items.length; i++) {
    if (toDelete.has(items[i].id)) continue; // already absorbed
    for (let j = i + 1; j < items.length; j++) {
      if (toDelete.has(items[j].id)) continue;
      const sim = wordOverlapSimilarity(items[i].fact, items[j].fact);
      if (sim >= THRESHOLD) {
        // items[i] is the winner (higher score because sorted DESC)
        const newOcc  = items[i].occurrences + items[j].occurrences;
        const newConf = Math.min(1.0, Math.max(items[i].confidence, items[j].confidence));
        db.prepare('UPDATE episodic_memories SET occurrences = ?, confidence = ? WHERE id = ?')
          .run(newOcc, newConf, items[i].id);
        items[i].occurrences = newOcc;
        items[i].confidence  = newConf;
        toDelete.add(items[j].id);
        mergedCount++;
        console.log(`[MERGE sim=${sim.toFixed(2)} cat=${cat}]`);
        console.log(`  KEEP : ${items[i].fact.substring(0, 90)}`);
        console.log(`  DROP : ${items[j].fact.substring(0, 90)}\n`);
      }
    }
  }
}

// Batch delete
if (toDelete.size > 0) {
  const ids = [...toDelete].join(',');
  db.exec(`DELETE FROM episodic_memories WHERE id IN (${ids})`);
}

const remaining = db.prepare('SELECT COUNT(*) as c FROM episodic_memories').get();
console.log(`\nCleanup complete!`);
console.log(`  Merged/deleted : ${mergedCount} duplicate entries`);
console.log(`  Remaining      : ${remaining.c} memories`);
