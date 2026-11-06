/**
 * Genera data/embeddings.json a partir del catálogo cargado en la DB (una sola vez; se versiona).
 * Uso: npm run db:seed && npm run embeddings:generate
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { createDb } from "../src/db/client";
import { getEnv } from "../src/env";
import { EMBEDDING_DIMENSIONS, embedDocuments } from "../src/ai/embeddings";
import { currentSearchDocuments, type EmbeddingsFile } from "../src/server/seed/load-embeddings";

async function main() {
  const env = getEnv();
  const { db, close } = createDb(env.DATABASE_URL, { max: 1 });
  try {
    const docs = await currentSearchDocuments(db);
    console.log(`Generando embeddings de ${docs.length} productos con ${env.GEMINI_EMBEDDING_MODEL}…`);
    const vectors = await embedDocuments(
      docs.map((d) => d.doc),
      { onBatch: (n) => console.log(`  ${n}/${docs.length}`) },
    );
    const file: EmbeddingsFile = {
      model: env.GEMINI_EMBEDDING_MODEL,
      dimensions: EMBEDDING_DIMENSIONS,
      generatedAt: new Date().toISOString(),
      items: docs.map((d, i) => ({
        productId: d.productId,
        contentHash: d.hash,
        // 6 decimales alcanzan para similitud coseno y achican el archivo.
        embedding: vectors[i].map((v) => Math.round(v * 1e6) / 1e6),
      })),
    };
    const out = path.resolve(process.cwd(), "data/embeddings.json");
    await writeFile(out, JSON.stringify(file));
    console.log(`Listo: ${out}`);
  } finally {
    await close();
  }
}

main().catch((err) => {
  console.error("Error generando embeddings:", err instanceof Error ? err.message : err);
  process.exit(1);
});
