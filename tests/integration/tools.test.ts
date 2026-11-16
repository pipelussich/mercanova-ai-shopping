import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createDb } from "@/db/client";
import { buildTools, type AssistantTools } from "@/ai/tools";
import { resetOperationalState } from "@/server/seed/import-dataset";
import { firstOutOfStockProductId } from "./fixtures";
import { DATASET_PATH, testDatabaseUrl } from "./helpers";

const { db, close } = createDb(testDatabaseUrl());
const failingEmbed = async () => {
  throw new Error("sin embeddings en test");
};

let session: string;
let tools: AssistantTools;

beforeEach(async () => {
  await resetOperationalState(db, DATASET_PATH);
  session = randomUUID();
  tools = buildTools({ db, sessionId: session, embedQuery: failingEmbed });
});
afterAll(async () => close());

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- ejecutar tools directo en tests
const run = async (name: keyof AssistantTools, input: any) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (tools[name] as any).execute(input, { toolCallId: "t", messages: [] });

describe("tools del asistente", () => {
  it("expone exactamente las tools previstas y ninguna para comprar", () => {
    expect(Object.keys(tools).sort()).toEqual(
      [
        "add_to_cart",
        "compare_products",
        "get_cart",
        "get_orders",
        "get_product_details",
        "get_related_products",
        "propose_checkout",
        "remove_from_cart",
        "search_products",
        "update_cart_item",
      ].sort(),
    );
  });

  it("search_products respeta el presupuesto y devuelve precios en USD", async () => {
    const r = await run("search_products", { query: "headphones", maxPriceUsd: 200 });
    expect(r.results.length).toBeGreaterThan(0);
    for (const p of r.results) expect(p.priceUsd).toBeLessThanOrEqual(200);
    expect(typeof r.results[0].priceUsd).toBe("number");
    expect(r.results[0]).toHaveProperty("recommendedFor");
  });

  it("search_products puede ordenar por precio para encontrar el más barato", async () => {
    const r = await run("search_products", {
      query: "mouse",
      category: "Mice",
      inStockOnly: true,
      sortBy: "price_asc",
    });
    const prices = r.results.map((p: { priceUsd: number }) => p.priceUsd);
    expect(prices).toEqual([...prices].sort((a: number, b: number) => a - b));
    expect(r.sortBy).toBe("price_asc");
  });

  it("search_products acepta un pedido sin query (\"el teclado más barato\") y ordena por precio", async () => {
    const input = { category: "Keyboards", sortBy: "price_asc" };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- el schema que valida lo que manda el modelo
    expect((tools.search_products.inputSchema as any).safeParse(input).success).toBe(true);
    const r = await run("search_products", input);
    expect(r.results.length).toBeGreaterThan(0);
    expect(r.results.every((p: { category: string }) => p.category === "Keyboards")).toBe(true);
    const prices = r.results.map((p: { priceUsd: number }) => p.priceUsd);
    expect(prices).toEqual([...prices].sort((a: number, b: number) => a - b));
  });

  it("search_products avisa cuando no hay resultados", async () => {
    const r = await run("search_products", { query: "zzzqqq" });
    expect(r).toMatchObject({ results: [], note: "NO_RESULTS" });
  });

  it("get_product_details devuelve el estado actual o un error explícito", async () => {
    const ok = await run("get_product_details", { productId: "MN-MON-0001" });
    expect(ok).toMatchObject({ id: "MN-MON-0001", priceUsd: 468.62, availableQty: 35 });
    expect(ok.specs.length).toBeGreaterThan(0);
    expect(await run("get_product_details", { productId: "NOPE" })).toEqual({ error: "PRODUCT_NOT_FOUND" });
  });

  it("compare_products alinea specs y devuelve error con ids inválidos", async () => {
    const ok = await run("compare_products", { productIds: ["MN-MON-0001", "MN-MON-0002"] });
    expect(ok.products.map((p: { priceUsd: number }) => p.priceUsd)).toEqual([468.62, 574.27]);
    const bad = await run("compare_products", { productIds: ["MN-MON-0001", "NOPE"] });
    expect(bad).toMatchObject({ error: "PRODUCT_NOT_FOUND" });
  });

  it("get_related_products ofrece alternativas activas para un producto sin stock", async () => {
    const id = await firstOutOfStockProductId(db);
    const r = await run("get_related_products", { productId: id, relationType: "alternative_to" });
    expect(r.related.length).toBeGreaterThan(0);
    for (const x of r.related) expect(x.relationType).toBe("alternative_to");
  });

  it("add_to_cart devuelve el error de dominio como dato, sin lanzar", async () => {
    const r = await run("add_to_cart", { productId: "MN-MON-0001", quantity: 99 });
    expect(r).toMatchObject({ ok: false, error: "INSUFFICIENT_STOCK" });
    expect(r.message).toMatch(/35/);
  });

  it("add_to_cart / update_cart_item / remove_from_cart informan la cantidad anterior", async () => {
    const add = await run("add_to_cart", { productId: "MN-MON-0001", quantity: 1 });
    expect(add).toMatchObject({ ok: true, action: "add", previousQuantity: 0, quantity: 1 });
    expect(add.productName).toBe("Flux Vision 24 QHD IPS");
    const upd = await run("update_cart_item", { productId: "MN-MON-0001", quantity: 3 });
    expect(upd).toMatchObject({ ok: true, previousQuantity: 1, quantity: 3 });
    const cart = await run("get_cart", {});
    expect(cart).toMatchObject({ totalUsd: 1405.86, itemCount: 3 });
    const rm = await run("remove_from_cart", { productId: "MN-MON-0001" });
    expect(rm).toMatchObject({ ok: true, previousQuantity: 3, quantity: 0 });
  });

  it("propose_checkout no compra: sólo indica si se puede ir al checkout", async () => {
    expect(await run("propose_checkout", {})).toMatchObject({ ready: false, checkoutUrl: "/checkout" });
    await run("add_to_cart", { productId: "MN-MON-0001", quantity: 1 });
    expect(await run("propose_checkout", {})).toMatchObject({ ready: true, issues: [] });
    expect(await run("get_orders", {})).toEqual({ orders: [] });
  });
});
