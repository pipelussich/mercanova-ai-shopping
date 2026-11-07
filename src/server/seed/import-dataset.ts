import { sql } from "drizzle-orm";
import type { DB } from "../../db/client";
import { excelSerialToDate, readWorkbook, type SheetRow, type Workbook } from "./xlsx-reader";
import {
  brands,
  cartItems,
  categories,
  chatMessages,
  inventory,
  orderAllocations,
  orderItems,
  orders,
  prices,
  productRelations,
  productSpecs,
  products,
  warehouses,
} from "../../db/schema";

export type ImportSummary = {
  products: number;
  specs: number;
  prices: number;
  inventory: number;
  warehouses: number;
  relations: number;
  categories: number;
  brands: number;
};

type Row = SheetRow;
type Sheets = Workbook;

export const readDataset = readWorkbook;

const str = (v: unknown) => (v == null ? null : String(v).trim());
const reqStr = (v: unknown, field: string) => {
  const s = str(v);
  if (!s) throw new Error(`Dataset inválido: falta ${field}`);
  return s;
};
const num = (v: unknown) => (v == null ? null : Number(v));
const int = (v: unknown) => (v == null ? null : Math.trunc(Number(v)));
const bool = (v: unknown) => v === true || v === 1 || String(v).toLowerCase() === "true";
const list = (v: unknown) =>
  v == null
    ? []
    : String(v)
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean);
const toDate = (v: unknown) => (v == null ? null : typeof v === "number" ? excelSerialToDate(v) : new Date(String(v)));
const isoDay = (v: unknown) => toDate(v)?.toISOString().slice(0, 10) ?? null;

function sheet(sheets: Sheets, name: string): Row[] {
  const rows = sheets[name];
  if (!rows) throw new Error(`Dataset inválido: falta la hoja "${name}"`);
  return rows;
}

function inventoryRows(sheets: Sheets) {
  return sheet(sheets, "Inventory").map((r) => ({
    productId: reqStr(r.product_id, "Inventory.product_id"),
    warehouseId: reqStr(r.warehouse_id, "Inventory.warehouse_id"),
    onHandQty: int(r.on_hand_qty) ?? 0,
    reservedQty: int(r.reserved_qty) ?? 0,
    availableQty: int(r.available_qty) ?? 0,
    status: str(r.inventory_status) ?? "Out of stock",
    updatedAt: toDate(r.inventory_updated_at) ?? new Date(),
  }));
}

async function chunked<T>(rows: T[], size: number, fn: (chunk: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += size) await fn(rows.slice(i, i + size));
}

/** Importa (o actualiza) el catálogo completo del dataset. Idempotente. */
export async function importDataset(db: DB, xlsxPath: string): Promise<ImportSummary> {
  const sheets = await readDataset(xlsxPath);

  const brandRows = sheet(sheets, "Brands").map((r) => ({
    id: reqStr(r.brand_id, "Brands.brand_id"),
    name: reqStr(r.brand_name, "Brands.brand_name"),
    country: str(r.country_of_origin),
    positioning: str(r.positioning),
  }));
  const brandName = new Map(brandRows.map((b) => [b.id, b.name]));

  const categoryRows = sheet(sheets, "Categories").map((r) => ({
    subcategoryId: reqStr(r.subcategory_id, "Categories.subcategory_id"),
    categoryId: reqStr(r.category_id, "Categories.category_id"),
    categoryName: reqStr(r.category_name, "Categories.category_name"),
    subcategoryName: reqStr(r.subcategory_name, "Categories.subcategory_name"),
    department: str(r.department),
    sortOrder: int(r.sort_order),
  }));

  const productRows = sheet(sheets, "Products").map((r) => {
    const brandId = reqStr(r.brand_id, "Products.brand_id");
    return {
      id: reqStr(r.product_id, "Products.product_id"),
      sku: reqStr(r.sku, "Products.sku"),
      name: reqStr(r.name, "Products.name"),
      brandId,
      brandName: brandName.get(brandId) ?? reqStr(r.brand, "Products.brand"),
      category: reqStr(r.category, "Products.category"),
      subcategory: reqStr(r.subcategory, "Products.subcategory"),
      shortDescription: str(r.short_description) ?? "",
      description: str(r.description) ?? "",
      recommendedFor: list(r.recommended_for),
      notRecommendedFor: list(r.not_recommended_for),
      keyFeatures: list(r.key_features),
      tags: list(r.tags),
      color: str(r.color),
      weightKg: num(r.weight_kg),
      widthCm: num(r.width_cm),
      heightCm: num(r.height_cm),
      depthCm: num(r.depth_cm),
      warrantyMonths: int(r.warranty_months),
      returnDays: int(r.return_days),
      rating: num(r.rating),
      reviewCount: int(r.review_count),
      launchDate: isoDay(r.launch_date),
      active: bool(r.active),
      imageUrl: str(r.image_url),
    };
  });

  const specRows = sheet(sheets, "Specifications").map((r) => ({
    productId: reqStr(r.product_id, "Specifications.product_id"),
    attributeGroup: reqStr(r.attribute_group, "Specifications.attribute_group"),
    attributeName: reqStr(r.attribute_name, "Specifications.attribute_name"),
    valueText: str(r.value_text),
    valueNumber: num(r.value_number),
    unit: str(r.unit),
  }));

  const priceRows = sheet(sheets, "Pricing").map((r) => ({
    productId: reqStr(r.product_id, "Pricing.product_id"),
    currency: str(r.currency) ?? "USD",
    listPrice: Number(r.list_price).toFixed(2),
    currentPrice: Number(r.current_price).toFixed(2),
    discountPercent: int(r.discount_percent) ?? 0,
    taxIncluded: bool(r.tax_included),
    updatedAt: toDate(r.price_updated_at),
  }));

  const warehouseRows = sheet(sheets, "Warehouses").map((r) => ({
    id: reqStr(r.warehouse_id, "Warehouses.warehouse_id"),
    name: reqStr(r.warehouse_name, "Warehouses.warehouse_name"),
    city: reqStr(r.city, "Warehouses.city"),
    department: reqStr(r.department, "Warehouses.department"),
    country: reqStr(r.country, "Warehouses.country"),
    pickupEnabled: bool(r.pickup_enabled),
    shippingEnabled: bool(r.shipping_enabled),
  }));

  const relationRows = sheet(sheets, "Relations").map((r) => ({
    productId: reqStr(r.product_id, "Relations.product_id"),
    relatedProductId: reqStr(r.related_product_id, "Relations.related_product_id"),
    relationType: reqStr(r.relation_type, "Relations.relation_type"),
    strength: num(r.strength) ?? 0,
  }));

  const inv = inventoryRows(sheets);

  await db.transaction(async (tx) => {
    await tx
      .insert(brands)
      .values(brandRows)
      .onConflictDoUpdate({
        target: brands.id,
        set: { name: sql`excluded.name`, country: sql`excluded.country`, positioning: sql`excluded.positioning` },
      });
    await tx.insert(categories).values(categoryRows).onConflictDoNothing();
    await chunked(productRows, 100, (c) =>
      tx
        .insert(products)
        .values(c)
        .onConflictDoUpdate({
          target: products.id,
          set: Object.fromEntries(
            Object.keys(c[0])
              .filter((k) => k !== "id")
              .map((k) => [k, sql.raw(`excluded.${toSnake(k)}`)]),
          ),
        }),
    );
    // Specs y relaciones no tienen clave natural única: se reemplazan completas.
    await tx.delete(productSpecs);
    await chunked(specRows, 500, (c) => tx.insert(productSpecs).values(c));
    await chunked(priceRows, 200, (c) =>
      tx
        .insert(prices)
        .values(c)
        .onConflictDoUpdate({
          target: prices.productId,
          set: {
            currency: sql`excluded.currency`,
            listPrice: sql`excluded.list_price`,
            currentPrice: sql`excluded.current_price`,
            discountPercent: sql`excluded.discount_percent`,
            taxIncluded: sql`excluded.tax_included`,
            updatedAt: sql`excluded.updated_at`,
          },
        }),
    );
    await tx.insert(warehouses).values(warehouseRows).onConflictDoNothing();
    await chunked(inv, 500, (c) => tx.insert(inventory).values(c).onConflictDoNothing());
    await tx.delete(productRelations);
    await chunked(relationRows, 500, (c) => tx.insert(productRelations).values(c));
  });

  return {
    products: productRows.length,
    specs: specRows.length,
    prices: priceRows.length,
    inventory: inv.length,
    warehouses: warehouseRows.length,
    relations: relationRows.length,
    categories: categoryRows.length,
    brands: brandRows.length,
  };
}

/** Borra carritos, órdenes y chats y vuelve el inventario al estado del dataset. */
export async function resetOperationalState(db: DB, xlsxPath: string): Promise<void> {
  const inv = inventoryRows(await readDataset(xlsxPath));
  await db.transaction(async (tx) => {
    await tx.delete(orderAllocations);
    await tx.delete(orderItems);
    await tx.delete(orders);
    await tx.delete(cartItems);
    await tx.delete(chatMessages);
    await tx.delete(inventory);
    await chunked(inv, 500, (c) => tx.insert(inventory).values(c));
  });
}

function toSnake(k: string) {
  return k.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
}
