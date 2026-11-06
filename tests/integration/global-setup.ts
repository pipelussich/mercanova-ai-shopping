import { runMigrations } from "../../src/db/migrate";
import { testDatabaseUrl } from "./helpers";

export default async function setup() {
  await runMigrations(testDatabaseUrl());
}
