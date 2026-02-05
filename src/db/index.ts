import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import * as schema from './schema';

const dbPath = 'data/app.db';
if (!existsSync('data')) mkdirSync('data', { recursive: true });

const sqlite = new Database(dbPath);
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });
