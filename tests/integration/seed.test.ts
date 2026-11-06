import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { createDb } from "@/db/client";
import { importDataset, resetOperationalState } from "@/server/seed/import-dataset";
import { DATASET_PATH, testDatabaseUrl } from "./helpers";

const { db, close } = createDb(testDatabaseUrl());

const count = async (table: string) =>
  Number((await db.execute<{ n: string }>(sql.raw(`select count(*) as n from ${table}`)))[0].n);

afterAll(async () => close());

describe("importDataset", () => {
  let summary: Awaited<ReturnType<typeof importDataset>>;

  beforeAll(async () => {
    summary = await importDataset(db, DATASET_PATH);
  });

  it("importa todas las hojas del dataset", () => {
    expect(summary).toEqual({
      products: 360,
      specs: 3000,
      prices: 360,
      inventory: 1800,
      warehouses: 5,
      relations: 1080,
      categories: 37,
      brands: 20,
    });
  });

  it("es idempotente", async () => {
    await importDataset(db, DATASET_PATH);
    expect(await count("products")).toBe(360);
    expect(await count("product_specs")).toBe(3000);
    expect(await count("inventory")).toBe(1800);
    expect(await count("product_relations")).toBe(1080);
  });

  it("separa listas y guarda precios", async () => {
    const [row] = await db.execute<{ recommended_for: string[]; current_price: string }>(sql`
      select p.recommended_for, pr.current_price
      from products p join prices pr on pr.product_id = p.id where p.id = 'MN-MON-0001'`);
    expect(row.recommended_for).toEqual(["office work", "programming", "multitasking", "gaming", "content creation"]);
    expect(Number(row.current_price)).toBe(468.62);
  });

  it("conserva los productos inactivos", async () => {
    const [row] = await db.execute<{ n: string }>(sql`select count(*) as n from products where not active`);
    expect(Number(row.n)).toBe(17);
  });
});

describe("resetOperationalState", () => {
  it("restaura el inventario del dataset", async () => {
    await db.execute(sql`
      update inventory set available_qty = 0, on_hand_qty = 0
      where product_id = 'MN-MON-0001' and warehouse_id = 'WH-MVD-CEN'`);
    await resetOperationalState(db, DATASET_PATH);
    const [row] = await db.execute<{ available_qty: number }>(sql`
      select available_qty from inventory where product_id = 'MN-MON-0001' and warehouse_id = 'WH-MVD-CEN'`);
    expect(row.available_qty).toBe(7);
  });
});
