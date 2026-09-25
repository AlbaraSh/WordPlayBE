import dotenv from 'dotenv';
import { openDb } from './db.js';
import { initSchemaAndSeed } from './schema-init.js';
import { createApp } from './src/createApp.js';

dotenv.config();

const PORT = Number(process.env.PORT || 3001);
const DB_PATH = process.env.DB_PATH || './data/app.db';

const db = openDb(DB_PATH);
initSchemaAndSeed(db);

const app = createApp(db);
app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
  console.log(`SQLite DB at ${DB_PATH}`);
});
