import { sql, type SQL } from "drizzle-orm";
import type { DB } from "@/db/client";
import {
  productFilterConditions,
  SUMMARY_COLUMNS,
  type ProductFilters,
  type SummaryRow,
} from "../catalog/catalog-repo";
import { toSummary, type ProductSummary } from "../catalog/catalog-service";
import { matchReasons } from "./search-document";

export type SearchQuery = Omit<ProductFilters, "ids"> & { query: string; limit?: number };

export type SearchResult = ProductSummary & {
  score: number;
  matchReasons: string[];
  recommendedFor: string[];
  notRecommendedFor: string[];
  keyFeatures: string[];
};

export type SearchResponse = { items: SearchResult[]; mode: "semantic" | "keyword" };

type Row = SummaryRow & {
  score: string | number;
  recommended_for: string[];
  not_recommended_for: string[];
  key_features: string[];
};

const EXTRA = sql`p.recommended_for, p.not_recommended_for, p.key_features`;

function where(conds: SQL[]): SQL {
  return conds.length ? sql`where ${sql.join(conds, sql` and `)}` : sql``;
}

function toResult(query: string, r: Row): SearchResult {
  const base = {
    recommendedFor: r.recommended_for,
    notRecommendedFor: r.not_recommended_for,
    keyFeatures: r.key_features,
  };
  return { ...toSummary(r), ...base, score: Number(r.score), matchReasons: matchReasons(query, base) };
}

/**
 * Búsqueda en lenguaje natural (RF-02): similitud semántica (pgvector) + filtros estructurados en SQL.
 * Si el embedding de la consulta falla (sin key, cuota, red) cae a búsqueda por texto completo.
 */
export async function searchProducts(
  db: DB,
  q: SearchQuery,
  deps: { embedQuery: (text: string) => Promise<number[]> },
): Promise<SearchResponse> {
  const limit = Math.min(Math.max(q.limit ?? 8, 1), 20);
  const filters = productFilterConditions(q);

  let vector: number[] | null = null;
  try {
    vector = await deps.embedQuery(q.query);
  } catch {
    vector = null;
  }

  if (vector) {
    const v = JSON.stringify(vector);
    const rows = await db.execute<Row>(sql`
      select ${SUMMARY_COLUMNS}, 0 as total, ${EXTRA}, 1 - (e.embedding <=> ${v}::vector) as score
      from products p
      join prices pr on pr.product_id = p.id
      join product_embeddings e on e.product_id = p.id
      ${where(filters)}
      order by e.embedding <=> ${v}::vector
      limit ${limit}`);
    if (rows.length > 0) return { items: rows.map((r) => toResult(q.query, r)), mode: "semantic" };
  }

  // Fallback: texto completo (inglés) y, si no hay nada, coincidencia en nombre/marca/categoría.
  const fts = await db.execute<Row>(sql`
    select ${SUMMARY_COLUMNS}, 0 as total, ${EXTRA},
           ts_rank(p.search_tsv, websearch_to_tsquery('english', ${q.query})) as score
    from products p join prices pr on pr.product_id = p.id
    ${where([...filters, sql`p.search_tsv @@ websearch_to_tsquery('english', ${q.query})`])}
    order by score desc, p.id
    limit ${limit}`);
  if (fts.length > 0) return { items: fts.map((r) => toResult(q.query, r)), mode: "keyword" };

  const words = q.query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 3)
    .slice(0, 6);
  if (words.length === 0) return { items: [], mode: "keyword" };
  const like = sql.join(
    words.map((w) => sql`(p.name ilike ${`%${w}%`} or p.brand_name ilike ${`%${w}%`} or p.category ilike ${`%${w}%`})`),
    sql` or `,
  );
  const rows = await db.execute<Row>(sql`
    select ${SUMMARY_COLUMNS}, 0 as total, ${EXTRA}, 0 as score
    from products p join prices pr on pr.product_id = p.id
    ${where([...filters, sql`(${like})`])}
    order by p.id
    limit ${limit}`);
  return { items: rows.map((r) => toResult(q.query, r)), mode: "keyword" };
}
