import path from "node:path";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDb } from "./client";

export const MIGRATIONS_DIR = path.resolve(process.cwd(), "drizzle");

export async function runMigrations(url: string, migrationsFolder = MIGRATIONS_DIR): Promise<void> {
  const { db, close } = createDb(url, { max: 1 });
  try {
    await migrate(db, { migrationsFolder });
  } finally {
    await close();
  }
}
