import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { toCatalogFilters, understandQuery, type ShoppingQuery } from "@/ai/query-understanding";

process.env.DATABASE_URL ??= "postgres://test";

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 20, text: 20, reasoning: undefined },
};

function jsonModel(obj: unknown) {
  return new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: "text", text: JSON.stringify(obj) }],
      finishReason: { unified: "stop", raw: undefined },
      usage,
      warnings: [],
    }),
  });
}

const parsed: ShoppingQuery = {
  searchText: "lightweight laptop for university",
  category: "Laptops",
  brand: null,
  minPriceUsd: null,
  maxPriceUsd: 900,
  inStockOnly: true,
  sortBy: "relevance",
};

describe("understandQuery (structured output)", () => {
  it("devuelve el objeto validado con el schema y pide JSON con temperatura 0", async () => {
    const model = jsonModel(parsed);
    const out = await understandQuery("notebook liviana para la facu hasta 900 dólares que esté en stock", {
      models: [model],
      cache: false,
    });
    expect(out).toEqual(parsed);
    const call = model.doGenerateCalls[0];
    expect(call.responseFormat?.type).toBe("json");
    expect(call.temperature).toBe(0);
  });

  it("si el modelo devuelve algo fuera del schema, devuelve null (la búsqueda sigue con el texto tal cual)", async () => {
    const out = await understandQuery("algo", { models: [jsonModel({ category: "Heladeras" })], cache: false });
    expect(out).toBeNull();
  });

  it("si el modelo se cuelga, corta por timeout y devuelve null", async () => {
    const hanging = new MockLanguageModelV4({
      doGenerate: ({ abortSignal }) =>
        new Promise((_, reject) => abortSignal?.addEventListener("abort", () => reject(abortSignal.reason))),
    });
    const t0 = Date.now();
    const out = await understandQuery("auriculares", { models: [hanging], timeoutMs: 100, cache: false });
    expect(out).toBeNull();
    expect(Date.now() - t0).toBeLessThan(3_000);
  });
});

describe("toCatalogFilters", () => {
  const brands = ["Lenovo", "Sony"];

  it("traduce el objeto a filtros del catálogo en centavos", () => {
    expect(toCatalogFilters(parsed, brands)).toEqual({
      query: "lightweight laptop for university",
      category: "Laptops",
      maxPriceCents: 90_000,
      inStockOnly: true,
      sortBy: "relevance",
    });
  });

  it("descarta marcas que no están en el catálogo y normaliza las que sí", () => {
    expect(toCatalogFilters({ ...parsed, brand: "Apple" }, brands).brand).toBeUndefined();
    expect(toCatalogFilters({ ...parsed, brand: "sony" }, brands).brand).toBe("Sony");
  });

  it("ignora un mínimo mayor al máximo", () => {
    const f = toCatalogFilters({ ...parsed, minPriceUsd: 1000, maxPriceUsd: 500 }, brands);
    expect(f.minPriceCents).toBeUndefined();
    expect(f.maxPriceCents).toBe(50_000);
  });
});
