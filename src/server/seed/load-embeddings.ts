import { readFile } from "node:fs/promises";
import { sql } from "drizzle-orm";
import type { DB } from "../../db/client";
import { getProduct } from "../catalog/catalog-service";
import { buildSearchDocument, contentHash } from "../search/search-document";

export type EmbeddingsFile = {
  model: string;
  dimensions: number;
  generatedAt: string;
  items: { productId: string; contentHash: string; embedding: number[] }[];
};

/** Documento de búsqueda actual de cada producto (desde la DB) con su hash. */
export async function currentSearchDocuments(db: DB): Promise<{ productId: string; doc: string; hash: string }[]> {
  const ids = await db.execute<{ id: string }>(sql`select id from products order by id`);
  const out = [];
  for (const { id } of ids) {
    const p = await getProduct(db, id);
    if (!p) continue;
    const doc = buildSearchDocument(p);
    out.push({ productId: id, doc, hash: contentHash(doc) });
  }
  return out;
}

/**
 * Carga embeddings precomputados (sin llamar a la API). Sólo se cargan los que corresponden al
 * contenido actual del producto; los desactualizados se reportan para regenerarlos.
 */
export async function loadEmbeddingsIfPresent(db: DB, path: string): Promise<{ loaded: number; stale: number }> {
  const file = JSON.parse(await readFile(path, "utf8")) as EmbeddingsFile;
  const byId = new Map(file.items.map((i) => [i.productId, i]));
  const docs = await currentSearchDocuments(db);
  let loaded = 0;
  let stale = 0;
  for (const d of docs) {
    const item = byId.get(d.productId);
    if (!item || item.contentHash !== d.hash || item.embedding.length !== file.dimensions) {
      stale++;
      continue;
    }
    await db.execute(sql`
      insert into product_embeddings (product_id, content_hash, embedding)
      values (${d.productId}, ${d.hash}, ${JSON.stringify(item.embedding)}::vector)
      on conflict (product_id) do update set content_hash = excluded.content_hash, embedding = excluded.embedding`);
    loaded++;
  }
  return { loaded, stale };
}
