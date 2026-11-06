import { sql } from "drizzle-orm";
import type { DB } from "@/db/client";
import { DomainError } from "@/domain/errors";
import { toCents } from "@/domain/money";
import { stockStatus, type StockStatus } from "@/domain/stock";
import {
  selectProductRow,
  selectRelated,
  selectSpecs,
  selectStockByWarehouse,
  selectSummaries,
  type ProductFilters,
  type SummaryRow,
} from "./catalog-repo";

export type { ProductFilters } from "./catalog-repo";

export type ProductSummary = {
  id: string;
  name: string;
  brand: string;
  category: string;
  subcategory: string;
  shortDescription: string;
  imageUrl: string | null;
  active: boolean;
  priceCents: number;
  listPriceCents: number;
  discountPercent: number;
  rating: number | null;
  reviewCount: number | null;
  availableQty: number;
  stockStatus: StockStatus;
};

export type ProductSpec = { group: string; name: string; value: string };

export type RelationType = "alternative_to" | "accessory_for" | "often_bought_with";

export type ProductDetail = ProductSummary & {
  description: string;
  recommendedFor: string[];
  notRecommendedFor: string[];
  keyFeatures: string[];
  tags: string[];
  warrantyMonths: number | null;
  returnDays: number | null;
  color: string | null;
  specs: ProductSpec[];
  stockByWarehouse: {
    warehouseId: string;
    warehouseName: string;
    city: string;
    availableQty: number;
    pickupEnabled: boolean;
  }[];
  related: { relationType: RelationType; strength: number; product: ProductSummary }[];
};

export function toSummary(r: SummaryRow): ProductSummary {
  const available = Number(r.available_qty);
  return {
    id: r.id,
    name: r.name,
    brand: r.brand_name,
    category: r.category,
    subcategory: r.subcategory,
    shortDescription: r.short_description,
    imageUrl: r.image_url,
    active: r.active,
    priceCents: toCents(r.current_price),
    listPriceCents: toCents(r.list_price),
    discountPercent: r.discount_percent,
    rating: r.rating == null ? null : Number(r.rating),
    reviewCount: r.review_count,
    availableQty: available,
    stockStatus: stockStatus(available),
  };
}

function specValue(s: { value_text: string | null; value_number: string | null; unit: string | null }): string {
  if (s.value_text) return s.value_text;
  if (s.value_number == null) return "";
  return `${Number(s.value_number)} ${s.unit ?? ""}`.trim();
}

export async function listProducts(
  db: DB,
  f: ProductFilters & { page?: number; pageSize?: number } = {},
): Promise<{ items: ProductSummary[]; total: number }> {
  const pageSize = Math.min(Math.max(f.pageSize ?? 24, 1), 400);
  const page = Math.max(f.page ?? 1, 1);
  const rows = await selectSummaries(db, f, { limit: pageSize, offset: (page - 1) * pageSize });
  return { items: rows.map(toSummary), total: rows.length ? Number(rows[0].total) : 0 };
}

export async function getProduct(db: DB, id: string): Promise<ProductDetail | null> {
  const row = await selectProductRow(db, id);
  if (!row) return null;
  const [specs, stock, related] = await Promise.all([
    selectSpecs(db, [id]),
    selectStockByWarehouse(db, id),
    selectRelated(db, id),
  ]);
  return {
    ...toSummary(row),
    description: row.description,
    recommendedFor: row.recommended_for,
    notRecommendedFor: row.not_recommended_for,
    keyFeatures: row.key_features,
    tags: row.tags,
    warrantyMonths: row.warranty_months,
    returnDays: row.return_days,
    color: row.color,
    specs: specs.map((s) => ({ group: s.attribute_group, name: s.attribute_name, value: specValue(s) })),
    stockByWarehouse: stock.map((w) => ({
      warehouseId: w.warehouse_id,
      warehouseName: w.name,
      city: w.city,
      availableQty: Number(w.available_qty),
      pickupEnabled: w.pickup_enabled,
    })),
    related: related.map((r) => ({
      relationType: r.relation_type as RelationType,
      strength: Number(r.strength),
      product: toSummary(r),
    })),
  };
}

export type Comparison = {
  products: ProductDetail[];
  rows: { group: string; name: string; values: (string | null)[] }[];
};

export async function compareProducts(db: DB, ids: string[]): Promise<Comparison> {
  const unique = [...new Set(ids)];
  if (unique.length < 2 || unique.length > 4)
    throw new DomainError("INVALID_QUANTITY", "Podés comparar entre 2 y 4 productos.");
  const products = await Promise.all(unique.map((id) => getProduct(db, id)));
  const missing = unique.filter((_, i) => !products[i]);
  if (missing.length)
    throw new DomainError("PRODUCT_NOT_FOUND", `No encontramos: ${missing.join(", ")}.`, { missing });
  const found = products as ProductDetail[];

  const keys: { group: string; name: string }[] = [];
  const seen = new Set<string>();
  for (const p of found)
    for (const s of p.specs) {
      const k = `${s.group}\u0000${s.name}`;
      if (!seen.has(k)) {
        seen.add(k);
        keys.push({ group: s.group, name: s.name });
      }
    }
  const rows = keys.map((k) => ({
    ...k,
    values: found.map((p) => p.specs.find((s) => s.group === k.group && s.name === k.name)?.value ?? null),
  }));
  return { products: found, rows };
}

export async function listCategories(db: DB): Promise<{ name: string; count: number }[]> {
  const rows = await db.execute<{ category: string; n: string }>(sql`
    select category, count(*) as n from products where active group by category order by category`);
  return rows.map((r) => ({ name: r.category, count: Number(r.n) }));
}

export async function listBrands(db: DB): Promise<string[]> {
  const rows = await db.execute<{ name: string }>(sql`select name from brands order by name`);
  return rows.map((r) => r.name);
}

export async function listWarehouses(db: DB) {
  return db.execute<{ id: string; name: string; city: string; department: string; pickup_enabled: boolean }>(sql`
    select id, name, city, department, pickup_enabled from warehouses order by id`);
}
