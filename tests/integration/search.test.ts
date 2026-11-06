import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { createDb } from "@/db/client";
import { searchProducts } from "@/server/search/search-service";
import { resetOperationalState } from "@/server/seed/import-dataset";
import { firstInactiveProductId } from "./fixtures";
import { DATASET_PATH, testDatabaseUrl } from "./helpers";

const { db, close } = createDb(testDatabaseUrl());
const DIM = 768;
const TARGET = "MN-HDP-0002"; // Orbit Sound 458 — USD 71,31

/** Vector base i (1 en la posición i): ortogonal a los demás → similitud coseno controlada. */
const basis = (i: number) => Array.from({ length: DIM }, (_, k) => (k === i ? 1 : 0));
const fakeEmbed = async () => basis(0);

beforeAll(async () => {
  await resetOperationalState(db, DATASET_PATH);
  // Todos los productos con vectores "lejanos" salvo el objetivo, que coincide exactamente con la consulta.
  const ids = await db.execute<{ id: string }>(sql`select id from products order by id`);
  for (const [n, { id }] of ids.entries()) {
    const v = id === TARGET ? basis(0) : basis(1 + (n % (DIM - 1)));
    await db.execute(sql`
      insert into product_embeddings (product_id, content_hash, embedding)
      values (${id}, 'test', ${JSON.stringify(v)}::vector)
      on conflict (product_id) do update set embedding = excluded.embedding`);
  }
});

afterAll(async () => {
  await db.execute(sql`delete from product_embeddings`);
  await close();
});

describe("searchProducts (semántica)", () => {
  it("ordena por similitud con la consulta", async () => {
    const r = await searchProducts(db, { query: "auriculares cómodos" }, { embedQuery: fakeEmbed });
    expect(r.mode).toBe("semantic");
    expect(r.items[0].id).toBe(TARGET);
    expect(r.items[0].score).toBeCloseTo(1, 5);
    expect(r.items.length).toBeLessThanOrEqual(8);
  });

  it("respeta el precio máximo y la categoría", async () => {
    const r = await searchProducts(
      db,
      { query: "x", maxPriceCents: 10000, category: "Mice", limit: 20 },
      { embedQuery: fakeEmbed },
    );
    expect(r.items.length).toBeGreaterThan(0);
    expect(r.items.every((p) => p.priceCents <= 10000 && p.category === "Mice")).toBe(true);
  });

  it("filtra sólo con stock", async () => {
    const r = await searchProducts(db, { query: "x", inStockOnly: true, limit: 20 }, { embedQuery: fakeEmbed });
    expect(r.items.every((p) => p.availableQty > 0)).toBe(true);
  });

  it("excluye discontinuados por defecto", async () => {
    const inactive = await firstInactiveProductId(db);
    const r = await searchProducts(db, { query: "x", limit: 20 }, { embedQuery: fakeEmbed });
    expect(r.items.some((p) => p.id === inactive)).toBe(false);
    expect(r.items.every((p) => p.active)).toBe(true);
  });

  it("explica coincidencias con los usos recomendados", async () => {
    const r = await searchProducts(db, { query: "headphones for calls and music" }, { embedQuery: fakeEmbed });
    expect(Array.isArray(r.items[0].matchReasons)).toBe(true);
  });
});

describe("searchProducts (fallback por palabras clave)", () => {
  const failing = async () => {
    throw new Error("Gemini caído");
  };

  it("usa búsqueda por texto si los embeddings fallan", async () => {
    const r = await searchProducts(db, { query: "wireless headphones" }, { embedQuery: failing });
    expect(r.mode).toBe("keyword");
    expect(r.items.length).toBeGreaterThan(0);
    expect(r.items.some((p) => p.category === "Headphones")).toBe(true);
  });

  it("encuentra por nombre de marca aunque la consulta no sea inglés", async () => {
    const r = await searchProducts(db, { query: "orbit" }, { embedQuery: failing });
    expect(r.items.some((p) => p.brand === "Orbit")).toBe(true);
  });

  it("devuelve lista vacía si no hay coincidencias", async () => {
    const r = await searchProducts(db, { query: "zzzqqq inexistente" }, { embedQuery: failing });
    expect(r.items).toEqual([]);
  });
});
