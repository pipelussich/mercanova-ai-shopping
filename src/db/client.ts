import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getEnv } from "../env";
import * as schema from "./schema";

export type DB = PostgresJsDatabase<typeof schema>;

export function createDb(url: string, opts: { max?: number } = {}): { db: DB; close: () => Promise<void> } {
  const client = postgres(url, { max: opts.max ?? 10, onnotice: () => {} });
  return { db: drizzle(client, { schema }), close: () => client.end() };
}

// Singleton para la app; sobrevive al hot reload de `next dev`.
const globalForDb = globalThis as unknown as { __mercanovaDb?: DB };

export function getDb(): DB {
  globalForDb.__mercanovaDb ??= createDb(getEnv().DATABASE_URL).db;
  return globalForDb.__mercanovaDb;
}
