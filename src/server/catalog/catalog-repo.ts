import { sql, type SQL } from "drizzle-orm";
import type { DB } from "@/db/client";

export type ProductFilters = {
  category?: string;
  brand?: string;
  maxPriceCents?: number;
  minPriceCents?: number;
  inStockOnly?: boolean;
  includeInactive?: boolean;
  ids?: string[];
};

export type SummaryRow = {
  id: string;
  name: string;
  brand_name: string;
  category: string;
  subcategory: string;
  short_description: string;
  image_url: string | null;
  active: boolean;
  rating: string | null;
  review_count: number | null;
  current_price: string;
  list_price: string;
  discount_percent: number;
  available_qty: string;
  total: string;
};

/** Condiciones SQL comunes a listado y búsqueda (alias: p = products, pr = prices). */
export function productFilterConditions(f: ProductFilters): SQL[] {
  const where: SQL[] = [];
  if (!f.includeInactive) where.push(sql`p.active`);
  if (f.category) where.push(sql`p.category = ${f.category}`);
  if (f.brand) where.push(sql`lower(p.brand_name) = lower(${f.brand})`);
  if (f.maxPriceCents != null) where.push(sql`pr.current_price <= ${f.maxPriceCents / 100}`);
  if (f.minPriceCents != null) where.push(sql`pr.current_price >= ${f.minPriceCents / 100}`);
  if (f.ids?.length) where.push(sql`p.id in ${f.ids}`);
  if (f.inStockOnly)
    where.push(sql`(select coalesce(sum(i2.available_qty),0) from inventory i2 where i2.product_id = p.id) > 0`);
  return where;
}

export const SUMMARY_COLUMNS = sql`
  p.id, p.name, p.brand_name, p.category, p.subcategory, p.short_description, p.image_url, p.active,
  p.rating, p.review_count, pr.current_price, pr.list_price, pr.discount_percent,
  (select coalesce(sum(i.available_qty),0) from inventory i where i.product_id = p.id) as available_qty`;

export async function selectSummaries(
  db: DB,
  f: ProductFilters,
  page: { limit: number; offset: number },
): Promise<SummaryRow[]> {
  const where = productFilterConditions(f);
  const whereSql = where.length ? sql`where ${sql.join(where, sql` and `)}` : sql``;
  return db.execute<SummaryRow>(sql`
    select ${SUMMARY_COLUMNS}, count(*) over() as total
    from products p join prices pr on pr.product_id = p.id
    ${whereSql}
    order by p.active desc, p.category, p.id
    limit ${page.limit} offset ${page.offset}`);
}

export async function selectProductRow(db: DB, id: string) {
  const rows = await db.execute<
    SummaryRow & {
      description: string;
      recommended_for: string[];
      not_recommended_for: string[];
      key_features: string[];
      tags: string[];
      warranty_months: number | null;
      return_days: number | null;
      color: string | null;
    }
  >(sql`
    select ${SUMMARY_COLUMNS}, 0 as total, p.description, p.recommended_for, p.not_recommended_for,
           p.key_features, p.tags, p.warranty_months, p.return_days, p.color
    from products p join prices pr on pr.product_id = p.id
    where p.id = ${id}`);
  return rows[0] ?? null;
}

export async function selectSpecs(db: DB, ids: string[]) {
  return db.execute<{
    product_id: string;
    attribute_group: string;
    attribute_name: string;
    value_text: string | null;
    value_number: string | null;
    unit: string | null;
  }>(sql`
    select product_id, attribute_group, attribute_name, value_text, value_number, unit
    from product_specs where product_id in ${ids} order by id`);
}

export async function selectStockByWarehouse(db: DB, id: string) {
  return db.execute<{
    warehouse_id: string;
    name: string;
    city: string;
    available_qty: number;
    pickup_enabled: boolean;
  }>(sql`
    select w.id as warehouse_id, w.name, w.city, coalesce(i.available_qty, 0) as available_qty, w.pickup_enabled
    from warehouses w left join inventory i on i.warehouse_id = w.id and i.product_id = ${id}
    order by w.id`);
}

export async function selectRelated(db: DB, id: string) {
  return db.execute<SummaryRow & { relation_type: string; strength: string }>(sql`
    select ${SUMMARY_COLUMNS}, 0 as total, r.relation_type, r.strength
    from product_relations r
    join products p on p.id = r.related_product_id
    join prices pr on pr.product_id = p.id
    where r.product_id = ${id} and p.active
    order by r.relation_type, r.strength desc`);
}
