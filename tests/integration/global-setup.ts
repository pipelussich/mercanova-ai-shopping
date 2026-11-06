import { createDb } from "../../src/db/client";
import { runMigrations } from "../../src/db/migrate";
import { importDataset } from "../../src/server/seed/import-dataset";
import { DATASET_PATH, testDatabaseUrl } from "./helpers";

export default async function setup() {
  await runMigrations(testDatabaseUrl());
  const { db, close } = createDb(testDatabaseUrl(), { max: 1 });
  try {
    await importDataset(db, DATASET_PATH);
  } finally {
    await close();
  }
}
