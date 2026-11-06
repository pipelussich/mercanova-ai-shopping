import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb } from "@/db/client";
import { DomainError } from "@/domain/errors";
import { compareProducts, getProduct, listCategories, listProducts } from "@/server/catalog/catalog-service";
import { resetOperationalState } from "@/server/seed/import-dataset";
import { readWorkbook } from "@/server/seed/xlsx-reader";
import { DATASET_PATH, testDatabaseUrl } from "./helpers";

const { db, close } = createDb(testDatabaseUrl());

beforeAll(async () => resetOperationalState(db, DATASET_PATH));
afterAll(async () => close());

describe("listProducts", () => {
  it("lista una categoría sin incluir discontinuados por defecto", async () => {
    const { items, total } = await listProducts(db, { category: "Headphones", pageSize: 100 });
    expect(items.every((p) => p.category === "Headphones" && p.active)).toBe(true);
    expect(total).toBe(items.length);
    const all = await listProducts(db, { category: "Headphones", includeInactive: true, pageSize: 100 });
    expect(all.total).toBe(30);
    expect(all.total).toBeGreaterThanOrEqual(total);
  });

  it("filtra por precio máximo", async () => {
    const { items } = await listProducts(db, { maxPriceCents: 20000, pageSize: 100 });
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((p) => p.priceCents <= 20000)).toBe(true);
  });

  it("filtra sólo productos con stock", async () => {
    const { items } = await listProducts(db, { inStockOnly: true, pageSize: 400 });
    expect(items.every((p) => p.availableQty > 0)).toBe(true);
  });

  it("pagina de a 24 por defecto", async () => {
    const page1 = await listProducts(db, {});
    const page2 = await listProducts(db, { page: 2 });
    expect(page1.items).toHaveLength(24);
    expect(page2.items[0].id).not.toBe(page1.items[0].id);
    expect(page1.total).toBe(343);
  });
});

describe("getProduct", () => {
  it("suma la disponibilidad de todos los depósitos", async () => {
    const wb = await readWorkbook(DATASET_PATH);
    const expected = wb.Inventory.filter((r) => r.product_id === "MN-MON-0001").reduce(
      (s, r) => s + Number(r.available_qty),
      0,
    );
    const p = await getProduct(db, "MN-MON-0001");
    expect(p?.availableQty).toBe(expected);
    expect(p?.stockByWarehouse).toHaveLength(5);
    expect(p?.priceCents).toBe(46862);
    expect(p?.recommendedFor).toContain("programming");
    expect(p?.specs.find((s) => s.name === "Refresh Rate")?.value).toBe("240 Hz");
    expect(p?.related.length).toBeGreaterThan(0);
  });

  it("devuelve null si no existe", async () => {
    expect(await getProduct(db, "NOPE")).toBeNull();
  });
});

describe("compareProducts", () => {
  it("alinea las specs de los productos comparados", async () => {
    const r = await compareProducts(db, ["MN-MON-0001", "MN-MON-0002"]);
    expect(r.products.map((p) => p.id)).toEqual(["MN-MON-0001", "MN-MON-0002"]);
    const refresh = r.rows.find((row) => row.name === "Refresh Rate");
    expect(refresh?.values).toEqual(["240 Hz", "60 Hz"]);
  });

  it("exige entre 2 y 4 productos", async () => {
    await expect(compareProducts(db, ["MN-MON-0001"])).rejects.toBeInstanceOf(DomainError);
    await expect(
      compareProducts(db, ["MN-MON-0001", "MN-MON-0002", "MN-MON-0003", "MN-MON-0004", "MN-MON-0005"]),
    ).rejects.toMatchObject({ code: "INVALID_QUANTITY" });
  });

  it("falla con un id inexistente", async () => {
    await expect(compareProducts(db, ["MN-MON-0001", "NOPE"])).rejects.toMatchObject({ code: "PRODUCT_NOT_FOUND" });
  });
});

describe("listCategories", () => {
  it("devuelve las 12 categorías", async () => {
    expect(await listCategories(db)).toHaveLength(12);
  });
});
