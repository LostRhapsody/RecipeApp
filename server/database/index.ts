import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"
import * as schema from "./schema"

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null

export function useDB() {
  if (!_db) {
    const sqlite = new Database("sqlite.db")
    sqlite.pragma("journal_mode = WAL")
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS recipes (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        url text NOT NULL,
        title text NOT NULL,
        description text,
        image text,
        author text,
        prep_time text,
        cook_time text,
        total_time text,
        recipe_yield text,
        recipe_category text,
        recipe_cuisine text,
        freeze_time text,
        ingredients text NOT NULL,
        instructions text NOT NULL,
        nutrition text,
        notes text,
        created_at integer NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS recipes_url_unique ON recipes (url);
    `)
    // Add columns for existing databases
    const columns = sqlite
      .prepare("PRAGMA table_info(recipes)")
      .all() as { name: string }[]
    const columnNames = new Set(columns.map((c) => c.name))
    if (!columnNames.has("freeze_time")) {
      sqlite.exec("ALTER TABLE recipes ADD COLUMN freeze_time text")
    }
    if (!columnNames.has("nutrition")) {
      sqlite.exec("ALTER TABLE recipes ADD COLUMN nutrition text")
    }
    _db = drizzle(sqlite, { schema })
  }
  return _db
}
