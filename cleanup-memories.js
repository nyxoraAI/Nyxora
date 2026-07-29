const os = require('os');
const path = require('path');
const DatabaseSync = require('node:sqlite').DatabaseSync;

const dbPath = path.join(os.homedir(), '.nyxora', 'data', 'episodic.db');
const db = new DatabaseSync(dbPath);

console.log('Fetching all memories...');
const rows = db.prepare('SELECT id, fact, occurrences, confidence, lastSeen FROM episodic_memories ORDER BY confidence DESC, occurrences DESC, lastSeen DESC').all();

const normalizedMap = new Map();

let deletedCount = 0;
let mergedCount = 0;

for (const row of rows) {
  // Normalize string for duplicate detection
  let clean = row.fact.trim().replace(/[.!?]+$/, '').toLowerCase();
  
  if (!normalizedMap.has(clean)) {
    // Keep this one as the primary record
    normalizedMap.set(clean, row);
  } else {
    // Duplicate found
    const primary = normalizedMap.get(clean);
    
    // Merge occurrences
    const newOccurrences = primary.occurrences + row.occurrences;
    const newConfidence = Math.min(1.0, Math.max(primary.confidence, row.confidence));
    
    // Update primary
    db.prepare('UPDATE episodic_memories SET occurrences = ?, confidence = ? WHERE id = ?')
      .run(newOccurrences, newConfidence, primary.id);
      
    // Update our map reference too
    primary.occurrences = newOccurrences;
    primary.confidence = newConfidence;
    
    // Delete the duplicate
    db.prepare('DELETE FROM episodic_memories WHERE id = ?').run(row.id);
    deletedCount++;
    mergedCount += row.occurrences;
    
    console.log(`Deleted duplicate: "${row.fact}" (Merged into ID ${primary.id})`);
  }
}

console.log(`\nCleanup complete! Deleted ${deletedCount} duplicate entries.`);
console.log(`Merged a total of ${mergedCount} occurrences into primary records.`);
