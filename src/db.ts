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
  ensureSchemaCompatibility(db);
  return db;
}

export function ensureSchemaCompatibility(db: Database): void {
  try {
    const riskCols = db.query("PRAGMA table_info(risk_items);").all() as any[];
    if (riskCols.length > 0) {
      const colNames = riskCols.map((c) => c.name);
      if (!colNames.includes("resolved_via")) {
        db.exec("ALTER TABLE risk_items ADD COLUMN resolved_via TEXT DEFAULT 'simulated';");
      }
      if (!colNames.includes("payment_link_url")) {
        db.exec("ALTER TABLE risk_items ADD COLUMN payment_link_url TEXT;");
      }
    }

    const recCols = db.query("PRAGMA table_info(recoveries);").all() as any[];
    if (recCols.length > 0) {
      const colNames = recCols.map((c) => c.name);
      if (!colNames.includes("resolved_via")) {
        db.exec("ALTER TABLE recoveries ADD COLUMN resolved_via TEXT DEFAULT 'simulated';");
      }
      if (!colNames.includes("payment_ref")) {
        db.exec("ALTER TABLE recoveries ADD COLUMN payment_ref TEXT;");
      }
    }

    db.exec(`
      CREATE TABLE IF NOT EXISTS payment_links (
        id           TEXT PRIMARY KEY,
        risk_item_id TEXT NOT NULL,
        short_url    TEXT NOT NULL,
        amount_paise INTEGER NOT NULL,
        status       TEXT NOT NULL DEFAULT 'created',
        is_live      INTEGER NOT NULL DEFAULT 0,
        created_at   INTEGER NOT NULL
      );
    `);
  } catch {}
}

export function applySchema(db: Database, schemaPath = "db/schema.sql"): void {
  const sql = readFileSync(resolve(schemaPath), "utf8");
  db.exec(sql);
  ensureSchemaCompatibility(db);
}

export function resetDbFile(path: string): void {
  for (const p of [path, `${path}-wal`, `${path}-shm`]) {
    if (existsSync(p)) unlinkSync(p);
  }
}
