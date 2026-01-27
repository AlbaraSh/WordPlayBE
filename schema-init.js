import fs from 'fs';
import path from 'path';

const ALLOWED_USERS = Array.from({ length: 10 }, (_, i) => `user${i + 1}`);

export function initSchemaAndSeed(db) {
  const schemaPath = path.join(process.cwd(), 'sql', 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');

  // Create tables
  db.exec(schemaSql);

  // Seed demo users (stats fields are in users table now)
  const insertUser = db.prepare(`
    INSERT OR IGNORE INTO users (id)
    VALUES (?)
  `);

  const tx = db.transaction(() => {
    for (const id of ALLOWED_USERS) {
      insertUser.run(id);
    }
  });

  tx();
}
