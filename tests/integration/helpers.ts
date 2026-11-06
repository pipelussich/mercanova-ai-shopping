import path from "node:path";

export const DATASET_PATH = path.resolve(__dirname, "../../data/MercaNova_dataset_obligatorio_2.xlsx");

export function testDatabaseUrl(): string {
  return process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5433/mercanova_test";
}
