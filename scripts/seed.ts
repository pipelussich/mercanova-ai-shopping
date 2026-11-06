import { existsSync } from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { createDb } from "../src/db/client";
import { getEnv } from "../src/env";
import { importDataset, resetOperationalState } from "../src/server/seed/import-dataset";
import { loadEmbeddingsIfPresent } from "../src/server/seed/load-embeddings";

const DATA_DIR = path.resolve(process.cwd(), "data");
const DATASET = path.join(DATA_DIR, "MercaNova_dataset_obligatorio_2.xlsx");
const EMBEDDINGS = path.join(DATA_DIR, "embeddings.json");

async function main() {
  const reset = process.argv.includes("--reset");
  const force = process.argv.includes("--force");
  const { db, close } = createDb(getEnv().DATABASE_URL, { max: 1 });
  try {
    const [{ n }] = await db.execute<{ n: string }>(sql`select count(*) as n from products`);
    if (Number(n) === 0 || force) {
      const summary = await importDataset(db, DATASET);
      console.log("Dataset importado:", summary);
    } else {
      console.log(`Catálogo ya cargado (${n} productos).`);
    }
    if (existsSync(EMBEDDINGS)) {
      const r = await loadEmbeddingsIfPresent(db, EMBEDDINGS);
      console.log(`Embeddings: ${r.loaded} cargados, ${r.stale} desactualizados.`);
    } else {
      console.log("Sin data/embeddings.json: la búsqueda usará palabras clave.");
    }
    if (reset) {
      await resetOperationalState(db, DATASET);
      console.log("Estado operacional reiniciado (carritos, órdenes y stock del dataset).");
    }
  } finally {
    await close();
  }
}

main().catch((err) => {
  console.error("Error en el seed:", err);
  process.exit(1);
});
