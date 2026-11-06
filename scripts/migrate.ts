import { runMigrations } from "../src/db/migrate";
import { getEnv } from "../src/env";

runMigrations(getEnv().DATABASE_URL)
  .then(() => console.log("Migraciones aplicadas."))
  .catch((err) => {
    console.error("Error aplicando migraciones:", err);
    process.exit(1);
  });
