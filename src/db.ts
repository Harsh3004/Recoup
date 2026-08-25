import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, readFileSync, unlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";

export const DEFAULT_DB_PATH = "data/recovery.db";

export function openDb(path = DEFAULT_DB_PATH): Database {
  mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path, { create: true });
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA synchronous = NORMAL;");
  return db;
}

export function applySchema(db: Database, schemaPath = "db/schema.sql"): void {
  const sql = readFileSync(resolve(schemaPath), "utf8");
  db.exec(sql);
}

export function resetDbFile(path: string): void {
  for (const p of [path, `${path}-wal`, `${path}-shm`]) {
    if (existsSync(p)) unlinkSync(p);
  }
}
