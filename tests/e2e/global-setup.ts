import path from "node:path";
import { createDb } from "../../src/db/client";
import { runMigrations } from "../../src/db/migrate";
import { importDataset, resetOperationalState } from "../../src/server/seed/import-dataset";

const DATASET = path.resolve(__dirname, "../../data/MercaNova_dataset_obligatorio_2.xlsx");

export default async function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5433/mercanova_test";
  await runMigrations(url);
  const { db, close } = createDb(url, { max: 1 });
  try {
    await importDataset(db, DATASET);
    await resetOperationalState(db, DATASET);
  } finally {
    await close();
  }
}
